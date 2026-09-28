#!/usr/bin/env python3
"""Query the local product catalog or calculate proposal inclusion counts."""
import argparse,json
from pathlib import Path
p=argparse.ArgumentParser(); p.add_argument('--view',choices=['stats','catalog','review'],default='stats'); p.add_argument('--month',type=int,choices=range(1,13)); a=p.parse_args()
config=json.loads((Path(__file__).resolve().parents[1]/'references/library.json').read_text()); base=Path(config['data_file']).expanduser().parent
if a.view=='catalog': print((base/'legacy-catalog.json').read_text()); raise SystemExit
if a.view=='review': print((base/'product-review.md').read_text()); raise SystemExit
mapping=json.loads((base/'product-mapping.json').read_text()); rows=mapping['records']
expected={r['id'] for r in json.loads((base/'quotes.json').read_text())['records'] if r['category']=='推广报价'}
actual={r['record_id'] for r in rows}
if expected!=actual or len(actual)!=len(rows): raise SystemExit('产品映射缺失、重复或过期，请先核对后统计')
if a.month: rows=[r for r in rows if r['month']==a.month]
unique={}
for r in rows:
 k=r['proposal_id']
 if k in unique:
  assert set(unique[k]['products'])==set(r['products']), '共享方案标签冲突'
 else: unique[k]=r
proposals=list(unique.values()); products=sorted({x for r in proposals for x in r['products']})
stats=[]
for product in products:
 matched=[r for r in proposals if product in r['products']]
 stats.append({'product':product,'proposal_count':len(matched),'by_month':{str(m):sum(r['month']==m for r in matched) for m in [7,8,9]},'proposal_ids':[r['proposal_id'] for r in matched],'source_record_ids':[r['record_id'] for r in matched]})
stats.sort(key=lambda x:(-x['proposal_count'],x['product']))
print(json.dumps({'method':mapping['method'],'input_records':len(rows),'unique_proposals':len(proposals),'with_delivery':sum(r['has_delivery'] for r in proposals),'missing_delivery':[r['record_id'] for r in proposals if not r['has_delivery']],'by_month':{str(m):{'proposals':sum(r['month']==m for r in proposals),'with_delivery':sum(r['month']==m and r['has_delivery'] for r in proposals)} for m in [7,8,9]},'separately_priced_comment_maintenance':{'total':sum(r['comment_billing']=='单独计价' for r in proposals),'by_month':{str(m):sum(r['month']==m and r['comment_billing']=='单独计价' for r in proposals) for m in [7,8,9]}},'stats':stats},ensure_ascii=False,indent=2))
