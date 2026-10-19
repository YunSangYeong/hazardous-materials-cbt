import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const bank=JSON.parse(fs.readFileSync(new URL('../../data/questions.json',import.meta.url)));
const KEY='hazardous-materials-cbt:practice:v1',EXAM='hazardous-materials-cbt:v1';
async function begin(page){await page.goto('/');await expect(page.locator('nav [data-view]')).toHaveCount(7);await expect(page.locator('.mode-grid > section')).toHaveCount(2);await page.getByRole('button',{name:'문제풀이 시작하기',exact:true}).click();}
async function state(page){return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);}
test('real random practice: immediate grade, Space, restoration, wrong notes, bookmarks and stats',async({page})=>{
 await begin(page);const first=await state(page);await page.keyboard.press('Space');expect((await state(page)).index).toBe(0);
 const q=bank.find(q=>q.id===first.ids[0]);await page.locator(`[data-practice-choice="${q.answer%4+1}"]`).click();await expect(page.getByRole('status').filter({hasText:'아쉬워요'})).toBeVisible();await expect(page.locator('.practice-explanation')).toContainText(q.explanation);
 await page.locator('main').getByRole('button',{name:'☆ 북마크',exact:true}).click();await page.locator('#question-title').focus();await page.keyboard.press('Space');let p=await state(page);expect(p.index).toBe(1);expect(p.ids).toEqual(first.ids);await expect(page.locator('.practice-explanation')).toHaveCount(0);
 await page.reload();expect((await state(page)).index).toBe(1);await expect(page.getByRole('heading',{name:'랜덤 문제풀이',exact:true})).toBeVisible();
 const second=bank.find(q=>q.id===p.ids[1]);await page.locator(`[data-practice-choice="${second.answer}"]`).click();await expect(page.locator('.answer-feedback')).toContainText('정답입니다');await expect(page.locator('.practice-toolbar')).toContainText('50%');
 await page.locator('nav [data-view="wrong"]').click();await expect(page.locator('main > details')).toHaveCount(1);await page.getByRole('button',{name:'오답 다시 풀기',exact:true}).click();await page.locator(`[data-practice-choice="${q.answer}"]`).click();await page.locator('nav [data-view="wrong"]').click();await expect(page.locator('main > details')).toHaveCount(0);
 await page.locator('nav [data-view="bookmarks"]').click();await expect(page.locator('main > details')).toHaveCount(1);await page.locator('nav [data-view="stats"]').click();await expect(page.locator('.cards')).toContainText('67%');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('area picker, focused controls and modified/held Space preserve native behavior',async({page})=>{
 await page.goto('/');await page.locator('[data-practice-area]').filter({hasText:'화재예방과 소화방법'}).click();await page.getByRole('button',{name:'문제풀이 시작하기',exact:true}).click();let p=await state(page);expect(p.ids).toHaveLength(350);
 const q=bank.find(q=>q.id===p.ids[0]);await page.locator(`[data-practice-choice="${q.answer}"]`).click();
 await page.keyboard.press('Shift+Space');expect((await state(page)).index).toBe(0);await page.locator('[data-bookmark]').focus();await page.keyboard.press('Space');expect((await state(page)).index).toBe(0);await expect(page.locator('[data-bookmark]')).toHaveAttribute('aria-pressed','true');
 await page.locator('#practice-area').focus();await page.keyboard.press('Space');await page.keyboard.press('Escape');expect((await state(page)).index).toBe(0);
 await page.locator('#question-title').focus();await page.evaluate(()=>document.querySelector('#question-title').dispatchEvent(new KeyboardEvent('keydown',{key:' ',code:'Space',repeat:true,bubbles:true})));expect((await state(page)).index).toBe(0);
 await page.keyboard.press('Space');expect((await state(page)).index).toBe(1);await page.locator('#practice-area').selectOption('위험물의 화학적 성질 및 취급');p=await state(page);expect(p.ids).toHaveLength(650);expect(p.index).toBe(0);
});
test('exam Space requires an answer, ignores dialog/controls and never submits the last question',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'시험 시작',exact:true}).click();await page.locator('#question-title').focus();await page.keyboard.press('Space');await expect(page.locator('.exam-top')).toContainText('1 / 60');
 await page.locator('[data-choice="1"]').click();await page.keyboard.press('Space');await expect(page.locator('.exam-top')).toContainText('2 / 60');
 await page.locator('[data-choice="2"]').click();await page.getByRole('button',{name:'시험 종료',exact:true}).click();await page.getByRole('button',{name:'계속 풀기',exact:true}).focus();await page.keyboard.press('Space');await expect(page.locator('dialog')).toHaveCount(0);await expect(page.locator('.exam-top')).toContainText('2 / 60');
 await page.locator('[data-index="59"]').click();await page.locator('[data-choice="1"]').click();await page.keyboard.press('Space');await expect(page.locator('.exam-top')).toContainText('60 / 60');expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).submittedAt,EXAM)).toBeNull();
 await expect(page.locator('.practice-explanation')).toHaveCount(0);
});
