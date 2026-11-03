import {previewLogin} from './preview-login.mjs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
const root=path.resolve(import.meta.dirname,'../..');
const {chromium,expect}=createRequire(path.join(root,'admin-web/package.json'))('@playwright/test');
const url=pathToFileURL(path.join(root,'preview/Open-PATAG.html')).href;
const out=path.join(root,'docs/auth-flow');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:390,height:900},reducedMotion:'reduce'});
const page=await context.newPage(),results={checks:[],errors:[]};page.on('pageerror',e=>results.errors.push(e.message));
const go=async(route)=>{await page.goto('about:blank');await page.goto(url+'#/'+route);};
const call=async(p,body,token,method)=>page.evaluate(async({p,body,token,method})=>{const r=await fetch('/api'+p,{method:method||(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};},{p,body,token,method});
try{
 for(const role of ['admin','maintenance','citizen']){
  await go(role+'/login');
  await expect(page.getByText('Explore fictional demo data',{exact:true})).toHaveCount(0);
  await expect(page.locator('.demo-access,.demo-action-btn,#demo-login')).toHaveCount(0);
  for(const endpoint of ['/auth/demo','/auth/demo/accounts'])for(const method of ['GET','POST','PUT','PATCH','DELETE']){
   const result=await call(endpoint,method==='GET'?null:{role},null,method);
   expect(result.status).toBe(404);expect(result.data.token).toBeUndefined();
  }
 }
 results.checks.push('Demo UI absent and demo endpoints closed for all roles and methods');
 await go('citizen/home');await expect(page.getByRole('heading',{name:'Log in',exact:true})).toBeVisible();results.checks.push('Protected citizen page requires login; no automatic demo session');
 await page.getByRole('link',{name:'Create an account',exact:true}).click();await page.getByLabel('Full name',{exact:true}).fill('Test Reporter');await page.getByLabel('Email address',{exact:true}).fill('Reporter@Example.Test');await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByRole('heading',{name:'Your address',exact:true})).toBeVisible();await expect(page.getByText('This stays on your private account',{exact:false})).toBeVisible();await page.getByLabel('Street / house number',{exact:false}).fill('12 Mabini St');await page.getByLabel('Barangay',{exact:true}).fill('Guinhawa');await page.getByLabel('City / municipality',{exact:true}).fill('Malolos');await page.getByLabel('Province',{exact:true}).fill('Bulacan');await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByRole('heading',{name:'Secure your account',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Back',exact:true}).click();await expect(page.getByLabel('Barangay',{exact:true})).toHaveValue('Guinhawa');await page.getByRole('button',{name:'Back',exact:true}).click();await expect(page.getByLabel('Full name',{exact:true})).toHaveValue('Test Reporter');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByLabel('Create a password',{exact:true}).fill('Three roads lead home 42!');await page.getByRole('button',{name:'Show password',exact:true}).click();await expect(page.getByLabel('Create a password',{exact:true})).toHaveAttribute('type','text');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Create account',exact:true}).click();await expect(page.getByText('Hello, Test.',{exact:true})).toBeVisible();
 const signed=await call('/bootstrap');const user=signed.data.user;expect(user.role).toBe('citizen');expect(user.email).toBe('reporter@example.test');expect(user.hash).toBeUndefined();expect(user.emailVerified).toBe(false);expect(user.address).toEqual({line:'12 Mabini St',barangay:'Guinhawa',city:'Malolos',province:'Bulacan'});results.checks.push('Three-step signup, private address, preserved details and password visibility');
 await go('citizen/profile');await expect(page.getByText('12 Mabini St, Guinhawa, Malolos, Bulacan')).toBeVisible();await page.getByRole('link',{name:'Edit profile'}).click();await page.getByLabel('Street / house number',{exact:false}).fill('14 Mabini St');await page.getByRole('button',{name:'Save profile'}).click();await expect(page.getByText('14 Mabini St, Guinhawa, Malolos, Bulacan')).toBeVisible();expect((await call('/bootstrap')).data.user.address.line).toBe('14 Mabini St');results.checks.push('Citizen can review and correct private address in profile');
 const old=await page.evaluate(()=>sessionStorage.getItem('patag-token'));
 await go('citizen/profile');await page.getByRole('button',{name:'Log out',exact:true}).click();await expect(page.getByRole('heading',{name:'Log in',exact:true})).toBeVisible();expect((await call('/bootstrap',null,old)).status).toBe(401);await go('citizen/reports');await expect(page.getByRole('heading',{name:'Log in',exact:true})).toBeVisible();results.checks.push('Logout revokes session and protects report routes after reload');
 await page.getByLabel('Email address',{exact:true}).fill('reporter@example.test');await page.getByLabel('Password',{exact:true}).fill('incorrect');await page.getByRole('button',{name:'Log in',exact:true}).click();await expect(page.getByRole('alert')).toContainText('incorrect');await page.getByLabel('Password',{exact:true}).fill('Three roads lead home 42!');await page.getByRole('button',{name:'Log in',exact:true}).click();await expect(page.getByText('Hello, Test.',{exact:true})).toBeVisible();results.checks.push('Wrong password feedback and valid password login');
 expect((await call('/auth/register',{name:'Other',email:'REPORTER@example.test',password:'Another Strong passphrase 42!',address:{barangay:'Guinhawa',city:'Malolos',province:'Bulacan'}})).status).toBe(409);
 expect((await call('/auth/register',{name:'Other',email:'other@example.test',password:'short',address:{barangay:'Guinhawa',city:'Malolos',province:'Bulacan'}})).status).toBe(400);
 expect((await call('/auth/demo',{role:'citizen',userId:user.id})).status).toBe(404);
 expect((await call('/auth/login',{email:user.email,password:'Three roads lead home 42!',role:'admin'})).status).toBe(401);
 const forged='preview:'+user.id+':forged';expect((await call('/bootstrap',null,forged)).status).toBe(401);results.checks.push('Duplicate/weak registration, role mismatch, created-account demo bypass and forged sessions rejected');
 await go('admin/dashboard');await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();await expect(page.getByText('Create account',{exact:true})).toHaveCount(0);
 await previewLogin(page,'admin');await expect(page.getByRole('heading',{name:'Roads overview'})).toBeVisible();
 await page.evaluate(()=>{const key='patag-hosted-preview-v1',db=JSON.parse(localStorage.getItem(key));db.sessions['account:old-demo-token']={userId:'maintenance-1',expires:Date.now()+60000};localStorage.setItem(key,JSON.stringify(db));});
 expect((await call('/bootstrap',null,'account:old-demo-token')).status).toBe(401);
 expect((await call('/users',{id:'maintenance-1',name:'Mika Santos',email:'crew@example.test',role:'maintenance',active:true,teamId:'team-1',password:'Provisioned staff password 42!'},null,'PATCH')).status).toBe(200);
 expect((await call('/bootstrap',null,'account:old-demo-token')).status).toBe(401);
 expect((await call('/auth/login',{email:'crew@example.test',password:'Provisioned staff password 42!',role:'maintenance'})).status).toBe(200);
 results.checks.push('Legacy demo token remains revoked after staff password provisioning');
 await page.evaluate(()=>{const key='patag-hosted-preview-v1',db=JSON.parse(localStorage.getItem(key));db.sessions['legacy-passwordless-token']={userId:'maintenance-1',expires:Date.now()+60000};localStorage.setItem(key,JSON.stringify(db));});
 expect((await call('/bootstrap',null,'legacy-passwordless-token')).status).toBe(401);
 expect((await call('/bootstrap',null,'account:legacy-passwordless-token')).status).toBe(401);
 results.checks.push('Legacy tokens rejected for password-protected accounts, including prefixed replay');
 const team=(await call('/teams',{name:'Authentication crew'})).data;
 expect((await call('/users',{name:'Auth Staff',email:'staff-auth@example.test',role:'maintenance',teamId:team.id,password:'Staff strong password 42!'})).status).toBe(201);
 await go('admin/settings');await page.getByRole('button',{name:'Log out',exact:true}).click();await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();
 await go('maintenance/login');await page.getByLabel('Email address',{exact:true}).fill('staff-auth@example.test');await page.getByLabel('Password',{exact:true}).fill('Staff strong password 42!');await page.getByRole('button',{name:'Log in',exact:true}).click();await expect(page.getByRole('heading',{name:'Your day on the road'})).toBeVisible();await go('maintenance/profile');await expect(page.getByText('Preview account',{exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Log out',exact:true}).click();await expect(page.getByRole('button',{name:'Log in',exact:true})).toBeVisible();results.checks.push('Admin-provisioned staff password login; visible staff logout; no profile account switchers');
 for(const theme of ['light','dark'])for(const route of ['citizen/login','citizen/register','admin/login','maintenance/login']){
  await go(route);await page.evaluate(t=>{document.documentElement.dataset.theme=t;localStorage.setItem('patag-theme',t)},theme);
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await page.setViewportSize({width:390,height:900});await page.screenshot({path:path.join(out,route.replace('/','-')+'-'+theme+'.png'),fullPage:true});
  if(route==='citizen/register'){await page.getByLabel('Full name',{exact:true}).fill('Test Citizen');await page.getByLabel('Email address',{exact:true}).fill('test@example.test');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.screenshot({path:path.join(out,'citizen-address-'+theme+'.png'),fullPage:true});await page.getByLabel('Barangay',{exact:true}).fill('Guinhawa');await page.getByLabel('City / municipality',{exact:true}).fill('Malolos');await page.getByLabel('Province',{exact:true}).fill('Bulacan');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.screenshot({path:path.join(out,'citizen-password-'+theme+'.png'),fullPage:true});}
 }
 const expiry=await call('/auth/login',{email:'reporter@example.test',password:'Three roads lead home 42!',role:'citizen'});expect(expiry.status).toBe(200);await page.evaluate(token=>{const db=JSON.parse(localStorage.getItem('patag-hosted-preview-v1'));db.sessions[token].expires=Date.now()-1;localStorage.setItem('patag-hosted-preview-v1',JSON.stringify(db));},expiry.data.token);expect((await call('/bootstrap',null,expiry.data.token)).status).toBe(401);results.checks.push('Expired sessions rejected');
 results.checks.push('32 responsive authentication screen/theme/width checks plus registration address/password screenshots');expect(results.errors).toHaveLength(0);
}catch(e){results.failure=e.message;process.exitCode=1;await page.screenshot({path:path.join(out,'failure.png'),fullPage:true});}finally{await fs.writeFile(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));await browser.close();}
