// Test-only credentials are provisioned in isolated browser storage, then use normal sign-in.
import {previewLogin} from './preview-login.mjs';
export async function gotoDemo(page,url){
 await page.goto(url);await page.waitForFunction(()=>document.querySelector('h1,h2'));
 const target=new URL(url),route=target.hash.slice(2),role=route.split('/')[0];
 if(!['citizen','admin','maintenance'].includes(role)||/\/(login|register|forgot-password)$/.test(route))return;
 const signedIn=await page.evaluate(async role=>{const response=await fetch('/api/bootstrap');const data=await response.json();return response.ok&&data.user.role===role;},role);
 if(!signedIn){target.hash='#/'+role+'/login';await page.goto(target.href);await previewLogin(page,role);await page.waitForURL(new RegExp('#/'+role+'/(dashboard|home)'));}
 await page.goto('about:blank');await page.goto(url);
}
