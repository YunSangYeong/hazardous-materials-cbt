import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {atoms,total} from '../scripts/check-chemistry.js';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));
const checks=read('../data/chemistry-checks.json'),bank=read('../data/questions.json');
test('formula parser verifies grouped subscripts',()=>{assert.deepEqual(atoms('Ca(OH)2'),{Ca:1,O:2,H:2});assert.throws(()=>atoms('Ca(OH'));assert.throws(()=>atoms('H0'));});
for(const c of checks)test(`${c.id}: balanced atoms and exact explanation equation`,()=>{
 const q=bank.find(q=>q.id===c.id);assert.ok(q);assert.ok(q.explanation.includes(c.equation));assert.deepEqual(total(c.left),total(c.right));
});
test('all drafted reaction equations have independent atom checks',()=>{
 assert.deepEqual(bank.filter(q=>q.explanation.includes('→')).map(q=>q.id).sort(),checks.map(c=>c.id).sort());
});
