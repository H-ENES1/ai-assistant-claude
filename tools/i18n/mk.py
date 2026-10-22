import re,json,sys,os
EN={}
for l in open('/tmp/st/l10n_en.tsv',encoding='utf8').read().split('\n'):
    if l: k,_,v=l.partition('\t'); EN[k]=v
tags=lambda s: sorted(re.findall(r'</?[a-z]+(?: [^>]*)?>',s))
phs=lambda s: sorted(re.findall(r'\$\d',s))
def load(lang):
    T={}
    for l in open(f'/tmp/st/l10n/{lang}.tsv',encoding='utf8').read().split('\n'):
        if l.strip():
            k,_,v=l.partition('\t'); T[k]=v
    return T
def check(lang,T):
    bad=0
    miss=[k for k in EN if k not in T]; extra=[k for k in T if k not in EN]
    if miss: print(lang,'MISSING',miss[:15],len(miss)); bad+=1
    if extra: print(lang,'EXTRA',extra[:15]); bad+=1
    for k in EN:
        if k in T:
            if not T[k].strip(): print(lang,'EMPTY',k); bad+=1
            if tags(EN[k])!=tags(T[k]): print(lang,'TAGS',k,tags(EN[k]),tags(T[k])); bad+=1
            if phs(EN[k])!=phs(T[k]): print(lang,'PH',k); bad+=1
            if '\t' in T[k] or '\n' in T[k]: print(lang,'WS',k); bad+=1
    return bad
def nest(T):
    o={'d':{},'ui':{'conf':{},'models':{},'presetLabels':[None]*5,'loop':[None]*5},'x':{'eff':[None]*5,'pfL':[None]*3,'ps':[[None,None] for _ in range(3)],'bot':[None]*7},'s':{}}
    effr=[None]*5
    for k,v in T.items():
        p=k.split('.')
        if p[0]=='d': o['d']['.'.join(p[1:])]=v
        elif p[0]=='s': o['s'][p[1]]=v
        elif p[0]=='ui':
            if p[1]=='conf': o['ui']['conf'][p[2]]=v
            elif p[1]=='models': o['ui']['models'].setdefault(p[2],[None,None])[int(p[3])]=v
            elif p[1] in('presetLabels','loop'): o['ui'][p[1]][int(p[2])]=v
            else: o['ui'][p[1]]=v
        elif p[0]=='x':
            if p[1]=='eff': o['x']['eff'][int(p[2])]=v
            elif p[1]=='effr': effr[int(p[2])]=v
            elif p[1]=='pfL': o['x']['pfL'][int(p[2])]=v
            elif p[1]=='ps': o['x']['ps'][int(p[2])][0 if p[3]=='v' else 1]=v
            elif p[1]=='bot': o['x']['bot'][int(p[2])]=v
            else: o['x'][p[1]]=v
    keys=['low','medium','high','xhigh','max']
    o['x']['eff']=[[keys[i],o['x']['eff'][i],effr[i]] for i in range(5)]
    return o
if __name__=='__main__':
    tot=0; out={}
    for lang in sys.argv[1:]:
        T=load(lang); b=check(lang,T); tot+=b
        if not b: out[lang]=nest(T); print(lang,'ok',len(T))
    os.makedirs('/home/claude/site/l10n',exist_ok=True)
    for lang,o in out.items():
        json.dump(o,open(f'/home/claude/site/l10n/{lang}.json','w',encoding='utf8'),ensure_ascii=False)
    print('problems',tot)
