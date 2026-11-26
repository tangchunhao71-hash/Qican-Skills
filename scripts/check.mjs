import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {allowedFiles, artifacts, releaseTree, root} from './release.mjs';

assert.deepEqual(releaseTree().sort(),[...allowedFiles].sort(),'源码与允许清单不同');
const mirror = readFileSync(join(root,'skills/cyber-qican/references/confirmed-rules-mirror.md'),'utf8');
const sourceVersion = /^source_version: qican-longform-feedback-v([0-9.]+)\r?$/m.exec(mirror)?.[1];
const mirrorVersion = /^mirror_version: ([0-9.]+)\r?$/m.exec(mirror)?.[1];
assert(sourceVersion && mirrorVersion,'缺少正式规则或镜像版本');
assert.equal(mirrorVersion,sourceVersion,'规则镜像版本与源规则版本不同');
const output = join(root,'dist');
const expected = artifacts();
assert.deepEqual(readdirSync(output).sort(),[...expected.keys()].sort(),'发行文件清单不同');
for (const [file,bytes] of expected) assert.deepEqual(readFileSync(join(output,file)),bytes,`发行文件已漂移 ${file}`);

if (process.argv.includes('--git')) {
  const allowed = new Set(allowedFiles);
  const history = spawnSync('git',['rev-list','--all'],{cwd:root,encoding:'utf8'});
  if (history.error || history.status !== 0) throw new Error(history.error?.message || history.stderr);
  const {checkPublicFiles} = await import('./privacy.mjs');
  for (const sha of history.stdout.trim().split(/\s+/).filter(Boolean)) {
    const tree = spawnSync('git',['ls-tree','-r','-z',sha],{cwd:root,encoding:'utf8'});
    if (tree.error || tree.status !== 0) throw new Error(tree.error?.message || tree.stderr);
    const files = new Map();
    for (const row of tree.stdout.split('\0').filter(Boolean)) {
      const match = /^100(?:644|755) blob ([0-9a-f]+)\t(.+)$/.exec(row);
      assert(match,`历史出现非普通文件 ${sha}`);
      assert(allowed.has(match[2]),`历史出现未批准路径 ${match[2]}`);
      const blob = spawnSync('git',['cat-file','blob',match[1]],{cwd:root});
      if (blob.error || blob.status !== 0) throw new Error(blob.error?.message || blob.stderr.toString());
      files.set(match[2],blob.stdout);
    }
    checkPublicFiles(files);
  }
}
console.log('公开源码、引用、发行文件和哈希校验通过');
