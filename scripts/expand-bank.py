"""Source-based authoring helpers. Only selected, explicitly reviewed manuscripts are published.
No numeric condition sweeps or filler questions. Synthetic software fixtures are never read.
"""
from pathlib import Path
import json,hashlib,re,unicodedata,random
ROOT=Path(__file__).resolve().parents[1]
def read(p):return json.loads((ROOT/p).read_text())
CRITERIA={c['id']:c for c in read('data/official-criteria.json')['items']}
SOURCES=read('data/sources.json')
def norm(s):return ''.join(c for c in unicodedata.normalize('NFKC',s)if c.isalnum())
def evidence(source,snapshot,locator,quote):
 item=next(x for x in SOURCES[source]['snapshots']if x['path']==snapshot)
 text=(ROOT/snapshot).read_text()
 if norm(quote) not in norm(text):raise ValueError(f'Quote not in source: {source} / {locator}')
 if hashlib.sha256((ROOT/snapshot).read_bytes()).hexdigest()!=item['sha256']:raise ValueError('Source hash changed')
 return dict(sourceId=source,snapshot=snapshot,sha256=item['sha256'],locator=locator,quote=quote,**({'effectiveDate':SOURCES[source]['effectiveDate']}if SOURCES[source].get('effectiveDate')else{}))
def make(number,*,concept,question,correct,wrong,explanation,cids,topic,area,evidences,difficulty='중급',reviewed=False,kind='concept'):
 if len(set([correct,*wrong]))!=4:raise ValueError(f'Invalid alternatives: {concept}')
 options=[correct,*wrong];random.Random(f'hm-{concept}').shuffle(options)
 criteria=[CRITERIA[c]for c in cids]
 official=[{'sourceId':'qnet-2025-2029','criterionId':c['id'],'locator':f"필기 {c['page']}쪽 / {c['id']} / {c['leaf']}"}for c in criteria]
 return dict(id=f'HM{number:04}',subject='위험물의 성질 및 안전관리',area=area,topic=topic,question=question,options=options,answer=options.index(correct)+1,explanation=explanation,difficulty=difficulty,criterion='; '.join(f"{c['main']} / {c['sub']} / {c['leaf']}"for c in criteria),criterionIds=cids,conceptKey=concept,origin='original',kind=kind,sourceIds=list(dict.fromkeys(['authored-draft','qnet-2025-2029',*[e['sourceId']for e in evidences]])),license='CC BY 4.0',review={'status':'verified'if reviewed else'pending','officialMapped':True,'accuracyChecked':reviewed,'reviewer':'Codex · 출처 대조 내부검수'if reviewed else None,'reviewedAt':'2026-10-19'if reviewed else None,'level':'internal-source-review'if reviewed else'pending-source-review','evidence':official+evidences,'note':'출처 원문과 정답·보기·해설을 대조한 내부검수. 외부 전문가 인증이 아님.'if reviewed else'출처 연결 후 정답·보기·해설 및 의미 중복 검토 대기. 출제 제외.'})
def science_rows():
 rows=[]
 for line in (ROOT/'data/science-concepts.tsv').read_text().splitlines():
  module,english,korean,definition,group,cid,topic=line.split('|');rows.append(dict(module=module,english=english,korean=korean,definition=definition,group=group,cid=cid,topic=topic))
 return rows

def science_questions(start):
 rows=science_rows();out=[]
 for row in rows:
  others=sorted((r for r in rows if r['korean']!=row['korean']),key=lambda r:(r['group']!=row['group'],r['module']!=row['module'],r['topic']!=row['topic'],r['korean']))
  choices=[r['korean']for r in others[:3]]
  file='docs/sources/chemistry-2e/'+row['module']+'.txt';text=(ROOT/file).read_text()
  if norm(row['english'])not in norm(text):raise ValueError(row)
  # Section glossary was read as the definition source. Korean definition is an original adaptation.
  ev=evidence('openstax-chemistry-2025',file,f"Chemistry 2e / {row['module']} / glossary: {row['english']}",next(x['term']+' '+x['meaning']for x in read('data/science-glossary.json')if x['module']==row['module']and x['term']==row['english']))
  out.append(make(start+len(out),concept='science-'+row['module']+'-'+re.sub(r'[^a-z0-9]+','-',row['english'].lower()).strip('-'),question=f"다음 설명을 가장 정확하게 나타내는 용어는?\n{row['definition']}",correct=row['korean'],wrong=choices,explanation=f"정답은 {row['korean']}({row['english']})이다. 핵심 정의: {row['definition']}. 정의의 대상과 조건을 구별한다. 근거: OpenStax Chemistry 2e의 해당 절 용어 정의. 이 문항은 고정 CC BY 4.0 판본을 참조하여 한국어로 재구성했다.",cids=[row['cid']],topic=row['topic'],area='화재예방과 소화방법',evidences=[ev],difficulty='기초',kind='source-concept'))
 return out

def calc_questions(start):
 out=[]
 for c in read('data/calculation-manuscripts.json'):
  file=f"docs/sources/chemistry-2e/{c['module']}.txt"
  ev=evidence('openstax-chemistry-2025',file,f"Chemistry 2e / {c['module']} / {c['term']}",(ROOT/file).read_text()[(ROOT/file).read_text().lower().index(c['term'].lower()):][:800])
  q=make(start+len(out),concept='calculation-'+c['key'],question=c['question'],correct=c['answer'],wrong=[v for v in c['choices']if v!=c['answer']],explanation=c['work'],cids=['Q01.01.02'],topic='기초 화학',area='화재예방과 소화방법',evidences=[ev],kind='calculation')
  q['calculation']={k:v for k,v in c.items()if k in ['key','inputs','expected','tolerance','unit','reaction']};out.append(q)
 return out

def fire_questions(start):
 out=[];rows=read('data/fire-definition-manuscripts.json')
 for row in rows:
  pool=sorted([x for x in rows if x['term']!=row['term']],key=lambda x:(x['source']!=row['source'],x['term']))
  wrong=[x['term']for x in pool[:3]]
  # Definitions containing nested lists retain only the self-contained defining sentence.
  definition=row['definition'].replace('다음 각 목의 것을 말한다.','것을 말한다.').replace('다음 각 목의 것과 같다.','것을 말한다.')
  source=row['source'];cid='Q01.03.07';topic='소화설비'
  if source=='nfpc101':cid='Q01.03.05'
  if source in ['nfpc107a','nfpc108']:cid='Q01.03.03';topic='소화약제'
  if row['term']in ['전역방출방식','국소방출방식']:cid='Q01.03.04';topic='소화 원리'
  if row['term']in ['심부화재','표면화재']:cid='Q01.02.02';topic='화재의 종류'
  if source in ['nfpc203','nfpc301']:cid='Q01.03.06'
  ev=evidence(source,f'docs/sources/{source}.txt',f"{SOURCES[source]['title']} / 제3조 / {row['term']}",row['text'])
  out.append(make(start+len(out),concept='fire-definition-'+row['term'],question=f"{SOURCES[source]['title']}의 용어 정의를 인용한 것이다. 이 원문이 정의하는 용어는?\n{definition}",correct=row['term'],wrong=wrong,explanation=f"정답은 '{row['term']}'이다. 원문 정의: {row['definition']} 이 문항은 표시한 화재안전성능기준의 용어를 묻는다. 위험물 제조소등의 구체적인 설비 적용은 시행규칙 별표 17 등 해당 기준을 함께 확인한다.",cids=[cid],topic=topic,area='화재예방과 소화방법',evidences=[ev],kind='equipment-principle'))
 return out

def equipment_cid(text):
 for words,no in [(['피난'],14),(['경보','감지기','수신기'],13),(['옥내소화전'],4),(['옥외소화전'],5),(['스프링클러'],6),(['물분무'],7),(['포소화','포방출'],8),(['불활성','이산화탄소'],9),(['할로','할론'],10),(['분말'],11),(['수동식소화기','소형소화기','대형소화기'],12),(['소요단위','능력단위'],3),(['적응성'],2),(['소화난이'],1)]:
  if any(w in text for w in words):return f'Q09.04.{no:02}'
 return 'Q09.04.02'

def legal_classification(row):
 if row.get('criterionIds'):return row['criterionIds'],row['topic']
 s=row['schedule'];text=row['text'];head=row['head'];article=re.search(r'제(\d+)조',head);n=int(article[1])if article else 0
 topic='위험물 제조소등의 시설기준';ids=[]
 if s.isdigit():
  z=int(s)
  if z==4:
   if '단축'in text or'특례'in head:ids=['Q09.01.04']
   elif any(w in head+text for w in ['안전거리','보유공지','설치장소']):ids=['Q09.01.01']
   elif any(w in head for w in ['벽','지붕','건축물','구조']):ids=['Q09.01.02']
   else:ids=['Q09.01.03']
  elif 5<=z<=12:ids=[f'Q09.02.{z-4:02}']
  elif 13<=z<=16:ids=[f'Q09.03.{z-12:02}']
  elif z==17:ids=[equipment_cid(head+' '+text)];topic='위험물 소방시설 점검'
  elif z==18:
   is_handling='취급의 기준'in head;common='공통'in head
   ids=[f"Q10.{2 if is_handling else 1:02}.{1 if common else 3:02}"];topic='위험물 저장 및 취급'
   cls=re.search(r'제([1-6])류',text)
   if cls and'유별'in head:ids=[f'Q{int(cls[1])+1:02}.02.{2 if is_handling else 1:02}','Q10.01.02','Q10.02.02']
  elif z==19:ids=['Q08.02.05'if any(w in text for w in ['표시','표지'])else'Q08.02.04'if any(w in text for w in ['충격','누설','전도','온도'])else'Q08.02.03'if'운반방법'in head else'Q08.02.02'];topic='위험물 운반 및 운송'
  elif z==21:ids=['Q08.01.03'];topic='위험물 운반 및 운송'
  elif z==1:ids=['Q11.02.01'];topic='위험물 관련 법령 및 안전관리'
  elif z==2:ids=['Q11.02.04'];topic='위험물 관련 법령 및 안전관리'
 elif s.startswith(('nfpc','nftc')):
  source_map={'nfpc101':'Q09.04.12','nftc101':'Q09.04.12','nfpc103':'Q09.04.06','nfpc104':'Q09.04.07','nfpc105':'Q09.04.08','nfpc106':'Q09.04.09','nfpc107':'Q09.04.10','nfpc107a':'Q09.04.09','nfpc108':'Q09.04.11','nfpc203':'Q09.04.13','nfpc301':'Q09.04.14'}
  ids=[source_map[s]];topic='위험물 소방시설 점검'
  if '대피'in text or'피난'in text and'화재'in text:ids.append('Q01.03.02')
 elif s=='hm-detailed':
  if n==24:ids=['Q11.02.01']
  elif 25<=n<=40:ids=['Q11.02.02']
  elif n==41:ids=['Q09.01.02']
  elif 42<=n<=98:ids=['Q09.02.02']
  elif 99<=n<=106:ids=['Q09.02.04']
  elif 107<=n<=109:ids=['Q09.02.06']
  elif 110<=n<=111:ids=['Q09.03.01']
  elif 112<=n<=126:ids=['Q09.03.03']
  elif 129<=n<=136:ids=[f'Q09.04.{n-125:02}'];topic='위험물 소방시설 점검'
  elif 127<=n<=128:ids=['Q09.04.02'];topic='위험물 소방시설 점검'
  elif 138<=n<=150:ids=['Q08.02.05'if'표시'in head else'Q08.02.02'];topic='위험물 운반 및 운송'
  elif 151<=n<=156:ids=['Q11.01.03'];topic='위험물 관련 법령 및 안전관리'
  else:ids=['Q11.01.01'];topic='위험물 관련 법령 및 안전관리'
 elif s=='hm-act':
  topic='위험물 관련 법령 및 안전관리'
  mapping={4:'Q10.01.01',5:'Q10.01.03',6:'Q11.02.01',7:'Q11.02.01',8:'Q11.02.02',9:'Q11.02.01',10:'Q11.02.03',11:'Q11.02.03',12:'Q11.02.04',13:'Q11.02.05',14:'Q11.01.01',15:'Q11.01.01',16:'Q11.02.02',17:'Q11.01.02',18:'Q11.01.03',19:'Q11.01.04',20:'Q08.02.01'if'운반자'in text else'Q08.02.02',21:'Q08.01.01'if'자격'in text else'Q08.01.03',22:'Q11.01.01',23:'Q11.02.05',24:'Q11.02.05',25:'Q11.02.04',26:'Q11.01.01',27:'Q01.03.02',28:'Q11.01.01'}
  ids=[mapping.get(n,'Q11.02.05'if n>=30 else'Q11.01.01')]
 elif s=='hm-rules':
  topic='위험물 관련 법령 및 안전관리'
  if n in [42,43]:ids=[f'Q09.04.{13 if n==42 else 14:02}']
  elif n==41:ids=[equipment_cid(text)]
  elif 28<=n<=40:ids=[f'Q09.02.{n-28:02}']if 29<=n<=36 else[f'Q09.03.{n-36:02}']if 37<=n<=40 else['Q09.01.03']
  elif 50<=n<=52:ids=['Q08.01.01'if n==52 and'자격'in text else'Q08.01.03'if n==52 else'Q08.02.02']
  elif 44<=n<=49:ids=['Q10.01.01']
  elif n in [63]:ids=['Q11.01.02']
  elif 64<=n<=71:ids=['Q11.01.03']
  elif 74<=n<=77:ids=['Q11.01.04']
  elif any(w in head for w in ['성능검사','탱크시험']):ids=['Q11.02.02']
  elif any(w in head for w in ['허가','완공']):ids=['Q11.02.01']
  elif '용도폐지'in head or'승계'in head:ids=['Q11.02.03']
  elif any(w in head for w in ['과징금','과태료','처분']):ids=['Q11.02.05']
  else:ids=['Q11.01.01']
 if not ids:raise ValueError(row)
 for cid in ids:
  if cid not in CRITERIA:raise ValueError((s,cid))
 return ids,topic

def legal_questions(start):
 out=[]
 for row in read('data/statutory-cloze-manuscripts.json'):
  source=row.get('source','hm-rules');snapshot=row['snapshot'];text=row['text'];key=row['key'];ids,topic=legal_classification(row)
  if source=='hm-rules'and row['schedule'].isdigit():location=f"시행규칙 별표 {row['schedule']} / PDF {row['page']}쪽 / {row['head']} / 원문항 {text.split(' ')[0]}"
  else:location=f"{SOURCES[source]['title']} / {row['head']} / 문언 발췌"
  ev=evidence(source,snapshot,location,text)
  masked=text.replace(key,'[ ㉠ ]',1)
  # Authoring prompt explicitly requests the cited provision's wording, not a free safety judgement.
  question=f"다음은 {location}의 문언이다. 빈칸 ㉠을 원문대로 복원한 것은?\n{masked}"
  explanation=f"정답은 '{key}'이다. 적용 원문: {text} 이 조항의 대상·조건·단서를 함께 적용한다. 근거는 {location}, 시행일 {SOURCES[source].get('effectiveDate','')}이다. 다른 종류의 시설이나 설비의 기준을 이 조항에 임의로 대입하지 않는다."
  out.append(make(start+len(out),concept='legal-provision-'+hashlib.sha256((snapshot+'|'+norm(text)).encode()).hexdigest()[:16],question=question,correct=key,wrong=row['wrong'],explanation=explanation,cids=ids,topic=topic,area='위험물의 화학적 성질 및 취급',evidences=[ev],kind='statutory-cloze'))
 return out

def hazard_questions(start):
 out=[]
 for row in read('data/hazard-manuscripts.json'):
  out.append(make(start+len(out),concept='hazard-'+row['key'],question=row['question'],correct=row['correct'],wrong=row['wrong'],explanation=row['explanation'],cids=row['criterionIds'],topic=row['topic'],area='위험물의 화학적 성질 및 취급',evidences=row['evidence'],kind='hazard-application'))
 return out

if __name__=='__main__':
 existing=read('data/questions.json');bank=existing[:140]
 for build in [science_questions,calc_questions,fire_questions,legal_questions,hazard_questions]:
  bank+=build(len(bank)+1)
 # Preserve a completed content review when the authored question is unchanged.
 for i,q in enumerate(bank):
  if i<len(existing) and all(q.get(k)==existing[i].get(k)for k in ['id','question','options','answer','explanation','criterionIds']) and existing[i].get('review',{}).get('status')=='verified':bank[i]=existing[i]
 (ROOT/'data/questions.json').write_text(json.dumps(bank,ensure_ascii=False,indent=2)+'\n')
 print('Actual manuscripts:',len(bank))
