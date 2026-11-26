import {createHash} from 'node:crypto';
import {lstatSync, readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {crc32} from 'node:zlib';
import {checkPublicFiles} from './privacy.mjs';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const names = ['cyber-qican','article-workflow'];
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

export function skillFiles() {
  const files = new Map();
  for (const rel of allowedFiles.filter(path => path.startsWith('skills/'))) {
    const file = join(root,rel);
    if (!lstatSync(file).isFile()) throw new Error(`Skill 文件缺失或不安全 ${rel}`);
    files.set(rel,readFileSync(file));
  }
  checkPublicFiles(files);
  for (const name of names) {
    const body = files.get(`skills/${name}/SKILL.md`)?.toString('utf8');
    if (!body?.startsWith(`---\nname: ${name}\ndescription: `) || !body.split('\n---\n')[1]?.trim()) {
      throw new Error(`Skill 名称或入口无效 ${name}`);
    }
  }
  if (!files.get(mirror)?.toString('utf8').includes('\nmirror_version: ')) throw new Error('共用规则镜像缺失');
  return files;
}

function readBody(raw) {
  return raw.replace(/^---\n[\s\S]*?\n---\n/,'').trim();
}

export function singleFile(files) {
  const text = rel => files.get(`skills/cyber-qican/${rel}`).toString('utf8');
  const embedded = new Map([
    ['references/confirmed-rules-mirror.md','本文件的「正式规则镜像」'],
    ['references/reasoning.md','本文件的「思考时如何选用规则」'],
    ['references/examples.md','本文件的「思考示例」'],
    ['references/public-perspectives.md','本文件的「按需研究祈蚕的公开观点」'],
  ]);
  let body = readBody(text('SKILL.md'));
  for (const [file,label] of embedded) body = body.replaceAll('\x60'+file+'\x60',label);
  body = body
    .replace('转入同插件 `article-workflow`','向用户交付可转交文章流程的文字材料')
    .replace('两 Skill 共用镜像，按创作阶段选择专用规则。','有创作需求时，按阶段选用下文 G–I 的文章方法。');
  const sections = [...embedded].map(([file]) => readBody(text(file))
    .replace(/^# .*$/m, header => file.endsWith('examples.md') ? '## 思考示例（虚构）' : '#' + header)
    .replaceAll('`confirmed-rules-mirror.md`','「正式规则镜像」')
    .replaceAll('继续使用 A—F，并按需要读取 G— I','继续使用 A—F，并按需要使用本文件中的 G—I'));
  const version = /^mirror_version:\s*(.+)$/m.exec(text('references/confirmed-rules-mirror.md'))?.[1];
  return Buffer.from(
    `<!-- 由公开源码生成 · 发行 ${manifest.version} · 方法镜像 ${version} -->\n`
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
  skillFiles();
  checkPublicFiles(files);
  const portable = JSON.parse(files.get('plugin.json'));
  const legacy = JSON.parse(files.get('.codex-plugin/plugin.json'));
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
  const pluginArchive = new Map([...skills, ...['LICENSE','plugin.json','.codex-plugin/plugin.json'].map(path=>[path,files.get(path)])]);
  checkPublicFiles(pluginArchive);
  const result = new Map([
    ['cyber-qican.md',standalone],
    ['qican-article-system-skills.zip',zip(skillArchive)],
    ['qican-article-system-plugin.zip',zip(new Map([...pluginArchive].map(([path,bytes])=>[`${manifest.name}/${path}`,bytes])))],
  ]);
  result.set('SHA256SUMS',Buffer.from([...result].map(([path,bytes])=>`${sha256(bytes)}  ${path}\n`).join('')));
  return result;
}
