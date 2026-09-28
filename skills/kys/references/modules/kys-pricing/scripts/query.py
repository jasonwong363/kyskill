#!/usr/bin/env python3
import argparse,json,sys
from pathlib import Path
p=argparse.ArgumentParser(description='查询 KY 本地历史报价；金额筛选仅对应账面金额')
p.add_argument('--query',default=''); p.add_argument('--customer',default=''); p.add_argument('--service',default='')
p.add_argument('--month',type=int,choices=range(1,13)); p.add_argument('--id'); p.add_argument('--include-other',action='store_true')
p.add_argument('--min-amount',type=float); p.add_argument('--max-amount',type=float)
a=p.parse_args()
if a.min_amount is not None and a.max_amount is not None and a.min_amount>a.max_amount: p.error('最低金额不能高于最高金额')
config=json.loads((Path(__file__).resolve().parents[1]/'references/library.json').read_text())
try: data=json.loads(Path(config['data_file']).expanduser().read_text())
except (FileNotFoundError,json.JSONDecodeError) as e: sys.exit('报价库缺失或格式错误：'+str(e))
records=[]
for r in data['records']:
 if a.id and r['id']!=a.id: continue
 if not a.include_other and not a.id and r['category']!='推广报价': continue
 if a.month and r['month']!=a.month: continue
 if a.customer.casefold() not in r['customer'].casefold(): continue
 hay=(r['customer']+' '+r['raw_delivery']).casefold()
 if any(q.casefold() not in hay for q in a.query.split()): continue
 if a.service and a.service.casefold() not in r['raw_delivery'].casefold() and not any(a.service.casefold() in i['service'].casefold() for i in r['items']): continue
 amount=r['ledger_amount']
 if a.min_amount is not None and (amount is None or amount<a.min_amount): continue
 if a.max_amount is not None and (amount is None or amount>a.max_amount): continue
 records.append(r)
records.sort(key=lambda r:(r['month'],r['id']),reverse=True)
print(json.dumps({'count':len(records),'amount_policy':data['amount_policy'],'message':'未找到符合条件的历史报价' if not records else '历史案例；请同时检查配置和待核对项','records':records},ensure_ascii=False,indent=2))
