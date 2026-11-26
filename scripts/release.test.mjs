import assert from 'node:assert/strict';
import {test} from 'node:test';
import {checkPublicFiles} from './privacy.mjs';
import {artifacts,sha256,skillFiles} from './release.mjs';

const sample = (name,body)=>new Map([[name,Buffer.from(body)]]);
test('隐私检查拦截虚构凭证、私人服务、个人路径、二进制和越界引用',()=>{
  const pretendSecret = ['gh','p','_', 'X'.repeat(35)].join('');
  const pretendDrive = ['https:', '', ['drive','google','com'].join('.'), 'a'].join('/');
  const pretendLocal = ['Z:', 'Users','Someone','Documents'].join('/');
  assert.throws(()=>checkPublicFiles(sample('input.md',pretendSecret)),/凭证/);
  assert.throws(()=>checkPublicFiles(sample('input.md',pretendDrive)),/地址/);
  assert.throws(()=>checkPublicFiles(sample('input.md',pretendLocal)),/路径/);
  assert.throws(()=>checkPublicFiles(sample('input.md','[outside](../outside.md)')),/越界/);
  assert.throws(()=>checkPublicFiles(sample('.env','placeholder')),/路径/);
  assert.throws(()=>checkPublicFiles(new Map([['sample.md',Buffer.from([0xff])]])),/UTF-8/);
});

test('发行 ZIP、摘要和单文件可重复生成',()=>{
  const a=artifacts(), b=artifacts();
  assert.deepEqual(a,b);
  const stand=a.get('cyber-qican.md').toString('utf8');
  assert.match(stand,/正式规则镜像/);
  assert.match(stand,/思考示例/);
  assert.match(stand,/按需研究祈蚕的公开观点/);
  assert.doesNotMatch(stand,/references\//);
  assert.match(a.get('SHA256SUMS').toString('utf8'),new RegExp(sha256(a.get('cyber-qican.md'))));
  assert(skillFiles().size > 8);
});
