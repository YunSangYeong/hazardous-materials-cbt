import {studyBackup,clearStudy} from './storage.js';
import {PRACTICE_KEY,LEARNING_KEY,createPractice,choosePractice,nextPractice,restorePractice,emptyLearning,restoreLearning,recordAttempt} from './practice.js';
import {SUBJECT, AREAS, STORAGE_KEY, eligible, createExam, remaining, answer, submit, grade, restore} from './model.js';
const app = document.querySelector('#app'), notice = document.querySelector('#notice');
let sourceRegistry = {}, bank = [], exam = null, view = 'home', filter = '', area = '', page = 0, reviewOnly = true, safeStorage = true;
let practice=null, practiceArea='', learning=emptyLearning();
const blockedStorage=new Set();
const esc = v => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function save() {
  if (!safeStorage) return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(exam)); }
  catch { notice.textContent = '기록 저장이 차단되었거나 공간이 부족합니다. 이 창에서는 계속 풀 수 있지만 새로고침 시 복원되지 않을 수 있습니다.'; }
}
function saveStudy(key,value){
 if(blockedStorage.has(key))return;
 try{localStorage.setItem(key,JSON.stringify(value));}catch{blockedStorage.add(key);notice.textContent='학습 기록을 저장할 수 없습니다. 현재 창에서 계속 학습할 수 있지만 새로고침 시 복원되지 않을 수 있습니다.';}
}
function focusQuestion(scroll=false){document.querySelector('#question-title')?.focus({preventScroll:!scroll});if(scroll)window.scrollTo({top:0});}
function startPractice(fresh=true,ids=null){
 try{if(fresh||!practice)practice=createPractice(bank,ids?'':practiceArea,Math.random,ids);saveStudy(PRACTICE_KEY,practice);go('practice');focusQuestion(true);}catch(e){notice.textContent=e.message;}
}
function advancePractice(){if(!practice||practice.selected===null)return;practice=nextPractice(practice);saveStudy(PRACTICE_KEY,practice);render();focusQuestion(true);}
function currentQuestion(){return view==='exam'&&exam?bank.find(q=>q.id===exam.ids[exam.index]):view==='practice'&&practice?bank.find(q=>q.id===practice.ids[practice.index]):null;}
function bookmarkButton(q){const marked=learning.bookmarks.includes(q.id);return `<button data-bookmark="${esc(q.id)}" aria-pressed="${marked}" class="bookmark-button">${marked?'★ 북마크 해제':'☆ 북마크'}</button>`;}
function recordExam(){
 if(!exam||exam.submittedAt===null)return;
 const id=`${exam.startedAt}:${exam.ids.join(',')}`;if(learning.completedExams.includes(id))return;
 for(const qid of exam.ids)learning=recordAttempt(learning,bank.find(q=>q.id===qid),exam.answers[qid]||0);
 const r=grade(exam,bank);learning={...learning,completedExams:[...learning.completedExams,id],exams:[{at:exam.submittedAt,score:r.score,correct:r.correct,passed:r.passed},...learning.exams].slice(0,100)};saveStudy(LEARNING_KEY,learning);
}
function practicePicker(){return `<div class="subject-picker">${['',...AREAS].map(a=>`<button data-practice-area="${esc(a)}" class="${practiceArea===a?'picked':''}" aria-pressed="${practiceArea===a}">${a?esc(a):'전체 영역'}</button>`).join('')}</div>`;}
function practiceScreen(){
 if(!practice)return `<h1>랜덤 문제풀이</h1><section class="panel center"><span class="tag">한 문제씩, 확실하게</span><h2>어떤 영역을 공부할까요?</h2><p>답안을 선택하면 정답과 상세 해설을 바로 확인할 수 있습니다.</p>${practicePicker()}<div class="actions">${action('문제풀이 시작하기','practiceStart','primary')}</div></section>`;
 const q=currentQuestion(),revealed=practice.selected!==null,correct=practice.selected===q.answer;
 return `<h1>랜덤 문제풀이</h1><p class="muted">한 문제씩 이해하고, 해설로 확실하게 내 것으로 만드세요.</p><div class="practice-toolbar"><span class="tag">${esc(practice.area||'전체 영역')}</span><span>연속 정답 <b>${practice.streak}</b></span><span>이번 학습 정답률 <b>${practice.answered?Math.round(practice.correct/practice.answered*100):0}%</b> (${practice.correct}/${practice.answered})</span><label>학습 영역 변경 <select id="practice-area"><option value="">전체 영역</option>${AREAS.map(a=>`<option ${practice.area===a?'selected':''}>${esc(a)}</option>`).join('')}</select></label></div><section class="panel practice-question"><div class="question-meta"><span class="tag">${esc(q.topic)} · ${esc(q.difficulty)}</span>${bookmarkButton(q)}</div><p class="muted">${practice.cycle}번째 순회 · ${practice.index+1} / ${practice.ids.length}문항</p><h2 class="question" id="question-title" tabindex="-1">${esc(q.question)}</h2><div class="choices" role="group" aria-label="답안 선택">${q.options.map((v,i)=>`<button class="choice ${practice.selected===i+1?'selected':''} ${revealed&&q.answer===i+1?'answer-correct':''}" data-practice-choice="${i+1}" aria-pressed="${practice.selected===i+1}" ${revealed?'disabled':''}><b>${i+1}</b><span>${esc(v)}${revealed&&q.answer===i+1?' (정답)':''}</span></button>`).join('')}</div>${revealed?`<div class="answer-feedback ${correct?'good':'bad'}" role="status">${correct?'정답입니다! 잘하고 있어요.':`아쉬워요. 정답은 ${q.answer}번입니다.`}</div><div class="practice-explanation"><h3>정답 해설</h3><p>${esc(q.explanation)}</p><details class="evidence"><summary>출처 및 출제기준</summary><p>${esc(q.criterion)}</p>${q.review.evidence.map(e=>`<p>${esc(sourceRegistry[e.sourceId]?.title||e.sourceId)} · ${esc(e.locator)}</p>`).join('')}</details></div>`:''}<div class="actions">${action('다음 문제 →','practiceNext','primary',!revealed)}</div><p class="muted">답안을 선택하면 즉시 채점됩니다. 채점 후 <kbd>Space</kbd> 키로 다음 문제로 이동할 수 있습니다.</p></section>`;
}
function collectionScreen(kind){
 const ids=kind==='wrong'?Object.keys(learning.wrong):learning.bookmarks,items=bank.filter(q=>ids.includes(q.id));
 return `<h1>${kind==='wrong'?'오답노트':'북마크'}</h1><p>${items.length}문항 · ${kind==='wrong'?'틀린 문제와 미응답을 다시 확인하고, 맞힌 문제는 자동으로 제외합니다.':'다시 보고 싶은 문제를 모았습니다.'}</p>${items.length?`<div class="actions">${action(kind==='wrong'?'오답 다시 풀기':'북마크 문제 풀기',kind==='wrong'?'wrongPractice':'bookmarkPractice','primary')}</div>${items.map((q,i)=>`<details class="collection-item"><summary>${esc(q.id)} · ${esc(q.question.slice(0,160))}</summary>${bookmarkButton(q)}${reviewCard(q,i,learning.wrong[q.id]||null,kind!=='wrong')}</details>`).join('')}`:'<section class="panel center">아직 저장된 문제가 없습니다. 문제풀이를 시작해 보세요.</section>'}`;
}
function statsScreen(){return `<h1>학습 통계</h1><p class="muted">실전 모의시험과 랜덤 문제풀이 기록으로 학습의 방향을 찾아보세요.</p><div class="cards"><div class="card"><span>학습한 문제</span><strong>${learning.total}</strong></div><div class="card"><span>전체 정답률</span><strong>${learning.total?Math.round(learning.correct/learning.total*100):0}%</strong></div><div class="card"><span>오답노트</span><strong>${Object.keys(learning.wrong).length}</strong></div><div class="card"><span>완료한 시험</span><strong>${learning.completedExams.length}</strong></div></div><section class="panel"><h2>학습 영역별 정답률</h2>${AREAS.map(a=>{const r=learning.areas[a]||{total:0,correct:0};return `<p>${esc(a)} · ${r.correct} / ${r.total} (${r.total?Math.round(r.correct/r.total*100):0}%)</p>`;}).join('')}</section><section class="panel history-panel"><h2>최근 모의시험 기록</h2>${learning.exams.length?learning.exams.slice(0,20).map(e=>`<p>${esc(new Date(e.at).toLocaleString('ko-KR'))} · ${e.score.toFixed(1)}점 · ${e.passed?'합격':'불합격'}</p>`).join(''):'<p class="muted">아직 완료한 모의시험이 없습니다.</p>'}</section>`;}
function go(next) { view = next; saveStudy('hazardous-materials-cbt:last-view',next);render(); app.focus(); }
function action(label, id, cls = '', disabled = false) { return `<button data-action="${id}" class="${cls}" ${disabled ? 'disabled' : ''}>${label}</button>`; }
function home() {
 const count=bank.filter(eligible).length;
 return `<section class="hero"><span class="tag">합격을 향한 오늘의 한 걸음</span><h1>위험물기능사 필기 CBT 모의시험</h1><p>오늘의 한 문제, 합격에 한 걸음 더 가까이.</p></section><p class="criteria-note">2025–2029 출제기준 · 공식 과목명: <b>${SUBJECT}</b></p>
 <div class="mode-grid" aria-label="시험 모드"><section class="panel exam-mode"><span class="tag">실전처럼, 집중해서</span><h2>실전 모의시험</h2><p>60분의 집중, 60문제의 도전.<br>실제 시험 흐름으로 준비 상태를 확인하세요.</p><div class="mode-facts"><span>60문항</span><span>60분</span><span>60점 합격</span></div><p class="muted">36문항 이상 정답 시 합격 · 과목별 과락 없음<br>답안 선택 후 스페이스바로 다음 문제 이동</p><div class="actions">${action(exam&&exam.submittedAt===null?'시험 이어하기':'시험 시작','start','primary',count!==1000)}</div></section>
 <section class="panel practice-mode"><span class="tag">한 문제씩, 확실하게</span><h2>랜덤 문제풀이</h2><p>부담 없이 한 문제부터 시작하세요.<br>정답과 상세 해설을 바로 확인할 수 있어요.</p>${practicePicker()}<div class="actions">${action('문제풀이 시작하기','practiceStart','primary',count!==1000)}${practice?action('이전 학습 이어하기','practiceContinue'):''}</div></section></div>
 <div class="cards"><div class="card"><span>전 범위 혼합</span><strong>60 <small>문항</small></strong></div><div class="card"><span>시험시간</span><strong>60 <small>분</small></strong></div><div class="card"><span>합격 기준</span><strong>60 <small>점 이상</small></strong></div><div class="card"><span>문제은행</span><strong>1,000 <small>문항</small></strong></div></div>
 ${count===1000?'<p class="muted">출제 가능 1,000문항 · 출처 대조 내부검수 완료. 내부검수는 외부 전문가 인증이 아닙니다.</p>':`<div class="warning">문제은행 준비 중 · 출제 가능 ${count.toLocaleString()} / 1,000문항<br>실제 수록 ${bank.length}문항 · 검수 대기 ${bank.filter(q=>!eligible(q)).length}문항</div>`}
 <div class="actions">${action('문제은행 보기','bank')}</div><section class="panel history-panel"><h2>두 학습 영역, 하나의 시험과목</h2><p><b>A. ${AREAS[0]}</b><br>기초 화학, 물질의 상태, 연소·폭발, 화재 분류, 소화 원리·약제·설비</p><p><b>B. ${AREAS[1]}</b><br>제1–6류 위험물, 지정수량, 저장·취급, 운반·운송, 법령 및 안전관리</p><p class="muted">두 영역은 학습 편의를 위한 내부 분류입니다. 현행 공식 시험과목이 두 개라는 의미가 아닙니다. 모의시험의 영역별 균형 추출은 자체 학습 정책이며 공식 출제 비율이 아닙니다.</p></section>`;
}
function examScreen() {
  const q = bank.find(q => q.id === exam.ids[exam.index]);
  const answered = Object.keys(exam.answers).length;
  return `<div class="exam-top"><div><span class="tag">실전 모의시험</span><b>　${exam.index + 1} / 60</b></div><div aria-label="남은 시간" class="timer" id="timer"></div></div><div class="exam-grid"><section class="panel"><div class="question-meta"><span class="muted">${esc(q.area)} · ${esc(q.topic)}</span>${bookmarkButton(q)}</div><h1 class="question" id="question-title" tabindex="-1">${exam.index+1}. ${esc(q.question)}</h1><div class="choices" role="group" aria-label="답안 선택">${q.options.map((c,i) => `<button class="choice ${exam.answers[q.id] === i+1 ? 'selected' : ''}" data-choice="${i+1}" aria-pressed="${exam.answers[q.id] === i+1}"><b>${i+1}</b><span>${esc(c)}</span></button>`).join('')}</div><div class="actions">${action('← 이전 문제','prev','',exam.index===0)}${action('다음 문제 →','next','primary',exam.index===59)}</div><p class="muted">답안 선택 후 <kbd>Space</kbd> 키로 다음 문제로 이동합니다. 마지막 문제는 직접 제출하세요.</p></section><section class="panel"><h2>답안 현황</h2><p>${answered}문항 응답 · 미응답 ${60-answered}문항</p><progress value="${answered}" max="60" aria-label="응답 진행률"></progress><div class="numbers">${exam.ids.map((id,i) => `<button data-index="${i}" class="${exam.answers[id] ? 'answered' : ''} ${exam.index===i?'current':''}" aria-label="${i+1}번 ${exam.answers[id]?'응답':'미응답'}" ${exam.index===i?'aria-current="true"':''}>${i+1}</button>`).join('')}</div><div class="actions">${action('미응답 확인','unanswered')}${action('시험 종료','finish','primary')}</div><p class="muted">초록색: 응답 완료<br>테두리: 현재 문제<br>답안은 제출 전까지 변경할 수 있습니다.</p></section></div>`;
}
function resultScreen() {
  const r = grade(exam, bank);
  return `<section class="panel center"><span class="tag">시험 결과</span><h1>${r.passed?'합격':'불합격'}</h1><div class="result-score ${r.passed?'':'fail'}">${r.score.toFixed(1)}<small> 점</small></div><p>정답 ${r.correct} · 오답 ${r.wrong} · 미응답 ${r.unanswered}</p><p class="muted">점수는 정답 수 ÷ 60 × 100, 소수 둘째 자리에서 반올림합니다.<br>합격 여부는 반올림 점수가 아닌 정답 36개 이상으로 판단합니다.<br>오답 수는 답을 선택했으나 틀린 문항 수입니다. 미응답은 별도 표시합니다.</p>${AREAS.map(a=>`<p>${a}: ${r.areas[a].correct} / ${r.areas[a].total} (${r.areas[a].total ? (100*r.areas[a].correct/r.areas[a].total).toFixed(1):'0.0'}%)</p>`).join('')}<div class="actions">${action('오답 확인','review','primary')}${action('다시 시험보기','restart')}</div></section>`;
}
function reviewCard(q, i, answerValue, draft = false) {
  return `<article class="panel review"><span class="tag">${esc(q.id)} · ${esc(q.topic)}</span><h3>${i+1}. ${esc(q.question)}</h3><ol>${q.options.map((v,j)=>`<li ${j+1===q.answer?'class="correct"':''}>${esc(v)}${j+1===q.answer?' (정답)':''}</li>`).join('')}</ol>${!draft?`<p class="incorrect">내가 선택한 답: ${answerValue ? `${answerValue}번 · ${esc(q.options[answerValue-1])}`:'미응답'}</p>`:''}<div class="correct"><b>정답: ${q.answer}번</b><p>${esc(q.explanation)}</p></div><p class="muted">${esc(q.area)} · 난이도 ${esc(q.difficulty)}<br>공식 출제기준 관련 항목: ${esc(q.criterion)}<br>${draft?(eligible(q)?'원문 대조 · 내부검수 완료 · ':'정확성 검수 대기 · 실제 시험 출제 제외 · '):''}자체 제작 예상문제</p>${q.review.evidence?.length?`<details class="evidence"><summary>출처 및 검수 근거</summary><p class="muted">${esc(q.review.note || '')}</p>${q.review.evidence.map(e=>`<p><b>${esc(sourceRegistry[e.sourceId]?.title || e.sourceId)}</b><br>${esc(e.locator)}${sourceRegistry[e.sourceId]?.url?` · <a href="${esc(sourceRegistry[e.sourceId].url)}" target="_blank" rel="noopener noreferrer">원문</a>`:''}${e.effectiveDate?` · 시행일 ${esc(e.effectiveDate)}`:''}${e.quote?`<br>근거 발췌: ${esc(e.quote)}`:''}</p>`).join('')}</details>`:''}</article>`;
}
function reviewScreen() {
  const map = new Map(bank.map(q => [q.id,q]));
  const items = exam.ids.map((id,i)=>({q:map.get(id),i})).filter(({q})=>!reviewOnly || exam.answers[q.id]!==q.answer);
  return `<h1>문제와 해설 확인</h1><div class="actions">${action(reviewOnly?'전체 문항 보기':'오답·미응답만 보기','toggleReview')}${action('결과로 돌아가기','result')}</div><p>${items.length}문항</p>${items.length?items.map(({q,i})=>reviewCard(q,i,exam.answers[q.id])).join(''):'<section class="panel">모든 문항을 맞혔습니다.</section>'}`;
}
function bankScreen() {
  const items = bank.filter(q=>(!area||q.area===area)&&`${q.id} ${q.question} ${q.topic}`.includes(filter));
  const pages = Math.max(1, Math.ceil(items.length/10)); page = Math.min(page,pages-1);
  return `<h1>문제은행</h1><p>총 ${bank.length.toLocaleString()}문항 · 출제 가능 ${bank.filter(eligible).length.toLocaleString()}문항</p><p class="muted">문제를 펼치면 정답·해설·출처를 확인할 수 있습니다. 자체 제작 학습문항이며 실제 기출문제가 아닙니다.</p><div class="filters"><input id="search" aria-label="문항 검색" placeholder="문제 내용, ID, 주제 검색" value="${esc(filter)}"><select id="area" aria-label="학습 영역"><option value="">전체 영역</option>${AREAS.map(a=>`<option ${a===area?'selected':''}>${a}</option>`).join('')}</select></div><div class="pagination">${action('이전','bankPrev','',page===0)}<span>${page+1} / ${pages} · ${items.length}문항</span>${action('다음','bankNext','',page===pages-1)}</div>${items.slice(page*10,page*10+10).map((q,i)=>`<details><summary>${esc(q.id)} · ${esc(q.question.length>160?q.question.slice(0,160)+'…':q.question)}</summary>${reviewCard(q,page*10+i,null,true)}</details>`).join('')}`;
}
function render() {
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active', b.dataset.view===view));
  app.innerHTML = view==='home'?home():view==='exam'?examScreen():view==='practice'?practiceScreen():view==='wrong'||view==='bookmarks'?collectionScreen(view):view==='stats'?statsScreen():view==='result'?resultScreen():view==='review'?reviewScreen():bankScreen();
  tick();
}
function finish() { if (!exam || exam.submittedAt!==null) return; exam=submit(exam); save();recordExam(); go('result'); }
function tick() {
  if (!exam || exam.submittedAt!==null) return;
  const seconds = remaining(exam);
  const timer = document.querySelector('#timer');
  if (timer) { timer.textContent = `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;timer.classList.toggle('urgent',seconds<=300); }
  if (seconds===0) finish();
}
function downloadBackup(){
 try{
  const backup=studyBackup({getItem:key=>localStorage.getItem(key)},{exam,practice,learning,view});
  const url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='hazardous-materials-study-backup.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  notice.textContent=backup.storageReadable?'학습 기록을 백업했습니다.':'저장소 접근이 제한되어 현재 창의 학습 기록만 백업했습니다.';
 }catch{notice.textContent='백업 파일을 만들지 못했습니다. 브라우저의 다운로드·저장소 설정을 확인해 주세요.';}
}
function confirmReset(){
 if(document.querySelector('dialog[open]'))return;
 const dialog=document.createElement('dialog');dialog.setAttribute('aria-labelledby','reset-title');
 dialog.innerHTML='<h2 id="reset-title">학습 데이터를 초기화할까요?</h2><p>진행 중인 시험, 랜덤 학습, 오답노트, 북마크와 학습 통계가 삭제됩니다. 기본 문제은행 1,000문항은 유지됩니다.</p><p>필요한 기록을 먼저 백업하세요. 이 작업은 되돌릴 수 없습니다.</p><div class="actions"><button data-reset-cancel>취소</button><button data-reset-confirm class="danger">모든 데이터 초기화</button></div>';
 document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 dialog.querySelector('[data-reset-cancel]').onclick=()=>dialog.close();
 dialog.querySelector('[data-reset-confirm]').onclick=()=>{
  try{clearStudy(localStorage);}catch{notice.textContent='브라우저 저장소에 접근할 수 없어 초기화를 완료하지 못했습니다. 현재 창의 학습 기록은 유지합니다.';dialog.close();return;}
  exam=null;practice=null;practiceArea='';learning=emptyLearning();filter='';area='';page=0;reviewOnly=true;safeStorage=true;blockedStorage.clear();view='home';dialog.close();render();app.focus();notice.textContent='학습 데이터를 초기화했습니다. 기본 문제은행 1,000문항은 그대로 유지됩니다.';
 };
 dialog.showModal();dialog.querySelector('[data-reset-cancel]').focus();
}
function confirmFinish() {
  const unanswered = 60-Object.keys(exam.answers).length;
  const dialog = document.createElement('dialog');
  dialog.innerHTML=`<h2>시험을 제출할까요?</h2><p>미응답 ${unanswered}문항이 있습니다.<br>제출하면 답안을 변경할 수 없습니다.</p><div class="actions"><button id="cancel">계속 풀기</button><button id="confirm" class="primary">제출하고 채점</button></div>`;
  document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  dialog.querySelector('#cancel').onclick=()=>dialog.close();
  dialog.querySelector('#confirm').onclick=()=>{dialog.close();finish();};dialog.showModal();
}
function start(fresh = false) {
  if (!bank.every(q=>q.subject===SUBJECT)) return;
  if (exam && !fresh) { go(exam.submittedAt===null?'exam':'result'); return; }
  try {exam=createExam(bank); save();go('exam');} catch(e){notice.textContent=e.message;}
}
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b || b.disabled)return;
  if(b.dataset.action==='backup'){downloadBackup();return;}
  if(b.dataset.action==='reset'){confirmReset();return;}
  tick();
  if(b.dataset.bookmark){const id=b.dataset.bookmark;if(bank.some(q=>q.id===id)){learning={...learning,bookmarks:learning.bookmarks.includes(id)?learning.bookmarks.filter(x=>x!==id):[...learning.bookmarks,id]};saveStudy(LEARNING_KEY,learning);render();}return;}
  if(b.hasAttribute('data-practice-area')){practiceArea=b.dataset.practiceArea;render();return;}
  if(view==='practice'&&practice&&b.dataset.practiceChoice){const next=choosePractice(practice,bank,Number(b.dataset.practiceChoice));if(next!==practice){learning=recordAttempt(learning,currentQuestion(),Number(b.dataset.practiceChoice));practice=next;saveStudy(PRACTICE_KEY,practice);saveStudy(LEARNING_KEY,learning);render();focusQuestion();}return;}
  if(b.dataset.view){if(b.dataset.view==='exam')start();else go(b.dataset.view);return;}
  if(view==='exam' && exam.submittedAt===null) {
    if(b.dataset.choice){exam=answer(exam,exam.ids[exam.index],Number(b.dataset.choice));save();render();focusQuestion();return;}
    if(b.dataset.index!==undefined){exam={...exam,index:Number(b.dataset.index)};save();render();document.querySelector('#question-title').focus();return;}
  }
  switch(b.dataset.action){
    case 'practiceStart':startPractice();break;case 'practiceContinue':startPractice(false);break;case 'practiceNext':advancePractice();break;case 'wrongPractice':startPractice(true,Object.keys(learning.wrong));break;case 'bookmarkPractice':startPractice(true,learning.bookmarks);break;case 'start':start();break;case 'restart':start(true);break;case 'bank':go('bank');break;
    case 'prev':case 'next':if(view!=='exam'||exam.submittedAt!==null)break;exam={...exam,index:Math.max(0,Math.min(59,exam.index+(b.dataset.action==='next'?1:-1)))};save();render();document.querySelector('#question-title').focus();break;
    case 'unanswered':{if(view!=='exam')break;const idx=exam.ids.findIndex(id=>!exam.answers[id]);if(idx>=0){exam={...exam,index:idx};save();render();document.querySelector('#question-title').focus();}else notice.textContent='모든 문제에 응답했습니다.';break;}
    case 'finish':if(view==='exam'&&exam.submittedAt===null)confirmFinish();break;
    case 'review':go('review');break;case 'result':go('result');break;case 'toggleReview':reviewOnly=!reviewOnly;render();break;
    case 'bankPrev':page--;render();break;case 'bankNext':page++;render();break;
  }
});
document.addEventListener('input',e=>{if(e.target.id==='search'){filter=e.target.value;page=0;const pos=e.target.selectionStart;render();const el=document.querySelector('#search');el.focus();el.setSelectionRange(pos,pos);}});
document.addEventListener('change',e=>{if(e.target.id==='practice-area'){practiceArea=e.target.value;startPractice();return;}if(e.target.id==='area'){area=e.target.value;page=0;render();}});
document.addEventListener('keydown',e=>{
 if(e.defaultPrevented||(e.code!=='Space'&&e.key!==' ')||e.repeat||e.isComposing||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||document.querySelector('dialog[open]')||!['exam','practice'].includes(view))return;
 if(e.target instanceof Element&&e.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],button:not(:disabled),a,summary,[role="button"]'))return;
 tick();
 if(view==='practice'&&practice?.selected!==null&&practice){e.preventDefault();advancePractice();}
 else if(view==='exam'&&exam?.submittedAt===null&&exam.answers[exam.ids[exam.index]]&&exam.index<59&&remaining(exam)>0){e.preventDefault();exam={...exam,index:exam.index+1};save();render();focusQuestion(true);}
});
window.addEventListener('pageshow',tick);document.addEventListener('visibilitychange',tick);
window.addEventListener('storage',e=>{if([PRACTICE_KEY,LEARNING_KEY].includes(e.key)){blockedStorage.add(e.key);notice.textContent='다른 탭에서 학습 기록이 변경되었습니다. 새로고침 후 계속하세요.';}if(e.key===STORAGE_KEY){safeStorage=false;notice.textContent='다른 탭에서 시험 기록이 변경되었습니다. 충돌을 막기 위해 이 탭의 저장을 중지했습니다. 새로고침 후 계속하세요.';}});
try {
  const response=await fetch(new URL('../data/questions.json',import.meta.url));if(!response.ok)throw new Error('문제은행을 불러오지 못했습니다.');bank=await response.json();const sourceResponse=await fetch(new URL('../data/sources.json',import.meta.url));if(!sourceResponse.ok)throw new Error('출처 정보를 불러오지 못했습니다.');sourceRegistry=await sourceResponse.json();
  try{const raw=localStorage.getItem(STORAGE_KEY);exam=raw==='null'?null:restore(raw,bank);}catch(e){safeStorage=false;notice.textContent=e.message;}
  try{practice=restorePractice(localStorage.getItem(PRACTICE_KEY),bank);practiceArea=practice?.area||'';}catch(e){blockedStorage.add(PRACTICE_KEY);notice.textContent=e.message;}
  try{learning=restoreLearning(localStorage.getItem(LEARNING_KEY),bank);}catch(e){blockedStorage.add(LEARNING_KEY);notice.textContent=e.message;}
  recordExam();
  view=exam?(exam.submittedAt===null?'exam':'result'):'home';try{if(practice&&JSON.parse(localStorage.getItem('hazardous-materials-cbt:last-view'))==='practice')view='practice';}catch{}render();setInterval(tick,1000);
} catch(e){app.textContent=`실행 오류: ${e.message} 페이지를 다시 불러와 주세요.`;}
