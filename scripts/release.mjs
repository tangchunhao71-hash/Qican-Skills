import {createHash} from 'node:crypto';
import {lstatSync, readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {crc32} from 'node:zlib';
import {checkPublicFiles} from './privacy.mjs';

export const root = fileURLToPath(new URL('../', import.meta.url));
const catalog = JSON.parse(readFileSync(join(root,'skills.json'),'utf8'));
export const dependencies = new Map();
for (const {name,requires} of catalog) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || dependencies.has(name) ||
      !Array.isArray(requires) || new Set(requires).size !== requires.length) {
    throw new Error(`无效或重复的 Skill 目录项 ${name}`);
  }
  dependencies.set(name,requires);
}
export const names = [...dependencies.keys()];

export function resolveSelection(requested, graph=dependencies) {
  const resolved = new Set();
  const visiting = new Set();
  function visit(name) {
    if (resolved.has(name)) return;
    if (!graph.has(name)) throw new Error(`未知 Skill ${name}`);
    if (visiting.has(name)) throw new Error(`循环依赖 ${name}`);
    visiting.add(name);
    for (const required of graph.get(name)) visit(required);
    visiting.delete(name);
    resolved.add(name);
  }
  for (const name of requested) visit(name);
  return [...resolved];
}
resolveSelection(names);
export const allowedFiles = JSON.parse(readFileSync(join(root,'scripts/release-files.json'),'utf8'));
export const manifest = JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
export const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');
const mirror = 'skills/cyber-qican/references/confirmed-rules-mirror.md';

export function acceptedFiles() {
  return new Map(allowedFiles.map(rel => {
    const file = join(root, rel);
    if (!lstatSync(file).isFile()) throw new Error(`只允许普通文件 ${rel}`);
    return [rel, readFileSync(file)];
  }));
}

export function releaseTree(directory = root, prefix = '') {
  return readdirSync(directory, {withFileTypes:true}).flatMap(entry => {
    if (!prefix && ['.git','dist','node_modules'].includes(entry.name)) return [];
    const rel = prefix + entry.name;
    if (entry.isDirectory()) return releaseTree(join(directory,entry.name), rel + '/');
    if (!entry.isFile()) throw new Error(`禁止特殊文件 ${rel}`);
    return [rel];
  });
}

export function skillFiles(requested=names) {
  const selected = resolveSelection(requested);
  const files = new Map();
  for (const rel of allowedFiles.filter(path=>path.startsWith('skills/'))) {
    const name = rel.split('/')[1];
    if (!dependencies.has(name)) throw new Error(`未登记的 Skill ${name}`);
    if (!selected.includes(name)) continue;
    const file = join(root,rel);
    if (!lstatSync(file).isFile()) throw new Error(`Skill 文件缺失或不安全 ${rel}`);
    files.set(rel,readFileSync(file));
  }
  checkPublicFiles(files);
  for (const name of selected) {
    const body = files.get(`skills/${name}/SKILL.md`)?.toString('utf8').replaceAll('\r\n','\n');
    if (!body?.startsWith(`---\nname: ${name}\ndescription: `) || !body.split('\n---\n')[1]?.trim()) {
      throw new Error(`Skill 名称或入口无效 ${name}`);
    }
  }
  if (selected.includes('cyber-qican') && !files.get(mirror)?.toString('utf8').includes('\nmirror_version: ')) throw new Error('共用规则镜像缺失');
  return files;
}

function readBody(raw) {
  return raw.replace(/^---\n[\s\S]*?\n---\n/,'').trim();
}

export function singleFile(files) {
  const text = rel => files.get(`skills/cyber-qican/${rel}`).toString('utf8').replaceAll('\r\n','\n');
  const embedded = new Map([
    ['references/reasoning.md','本文件的「判断遇到困难时」'],
    ['references/examples.md','本文件的「判断依据与例子」'],
    ['references/public-perspectives.md','本文件的「按需研究祈蚕的公开观点」'],
  ]);
  let body = readBody(text('SKILL.md'));
  for (const [file,label] of embedded) body = body.replaceAll('\x60'+file+'\x60',label);
  body = body.replace('转入同插件 `article-workflow`','交付可转交文章流程的文字材料');
  const sections = [...embedded.keys()].map(file => readBody(text(file)).replace(/^# /m,'## '));
  return Buffer.from(
    `<!-- 由公开源码生成 · 发行 ${manifest.version} -->\n`
    + '把本文件全文交给 AI，再讲你的问题。文中的方法、导航和例子均已附在这里。\n\n'
    + [body,...sections].join('\n\n---\n\n')+'\n'
  );
}

// Store UTF-8 text entries without compression. Stable dates make releases reproducible.
export function zip(entries) {
  const blocks = [];
  const directory = [];
  let offset = 0;
  for (const [filename,bytes] of [...entries].sort(([a],[b])=>a<b?-1:a>b?1:0)) {
    const name = Buffer.from(filename);
    const crc = crc32(bytes);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20,4);
    local.writeUInt16LE(0x800,6);
    local.writeUInt16LE(0x21,12);
    local.writeUInt32LE(crc,14);
    local.writeUInt32LE(bytes.length,18);
    local.writeUInt32LE(bytes.length,22);
    local.writeUInt16LE(name.length,26);
    blocks.push(local,name,bytes);

    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50);
    record.writeUInt16LE(0x314,4);
    local.copy(record,6,4);
    record.writeUInt32LE(0o100644 * 65536,38);
    record.writeUInt32LE(offset,42);
    directory.push(record,name);
    offset += local.length + name.length + bytes.length;
  }
  const central = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.size,8);
  end.writeUInt16LE(entries.size,10);
  end.writeUInt32LE(central.length,12);
  end.writeUInt32LE(offset,16);
  return Buffer.concat([...blocks,central,end]);
}

export function artifacts() {
  const files = acceptedFiles();
  for (const name of names) skillFiles([name]);
  checkPublicFiles(files);
  const portable = JSON.parse(files.get('plugin.json'));
  const legacy = JSON.parse(files.get('.codex-plugin/plugin.json'));
  const marketplace = JSON.parse(files.get('.agents/plugins/marketplace.json'));
  if (marketplace.name !== manifest.name || marketplace.plugins?.length !== 1 ||
      marketplace.plugins[0].name !== manifest.name || marketplace.plugins[0].source?.path !== './' ||
      manifest.bin?.[manifest.name] !== 'bin/install.js') {
    throw new Error('目录或 CLI 标识不一致');
  }
  if (portable.version !== manifest.version || legacy.version !== manifest.version ||
      portable.name !== manifest.name || legacy.name !== manifest.name ||
      portable.$schema !== 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json' ||
      JSON.stringify(portable.extensions['com.openai'].interface) !== JSON.stringify(legacy.interface)) {
    throw new Error('插件版本、标识或界面元数据不一致');
  }
  const skills = new Map([...files].filter(([path]) => path.startsWith('skills/')));
  const standalone = singleFile(skills);
  checkPublicFiles(new Map([['cyber-qican.md',standalone]]));
  if (/references\/|\.\.\//.test(standalone.toString('utf8'))) throw new Error('单文件仍有相对依赖');
  const skillArchive = new Map([...skills].map(([path,bytes])=>[path.slice(7),bytes]));
  skillArchive.set('LICENSE',files.get('LICENSE'));
  checkPublicFiles(skillArchive);
  const pluginArchive = new Map([...skills, ...['LICENSE','plugin.json','.codex-plugin/plugin.json','skills.json'].map(path=>[path,files.get(path)])]);
  checkPublicFiles(pluginArchive);
  const result = new Map([
    ['cyber-qican.md',standalone],
    ['qican-skills-skills.zip',zip(skillArchive)],
    ['qican-skills-plugin.zip',zip(new Map([...pluginArchive].map(([path,bytes])=>[`${manifest.name}/${path}`,bytes])))],
  ]);
  result.set('SHA256SUMS',Buffer.from([...result].map(([path,bytes])=>`${sha256(bytes)}  ${path}\n`).join('')));
  return result;
}
