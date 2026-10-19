import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixtureBank} from './fixtures.js';
import {AREAS} from '../src/model.js';
import {createPractice,choosePractice,nextPractice,restorePractice,restoreLearning,emptyLearning,recordAttempt} from '../src/practice.js';
const bank=fixtureBank();
test('practice draws every eligible question exactly once before next cycle',()=>{
 let p=createPractice(bank),seen=new Set();
 for(let i=0;i<1000;i++){const id=p.ids[p.index];assert.ok(!seen.has(id));seen.add(id);p=choosePractice(p,bank,1);const before=p;p=choosePractice(p,bank,2);assert.equal(p,before);p=nextPractice(p);}
 assert.equal(seen.size,1000);assert.equal(p.cycle,2);assert.equal(p.answered,1000);assert.equal(p.correct,1000);assert.equal(p.selected,null);
});
test('practice filters area and selected review IDs without changing original bank',()=>{
 const a=createPractice(bank,AREAS[0]);assert.equal(a.ids.length,350);assert.ok(a.ids.every(id=>bank.find(q=>q.id===id).area===AREAS[0]));
 assert.deepEqual(new Set(createPractice(bank,'',Math.random,[bank[0].id,bank[1].id]).ids),new Set([bank[0].id,bank[1].id]));assert.equal(bank.length,1000);
 const b=structuredClone(bank);b[0].review.status='pending';assert.ok(!createPractice(b).ids.includes(b[0].id));assert.throws(()=>createPractice([]));
});
test('unanswered next is locked; correct/incorrect streak and statistics are independent',()=>{
 let p=createPractice(bank);assert.equal(nextPractice(p),p);assert.equal(choosePractice(p,bank,0),p);
 p=choosePractice(p,bank,1);assert.equal(p.streak,1);p=nextPractice(p);p=choosePractice(p,bank,2);assert.equal(p.streak,0);assert.equal(p.correct,1);assert.equal(p.answered,2);
});
test('practice restores exact order, answer and cycle; corrupt state is rejected',()=>{
 const p=choosePractice(createPractice(bank),bank,1);assert.deepEqual(restorePractice(JSON.stringify(p),bank),p);
 for(const patch of [{ids:['HM9999']},{index:-1},{selected:5},{correct:9999},{cycle:0},{ids:[p.ids[0],p.ids[0]]}])assert.throws(()=>restorePractice(JSON.stringify({...p,...patch}),bank));
 assert.equal(restorePractice(null,bank),null);
});
test('wrong notes retain latest attempt and clear when answered correctly; statistics persist',()=>{
 const q=bank[0];let s=recordAttempt(emptyLearning(),q,2);assert.equal(s.wrong[q.id],2);assert.equal(s.total,1);s=recordAttempt(s,q,1);assert.equal(s.wrong[q.id],undefined);assert.equal(s.correct,1);assert.equal(s.total,2);
 s=recordAttempt(s,q,0);assert.equal(s.wrong[q.id],0);assert.deepEqual(restoreLearning(JSON.stringify(s),bank),s);
 assert.throws(()=>restoreLearning(JSON.stringify({...s,correct:999}),bank));assert.throws(()=>restoreLearning(JSON.stringify({...s,exams:[{}]}),bank));
});
