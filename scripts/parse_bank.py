#!/usr/bin/env python3
"""Turn source Markdown into structured records without correcting the source."""
import argparse,json,re,sys
from pathlib import Path
Q=re.compile(r'^####\s+(Q[\w.-]+)\s*$',re.M)
COVER=re.compile(r'^\*\*High-yield topic coverage\s*[—-]\s*(.+?)\*\*\s*$',re.M)
def parse(path):
    text=path.read_text(encoding='utf-8'); headings=[]; main='Unclassified'; sub='Unclassified'
    for m in re.finditer(r'^(##\s+.*|###\s+.*|####\s+Q[^\n]*)$',text,re.M):
        h=m.group(1)
        if h.startswith('## '):
            z=re.match(r'^##\s+\d+\.\s+(.+)$',h); main=z.group(1).strip() if z else h[3:].strip(); sub='Unclassified'
        elif h.startswith('### '):
            z=re.match(r'^###\s+[\d.]+\s+(.+)$',h); sub=z.group(1).strip() if z else h[4:].strip()
        else: headings.append((m.start(),main,sub))
    matches=list(Q.finditer(text)); out=[]
    for i,m in enumerate(matches):
        block=re.sub(r'\n{3,}','\n\n',text[m.start():matches[i+1].start() if i+1<len(matches) else len(text)].strip())
        qid=m.group(1); ctx=next((h for h in headings if h[0]==m.start()),None); subject,subtopic=(ctx[1],ctx[2]) if ctx else ('Unclassified','Unclassified')
        am=re.search(r'^\*Appeared in:\s*(.*?)\*\s*$',block,re.M); appearance=am.group(1).strip() if am else ''
        tm=re.search(r'^\*(True/False(?:\s*\([^*]+\))?|Single Best Answer(?:\s*\([^*]+\))?)\*\s*$',block,re.M); label=tm.group(1) if tm else ''
        typ='tf' if label.startswith('True/False') else ('sba' if label.startswith('Single Best Answer') else 'unknown')
        end=am.start() if am else (tm.start() if tm else len(block))
        stem=re.sub(r'^####\s+'+re.escape(qid)+r'\s*','',block[:end].strip(),count=1)
        opts=[]
        for om in re.finditer(r'^\s*-\s*([a-e])\)\s*(.+?)\s*$',block,re.M|re.I):
            raw=om.group(2).strip(); tx=re.search(r'(?:—|–|-)\s*\*\*([TF])\*\*\s*(?:✅)?\s*$',raw,re.I)
            truth=(tx.group(1).upper()=='T') if tx else None
            textopt=raw[:tx.start()].rstrip(' —–-') if tx else raw
            best=bool(re.search(r'\*\*Best answer\*\*|Best answer\s*✅?',raw,re.I))
            textopt=re.sub(r'\s*[—–-]\s*\*\*Best answer\*\*\s*✅?\s*$','',textopt,flags=re.I).strip()
            textopt=re.sub(r'\s*✅\s*$','',textopt).strip()
            opts.append({'key':om.group(1).lower(),'text':textopt,'truth':truth,'isBestAnswer':best,'hasSourceKey':truth is not None or best,'sourceLine':raw})
        cm=COVER.search(block); coverage=block[cm.start():].strip() if cm else ''
        years=sorted({int(y) for y in re.findall(r'\b(20\d{2})\b',appearance)})
        sessions=[v.strip() for v in re.split(r'\s*\|\s*',appearance) if v.strip()]; buckets=[]
        for v in sessions:
            low=v.lower()
            if 'march 2024' in low: b='March 2024 paper'
            elif 'residency' in low and '2025' in low: b='Residency March 2025'
            elif 'residency' in low and '2026' in low: b='Residency March 2026'
            elif 'diploma' in low and '2026' in low: b='Diploma 2026'
            else: b=v
            if b not in buckets:buckets.append(b)
        keyed=(typ=='tf' and bool(opts) and all(o['truth'] is not None for o in opts)) or (typ=='sba' and any(o['isBestAnswer'] for o in opts))
        plain=re.sub(r'[#*_\x60>]', ' ', block); plain=re.sub(r'\s+',' ',plain).strip().lower()
        out.append({'id':qid,'subject':subject,'subtopic':subtopic,'questionType':typ,'typeLabel':label,'stemMarkdown':stem,'appearance':appearance,'sessions':sessions,'sessionBuckets':buckets,'years':years,'options':opts,'coverageTitle':cm.group(1).strip() if cm else '','coverageMarkdown':coverage,'originalMarkdown':block,'answerStatus':'keyed' if keyed else 'needs-review','hasSourceKey':keyed,'sourceQuestionId':qid,'searchText':plain})
    return out
def main():
    ap=argparse.ArgumentParser(); ap.add_argument('source',type=Path); ap.add_argument('output',type=Path); ap.add_argument('--js',action='store_true'); a=ap.parse_args()
    data=parse(a.source); a.output.parent.mkdir(parents=True,exist_ok=True); payload=json.dumps(data,ensure_ascii=False,separators=(',',':'))
    a.output.write_text('window.QUESTION_BANK = '+payload+';\n' if a.js else json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    counts={}
    for x in data:counts[x['subject']]=counts.get(x['subject'],0)+1
    print('Parsed %d records; %d source-keyed; %d need answer-key review.'%(len(data),sum(x['answerStatus']=='keyed' for x in data),sum(x['answerStatus']!='keyed' for x in data)))
    for s,n in counts.items():print('  %s: %d'%(s,n))
    if len(data)!=764:sys.exit('Expected 764 question records; got %d'%len(data))
if __name__=='__main__':main()
