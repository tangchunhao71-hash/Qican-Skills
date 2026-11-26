import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {artifacts, root} from './release.mjs';

const output = join(root,'dist');
const files = artifacts();
mkdirSync(output,{recursive:true});
for (const [name,raw] of files) {
  writeFileSync(join(output,name),raw);
  console.log(`dist/${name}`);
}
