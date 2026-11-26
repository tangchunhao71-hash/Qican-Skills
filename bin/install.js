#!/usr/bin/env node
import {existsSync,lstatSync,mkdirSync,mkdtempSync,readFileSync,realpathSync,renameSync,rmSync,rmdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {homedir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {createInterface} from 'node:readline/promises';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {manifest,names,sha256,skillFiles} from '../scripts/release.mjs';

const receiptName = '.qican-release.json';
const startPage = `https://github.com/tangchunhao71-hash/qican-article-system/blob/v${manifest.version}/START.md`;

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
  const receiptPath = join(directory,receiptName);
  if (!stat(receiptPath)?.isFile()) return null;
  let receipt;
  try { receipt = JSON.parse(readFileSync(receiptPath,'utf8')); }
  catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
  return receipt?.package === manifest.name && receipt.skill === name &&
    typeof receipt.version === 'string' ? receipt : null;
}

export function installedAt(target) {
  const fsTarget = stat(target);
  if (fsTarget && !fsTarget.isDirectory()) throw new Error('目标需为普通目录');
  return names.flatMap(name=>{
    const path = join(target,name);
    const current = stat(path);
    if (!current) return [];
    return [{name,receipt:current.isDirectory()?readReceipt(path,name):null}];
  });
}

function removeScratch(transaction,parent) {
  // Only remove our own mkdtemp sibling, never a user-chosen target or backup.
  if (dirname(transaction) !== parent || !transaction.startsWith(join(parent,'.qican-article-system-'))) {
    throw new Error('无法核实工作目录的清理边界');
  }
  rmSync(transaction,{recursive:true});
}

export function install(target, {upgrade=false,move=renameSync}={}) {
  target = resolve(target);
  if (dirname(target) === target) throw new Error('请选择技能目录，不能使用文件系统根目录');
  const files = skillFiles();
  mkdirSync(target,{recursive:true});
  if (!stat(target)?.isDirectory()) throw new Error('目标需为普通目录');
  const parent = dirname(target);
  const lockId = createHash('sha256').update(process.platform === 'win32' ? target.toLowerCase() : target).digest('hex').slice(0,12);
  const lock = join(parent,`.qican-article-system-lock-${lockId}`);
  try { mkdirSync(lock); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error(`已有安装操作或中断记录 ${lock}`);
    throw error;
  }
  try {
    const existing = installedAt(target);
    if (existing.length && !upgrade) throw new Error('已存在同名 Skill，当前未覆盖');
    if (existing.some(row=>!row.receipt)) throw new Error('发现由其他方式安装的同名 Skill。请先手动备份，或另选目录');
    const transaction = mkdtempSync(join(parent,'.qican-article-system-'));
    const incoming = join(transaction,'incoming');
    const previous = join(transaction,'previous');
    const backedUp = [];
    const placed = [];
    try {
      mkdirSync(incoming);
      mkdirSync(previous);
      for (const [rel,bytes] of files) {
        const out = join(incoming,rel.slice(7));
        mkdirSync(dirname(out),{recursive:true});
        writeFileSync(out,bytes,{flag:'wx'});
        if (sha256(readFileSync(out)) !== sha256(bytes)) throw new Error(`暂存文件校验失败 ${rel}`);
      }
      for (const name of names) {
        const receipt = {package:manifest.name,skill:name,version:manifest.version};
        writeFileSync(join(incoming,name,receiptName),JSON.stringify(receipt)+'\n',{flag:'wx'});
      }
      // Verify both replacements before moving anything in the active Skills directory.
      for (const {name} of existing) {
        move(join(target,name),join(previous,name));
        backedUp.push(name);
      }
      for (const name of names) {
        move(join(incoming,name),join(target,name));
        placed.push(name);
      }
      const installed = installedAt(target);
      if (installed.length !== names.length || installed.some(r=>r.receipt?.version !== manifest.version)) {
        throw new Error('双 Skill 安装读回失败');
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
      return {backup:null};
    }
    const backup = previous;
    return {backup};
  } finally {
    rmdirSync(lock);
  }
}

async function cli() {
  const {values} = parseArgs({options:{
    target:{type:'string'},dir:{type:'string'},preview:{type:'boolean'},
    upgrade:{type:'boolean'},yes:{type:'boolean'},help:{type:'boolean'},version:{type:'boolean'},
  }});
  if (values.help) {
    console.log('qican-article-system [--target codex|agents|claude-code|cursor | --dir PATH] [--preview] [--upgrade] [--yes]');
    return;
  }
  if (values.version) { console.log(manifest.version); return; }
  if (values.yes && !values.target && !values.dir) throw new Error('--yes 需要显式指定 --target 或 --dir');
  const terminal = process.stdin.isTTY && process.stdout.isTTY;
  const rl = terminal ? createInterface({input:process.stdin,output:process.stdout}) : null;
  try {
    const ask = rl ? prompt=>rl.question(prompt) : null;
    const dir = await chooseDirectory(values,homedir(),ask,console.log);
    if (!dir) { console.log('已取消。'); return; }
    skillFiles();
    const current = installedAt(dir);
    console.log(`Qican Article System ${manifest.version}\n目标 ${dir}\n计划 ${names.join(' + ')}`);
    for (const row of current) console.log(`已有 ${row.name} · ${row.receipt?.version ?? '其他方式安装'}`);
    if (values.preview) { console.log('仅预览。' ); return; }
    if (current.length && !values.upgrade) throw new Error('已有同名目录。默认保留。');
    if (current.some(row=>!row.receipt)) throw new Error('已有其他方式安装的同名 Skill。请先手动备份，或另选目录');
    if (!values.yes) {
      if (!ask) throw new Error('非交互运行请明确提供目标和 --yes，或使用 --preview');
      const reply = (await ask('确认写入？[y/N] ')).trim();
      if (!/^(y|yes)$/i.test(reply)) { console.log('已取消。'); return; }
    }
    const {backup} = install(dir,{upgrade:values.upgrade});
    console.log('已安装两个 Skill。');
    if (backup) console.log(`旧版备份 ${backup}`);
    console.log(`第一次使用 ${startPage}`);
  } finally {
    rl?.close();
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  cli().catch(error=>{ console.error(error.message); process.exitCode=1; });
}
