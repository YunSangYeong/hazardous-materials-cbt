import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
export const official=read('data/official-criteria.json');
export const sources=read('data/sources.json');
const normalized=s=>String(s).normalize('NFKC').replace(/[^\p{L}\p{N}]/gu,'');
export function auditSources(registry=sources){
 const errors=[], snapshots=new Map();
 for(const [sourceId,s]of Object.entries(registry))for(const file of s.snapshots||[]){
  const target=path.resolve(root,file.path);
  if(!target.startsWith(root+path.sep)){errors.push(`${sourceId}: 출처 경로 오류`);continue;}
  try{
   const bytes=fs.readFileSync(target);const hash=createHash('sha256').update(bytes).digest('hex');
   if(hash!==file.sha256){errors.push(`${sourceId}: 출처 스냅샷 SHA-256 불일치`);continue;}
   snapshots.set(`${sourceId}:${file.path}`,{...file,text:file.path.endsWith('.txt')?normalized(bytes.toString('utf8')):null});
  }catch{errors.push(`${sourceId}: 출처 파일 누락`);}
 }
 return {errors,snapshots};
}
export function evidenceErrors(q, registry=sources, criterion=official, audit=auditSources(registry)){
 const errors=[];
 const criteria=new Map(criterion.items.map(c=>[c.id,c]));
 if(!Array.isArray(q.criterionIds)||q.criterionIds.length===0)errors.push('공식 세세항목 ID 누락');
 for(const id of q.criterionIds||[])if(!criteria.has(id))errors.push('존재하지 않는 공식 세세항목 ID');
 if(!Array.isArray(q.sourceIds)||q.sourceIds.some(id=>!registry[id]))errors.push('등록되지 않은 출처');
 const evidence=q.review?.evidence;
 if(!Array.isArray(evidence))return [...errors,'근거 목록 형식 오류'];
 for(const e of evidence){
  if(!registry[e.sourceId]){errors.push('근거 출처 미등록');continue;}
  if(!q.sourceIds?.includes(e.sourceId))errors.push('근거 출처가 문항 출처 목록에서 누락');
  if(e.sourceId==='qnet-2025-2029'&&(!criteria.has(e.criterionId)||!q.criterionIds?.includes(e.criterionId)))errors.push('공식 항목 연결 근거 불일치');
  if(registry[e.sourceId]?.snapshots?.length && e.sourceId!=='qnet-2025-2029'){
   const snapshot=audit.snapshots.get(`${e.sourceId}:${e.snapshot}`);
   if(!snapshot?.text||snapshot.sha256!==e.sha256)errors.push('법령 스냅샷 또는 해시 근거 오류');
   else if(typeof e.quote!=='string'||normalized(e.quote).length<4||!snapshot.text.includes(normalized(e.quote)))errors.push('법령 인용문 원문 불일치');
   if(registry[e.sourceId].effectiveDate&&e.effectiveDate!==registry[e.sourceId].effectiveDate)errors.push('법령 시행일 불일치');
   if(!e.locator?.trim())errors.push('법령 위치 누락');
  }
 }
 if(q.review?.status==='verified'){
  if(q.review.level!=='internal-source-review')errors.push('검수 단계 누락');
  for(const id of q.criterionIds||[])if(!evidence.some(e=>e.sourceId==='qnet-2025-2029'&&e.criterionId===id))errors.push('공식 세세항목 대조 근거 누락');
  if(!evidence.some(e=>e.sourceId!=='qnet-2025-2029'))errors.push('정답 정확성 검수 자료 누락');
 }
 return errors;
}
export function coverage(bank, criterion=official){
 return criterion.items.map(c=>({...c,total:bank.filter(q=>q.criterionIds?.includes(c.id)).length,verified:bank.filter(q=>q.criterionIds?.includes(c.id)&&q.review?.status==='verified'&&q.review.accuracyChecked===true&&q.review.officialMapped===true).length}));
}
