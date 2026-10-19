// Synthetic software test data ONLY. Never copied into the production question bank.
import {SUBJECT, AREAS} from '../src/model.js';
export function fixtureBank() {
  return Array.from({length:1000},(_,i)=>({id:`HM${String(i+1).padStart(4,'0')}`,subject:SUBJECT,area:AREAS[i<350?0:1],topic:`테스트 주제 ${i%10}`,question:`소프트웨어 테스트 전용 ${i+1}: 1을 고르세요.`,options:['1','2','3','4'],answer:1,explanation:'시험용 정답입니다. 학습용 문항이 아닙니다.',difficulty:'기초',criterion:'TEST ONLY',review:{status:'verified',officialMapped:true,accuracyChecked:true}}));
}
