import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

// Render actual ported React components in an isolated browser; no Auth,
// Firestore, production credentials or application network calls are used.
test('shared source fields and accordion preserve values, accessibility and responsive geometry', async () => {
  const root = resolve('react-app');
  const dir = await mkdtemp(resolve(root, 'p1-ui-fixture-'));
  let server, browser;
  try {
    await writeFile(resolve(dir,'index.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="./fixture.jsx"></script></body></html>');
    await writeFile(resolve(dir,'fixture.jsx'), `import React,{useState} from 'react';
      import {createRoot} from 'react-dom/client';
      import {DynamicField} from '@/components/DynamicField';
      import {PlatformCardAccordionHeader} from '@/components/PlatformCardAccordionHeader';
      import '@/ui/PlatformOwnersPage-dynamic.css';
      import '@/ui/AdminUsersPage-dynamic.css';
      import '@/ui/telegram-dynamic.css';
      function Fixture(){const [open,setOpen]=useState(false);const [name,setName]=useState('');const [plan,setPlan]=useState('monthly');
        return <main className="platform-shell" style={{padding:12,maxWidth:600,margin:'auto'}}>
        <section className="platform-card-collapsible" data-expanded={open}>
          <PlatformCardAccordionHeader titleId="title" panelId="panel" title="ตั้งค่าระบบ" description="ข้อมูลตัวอย่าง" icon="bi bi-gear" expanded={open} onToggle={()=>setOpen(x=>!x)}/>
          <div id="panel" className="platform-card-accordion-panel owner-modal" hidden={!open}>
            <DynamicField id="name" label="ชื่อผู้ใช้งาน" value={name} className="platform-owner-dynamic-field" description="กรอกชื่อ"><input id="name" required value={name} onChange={e=>setName(e.target.value)}/></DynamicField>
            <DynamicField id="plan" label="แพ็กเกจ" kind="select" value={plan} className="platform-owner-dynamic-field"><select id="plan" value={plan} onChange={e=>setPlan(e.target.value)}><option value="monthly">รายเดือน</option><option value="yearly">รายปี</option></select></DynamicField>
          </div>
        </section></main>}
      createRoot(document.getElementById('root')).render(<Fixture/>);`);
    server = await createServer({configFile:false,root,plugins:[react()],resolve:{alias:{'@':resolve(root,'src')}},server:{host:'127.0.0.1',port:0},publicDir:false});
    await server.listen();
    const port = server.httpServer.address().port;
    browser = await chromium.launch({channel:'chrome',headless:true});
    for (const width of [320,390,768,1440]) {
      const page = await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
      try {
        await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
        await page.goto('http://127.0.0.1:'+port+'/'+basename(dir)+'/index.html');
        const toggle=page.getByRole('button',{name:/ตั้งค่าระบบ/});
        await toggle.waitFor();
        assert.equal(await toggle.getAttribute('aria-expanded'),'false');
        assert.equal(await page.locator('#panel').isVisible(),false);
        await toggle.click();
        const name=page.getByLabel('ชื่อผู้ใช้งาน');
        await name.fill('Owner Demo');
        assert.equal(await name.getAttribute('aria-describedby'),'name-info');
        await page.locator('#plan').selectOption('yearly');
        await toggle.click();
        assert.equal(await name.isVisible(),false);
        await toggle.click();
        assert.equal(await name.inputValue(),'Owner Demo');
        assert.equal(await page.locator('#plan').inputValue(),'yearly');
        const geometry=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,control:document.querySelector('#name').getBoundingClientRect().height,label:document.querySelector('label[for="name"]').getBoundingClientRect().top,input:document.querySelector('#name').getBoundingClientRect().top}));
        assert.ok(geometry.scroll<=width+1,JSON.stringify(geometry));
        assert.ok(geometry.control>=44,JSON.stringify(geometry));
        assert.ok(geometry.label-geometry.input<=8,JSON.stringify(geometry));
      } finally {await page.close();}
    }
  } finally {await browser?.close();await server?.close();await rm(dir,{recursive:true,force:true});}
});
