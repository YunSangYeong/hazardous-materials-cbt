import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {official,sources,auditSources,evidenceErrors,coverage} from '../scripts/source-evidence.js';
const bank=JSON.parse(fs.readFileSync(new URL('../data/questions.json',import.meta.url)));
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const norm=s=>s.normalize('NFKC').replace(/[^\p{L}\p{N}]/gu,'');
test('all 110 official leaves occur in captured written criteria; practical excluded',()=>{
 assert.equal(official.items.length,110);assert.equal(new Set(official.items.map(c=>c.id)).size,110);
 assert.deepEqual([...new Set(official.items.map(c=>c.page))],[1,2,3,4,5,6]);
 assert.equal(new Set(official.items.map(c=>c.main)).size,11);
 const text=read(sources['qnet-2025-2029'].snapshots[0].path);
 for(const c of official.items)assert.ok(norm(text).includes(norm(c.leaf)),c.id);
 assert.ok(norm(text).includes(norm(official.subject)));assert.ok(text.includes('2025.01.01'));
});
test('official source snapshots have matching SHA-256 digests',()=>assert.deepEqual(auditSources().errors,[]));
test('all 1000 manuscripts have captured supporting source and exact criteria evidence',()=>{
 const reviewed=bank.filter(q=>q.review.status==='verified');assert.equal(reviewed.length,1000);
 const audit=auditSources();
 for(const q of reviewed){assert.deepEqual(evidenceErrors(q,undefined,undefined,audit),[],q.id);assert.equal(q.review.level,'internal-source-review');assert.ok(q.review.evidence.some(e=>sources[e.sourceId]?.snapshots?.length&&e.sourceId!=='qnet-2025-2029'));}
 assert.equal(bank.filter(q=>q.review.status==='pending').length,0);
});
test('forged quote, stale effective date, unknown source and mismatched official ID fail',()=>{
 const original=bank.find(q=>q.id==='HM0061');
 for(const [mutate,term]of [
  [q=>q.review.evidence[1].quote='이 인용문은 공식 법령에 존재하지 않습니다','인용문'],
  [q=>q.review.evidence[1].effectiveDate='2000-01-01','시행일'],
  [q=>q.sourceIds.push('unknown'),'등록되지 않은'],
  [q=>q.criterionIds=['Q99.99.99'],'세세항목'],
  [q=>q.review.evidence[1].sha256='0'.repeat(64),'해시']
 ]){const q=structuredClone(original);mutate(q);assert.ok(evidenceErrors(q).some(e=>e.includes(term)),term);}
});
test('tampered snapshot digest is rejected without modifying source files',()=>{
 const registry=structuredClone(sources);registry['hazardous-materials-law'].snapshots[0].sha256='0'.repeat(64);assert.ok(auditSources(registry).errors.some(e=>e.includes('SHA-256')));
});
test('coverage separates drafted and reviewed official leaf counts',()=>{
 const rows=coverage(bank);assert.equal(rows.filter(c=>c.total).length,110);assert.equal(rows.filter(c=>c.verified).length,110);assert.equal(rows.filter(c=>!c.verified).length,0);
});
