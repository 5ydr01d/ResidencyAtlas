#!/usr/bin/env python3
import json,re,sys
from pathlib import Path
s=Path(sys.argv[1]).read_text(encoding='utf-8')
m=re.fullmatch(r'window\.QUESTION_BANK\s*=\s*(\[.*\])\s*;\s*',s,re.S)
if not m:raise SystemExit('Question asset is not a valid window.QUESTION_BANK JSON array')
q=json.loads(m.group(1)); assert len(q)==764,'Expected 764 questions, got '+str(len(q))
assert len({x['id'] for x in q})==len(q),'Duplicate question IDs'
required={'id','subject','subtopic','questionType','stemMarkdown','appearance','options','coverageTitle','originalMarkdown','answerStatus'}
for x in q:
 assert required<=set(x),'Missing fields in '+str(x.get('id'))
 assert x['subject']!='Unclassified','Missing subject: '+x['id']
 assert x['options'],'Missing options: '+x['id']
assert sum(x['questionType']=='tf' for x in q)>500,'Unexpectedly low T/F count'
assert sum(x['questionType']=='sba' for x in q)>50,'Unexpectedly low SBA count'
print('PASS: %d unique questions; %d subjects.'%(len(q),len({x['subject'] for x in q})))
print('Source-key parsing is structural only and does not medically verify answers.')
