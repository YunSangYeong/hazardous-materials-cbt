import {test} from 'node:test';
import assert from 'node:assert/strict';
import {STUDY_KEYS,studyBackup,clearStudy} from '../src/storage.js';
const memory=()=>{const values=new Map([...STUDY_KEYS.map((k,i)=>[k,`raw-${i}`]),['electrician-cbt:v1','keep'],['other-app','keep too']]);return {values,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};};
test('backup contains all study keys and current state without mutating storage',()=>{
 const store=memory(),before=[...store.values],current={exam:{index:5},practice:{index:2},learning:{bookmarks:['HM0001']},view:'practice'};
 const b=studyBackup(store,current,new Date('2026-10-19T00:00:00Z'));assert.equal(b.app,'hazardous-materials-cbt');assert.equal(b.formatVersion,1);assert.equal(b.storageReadable,true);assert.deepEqual(b.exam,current.exam);assert.deepEqual(Object.keys(b.rawStorage),STUDY_KEYS);assert.deepEqual([...store.values],before);
});
test('backup preserves corrupted raw records and supports memory-only backup on denial',()=>{
 const store=memory();store.setItem(STUDY_KEYS[0],'{broken');assert.equal(studyBackup(store,{}).rawStorage[STUDY_KEYS[0]],'{broken');
 const b=studyBackup({getItem(){throw Error('denied');}},{learning:{correct:2}});assert.equal(b.storageReadable,false);assert.equal(b.learning.correct,2);
});
test('reset removes only this CBT data, preserving electrician and other applications',()=>{
 const store=memory();clearStudy(store);for(const key of STUDY_KEYS)assert.equal(store.getItem(key),null);assert.equal(store.getItem('electrician-cbt:v1'),'keep');assert.equal(store.getItem('other-app'),'keep too');
});
test('read denial does not start removal; partial remove denial restores prior data',()=>{
 let removed=false;assert.throws(()=>clearStudy({getItem(){throw Error('denied');},removeItem(){removed=true;}}));assert.equal(removed,false);
 const store=memory(),before=[...store.values];let count=0;const remove=store.removeItem;store.removeItem=k=>{if(++count===2)throw Error('denied');remove(k);};assert.throws(()=>clearStudy(store));assert.deepEqual([...store.values].sort(),before.sort());
});
