import json,re,sys,os
EXT='/home/claude/ext/_locales'
en=json.load(open(EXT+'/en/messages.json',encoding='utf8'))
DIRS={'de':'de','fr':'fr','es':'es','it':'it','pt':'pt_BR','ru':'ru','ja':'ja','zh':'zh_CN'}
PH=re.compile(r'\$[A-Za-z0-9_]+\$?')
def phs(s): return sorted(re.findall(r'\$(?:[1-9]|[A-Z]+\$)',s))
bad=0
for lang in sys.argv[1:]:
    tsv={}
    for l in open(f'/tmp/tr/{lang}.tsv',encoding='utf8').read().split('\n'):
        if not l: continue
        k,_,v=l.partition('\t'); tsv[k]=v
    out={}
    for k,e in en.items():
        m=e['message']
        v=tsv.get(k)
        if v is None: print(lang,'MISSING',k); bad+=1; v=m
        if m and phs(m)!=phs(v): print(lang,'PH',k,phs(m),phs(v)); bad+=1
        o={'message':v}
        if 'placeholders' in e: o['placeholders']=e['placeholders']
        if 'description' in e: o['description']=e['description']
        out[k]=o
    extra=[k for k in tsv if k not in en]
    if extra: print(lang,'EXTRA',extra); bad+=1
    d=f'{EXT}/{DIRS[lang]}'; os.makedirs(d,exist_ok=True)
    json.dump(out,open(d+'/messages.json','w',encoding='utf8'),ensure_ascii=False,indent=2)
    print(lang,'ok',len(out))
print('problems',bad)
