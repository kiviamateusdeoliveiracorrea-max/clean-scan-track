"""Read-only authenticated regression checks for promoted Fase 2B policies.
Run after minting the intended account session. Optional SECURITY_PHOTO_AUDIT_ID
checks a known audit photo uploaded by another authorized account.
"""
import asyncio,json,os
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
 session_file=os.environ.get('SECURITY_SESSION_FILE',os.path.expanduser('~/.cache/lovable-auth/session.json'))
 with open(session_file) as f: minted=json.load(f)
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True)
  context=await browser.new_context(viewport={'width':1280,'height':1800})
  page=await context.new_page(); errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto('http://localhost:8080')
  await page.evaluate('([k,v])=>localStorage.setItem(k,v)',[minted['storage_key'],json.dumps(minted['session'])])
  await page.evaluate("localStorage.setItem('active-unit-id','664abb8d-f9ae-4d7c-ae3d-6c719426679e')")
  for route,heading in [('/','Dashboard Executivo'),('/areas','Áreas'),('/auditores','Auditores'),('/auditorias','Auditorias 5S'),('/auditorias-processo','Auditorias de Processo'),('/nao-conformidades','Não Conformidades'),('/minha-conta','Minha conta'),('/perguntas-processo','Cadastro de Perguntas — Auditoria de Processos'),('/perguntas','Cadastro de Perguntas')]:
   await page.goto('http://localhost:8080'+route)
   await page.get_by_role('heading',name=heading,exact=True).wait_for(timeout=20000)
   await page.wait_for_timeout(2500)
   if route in ['/areas','/auditores']:
    assert not await page.get_by_text('0 cadastrada(s)',exact=True).count()
    assert not await page.get_by_text('Nenhum auditor cadastrado.',exact=True).count()
   if route == '/auditorias-processo':
    links=page.locator('main a[href^="/auditorias-processo/"]').filter(has_not=page.get_by_text('Nova auditoria de processo',exact=True))
    for href in await links.evaluate_all('(a)=>a.map(x=>x.getAttribute("href")).filter(x=>!x.endsWith("/nova"))'):
     await page.goto('http://localhost:8080'+href); await page.wait_for_timeout(2500)
     assert 'Acesso negado' not in await page.locator('main').inner_text()
     record_id=href.rsplit('/',1)[-1]
     result=await page.evaluate('''async(id)=>{
      const {supabase:s}=await import('/src/integrations/supabase/client.ts');
      const r=await s.from('auditorias_processo').select('id').eq('id',id).single();
      return {id:r.data?.id,error:r.error?.message};
     }''',record_id)
     assert result['id']==record_id and not result.get('error')
     print('PASS process detail')
   if route == '/nao-conformidades':
    await page.get_by_role('combobox').filter(has_text='Todas as severidades').click()
    await page.get_by_role('option',name='Crítica',exact=False).first.click()
    await page.wait_for_timeout(500)
    print('PASS NC severity filter')
   print('PASS',route)
  checks=await page.evaluate('''async()=>{
   const {supabase:s}=await import('/src/integrations/supabase/client.ts');
   const uid=(await s.auth.getUser()).data.user.id;
   const profile=await s.from('profiles').select('id').eq('id',uid);
   const colleagues=await s.from('profiles').select('id');
   const areas=await s.from('areas').select('id,unit_id');
   const units=await s.from('units').select('id');
   const five=await s.from('perguntas_auditoria').select('id');
   const process=await s.from('perguntas_processo').select('id');
   return {own:profile.data?.length,colleagues:colleagues.data?.length,areas:areas.data?.length,units:units.data?.length,five:five.data?.length,process:process.data?.length,errors:[profile.error,colleagues.error,areas.error,units.error,five.error,process.error].filter(Boolean).map(e=>e.message)};
  }''')
  assert not checks['errors'],checks['errors']
  assert checks['own']==1
  assert checks['colleagues']>1
  assert checks['areas']>0 and checks['units']>0 and checks['five']>0 and checks['process']>0
  print('PASS own profile, colleagues, areas, units, both question catalogs',checks)
  audit=os.environ.get('SECURITY_PHOTO_AUDIT_ID')
  if audit:
   await page.goto('http://localhost:8080/auditorias/'+audit)
   await page.get_by_text('Fotos da auditoria (1)',exact=False).wait_for(timeout=20000)
   image=page.get_by_alt_text('Foto da auditoria',exact=True)
   await image.wait_for(); await page.wait_for_timeout(2000)
   assert await image.evaluate('(i)=>i.complete&&i.naturalWidth>0')
   await page.screenshot(path='/tmp/browser/security-promotion/shared_photo.png')
   print('PASS 5S detail and photo from another authorized uploader')
  assert not errors,errors
  print('PASS no browser runtime errors')
  await browser.close()
asyncio.run(main())
