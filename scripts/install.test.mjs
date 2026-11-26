import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,mkdtempSync,readFileSync,renameSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {test} from 'node:test';
import {chooseDirectory,hostTargets,install,installedAt} from '../bin/install.js';
import {manifest,names,root,skillFiles} from './release.mjs';

function fixture(t) {
  const parent = resolve(tmpdir());
  const sandbox = mkdtempSync(join(parent,'qican-test-'));
  t.after(()=>{
    assert.equal(dirname(sandbox),parent);
    assert.match(sandbox,/[\\/]qican-test-[^\\/]+$/);
    rmSync(sandbox,{recursive:true,force:true});
  });
  return sandbox;
}
const entry = join(root,'bin/install.js');
const cli = args => spawnSync(process.execPath,[entry,...args],{encoding:'utf8'});
const read = file => readFileSync(file,'utf8');

test('预览指定目录并且不写入', t=>{
  const target = join(fixture(t),'技能 包');
  const result = cli(['--dir',target,'--preview']);
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/仅预览/);
  assert.equal(existsSync(target),false);
});

test('检测多个宿主，只选一个，允许取消', async t=>{
  const home = fixture(t);
  const [codex,claude,cursor] = hostTargets(home);
  mkdirSync(codex.parent);
  mkdirSync(cursor.parent);
  const seen = [];
  const selected = await chooseDirectory({},home,async()=> '2',line=>seen.push(line));
  assert.equal(selected,cursor.dir);
  assert.equal(seen.length,2);
  assert.equal(await chooseDirectory({},home,async()=>'',()=>{}),null);
  assert.equal(await chooseDirectory({target:'claude-code'},home,null,()=>{}),claude.dir);
  assert.equal(existsSync(codex.dir),false);
  assert.equal(existsSync(cursor.dir),false);
});

test('首次安装双 Skill，同版可复用，自定义目录可用', t=>{
  const target = join(fixture(t),'资料 空间','skills');
  const first = cli(['--dir',target,'--yes']);
  assert.equal(first.status,0,first.stderr);
  assert.match(first.stdout,/START\.md/);
  assert.deepEqual(installedAt(target).map(row=>row.name),names);
  for (const [file,bytes] of skillFiles()) assert.deepEqual(readFileSync(join(target,file.slice(7))),bytes);
  const second = cli(['--dir',target,'--yes']);
  assert.equal(second.status,0,second.stderr);
  assert.match(second.stdout,/所选 Skill 已就绪/);
});

test('没有明确同意时不写入，含未托管同名目录时升级也停下', t=>{
  const target = join(fixture(t),'skills');
  const declined = cli(['--dir',target]);
  assert.notEqual(declined.status,0);
  assert.equal(existsSync(target),false);
  mkdirSync(join(target,names[0]),{recursive:true});
  const old = join(target,names[0],'SKILL.md');
  writeFileSync(old,'unknown install');
  const unsafe = cli(['--dir',target,'--upgrade','--yes']);
  assert.notEqual(unsafe.status,0);
  assert.equal(read(old),'unknown install');
  assert.equal(existsSync(join(target,names[1])),false);
});

test('联合升级备份旧文件并清理本次安装目录中的过期文件', t=>{
  const target = join(fixture(t),'skills');
  install(target);
  const old = join(target,names[0],'stale.md');
  writeFileSync(old,'legacy content');
  const other = join(target,'unrelated');
  mkdirSync(other);
  writeFileSync(join(other,'SKILL.md'),'untouched');
  const {backup} = install(target,{upgrade:true});
  assert.equal(existsSync(old),false);
  assert.equal(read(join(backup,names[0],'stale.md')),'legacy content');
  assert.equal(dirname(dirname(backup)),dirname(target));
  assert.deepEqual(installedAt(target).map(row=>row.receipt.version),[manifest.version,manifest.version]);
  assert.equal(read(join(other,'SKILL.md')),'untouched');
});

test('第二个目录替换失败时回滚两个旧版本', t=>{
  const target = join(fixture(t),'skills');
  install(target);
  for (const name of names) writeFileSync(join(target,name,'old.md'),name);
  const activeNewSecond = join(target,names[1]);
  let failed = false;
  const move = (from,to)=>{
    if (!failed && to === activeNewSecond && dirname(from).endsWith('incoming')) {
      failed = true;
      throw new Error('simulated second replacement failure');
    }
    return renameSync(from,to);
  };
  assert.throws(()=>install(target,{upgrade:true,move}),/已恢复/);
  assert(failed);
  for (const name of names) assert.equal(read(join(target,name,'old.md')),name);
});

test('独立安装赛博祈蚕，随后追加文章流程时复用共用规则',t=>{
  const target=join(fixture(t),'skills');
  const only=cli(['--dir',target,'--skill','cyber-qican','--yes']);
  assert.equal(only.status,0,only.stderr);
  assert.deepEqual(installedAt(target).map(row=>row.name),['cyber-qican']);
  const mirror=join(target,'cyber-qican','references','confirmed-rules-mirror.md');
  const before=readFileSync(mirror);
  const add=cli(['--dir',target,'--skill','article-workflow','--yes']);
  assert.equal(add.status,0,add.stderr);
  assert.match(add.stdout,/计划 cyber-qican · 已就绪/);
  assert.deepEqual(installedAt(target).map(row=>row.name),names);
  const entry=read(join(target,'article-workflow','SKILL.md'));
  const ref=/`(\.\.\/cyber-qican\/references\/confirmed-rules-mirror\.md)`/.exec(entry)[1];
  assert.deepEqual(readFileSync(resolve(join(target,'article-workflow'),ref)),before);
});

test('从空目录选择文章流程会安装其依赖，--all 与 --skill 互斥',t=>{
  const target=join(fixture(t),'skills');
  const conflict=cli(['--dir',target,'--all','--skill','cyber-qican','--yes']);
  assert.notEqual(conflict.status,0);
  assert.equal(existsSync(target),false);
  const selected=cli(['--dir',target,'--skill','article-workflow','--yes']);
  assert.equal(selected.status,0,selected.stderr);
  assert.deepEqual(installedAt(target).map(row=>row.name),names);
});

test('旧 v0.3.0 安装记录可迁移，升级共用依赖会保留并迁移已装文章流程',t=>{
  const target=join(fixture(t),'skills');
  install(target);
  for (const name of names) {
    const receipt={package:'qican-article-system',skill:name,version:'0.3.0'};
    writeFileSync(join(target,name,'.qican-release.json'),JSON.stringify(receipt));
  }
  const preview=cli(['--dir',target,'--skill','cyber-qican','--upgrade','--preview']);
  assert.equal(preview.status,0,preview.stderr);
  assert.match(preview.stdout,/article-workflow · 备份并替换 · 0\.3\.0/);
  assert.throws(()=>install(target,{skills:['cyber-qican']}),/默认保留/);
  const updated=install(target,{skills:['cyber-qican'],upgrade:true});
  assert.deepEqual(updated.changed,names);
  for (const name of names) {
    const old=JSON.parse(read(join(updated.backup,name,'.qican-release.json')));
    assert.equal(old.package,'qican-article-system');
  }
  assert.deepEqual(installedAt(target).map(row=>row.receipt.package),[manifest.name,manifest.name]);
});
