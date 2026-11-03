"""Run with the same temporary account after removing its auditor role."""
import os,requests
base=os.environ['SUPABASE_URL']; key=os.environ['SUPABASE_PUBLISHABLE_KEY']
r=requests.post(base+'/auth/v1/token?grant_type=password',headers={'apikey':key},json={'email':os.environ['PROCESS_TEST_EMAIL'],'password':os.environ['PROCESS_TEST_PASSWORD']},timeout=30)
assert r.status_code==200,'Login failed'
h={'apikey':key,'Authorization':'Bearer '+r.json()['access_token'],'Prefer':'return=representation'}
def req(method,path,body=None):return requests.request(method,base+'/rest/v1/'+path,headers=h,json=body,timeout=30)
r=req('GET','perguntas_processo?area_nome=eq.CTT'); assert r.status_code==200 and len(r.json())==33; print('PASS: Consulta reads authorized checklist')
r=req('POST','auditorias_processo',{'area_id':'6ce4f7ea-4038-454d-a45a-6a426128a77d','unit_id':'664abb8d-f9ae-4d7c-ae3d-6c719426679e'}); assert r.status_code>=400; print('PASS: Consulta cannot create audit')
r=req('PATCH','perguntas_processo?id=eq.'+req('GET','perguntas_processo?area_nome=eq.CTT').json()[0]['id'],{'peso':2}); assert r.status_code==200 and r.json()==[]; print('PASS: Consulta cannot edit questions')
