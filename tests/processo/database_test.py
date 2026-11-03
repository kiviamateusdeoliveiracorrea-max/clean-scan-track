"""Integration suite. Supply PROCESS_TEST_EMAIL/PASSWORD for an authorized CTT auditor.
Run against a disposable test account; only process records tagged by this suite are removed.
"""
import concurrent.futures
import os
import uuid
import requests

BASE = os.environ['SUPABASE_URL']
KEY = os.environ['SUPABASE_PUBLISHABLE_KEY']
AREA = '6ce4f7ea-4038-454d-a45a-6a426128a77d'
UNIT = '664abb8d-f9ae-4d7c-ae3d-6c719426679e'
OTHER_AREA = 'aac18824-ccac-41d0-86ec-f969cf5861cb'
created = []
checks = 0

def check(value, label):
    global checks
    assert value, label
    checks += 1
    print('PASS:', label)

login = requests.post(BASE+'/auth/v1/token?grant_type=password', headers={'apikey': KEY}, json={
    'email': os.environ['PROCESS_TEST_EMAIL'], 'password': os.environ['PROCESS_TEST_PASSWORD']}, timeout=30)
assert login.status_code == 200, 'Test account sign-in failed'
HEAD = {'apikey': KEY, 'Authorization': 'Bearer '+login.json()['access_token'], 'Prefer': 'return=representation'}

def req(method, path, data=None):
    return requests.request(method, BASE+'/rest/v1/'+path, headers=HEAD, json=data, timeout=30)

def draft():
    r = req('POST', 'auditorias_processo', {'area_id': AREA, 'unit_id': UNIT, 'observacoes': 'Integration test '+str(uuid.uuid4())})
    assert r.status_code == 201, 'Draft insert failed'
    aid = r.json()[0]['id']; created.append(aid); return aid

def rpc(aid, answers, actions=None, **extra):
    return req('POST', 'rpc/complete_audit_processo', {'p_id': aid, 'p_audit': {'area_id': AREA, 'unit_id': UNIT, 'processo_claro': False, 'nota_final': 0, **extra}, 'p_answers': answers, 'p_acoes': actions if actions is not None else []})

def counts(aid):
    return len(req('GET','respostas_processo?auditoria_processo_id=eq.'+aid).json()),len(req('GET','acoes_processo?auditoria_processo_id=eq.'+aid).json())

try:
    questions = req('GET', 'perguntas_processo?area_nome=eq.CTT&ativo=eq.true&order=ordem').json()
    check(len(questions)==33, 'CTT global checklist has 33 questions')
    visible = req('GET','perguntas_processo').json()
    check(all(q['area_nome']=='CTT' for q in visible), 'Questions restricted to authorized area')
    denied = req('POST','auditorias_processo', {'area_id': OTHER_AREA, 'unit_id': UNIT})
    check(denied.status_code>=400, 'Auditor cannot create in unauthorized area')
    denied = req('POST','auditorias_processo', {'area_id': AREA, 'unit_id': 'aa6862e2-6407-4e8b-aa2a-58e41c2ff65f'})
    check(denied.status_code>=400, 'Auditor cannot create in unauthorized unit')
    ans = [{'pergunta_id':q['id'],'resposta':'SIM'} for q in questions]
    aid = draft()
    check(req('PATCH','auditorias_processo?id=eq.'+aid, {'status':'concluida'}).status_code>=400, 'Direct empty completion blocked')
    variants = [('missing', ans[1:]), ('duplicate',ans+[ans[0]]), ('NA',[{**ans[0],'resposta':'NA'}]+ans[1:]), ('null',[{**ans[0],'resposta':None}]+ans[1:]), ('extra',ans+[{'pergunta_id':str(uuid.uuid4()),'resposta':'SIM'}]), ('malformed',None)]
    for label, variant in variants:
        r = rpc(aid,variant)
        check(r.status_code>=400 and counts(aid)==(0,0), label+' rejected with no partial answers/actions')
    r=rpc(aid,ans,[{'o_que':'Valid'},{'o_que':''}])
    check(r.status_code>=400 and counts(aid)==(0,0), 'Action failure rolls back all answers and actions')
    check(req('GET','auditorias_processo?id=eq.'+aid).json()[0]['status']=='rascunho', 'Failed completion preserves draft')
    r=rpc(aid,ans,[{'o_que':'Verify process','como':'Check procedure'}])
    check(r.status_code==200, 'Authenticated auditor completes transaction')
    row=req('GET','auditorias_processo?id=eq.'+aid).json()[0]
    check(row['status']=='concluida' and all(row[k]==100 for k in ['nota_pessoas','nota_ambiente','nota_processo','nota_final']), 'All SIM yields 100 in every pillar and final')
    check(row['processo_claro'] is False and row['nota_final']==100, 'Closing clarity answer excluded from score and client total ignored')
    check(counts(aid)==(33,1), '33 answers and one action read back')
    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        results=list(pool.map(lambda _: rpc(aid,ans,[{'o_que':'Must not duplicate'}]),range(2)))
    check(all(r.status_code==200 for r in results) and counts(aid)==(33,1), 'Concurrent completion retries do not duplicate actions')
    aid2=draft()
    people=next(q for q in questions if q['categoria']=='Pessoas')
    mixed=[{**a,'resposta':'NÃO' if a['pergunta_id']==people['id'] else 'SIM'} for a in ans]
    check(rpc(aid2,mixed).status_code==200,'Mixed SIM/NÃO completion succeeds')
    row=req('GET','auditorias_processo?id=eq.'+aid2).json()[0]
    check(abs(row['nota_pessoas']-87.5)<1e-8 and abs(row['nota_final']-(87.5+100+100)/3)<1e-8,'Pillar percentage and equal average with unequal question counts')
    check(row['nota_final']<100,'Any NÃO prevents 100 percent')
    # Local override replaces global checklist; weights deliberately unequal.
    local=req('POST','perguntas_processo',[{'area_nome':'CTT','categoria':c,'ordem':999,'pergunta':'Integration override '+c,'unit_id':UNIT,'peso':99 if c=='Pessoas' else 1} for c in ['Pessoas','Ambiente','Processo']])
    assert local.status_code==201, 'Local questions insert failed'
    local_ids=[q['id'] for q in local.json()]
    try:
        aid3=draft(); local_ans=[{'pergunta_id':q['id'],'resposta':'NÃO' if q['categoria']=='Pessoas' else 'SIM'} for q in local.json()]
        check(rpc(aid3,local_ans).status_code==200 and counts(aid3)==(3,0),'Local override replaces 33 global questions')
        row=req('GET','auditorias_processo?id=eq.'+aid3).json()[0]
        check(abs(row['nota_final']-200/3)<1e-8,'Weights do not affect simple pillar average')
    finally:
        for aid in created:
            assert req('DELETE','auditorias_processo?id=eq.'+aid).status_code<400,'Audit cleanup failed'
        created.clear()
        for qid in local_ids:
            assert req('DELETE','perguntas_processo?id=eq.'+qid).status_code<400,'Override cleanup failed'
    anonymous=requests.post(BASE+'/rest/v1/rpc/complete_audit_processo',headers={'apikey':KEY},json={'p_id':str(uuid.uuid4()),'p_audit':{},'p_answers':[],'p_acoes':[]},timeout=30)
    check(anonymous.status_code in [401,403,404],'Anonymous RPC invocation blocked')
finally:
    for aid in created:
        assert req('DELETE','auditorias_processo?id=eq.'+aid).status_code<400,'Audit cleanup failed'
print('Completed',checks,'checks; all process test records removed')
