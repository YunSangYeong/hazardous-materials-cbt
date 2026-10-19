import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const bank=JSON.parse(fs.readFileSync(new URL('../../data/questions.json',import.meta.url)));
const byId=new Map(bank.map(q=>[q.id,q]));
const KEY='hazardous-materials-cbt:v1';
test('real bank: draw, edit, restore, 36-pass grade, wrong explanations and new exam',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'시험 시작',exact:true}).click();
 const initial=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
 expect(initial.ids).toHaveLength(60);expect(new Set(initial.ids).size).toBe(60);expect(initial.deadline-initial.startedAt).toBe(3600000);
 const chosen=initial.ids.map(id=>byId.get(id));expect(chosen.filter(q=>q.area==='화재예방과 소화방법')).toHaveLength(21);expect(chosen.filter(q=>q.area==='위험물의 화학적 성질 및 취급')).toHaveLength(39);
 expect(await page.locator('.evidence').count()).toBe(0);expect(await page.locator('article').count()).toBe(0);
 for(let i=0;i<46;i++){
  await page.locator(`[data-index="${i}"]`).click();const q=chosen[i];
  if(i===0){await page.locator(`[data-choice="${q.answer%4+1}"]`).click();}
  const answer=i<36?q.answer:q.answer%4+1;await page.locator(`[data-choice="${answer}"]`).click();
  if(i===2){await page.reload();const restored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);expect(restored.ids).toEqual(initial.ids);expect(restored.deadline).toBe(initial.deadline);}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 await page.getByRole('button',{name:'시험 종료',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('미응답 14문항');await page.getByRole('button',{name:'제출하고 채점'}).click();
 await expect(page.getByRole('heading',{name:'합격',exact:true})).toBeVisible();await expect(page.locator('.result-score')).toContainText('60.0');await expect(page.locator('main')).toContainText('정답 36 · 오답 10 · 미응답 14');
 await page.reload();await expect(page.locator('main')).toContainText('정답 36 · 오답 10 · 미응답 14');
 await page.getByRole('button',{name:'오답 확인',exact:true}).click();await expect(page.locator('article')).toHaveCount(24);
 const q=chosen[36];const first=page.locator('article').first();await expect(first).toContainText(q.explanation);await expect(first).toContainText(q.options[q.answer-1]);await first.locator('.evidence > summary').click();await expect(first.locator('.evidence a').first()).toHaveAttribute('href',/^https:\/\//);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'결과로 돌아가기'}).click();await page.getByRole('button',{name:'다시 시험보기'}).click();const next=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);expect(next.ids).not.toEqual(initial.ids);expect(next.answers).toEqual({});expect(errors).toEqual([]);
});
test('real longest question and expanded evidence fit narrow screen',async({page})=>{
 const longest=[...bank].sort((a,b)=>b.question.length-a.question.length)[0];
 await page.goto('/');await page.getByRole('button',{name:'문제은행 보기'}).click();await page.getByLabel('문항 검색').fill(longest.id);await page.locator('main > details > summary').click();await page.locator('.evidence > summary').click();
 await expect(page.locator('article')).toContainText(longest.explanation);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/real-bank-${test.info().project.name}.png`,fullPage:true});
});
