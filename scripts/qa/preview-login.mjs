import {seed,workspace} from '../../browser-preview/domain.mjs';
export async function previewLogin(page,role){
 const email=await page.evaluate(async ({role,fixture})=>{
  const key='patag-hosted-preview-v1';
  let db=JSON.parse(localStorage.getItem(key));
  if(!db)db=fixture;
  if(!db)throw Error('Initialize preview fixture before login');
  const user=db.users.find(u=>u.role===role),salt=crypto.randomUUID(),password='Synthetic fixture password 42!';
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:600000,hash:'SHA-256'},material,256);
  Object.assign(user,{salt,hash:Array.from(new Uint8Array(bits),b=>b.toString(16).padStart(2,'0')).join(''),iterations:600000});
  localStorage.setItem(key,JSON.stringify(db));return user.email;
 },{role,fixture:workspace(seed())});
 await page.getByLabel('Email address',{exact:true}).fill(email);
 await page.locator('input[name=password]').fill('Synthetic fixture password 42!');
 await page.getByRole('button',{name:/^(Sign in|Log in)$/}).click();
}
