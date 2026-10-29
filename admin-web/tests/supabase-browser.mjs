import { chromium, expect } from '@playwright/test';
import http from 'node:http';
import path from 'node:path';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { database,fixtures,ids } from '../../backend/tests/database.mjs';
import { createServer } from '../../backend/server.mjs';
import { transaction } from '../../backend/db.mjs';
import { reportEvent } from '../../backend/service.mjs';
const root=path.resolve(import.meta.dirname,'../..'),temporary=path.join(root,'backend/.browser-temp'),output=path.join(root,'docs/backend-verification');
await mkdir(temporary,{recursive:true});await mkdir(output,{recursive:true});process.env.TEMP=temporary;process.env.TMP=temporary;
const pool=await database();await fixtures(pool.db);let api,context;
const web=http.createServer(async(req,res)=>{
 try {
  if(req.url.startsWith('/api/')) {
   const upstream=http.request({host:'127.0.0.1',port:api.address().port,path:req.url,method:req.method,headers:req.headers},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res);});
   upstream.on('error',()=>{res.writeHead(503);res.end('{"error":"API unavailable"}');});req.pipe(upstream);return;
  }
  const directory=path.join(root,'admin-web/dist'),name=path.resolve(directory,'.'+new URL(req.url,'http://localhost').pathname);
  if(!name.startsWith(directory+path.sep)){res.writeHead(404);res.end();return;}
  let content;try{content=await readFile(name);}catch{content=await readFile(path.join(directory,'index.html'));}
  res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf'})[path.extname(name)]||'text/html');res.end(content);
 }catch{res.writeHead(500);res.end();}
});
await new Promise(r=>web.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${web.address().port}`;
const config={url:'https://test.supabase.co',origin,publicKey:'public-test-key',serviceKey:'server-only-test-key-do-not-bundle',secure:false};
const jwt=`header.${Buffer.from(JSON.stringify({sub:ids.admin,session_id:ids.admin,iss:config.url+'/auth/v1',exp:Math.floor(Date.now()/1000)+3600,aal:'aal1'})).toString('base64url')}.signature`;
const user={id:ids.admin,email:'admin@example.test',factors:[]};
const auth={login:async()=>({access_token:jwt,user}),user:async()=>user,logout:async()=>({})};
api=createServer({config,pool,auth,storage:{download:async()=>new Response(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64'))}});
await new Promise(r=>api.listen(0,'127.0.0.1',r));
const errors=[],failedApi=[],demoRequests=[],checks=[];
try {
 context=await chromium.launchPersistentContext(path.join(temporary,'profile'),{channel:'chrome',headless:true,downloadsPath:path.join(temporary,'downloads'),viewport:{width:1440,height:1000},args:['--disable-gpu']});
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 page.on('request',req=>{if(req.url().includes('/auth/demo'))demoRequests.push(req.url());});
 page.on('response',res=>{if(res.url().includes('/api/')&&res.status()>=400)failedApi.push({url:res.url(),status:res.status()});});
 await page.goto(origin+'/admin/login');await expect(page.getByText('Explore fictional demo data')).toHaveCount(0);
 await page.getByLabel('Email address',{exact:true}).fill('admin@example.test');await page.getByLabel('Password',{exact:true}).fill('private browser test password');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page).toHaveURL(/\/admin\/dashboard$/);await expect(page.getByText('Supabase API unavailable')).toHaveCount(0);checks.push('cookie login and dashboard');
 { const keys=await page.evaluate(()=>Object.keys(sessionStorage));if(keys.includes('patag-token'))throw Error('Browser bearer token persistence detected.'); } checks.push('no browser auth token storage');
 await page.goto(origin+'/admin/reports/'+ids.report);await page.getByRole('button',{name:'Verify report',exact:true}).click();await page.getByRole('button',{name:'Confirm verify',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:'Assign maintenance team',exact:true})).toBeVisible();checks.push('real verification modal payload');
 await page.getByRole('button',{name:'Assign maintenance team',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('dialog').locator('select[name=teamId]').selectOption(ids.team);await page.getByRole('button',{name:'Confirm assign',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);checks.push('real crew assignment modal payload');
 const claims={sub:ids.crew,session_id:ids.crew,role:'authenticated',aal:'aal1'};
 await transaction(pool,c=>reportEvent(c,ids.report,{action:'start'}),claims);
 const photo='00000000-0000-4000-8000-000000000030';await pool.db.query("INSERT INTO public.patag_evidence(id,uploaded_by,object_path,name,kind,mime_type,size) VALUES($1,$2,'test/after','after.png','after','image/png',68)",[photo,ids.crew]);
 await transaction(pool,c=>reportEvent(c,ids.report,{action:'complete',note:'Browser test repair',photos:[{id:photo}]}),claims);
 await page.reload();await page.getByRole('button',{name:'Confirm resolution',exact:true}).click();await page.getByRole('button',{name:'Confirm resolution',exact:true}).last().click();await expect(page.getByRole('dialog')).toHaveCount(0);checks.push('administrative resolution modal payload');
 await page.screenshot({path:path.join(output,'admin-report.png'),fullPage:true});
 await page.goto(origin+'/admin/duplicates');await expect(page.getByText('Showing up to 50 authorized candidate pairs.',{exact:false})).toBeVisible();checks.push('bounded duplicate screen');
 await pool.db.query('UPDATE public.patag_reports SET road=$1 WHERE id=$2',[' =1+1',ids.report]);
 await page.goto(origin+'/admin/exports');
 for(const kind of ['CSV','PDF']) {
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Download '+kind,exact:false}).click();const download=await pending;const file=path.join(temporary,'export.'+kind.toLowerCase());await download.saveAs(file);const bytes=await readFile(file);
  if(kind==='CSV'&&(!bytes.toString().includes(ids.report)||!bytes.toString().includes("' =1+1")))throw Error('CSV omitted authorized report or failed formula protection.');if(kind==='PDF'&&!bytes.toString('ascii',0,4).includes('%PDF'))throw Error('Invalid PDF.');checks.push('authorized audited '+kind+' download');
 }
 await page.goto(origin+'/admin/notifications');await page.getByRole('button',{name:'Mark all as read'}).click();checks.push('notification read update');
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page).toHaveURL(/\/admin\/login$/);checks.push('logout');
 if(errors.length||failedApi.length||demoRequests.length)throw Error(JSON.stringify({errors,failedApi,demoRequests}));
 await writeFile(path.join(output,'browser-results.json'),JSON.stringify({checks,errors,failedApi,demoRequests,backend:'real Node API + isolated PostgreSQL; Supabase Auth/Storage boundary stubs',hosted:false},null,2));
 console.log(`PASS: ${checks.length} browser checks; 0 page errors; 0 failed API responses; 0 demo requests.`);
}catch(error){if(context){const page=context.pages().at(-1);await page.screenshot({path:path.join(output,'browser-failure.png'),fullPage:true});console.error(await page.locator('body').innerText());}throw error;}finally{if(context)await context.close();await new Promise(r=>web.close(r));if(api)await new Promise(r=>api.close(r));await pool.end();}
