import {test,expect} from '@playwright/test';
import {fixtureBank} from '../fixtures.js';
const KEY='hazardous-materials-cbt:v1';
async function fixture(page){await page.route('**/data/questions.json',r=>r.fulfill({json:fixtureBank()}));}
async function start(page){await fixture(page);await page.goto('/');await page.getByRole('button',{name:'시험 시작',exact:true}).click();await expect(page.locator('#timer')).toHaveText('60:00');}
async function submit(page){await page.getByRole('button',{name:'시험 종료',exact:true}).click();await page.getByRole('button',{name:'제출하고 채점'}).click();}
test('production bank enables exam and shows 1000 reviewed questions',async({page})=>{
 await page.goto('/');await expect(page.getByRole('button',{name:'시험 시작',exact:true})).toBeEnabled();await expect(page.locator('main')).toContainText('출제 가능 1,000문항');
 await page.getByRole('button',{name:'문제은행 보기'}).click();await expect(page.locator('main')).toContainText('총 1,000문항');await page.getByLabel('문항 검색').fill('원자번호');await expect(page.locator('main > details')).toHaveCount(2);await expect(page.locator('main > details').first()).toContainText('HM0001');
 await page.getByLabel('문항 검색').fill('HM0061');await page.locator('main > details > summary').click();await expect(page.locator('article')).toContainText('내부검수 완료');await page.locator('.evidence > summary').click();await expect(page.locator('.evidence')).toContainText('별표 1 비고 1');await expect(page.locator('.evidence')).toContainText('2026-07-01');
});
test('answers editable, navigation, no answer leakage, persistence and wrong review',async({page})=>{
 await start(page);await expect(page.locator('main')).not.toContainText('시험용 정답입니다');
 await page.locator('[data-choice="1"]').click();await page.locator('[data-choice="2"]').click();await expect(page.locator('[data-choice="2"]')).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'다음 문제 →',exact:true}).click();await page.locator('[data-choice="1"]').click();
 const before=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
 await page.reload();await expect(page.locator('[data-choice="1"]')).toHaveAttribute('aria-pressed','true');
 const after=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);expect(after.deadline).toBe(before.deadline);expect(after.ids).toEqual(before.ids);
 await page.getByRole('button',{name:'시험 종료',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('미응답 58문항');await page.getByRole('button',{name:'계속 풀기'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 await submit(page);await expect(page.locator('main')).toContainText('정답 1 · 오답 1 · 미응답 58');
 await page.getByRole('button',{name:'오답 확인',exact:true}).click();await expect(page.locator('article')).toHaveCount(59);await expect(page.locator('article').first()).toContainText('내가 선택한 답: 2번');await expect(page.locator('main')).toContainText('시험용 정답입니다');
 await page.getByRole('button',{name:'전체 문항 보기'}).click();await expect(page.locator('article')).toHaveCount(60);
 await page.getByRole('button',{name:'결과로 돌아가기'}).click();await page.getByRole('button',{name:'다시 시험보기'}).click();await expect(page.locator('#timer')).toHaveText('60:00');
 const again=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);expect(again.ids).not.toEqual(before.ids);expect(again.answers).toEqual({});
});
test('60 minutes auto-submits and late answer cannot change score',async({page})=>{
 await page.clock.install();await start(page);await page.locator('[data-choice="1"]').click();await page.clock.fastForward(60*60*1000);
 await expect(page.locator('main')).toContainText('정답 1 · 오답 0 · 미응답 59');await expect(page.locator('[data-choice]')).toHaveCount(0);
});
test('expired saved exam submits on return; submitted result is stable on reload',async({page})=>{
 await start(page);await page.evaluate(key=>{const s=JSON.parse(localStorage.getItem(key));s.startedAt=Date.now()-3601000;s.deadline=s.startedAt+3600000;localStorage.setItem(key,JSON.stringify(s));},KEY);
 await page.reload();await expect(page.locator('main')).toContainText('시험 결과');const at=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).submittedAt,KEY);await page.reload();expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).submittedAt,KEY)).toBe(at);
});
test('36 correct passes; 35 fails independent of rounding',async({page})=>{
 await start(page);
 for(const n of [35,36]){
  await page.evaluate(({key,n})=>{const e=JSON.parse(localStorage.getItem(key));e.answers={};for(const id of e.ids.slice(0,n))e.answers[id]=1;e.submittedAt=null;localStorage.setItem(key,JSON.stringify(e));},{key:KEY,n});await page.reload();await submit(page);
  await expect(page.getByRole('heading',{name:n===36?'합격':'불합격',exact:true})).toBeVisible();
 }
});
test('number jump and unanswered jump, touch targets and no horizontal overflow',async({page})=>{
 await start(page);await page.locator('[data-index="59"]').click();await expect(page.locator('.exam-top')).toContainText('60 / 60');await expect(page.getByRole('button',{name:'다음 문제 →'})).toBeDisabled();await page.locator('[data-choice="1"]').click();await page.getByRole('button',{name:'미응답 확인',exact:true}).click();await expect(page.locator('.exam-top')).toContainText('1 / 60');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 for(const box of await page.locator('[data-choice]').evaluateAll(els=>els.map(el=>({height:el.getBoundingClientRect().height}))))expect(box.height).toBeGreaterThanOrEqual(44);
});
test('corrupted storage preserved; storage denied still runs',async({page})=>{
 await page.goto('/');await page.evaluate(key=>localStorage.setItem(key,'{broken'),KEY);await page.reload();await expect(page.locator('#notice')).not.toBeEmpty();expect(await page.evaluate(key=>localStorage.getItem(key),KEY)).toBe('{broken');
 await fixture(page);await page.addInitScript(()=>{Storage.prototype.setItem=()=>{throw new DOMException('denied','SecurityError');};});await page.goto('/');await page.getByRole('button',{name:'시험 시작',exact:true}).click();await page.locator('[data-choice="1"]').click();await expect(page.locator('main')).toContainText('1문항 응답');
});
test('works under project path and within iframe',async({page})=>{
 await fixture(page);
 await page.route('**/hazardous-materials-cbt/**',async route=>{
  const url=new URL(route.request().url());const stripped=url.pathname.replace('/hazardous-materials-cbt','');
  if(stripped==='/data/questions.json')return route.fulfill({json:fixtureBank()});
  const response=await route.fetch({url:`http://127.0.0.1:4173${stripped}`});return route.fulfill({response});
 });
 await page.goto('/hazardous-materials-cbt/');await page.getByRole('button',{name:'시험 시작',exact:true}).click();await expect(page.locator('#timer')).toBeVisible();
 await page.goto('/');await page.evaluate(()=>{document.body.innerHTML='<iframe title="CBT" src="/hazardous-materials-cbt/" style="width:100%;height:900px;border:0"></iframe>';});
 const frame=page.frameLocator('iframe');await expect(frame.locator('#timer')).toBeVisible();expect(await frame.locator('html').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
});
