#!/usr/bin/env node
import {existsSync,lstatSync,mkdirSync,mkdtempSync,readFileSync,realpathSync,renameSync,rmSync,rmdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {homedir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {createInterface} from 'node:readline/promises';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {manifest,names,resolveSelection,sha256,skillFiles} from '../scripts/release.mjs';

const receiptName = '.qican-release.json';
const legacySkills = new Set(['cyber-qican','article-workflow']);
const startPage = `https://github.com/tangchunhao71-hash/Qican-Skills/blob/v${manifest.version}/START.md`;

function stat(path) {
  try { return lstatSync(path); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return null;
  }
}

export function hostTargets(home) {
  return [
    {id:'codex',label:'Codex / Agents',parent:join(home,'.agents')},
    {id:'claude-code',label:'Claude Code',parent:join(home,'.claude')},
    {id:'cursor',label:'Cursor',parent:join(home,'.cursor')},
  ].map(item=>({...item,dir:join(item.parent,'skills'),detected:existsSync(item.parent)}));
}

export async function chooseDirectory(values, home, ask, output) {
  if (values.dir && values.target) throw new Error('请选择 --dir 或 --target 其中一项');
  if (values.dir) return resolve(values.dir.replace(/^~(?=[\\/])/,home));
  const targets = hostTargets(home);
  if (values.target) {
    const host = targets.find(t=>t.id === (values.target === 'agents' ? 'codex' : values.target));
    if (!host) throw new Error('未知目标。可选 codex、agents、claude-code、cursor');
    return host.dir;
  }
  const detected = targets.filter(t=>t.detected);
  if (detected.length === 1) return detected[0].dir;
  if (!ask) throw new Error('无法交互选择。请用 --target 或 --dir 指定一处');
  const choices = detected.length ? detected : targets;
  choices.forEach((host,i)=>output(`${i+1}. ${host.label} · ${host.dir}`));
  const answer = (await ask('选择一个安装目标（回车取消） ')).trim();
  if (!answer || /^q$/i.test(answer)) return null;
  const index = Number(answer)-1;
  if (!Number.isInteger(index) || !choices[index]) throw new Error('无法识别该选项，安装未开始');
  return choices[index].dir;
}

function readReceipt(directory,name) {
  const path = join(directory,receiptName);
  if (!stat(path)?.isFile()) return null;
  let receipt;
  try { receipt = JSON.parse(readFileSync(path,'utf8')); }
  catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
  const owned = receipt?.package === manifest.name ||
    (receipt?.package === 'qican-article-system' && legacySkills.has(name));
  return owned && receipt.skill === name && typeof receipt.version === 'string' ? receipt : null;
}

export function installedAt(target) {
  const fsTarget = stat(target);
  if (fsTarget && !fsTarget.isDirectory()) throw new Error('目标需为普通目录');
  return names.flatMap(name=>{
    const path = join(target,name);
    const current = stat(path);
    return current ? [{name,receipt:current.isDirectory()?readReceipt(path,name):null}] : [];
  });
}

function matchesFiles(target,name,files) {
  const prefix = `skills/${name}/`;
  return [...files].filter(([rel])=>rel.startsWith(prefix)).every(([rel,expected])=>{
    const path = join(target,rel.slice(7));
    return stat(path)?.isFile() && readFileSync(path).equals(expected);
  });
}

export function planInstall(target,{skills=names,upgrade=false}={}) {
  const prior = new Map(installedAt(target).map(row=>[row.name,row.receipt]));
  const requested = resolveSelection(skills);
  if (!requested.length) throw new Error('请至少选择一个 Skill');
  const dependents = upgrade ? [...prior].filter(([name,receipt])=>
    receipt && resolveSelection([name]).some(dependency=>requested.includes(dependency))
  ).map(([name])=>name) : [];
  const selected = resolveSelection([...requested,...dependents]);
  const files = skillFiles(selected);
  const rows = selected.map(name=>{
    if (!prior.has(name)) return {name,action:'install'};
    const receipt = prior.get(name);
    if (!receipt) return {name,action:'foreign'};
    if (upgrade) return {name,action:'replace',version:receipt.version};
    const matches = receipt.package === manifest.name && receipt.version === manifest.version &&
      matchesFiles(target,name,files);
    return {name,action:matches?'reuse':'requires-upgrade',version:receipt.version};
  });
  return {files,rows};
}

function assertWritable(rows) {
  const foreign = rows.find(row=>row.action === 'foreign');
  if (foreign) throw new Error(`已有其他方式安装的同名 Skill ${foreign.name}。请先手动备份，或另选目录`);
  const older = rows.find(row=>row.action === 'requires-upgrade');
  if (older) throw new Error(`已有同名目录 ${older.name}，默认保留。确认后使用 --upgrade`);
}

function removeScratch(transaction,parent) {
  if (dirname(transaction) !== parent || !transaction.startsWith(join(parent,'.qican-skills-'))) {
    throw new Error('无法核实工作目录的清理边界');
  }
  rmSync(transaction,{recursive:true});
}

export function install(target,{skills=names,upgrade=false,confirmedRows,move=renameSync}={}) {
  target = resolve(target);
  if (dirname(target) === target) throw new Error('请选择技能目录，不能使用文件系统根目录');
  const initial = planInstall(target,{skills,upgrade});
  assertWritable(initial.rows);
  mkdirSync(target,{recursive:true});
  const parent = dirname(target);
  const lockId = createHash('sha256').update(process.platform === 'win32' ? target.toLowerCase() : target).digest('hex').slice(0,12);
  // Keep the lock name stable so the v0.3 installer serializes against this installer.
  const lock = join(parent,`.qican-article-system-lock-${lockId}`);
  try { mkdirSync(lock); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error(`已有安装操作或中断记录 ${lock}`);
    throw error;
  }
  try {
    const {files,rows} = planInstall(target,{skills,upgrade});
    if (JSON.stringify(confirmedRows ?? initial.rows) !== JSON.stringify(rows)) {
      throw new Error('安装目标已变化，请重新预览');
    }
    assertWritable(rows);
    const changes = rows.filter(row=>row.action !== 'reuse');
    const changed = changes.map(row=>row.name);
    if (!changed.length) return {backup:null,changed};
    const transaction = mkdtempSync(join(parent,'.qican-skills-'));
    const incoming = join(transaction,'incoming');
    const previous = join(transaction,'previous');
    const backedUp = [];
    const placed = [];
    try {
      mkdirSync(incoming);
      mkdirSync(previous);
      for (const [rel,bytes] of files) {
        if (!changed.includes(rel.split('/')[1])) continue;
        const out = join(incoming,rel.slice(7));
        mkdirSync(dirname(out),{recursive:true});
        writeFileSync(out,bytes,{flag:'wx'});
        if (sha256(readFileSync(out)) !== sha256(bytes)) throw new Error(`暂存文件校验失败 ${rel}`);
      }
      for (const name of changed) {
        const receipt = {package:manifest.name,skill:name,version:manifest.version};
        writeFileSync(join(incoming,name,receiptName),JSON.stringify(receipt)+'\n',{flag:'wx'});
      }
      for (const {name,action} of changes) {
        if (action !== 'replace') continue;
        move(join(target,name),join(previous,name));
        backedUp.push(name);
      }
      for (const name of changed) {
        move(join(incoming,name),join(target,name));
        placed.push(name);
      }
      for (const name of changed) {
        const receipt = readReceipt(join(target,name),name);
        if (receipt?.version !== manifest.version || !matchesFiles(target,name,files)) {
          throw new Error(`安装读回失败 ${name}`);
        }
      }
    } catch (error) {
      const failures = [];
      for (const name of placed.reverse()) {
        try { move(join(target,name),join(incoming,name)); }
        catch (restoreError) { failures.push(restoreError.message); }
      }
      for (const name of backedUp.reverse()) {
        try { move(join(previous,name),join(target,name)); }
        catch (restoreError) { failures.push(restoreError.message); }
      }
      if (failures.length) throw new Error(`安装失败，恢复未完成。请保留备份 ${previous}\n${error.message}\n${failures.join('\n')}`);
      removeScratch(transaction,parent);
      throw new Error(`安装未完成，安装前的 Skill 已恢复或保持原样。原因 ${error.message}`);
    }
    if (!backedUp.length) {
      removeScratch(transaction,parent);
      return {backup:null,changed};
    }
    return {backup:previous,changed};
  } finally {
    rmdirSync(lock);
  }
}

async function cli() {
  const {values} = parseArgs({options:{
    target:{type:'string'},dir:{type:'string'},skill:{type:'string',multiple:true},
    all:{type:'boolean'},preview:{type:'boolean'},upgrade:{type:'boolean'},
    yes:{type:'boolean'},help:{type:'boolean'},version:{type:'boolean'},list:{type:'boolean'},
  }});
  if (values.help) {
    console.log('qican-skills [--target codex|agents|claude-code|cursor | --dir PATH] [--all | --skill NAME ...] [--preview] [--upgrade] [--yes] [--list]');
    return;
  }
  if (values.version) { console.log(manifest.version); return; }
  if (values.list) {
    for (const name of names) {
      const required = resolveSelection([name]).filter(dependency=>dependency!==name);
      console.log(required.length ? `${name} · 依赖 ${required.join(', ')}` : name);
    }
    return;
  }
  if (values.all && values.skill?.length) throw new Error('请选择 --all 或 --skill');
  if (values.yes && !values.target && !values.dir) throw new Error('--yes 需要显式指定 --target 或 --dir');
  const skills = values.skill ?? names;
  const terminal = process.stdin.isTTY && process.stdout.isTTY;
  const rl = terminal ? createInterface({input:process.stdin,output:process.stdout}) : null;
  try {
    const ask = rl ? prompt=>rl.question(prompt) : null;
    const dir = await chooseDirectory(values,homedir(),ask,console.log);
    if (!dir) { console.log('已取消。'); return; }
    const {rows} = planInstall(dir,{skills,upgrade:values.upgrade});
    const labels = {install:'安装',replace:'备份并替换',reuse:'已就绪',foreign:'其他方式安装', 'requires-upgrade':'需要 --upgrade'};
    console.log(`Qican-Skills ${manifest.version}\n目标 ${dir}`);
    for (const row of rows) console.log(`计划 ${row.name} · ${labels[row.action]}${row.version?' · '+row.version:''}`);
    if (values.preview) { console.log('仅预览。'); return; }
    assertWritable(rows);
    if (rows.every(row=>row.action === 'reuse')) { console.log('所选 Skill 已就绪。'); return; }
    if (!values.yes) {
      if (!ask) throw new Error('非交互运行请明确提供目标和 --yes，或使用 --preview');
      const reply = (await ask('确认写入？[y/N] ')).trim();
      if (!/^(y|yes)$/i.test(reply)) { console.log('已取消。'); return; }
    }
    const {backup,changed} = install(dir,{skills,upgrade:values.upgrade,confirmedRows:rows});
    console.log(`已就绪 ${changed.join(' + ')}`);
    if (backup) console.log(`旧版备份 ${backup}`);
    console.log(`第一次使用 ${startPage}`);
  } finally {
    rl?.close();
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  cli().catch(error=>{ console.error(error.message); process.exitCode=1; });
}
