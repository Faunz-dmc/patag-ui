import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import http from 'node:http';
import path from 'node:path';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { database,fixtures,ids } from '../../backend/tests/database.mjs';
import { createServer } from '../../backend/server.mjs';
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
let updates=0,rejectToken=false;const observed=[];
const auth={verifyRecovery:async hash=>{if(hash!=='synthetic-hash')throw Error('Unexpected synthetic hash');return {access_token:jwt};},user:async value=>{if(value!==jwt||rejectToken)throw Object.assign(Error('Recovery link is invalid or expired.'),{status:401});return user;},updatePassword:async(value,password)=>{if(value!==jwt||password!=='synthetic browser password')throw Error('Invalid synthetic update');updates++;},logoutAll:async()=>({})};
api=createServer({config,pool,auth,storage:{download:async()=>new Response(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64'))}});
await new Promise(r=>api.listen(0,'127.0.0.1',r));
const errors=[],checks=[];
try {
 context=await chromium.launchPersistentContext(path.join(temporary,'recovery-profile'),{channel:'chrome',headless:true,viewport:{width:1260,height:800},args:['--disable-gpu']});
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 page.on('request',req=>{if(req.url().endsWith('/api/auth/password'))observed.push(req.postDataJSON());});
 async function clean(){await expect(page).toHaveURL(origin+'/admin/reset-password');const saved=await page.evaluate(()=>JSON.stringify([localStorage,sessionStorage]));assert.ok(!saved.includes('synthetic-hash')&&!saved.includes(jwt));}
 for(const callback of ['?token_hash=synthetic-hash&type=recovery','#access_token='+jwt+'&refresh_token=synthetic-refresh&type=recovery']){
  await page.goto(origin+'/admin/reset-password'+callback);await expect(page.getByLabel('New password')).toBeVisible();await clean();
  await page.getByLabel('New password').fill('synthetic browser password');await page.getByRole('button',{name:'Update password',exact:true}).click();await expect(page.getByRole('status')).toContainText('Password updated.');await expect(page.getByLabel('New password')).toHaveCount(0);
 }
 assert.equal(updates,2);assert.ok(observed[0].tokenHash);assert.ok(observed[1].accessToken);assert.ok(!('refreshToken' in observed[1]));checks.push('both callback formats submit through real local API and clear secrets from URL/storage');
 for(const callback of ['', '#error=access_denied&error_code=otp_expired&error_description=synthetic-secret', '#access_token=synthetic-secret&type=signup']){
  await page.goto('about:blank');await page.goto(origin+'/admin/reset-password'+callback);await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByLabel('New password')).toHaveCount(0);assert.ok(!(await page.locator('body').innerText()).includes('synthetic-secret'));await clean();
 }checks.push('missing, provider-expired and wrong-flow callbacks show safe errors');
 rejectToken=true;await page.goto(origin+'/admin/reset-password#access_token='+jwt+'&type=recovery');await page.getByLabel('New password').fill('synthetic browser password');await page.getByRole('button',{name:'Update password',exact:true}).click();await expect(page.getByRole('alert')).toContainText('invalid or expired');assert.equal(updates,2);rejectToken=false;checks.push('Auth rejection cannot update password');
 await pool.query('DELETE FROM auth.sessions WHERE user_id=$1',[ids.admin]);await page.goto(origin+'/admin/reset-password#access_token='+jwt+'&type=recovery');await page.getByLabel('New password').fill('synthetic browser password');await page.getByRole('button',{name:'Update password',exact:true}).click();await expect(page.getByRole('alert')).toContainText('invalid or expired');assert.equal(updates,2);checks.push('revoked Auth session cannot update password');
 assert.deepEqual(errors,[]);await page.screenshot({path:path.join(output,'recovery-validation.png'),fullPage:true});
 await writeFile(path.join(output,'recovery-results.json'),JSON.stringify({checks,errors,hosted:false,backend:'real Node API + isolated PostgreSQL; synthetic Supabase Auth boundary'},null,2));
 console.log('PASS: '+checks.length+' recovery browser check groups; 0 page errors; no hosted mutations.');
}finally{if(context)await context.close();await new Promise(r=>web.close(r));if(api)await new Promise(r=>api.close(r));await pool.end();}
