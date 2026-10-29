import { randomUUID } from 'node:crypto';
import { fail, fields, text, uuid } from './config.mjs';
import { transaction, audit } from './db.mjs';
export function imageInput(input) {
  fields(input,['data','name','kind']);
  const match=typeof input.data==='string'&&/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(input.data);
  if(!match) fail(400,'Choose a PNG, JPEG or WebP image.');
  const bytes=Buffer.from(match[2],'base64');
  if(bytes.length<12||bytes.length>8388608||bytes.toString('base64')!==match[2]) fail(400,'Invalid image or file exceeds 8 MB.');
  const valid=match[1]==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):match[1]==='jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
  if(!valid||!['before','after'].includes(input.kind)) fail(400,'Invalid image content or evidence kind.');
  return {bytes,mime:'image/'+match[1],name:text(input.name,'file name',200),kind:input.kind};
}
export function storageClient(config,transport=fetch) {
  async function call(path,method='GET',body,mime) {
    let response;
    try{response=await transport(config.url+'/storage/v1'+path,{method,headers:{apikey:config.serviceKey,Authorization:'Bearer '+config.serviceKey,...(mime?{'Content-Type':mime}:{})},body,signal:AbortSignal.timeout(20000),redirect:'error'});}catch{fail(503,'Supabase private Storage is unavailable.');}
    if(!response.ok) fail(503,'Supabase private Storage request failed. Check bucket configuration and permissions.');
    return response;
  }
  return {upload:(path,bytes,mime)=>call('/object/patag-evidence/'+path,'POST',bytes,mime),remove:path=>call('/object/patag-evidence','DELETE',JSON.stringify({prefixes:[path]}),'application/json'),download:path=>call('/object/authenticated/patag-evidence/'+path)};
}
export async function uploadEvidence(pool,claims,input,storage) {
  const image=imageInput(input),id=randomUUID(),objectPath=claims.sub+'/'+id;
  await storage.upload(objectPath,image.bytes,image.mime);
  try {
    return await transaction(pool,async db=>{
      await db.query('INSERT INTO public.patag_evidence(id,uploaded_by,object_path,name,kind,mime_type,size) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,db.actor.id,objectPath,image.name,image.kind,image.mime,image.bytes.length]);
      await audit(db,'evidence.upload',id,db.actor.municipality,{size:image.bytes.length,kind:image.kind});
      return {id,url:'/evidence/'+id,name:image.name,kind:image.kind};
    },claims);
  } catch(error) {try{await storage.remove(objectPath);}catch{fail(503,'Evidence upload requires administrator cleanup in private Storage.');}throw error;}
}
export async function evidenceRecord(db,id) {
  const row=(await db.query('SELECT object_path,mime_type FROM public.patag_evidence WHERE id=$1',[uuid(id)])).rows[0];
  if(!row) fail(404,'Evidence not found in your authorized scope.');return row;
}
