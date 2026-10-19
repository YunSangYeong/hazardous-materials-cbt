import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {auditSources,evidenceErrors,coverage,sources} from './source-evidence.js';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {SUBJECT, AREAS, eligible} from '../src/model.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentReviews=JSON.parse(fs.readFileSync(path.join(root,'data/content-reviews.json'),'utf8'));
const duplicateReviews=JSON.parse(fs.readFileSync(path.join(root,'data/duplicate-reviews.json'),'utf8'));
export const fingerprint=q=>createHash('sha256').update(JSON.stringify(Object.fromEntries(['id','question','options','answer','explanation','criterionIds'].map(k=>[k,q[k]??null])))).digest('hex');
export const normalize = s => s.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');
const substance = s => s.includes('\n') ? s.slice(s.indexOf('\n')+1) : s;
const shape = s => normalize(substance(s)).replace(/[0-9]+(?:\.[0-9]+)?/g,'#');
function grams(s) { const out=new Set();for(let i=0;i<s.length-2;i++)out.add(s.slice(i,i+3));return out; }
export function similarity(a,b) {
  const x=grams(shape(a)), y=grams(shape(b));
  const n=[...x].filter(g=>y.has(g)).length;
  return x.size+y.size ? 2*n/(x.size+y.size) : 0;
}
export function validate(bank, scope, release=false) {
  const sourceAudit=auditSources();
  const errors=[...sourceAudit.errors], warnings=[], near=[], seenIds=new Set(), seenText=new Set(), concepts=new Set();
  if(!Array.isArray(bank))return {errors:['문제은행은 배열이어야 합니다.'],warnings,near};
  if(bank.some(q=>!q || typeof q!=='object' || Array.isArray(q)))return {errors:['문항은 객체여야 합니다.'],warnings,near};
  for(const [i,q] of bank.entries()) {
    const id=q.id || `행 ${i+1}`;
    const fail=m=>errors.push(`${id}: ${m}`);
    if(!/^HM\d{4}$/.test(q.id)||Number(q.id.slice(2))<1||Number(q.id.slice(2))>1000)fail('ID 범위 오류');
    if(seenIds.has(q.id))fail('ID 중복'); seenIds.add(q.id);
    if(q.id!==`HM${String(i+1).padStart(4,'0')}`)fail('ID 순서/연속성 오류');
    if(q.subject!==SUBJECT || !AREAS.includes(q.area))fail('공식 과목명 또는 내부 영역 오류');
    const topics=scope.areas.find(a=>a.name===q.area)?.topics;
    if(!topics?.includes(q.topic))fail('잠정 주제 분류 누락');
    for(const field of ['question','explanation','criterion','conceptKey'])if(typeof q[field]!=='string'||!q[field].trim())fail(`${field} 누락`);
    if(typeof q.question==='string'){const text=normalize(q.question);if(seenText.has(text))fail('문제 내용 중복');seenText.add(text);}
    if(!Array.isArray(q.options)||q.options.length!==4||q.options.some(x=>typeof x!=='string'||!x.trim())||new Set(q.options.map(x=>x.normalize('NFKC').toLowerCase().replace(/\s/g,''))).size!==4)fail('보기 4개 또는 보기 고유성 오류');
    if(!Number.isInteger(q.answer)||q.answer<1||q.answer>4)fail('정답 번호 오류');
    if(!['기초','중급','고급'].includes(q.difficulty))fail('난이도 오류');
    if(concepts.has(q.conceptKey))fail('학습 개념 키 중복'); concepts.add(q.conceptKey);
    if(!Array.isArray(q.sourceIds)||q.sourceIds.length===0||q.origin!=='original')fail('출처/자체 제작 표시 누락');
    if(!q.review||!['pending','verified','rejected'].includes(q.review.status))fail('검수 상태 오류');
    if(q.review?.status==='verified' && (!eligible(q)||!q.review.reviewer||!q.review.reviewedAt||!q.review.evidence?.length))fail('검수 근거 누락');
    for(const error of evidenceErrors(q,undefined,undefined,sourceAudit))fail(error);
    if(q.review?.status==='verified'&&!contentReviews.some(r=>r.id===q.id&&r.fingerprint===fingerprint(q)))fail('문항 내용과 내부검수 기록 불일치');
    if(release&&!eligible(q))fail('출제 불가');
    if(release&&!q.review?.evidence?.some(e=>e.sourceId==='qnet-2025-2029'&&e.locator))fail('Q-Net 원문 항목 매핑 누락');
    if(release&&['위험물의 지정수량','위험물 관련 법령 및 안전관리','위험물 운반 및 운송'].includes(q.topic)&&!q.review?.evidence?.some(e=>sources[e.sourceId]?.type==='law'&&e.locator&&e.effectiveDate))fail('법령 조문·시행일 검수 누락');
  }
  const signatures=bank.map(q=>typeof q.question==='string'?grams(shape(q.question)):new Set());
  for(let i=0;i<bank.length;i++)for(let j=i+1;j<bank.length;j++){
    if(typeof bank[i].question!=='string'||typeof bank[j].question!=='string')continue;
    const x=signatures[i],y=signatures[j];let shared=0;for(const gram of x)if(y.has(gram))shared++;
    const score=x.size+y.size?2*shared/(x.size+y.size):0;
    if(score>=0.66){
      const review=duplicateReviews.find(r=>r.ids[0]===bank[i].id&&r.ids[1]===bank[j].id&&r.fingerprints[0]===fingerprint(bank[i])&&r.fingerprints[1]===fingerprint(bank[j])&&r.decision==='distinct-learning-goals'&&r.reason?.length>20);
      near.push({ids:[bank[i].id,bank[j].id],similarity:Number(score.toFixed(3)),reviewed:!!review,reason:review?.reason});
    }
  }
  const unresolved=near.filter(p=>!p.reviewed);
  if(unresolved.length)errors.push(`유사 문항 ${unresolved.length}쌍: 별도 검토 필요 (자동 유사도는 의미 중복 판정의 대체가 아님)`);
  const missing=scope.areas.flatMap(a=>a.topics.filter(t=>!bank.some(q=>q.area===a.name&&q.topic===t)).map(t=>`${a.name} / ${t}`));
  if(missing.length)(release?errors:warnings).push(`미수록 주제: ${missing.join(', ')}`);
  if(bank.length!==1000)(release?errors:warnings).push(`문항 수 ${bank.length} / 1000`);
  if(!scope.officialVerified)(release?errors:warnings).push('공식 출제기준 원문 대조 미완료');
  const itemCoverage=coverage(bank),missingOfficial=itemCoverage.filter(c=>!c.verified);
  if(missingOfficial.length)(release?errors:warnings).push(`출제 승인 문항 없는 공식 세세항목 ${missingOfficial.length} / ${itemCoverage.length}`);
  const report={officialItemCount:itemCoverage.length,coveredOfficialItems:itemCoverage.filter(c=>c.total).length,verifiedOfficialItems:itemCoverage.filter(c=>c.verified).length,drafts:bank.length,eligible:bank.filter(eligible).length,pending:bank.filter(q=>!eligible(q)).length,unwritten:Math.max(0,1000-bank.length),errors,warnings,near,reviewedNearPairs:near.filter(p=>p.reviewed).length,unresolvedNearPairs:unresolved.length};
  return report;
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
  const report=validate(read('data/questions.json'),read('data/scope.json'),process.argv.includes('--release'));
  console.log(JSON.stringify(report,null,2));process.exitCode=report.errors.length?1:0;
}
