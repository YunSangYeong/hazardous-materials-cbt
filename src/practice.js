import {eligible,shuffle,AREAS} from './model.js';
export const PRACTICE_KEY='hazardous-materials-cbt:practice:v1';
export const LEARNING_KEY='hazardous-materials-cbt:learning:v1';
export function createPractice(bank,area='',random=Math.random,ids=null){
 const pool=bank.filter(q=>eligible(q)&&(!area||q.area===area)&&(!ids||ids.includes(q.id)));
 if(!pool.length)throw Error('학습할 문항이 없습니다.');
 return {version:1,area,ids:shuffle(pool.map(q=>q.id),random),index:0,selected:null,answered:0,correct:0,streak:0,cycle:1};
}
export function choosePractice(p,bank,choice){
 const q=bank.find(q=>q.id===p.ids[p.index]);
 if(p.selected!==null||!q||!Number.isInteger(choice)||choice<1||choice>4)return p;
 const correct=choice===q.answer;
 return {...p,selected:choice,answered:p.answered+1,correct:p.correct+Number(correct),streak:correct?p.streak+1:0};
}
export function nextPractice(p,random=Math.random){
 if(p.selected===null)return p;
 if(p.index<p.ids.length-1)return {...p,index:p.index+1,selected:null};
 const ids=shuffle(p.ids,random);
 if(ids.length>1&&ids[0]===p.ids[p.index])[ids[0],ids[1]]=[ids[1],ids[0]];
 return {...p,ids,index:0,selected:null,cycle:p.cycle+1};
}
export function restorePractice(raw,bank){
 if(!raw||raw==='null')return null;
 const p=JSON.parse(raw),pool=new Set(bank.filter(eligible).map(q=>q.id));
 if(p.version!==1||!['',...AREAS].includes(p.area)||!Array.isArray(p.ids)||!p.ids.length||new Set(p.ids).size!==p.ids.length||p.ids.some(id=>!pool.has(id)||p.area&&bank.find(q=>q.id===id).area!==p.area)||!Number.isInteger(p.index)||p.index<0||p.index>=p.ids.length||p.selected!==null&&(!Number.isInteger(p.selected)||p.selected<1||p.selected>4)||!['answered','correct','streak','cycle'].every(k=>Number.isInteger(p[k])&&p[k]>=0)||p.correct>p.answered||p.streak>p.correct||p.cycle<1)throw Error('저장된 랜덤 학습 기록을 복원할 수 없습니다.');
 return p;
}
export const emptyLearning=()=>({version:1,bookmarks:[],wrong:{},total:0,correct:0,areas:{},exams:[],completedExams:[]});
export function restoreLearning(raw,bank){
 if(!raw)return emptyLearning();
 const s=JSON.parse(raw),ids=new Set(bank.map(q=>q.id));
 if(s.version!==1||!Array.isArray(s.bookmarks)||s.bookmarks.some(id=>!ids.has(id))||!s.wrong||typeof s.wrong!=='object'||Array.isArray(s.wrong)||Object.entries(s.wrong).some(([id,a])=>!ids.has(id)||!Number.isInteger(a)||a<0||a>4)||!Number.isInteger(s.total)||!Number.isInteger(s.correct)||s.total<0||s.correct<0||s.correct>s.total||!s.areas||typeof s.areas!=='object'||!Array.isArray(s.exams)||!Array.isArray(s.completedExams)||s.completedExams.some(id=>typeof id!=='string')||s.exams.some(e=>!e||!Number.isFinite(e.at)||!Number.isFinite(e.score)||e.score<0||e.score>100||!Number.isInteger(e.correct)||e.correct<0||e.correct>60||typeof e.passed!=='boolean'))throw Error('학습 기록을 복원할 수 없습니다.');
 for(const a of Object.values(s.areas))if(!a||!Number.isInteger(a.total)||!Number.isInteger(a.correct)||a.correct<0||a.total<a.correct)throw Error('학습 영역 기록이 올바르지 않습니다.');
 return s;
}
export function recordAttempt(s,q,choice){
 const correct=choice===q.answer,wrong={...s.wrong},a=s.areas[q.area]||{total:0,correct:0};
 if(correct)delete wrong[q.id];else wrong[q.id]=choice||0;
 return {...s,total:s.total+1,correct:s.correct+Number(correct),wrong,areas:{...s.areas,[q.area]:{total:a.total+1,correct:a.correct+Number(correct)}}};
}
