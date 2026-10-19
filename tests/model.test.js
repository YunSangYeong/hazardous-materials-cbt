import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fixtureBank} from './fixtures.js';
import {AREAS,DURATION,createExam,remaining,answer,submit,grade,restore,eligible} from '../src/model.js';
import {validate, similarity} from '../scripts/validate-bank.js';
const bank=fixtureBank();
const drafts=JSON.parse(fs.readFileSync(new URL('../data/questions.json',import.meta.url)));
const scope=JSON.parse(fs.readFileSync(new URL('../data/scope.json',import.meta.url)));
function rng(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32;};}
test('60 unique, all topics, 21/39 internal allocation across 200 seeds',()=>{
 const signatures=new Set();
 for(let seed=1;seed<=200;seed++){
  const e=createExam(bank,1000,rng(seed));assert.equal(e.ids.length,60);assert.equal(new Set(e.ids).size,60);
  const chosen=bank.filter(q=>e.ids.includes(q.id));assert.equal(chosen.filter(q=>q.area===AREAS[0]).length,21);assert.equal(chosen.filter(q=>q.area===AREAS[1]).length,39);
  for(const a of AREAS)assert.equal(new Set(chosen.filter(q=>q.area===a).map(q=>q.topic)).size,10);
  signatures.add(e.ids.join(','));
 }assert.equal(signatures.size,200);
});
test('sampling includes high IDs and tail of both areas',()=>{
 const ids=new Set();for(let seed=1;seed<=200;seed++)for(const id of createExam(bank,0,rng(seed)).ids)ids.add(id);
 assert.equal(ids.size,1000);
});
test('reject unreviewed, incomplete bank and missing area',()=>{
 const unreviewed=structuredClone(drafts);unreviewed[0].review.status='pending';assert.throws(()=>createExam(unreviewed));assert.throws(()=>createExam(bank.slice(0,999)));assert.throws(()=>createExam(bank.map(q=>({...q,area:AREAS[0]}))));
 const duplicate=structuredClone(bank);duplicate[1].id=duplicate[0].id;assert.throws(()=>createExam(duplicate));
 const b=structuredClone(bank);b[0].review.accuracyChecked=false;assert.throws(()=>createExam(b));
});
test('absolute deadline and restoration do not extend time',()=>{
 const e=createExam(bank,10000);assert.equal(remaining(e,10000),3600);assert.equal(e.deadline,10000+DURATION);assert.equal(remaining(e,10001),3600);assert.equal(remaining(e,11000),3599);assert.equal(remaining(e,10000+DURATION),0);
 assert.equal(restore(JSON.stringify(e),bank).deadline,e.deadline);assert.equal(remaining(e,10000+DURATION+100),0);
});
test('answer changes, invalid inputs, expired and submitted answer locks',()=>{
 let e=createExam(bank,1000);const id=e.ids[0];e=answer(e,id,1,2000);e=answer(e,id,4,3000);assert.equal(e.answers[id],4);
 assert.equal(answer(e,id,5,3000),e);assert.equal(answer(e,'bad',1,3000),e);assert.equal(answer(e,id,2,e.deadline),e);
 e=submit(e,4000);assert.equal(answer(e,id,2,5000),e);assert.equal(submit(e,6000),e);
});
for(const correct of [0,35,36,60])test(`grade ${correct}/60, pass boundary and rounding`,()=>{
 let e=createExam(bank,0);for(let i=0;i<correct;i++)e=answer(e,e.ids[i],1,1);
 const r=grade(e,bank);assert.equal(r.correct,correct);assert.equal(r.unanswered,60-correct);assert.equal(r.wrong,0);assert.equal(r.passed,correct>=36);assert.equal(r.score,Math.round(correct/60*1000)/10);
 assert.equal(Object.values(r.areas).reduce((n,a)=>n+a.correct,0),correct);
});
test('wrong and unanswered are disjoint',()=>{
 let e=createExam(bank,0);e=answer(e,e.ids[0],2,1);const r=grade(e,bank);assert.deepEqual([r.correct,r.wrong,r.unanswered],[0,1,59]);
});
test('restore validates corrupted or incompatible persisted state',()=>{
 const e=createExam(bank,0);assert.equal(restore(null,bank),null);assert.throws(()=>restore('{',bank));
 for(const patch of [{index:60},{deadline:123},{ids:Array(60).fill(e.ids[0])},{answers:{[e.ids[0]]:5}},{answers:{notInExam:1}},{submittedAt:'bad'},{startedAt:null}])assert.throws(()=>restore(JSON.stringify({...e,...patch}),bank));
 const incompatible=structuredClone(bank);incompatible.find(q=>q.id===e.ids[0]).review.status='pending';assert.throws(()=>restore(JSON.stringify(e),incompatible));
});
test('actual 1000 bank passes release, all 110 criteria and internal review receipts',()=>{
 const r=validate(drafts,scope,true);assert.deepEqual(r.errors,[]);assert.equal(r.eligible,1000);assert.equal(drafts.filter(eligible).length,1000);assert.equal(r.pending,0);assert.equal(r.drafts,1000);assert.equal(r.unwritten,0);assert.equal(r.officialItemCount,110);assert.equal(r.verifiedOfficialItems,110);assert.equal(r.unresolvedNearPairs,0);assert.ok(r.reviewedNearPairs>0);
});
test('release gate rejects incomplete, unreviewed and uncovered bank',()=>{
 const incomplete=structuredClone(drafts.slice(0,999));incomplete.forEach(q=>{q.review.status='pending';q.review.accuracyChecked=false;});
 const r=validate(incomplete,scope,true);assert.ok(r.errors.some(x=>x.includes('문항 수')));assert.ok(r.errors.some(x=>x.includes('공식 세세항목')));assert.ok(r.errors.some(x=>x.includes('출제 불가')));
});
test('actual bank chooses 60 unique with 21/39 allocation and all internal topics',()=>{
 for(let seed=1;seed<=100;seed++){
  const e=createExam(drafts,1000,rng(seed));const chosen=drafts.filter(q=>e.ids.includes(q.id));assert.equal(e.ids.length,60);assert.equal(new Set(e.ids).size,60);
  for(const [area,total]of [[AREAS[0],21],[AREAS[1],39]]){const group=chosen.filter(q=>q.area===area);assert.equal(group.length,total);assert.deepEqual(new Set(group.map(q=>q.topic)),new Set(drafts.filter(q=>q.area===area).map(q=>q.topic)));}
 }
});
test('validator rejects duplicates, bad choices, missing metadata and false approvals',()=>{
 const b=structuredClone(drafts);b[1].id=b[0].id;b[1].question=b[0].question;b[2].options=['x','x'];b[3].answer=0;b[4].explanation='';b[5].criterion='';b[6].review.reviewer=null;
 const r=validate(b,scope);for(const term of ['ID 중복','문제 내용 중복','보기','정답 번호','explanation','criterion','검수 근거'])assert.ok(r.errors.some(x=>x.includes(term)),term);
});
test('numeric and punctuation variations are flagged as near duplicates',()=>{
 assert.equal(similarity('기체 20 L의 질량을 구하시오.','기체 30 L의 질량을 구하시오!'),1);
});

test('malformed bank returns validation errors instead of crashing',()=>{
 for(const b of [null, {}, [null], ['invalid']])assert.ok(validate(b,scope).errors.length);
 const b=structuredClone(drafts);delete b[0].question;assert.ok(validate(b,scope).errors.some(e=>e.includes('question')));
});

test('edited question invalidates its recorded content review',()=>{const b=structuredClone(drafts);b[100].explanation+=' 잘못된 변경';assert.ok(validate(b,scope,true).errors.some(e=>e.includes('내부검수 기록 불일치')));});
test('decimal points and signs stay distinct in answer choices',()=>{const q=structuredClone(drafts[0]);q.options=['1.00','100','+6','−6'];const r=validate([q],scope);assert.ok(!r.errors.some(e=>e.includes('보기 4개')));});
