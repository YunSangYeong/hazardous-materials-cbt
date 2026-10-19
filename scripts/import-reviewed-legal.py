"""Import the manually source-reviewed legal manuscript, checking quotes and preserving IDs.
Does not fetch or approve arbitrary imported questions. The TSV is a reviewed authoring source.
"""
import json,hashlib,re,unicodedata
from pathlib import Path
root=Path(__file__).resolve().parents[1]
read=lambda p:json.loads((root/p).read_text())
def norm(s):
 s=unicodedata.normalize('NFKC',s)
 return ''.join(c for c in s if c.isalnum())
bank=read('data/questions.json');criteria={c['id']:c for c in read('data/official-criteria.json')['items']}
sources=read('data/sources.json');old={q['conceptKey']:q for q in bank}
for line in (root/'data/legal-reviewed.tsv').read_text().splitlines():
 key,cid,topic,question,correct,a,b,c,explanation,locator,quote=line.split('|')
 key='law-'+key;criterion=criteria[cid]
 # Korean labels are used in the authored TSV.
 m=re.match(r'별표 (\d+)',locator)
 snapshot=f'docs/sources/decree-schedule-{m.group(1)}.txt' if m else 'docs/sources/decree-current.txt'
 content=(root/snapshot).read_text()
 if norm(quote) not in norm(content):raise ValueError(f'Quote not found: {key}: {quote}')
 record=next(x for x in sources['hazardous-materials-law']['snapshots']if x['path']==snapshot)
 if hashlib.sha256((root/snapshot).read_bytes()).hexdigest()!=record['sha256']:raise ValueError('Snapshot changed')
 previous=old.get(key);number=int(previous['id'][2:])if previous else len(bank)+1
 options=[correct,a,b,c];rotation=number%4;options=options[rotation:]+options[:rotation]
 item=dict(id=f'HM{number:04}',subject='위험물의 성질 및 안전관리',area=criterion['area'],topic=topic,question=question,options=options,answer=options.index(correct)+1,explanation=explanation,difficulty='중급',criterion=f"{criterion['main']} / {criterion['sub']} / {criterion['leaf']}",criterionIds=[cid],conceptKey=key,origin='original',sourceIds=['authored-draft','qnet-2025-2029','hazardous-materials-law'],review={'status':'verified','officialMapped':True,'accuracyChecked':True,'reviewer':'Codex · 공식 원문 대조 내부검수','reviewedAt':'2026-10-19','level':'internal-source-review','evidence':[{'sourceId':'qnet-2025-2029','locator':f"필기 {criterion['page']}쪽 / {cid} / {criterion['leaf']}",'criterionId':cid},{'sourceId':'hazardous-materials-law','locator':locator,'effectiveDate':'2026-07-01','snapshot':snapshot,'sha256':record['sha256'],'quote':quote}],'note':'법령 본문·별표와 정답, 오답 보기, 해설을 내부 대조. 외부 전문가 독립검수 또는 공적 인증이 아님.'})
 if previous:
  for field in ['id','subject','area','topic','question','options','answer','explanation','criterionIds','conceptKey']:
   if previous.get(field)!=item.get(field):raise ValueError(f'Existing reviewed item differs: {previous["id"]} / {field}. Inspect and review manually; no overwrite.')
 else:bank.append(item)
(root/'data/questions.json').write_text(json.dumps(bank,ensure_ascii=False,indent=2)+'\n')
print('Total',len(bank),'internally source-reviewed',sum(q['review']['status']=='verified'for q in bank))
