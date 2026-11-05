"""Authenticated check: the signed-in account can create/edit/delete a 5S question
in an area of its own unit. Usage: python3 perguntas_write_test.py <AREA> <LABEL>"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright
AREA = sys.argv[1] if len(sys.argv) > 1 else 'CTT'
LABEL = sys.argv[2] if len(sys.argv) > 2 else 'user'
async def main():
    with open(os.path.expanduser('~/.cache/lovable-auth/session.json')) as f: minted = json.load(f)
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        page = await (await b.new_context(viewport={'width':1280,'height':1800})).new_page()
        await page.goto('http://localhost:8080')
        await page.evaluate('([k,v])=>localStorage.setItem(k,v)', [minted['storage_key'], json.dumps(minted['session'])])
        await page.goto('http://localhost:8080/'); await page.wait_for_timeout(3000)
        r = await page.evaluate('''async(area)=>{
          const {supabase:s}=await import('/src/integrations/supabase/client.ts');
          const o=[];
          const i=await s.from('perguntas_auditoria').insert({area_nome:area,categoria:'Pessoas',pergunta:'TESTE TEMPORARIO',peso:1,ativo:false}).select('id').single();
          o.push(['insert',!i.error,i.error?.message]); if(i.error) return o;
          const u=await s.from('perguntas_auditoria').update({pergunta:'TESTE EDITADO'}).eq('id',i.data.id); o.push(['update',!u.error,u.error?.message]);
          const d=await s.from('perguntas_auditoria').delete().eq('id',i.data.id); o.push(['delete',!d.error,d.error?.message]);
          const c=await s.from('perguntas_auditoria').select('id').eq('id',i.data.id); o.push(['cleanup',(c.data||[]).length===0,null]);
          return o;}''', AREA)
        print(r); assert all(x[1] for x in r), r
        print(f'PASS {LABEL} CRUD in {AREA}')
        await b.close()
asyncio.run(main())
