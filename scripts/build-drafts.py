"""Build only the authored, unverified drafts. Never pad to the target count."""
import json
from pathlib import Path
root = Path(__file__).resolve().parents[1]
areas = {'A':'화재예방과 소화방법','B':'위험물의 화학적 성질 및 취급'}
previous = json.loads((root/'data/questions.json').read_text()) if (root/'data/questions.json').exists() else []
questions = []
for i, line in enumerate((root/'data/drafts.tsv').read_text().splitlines(),1):
    area, topic, question, correct, *rest = line.split('|')
    options, explanation = [correct, *rest[:3]], rest[3]
    rotation = i % 4
    options = options[rotation:] + options[:rotation]
    questions.append(dict(id=f'HM{i:04}',subject='위험물의 성질 및 안전관리',area=areas[area],topic=topic,
        question=question,options=options,answer=options.index(correct)+1,explanation=explanation,
        difficulty='기초',criterion=f'잠정 분류 / {areas[area]} / {topic}',conceptKey=f'draft-{i:04}',
        origin='original',sourceIds=['authored-draft'],review=dict(status='pending',officialMapped=False,
        accuracyChecked=False,reviewer=None,reviewedAt=None,evidence=[],note='자체 작성 원고. 공식 기준 원문 대조 및 별도 정확성 검수 전. 출제 제외.')))
for candidate in questions:
    index = int(candidate['id'][2:]) - 1
    if index < len(previous):
        old = previous[index]
        for field in ['id','subject','area','topic','question','options','answer','explanation']:
            if old[field] != candidate[field]:
                raise ValueError(f"Existing manuscript changed: {old['id']} / {field}. Review manually; not overwritten.")
    else:
        previous.append(candidate)
questions = previous
(root/'data/questions.json').write_text(json.dumps(questions,ensure_ascii=False,indent=2)+'\n')
print(f'실제 {len(questions)}문항. 기존 문항과 검수 정보를 보존하고 새 원고만 추가함.')
