export const SUBJECT = '위험물의 성질 및 안전관리';
export const AREAS = ['화재예방과 소화방법', '위험물의 화학적 성질 및 취급'];
export const DURATION = 60 * 60 * 1000;
export const STORAGE_KEY = 'hazardous-materials-cbt:v1';
export function shuffle(items, random = Math.random) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export const eligible = q => q.review?.status === 'verified' && q.review.officialMapped === true && q.review.accuracyChecked === true;
export function createExam(bank, now = Date.now(), random = Math.random) {
  const pool = bank.filter(eligible);
  if (pool.length !== 1000 || new Set(pool.map(q => q.id)).size !== 1000) throw new Error('공식 기준 대조와 정확성 검증을 마친 1,000문항이 필요합니다.');
  const a = shuffle(pool.filter(q => q.area === AREAS[0]), random);
  const b = shuffle(pool.filter(q => q.area === AREAS[1]), random);
  // 자체 학습 정책. 공식 출제 비율이 아님. 350/650인 경우 21/39문항.
  const countA = Math.max(1, Math.min(59, Math.round(60 * a.length / pool.length)));
  if (a.length < countA || b.length < 60 - countA) throw new Error('학습 영역별 문항이 부족합니다.');
  function diverse(list, n) {
    const byTopic = new Map();
    for (const q of list) { if (!byTopic.has(q.topic)) byTopic.set(q.topic, []); byTopic.get(q.topic).push(q); }
    const groups = shuffle([...byTopic.values()], random), out = [];
    while (out.length < n) for (const group of groups) { if (group.length && out.length < n) out.push(group.pop()); }
    return out;
  }
  return {version: 1, ids: shuffle([...diverse(a, countA), ...diverse(b, 60-countA)], random).map(q => q.id), answers: {}, index: 0, startedAt: now, deadline: now + DURATION, submittedAt: null};
}
export const remaining = (exam, now = Date.now()) => Math.max(0, Math.ceil((exam.deadline - now) / 1000));
export function answer(exam, id, choice, now = Date.now()) {
  if (exam.submittedAt !== null || remaining(exam, now) === 0 || !exam.ids.includes(id) || !Number.isInteger(choice) || choice < 1 || choice > 4) return exam;
  return {...exam, answers: {...exam.answers, [id]: choice}};
}
export function submit(exam, now = Date.now()) { return exam.submittedAt !== null ? exam : {...exam, submittedAt: now}; }
export function grade(exam, bank) {
  const map = new Map(bank.map(q => [q.id, q]));
  const areas = Object.fromEntries(AREAS.map(a => [a, {correct: 0, total: 0}]));
  let correct = 0, unanswered = 0;
  for (const id of exam.ids) {
    const q = map.get(id); if (!q) throw new Error('저장된 시험 문항을 찾을 수 없습니다.');
    const ok = exam.answers[id] === q.answer;
    correct += Number(ok); unanswered += Number(!exam.answers[id]);
    areas[q.area].total++; areas[q.area].correct += Number(ok);
  }
  return {correct, wrong: exam.ids.length - correct - unanswered, unanswered, score: Math.round(correct / exam.ids.length * 1000) / 10, passed: correct >= 36 && exam.ids.length === 60, areas};
}
export function restore(raw, bank) {
  if (!raw) return null;
  const e = JSON.parse(raw), map = new Map(bank.map(q => [q.id, q]));
  if (e.version !== 1 || !Array.isArray(e.ids) || e.ids.length !== 60 || new Set(e.ids).size !== 60 || e.ids.some(id => !map.has(id) || !eligible(map.get(id))) || !Number.isInteger(e.index) || e.index < 0 || e.index >= 60 || !Number.isFinite(e.startedAt) || e.deadline - e.startedAt !== DURATION || !(e.submittedAt === null || Number.isFinite(e.submittedAt)) || !e.answers || typeof e.answers !== 'object' || Array.isArray(e.answers) || Object.entries(e.answers).some(([id,v]) => !e.ids.includes(id) || !Number.isInteger(v) || v < 1 || v > 4)) throw new Error('저장 기록이 손상되었거나 문제은행 버전이 다릅니다. 원본 기록을 보존했습니다.');
  return e;
}
