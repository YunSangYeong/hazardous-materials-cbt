import {STORAGE_KEY} from './model.js';
import {PRACTICE_KEY,LEARNING_KEY} from './practice.js';
export const STUDY_KEYS=Object.freeze([STORAGE_KEY,PRACTICE_KEY,LEARNING_KEY,'hazardous-materials-cbt:last-view']);
export function studyBackup(storage,current,now=new Date()){
 const raw={};let storageReadable=true;
 for(const key of STUDY_KEYS){try{raw[key]=storage.getItem(key);}catch{storageReadable=false;}}
 return {app:'hazardous-materials-cbt',formatVersion:1,exportedAt:now.toISOString(),...current,storageReadable,rawStorage:raw};
}
export function clearStudy(storage){
 // Never clear the origin: another CBT or application can share this storage.
 const previous=new Map(STUDY_KEYS.map(key=>[key,storage.getItem(key)]));
 try{for(const key of STUDY_KEYS)storage.removeItem(key);}
 catch(error){
  // Best effort rollback if a browser denies removal halfway through.
  for(const [key,value]of previous)try{if(value!==null)storage.setItem(key,value);}catch{}
  throw error;
 }
}
