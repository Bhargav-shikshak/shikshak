import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const seed = ts.transpileModule(await readFile('demo/seed.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { catalog } = await import('data:text/javascript;base64,' + Buffer.from(seed).toString('base64'));
let source = await readFile('backend/worker.ts','utf8');
source = source.replace("import { catalog } from '../demo/seed';", 'const catalog = ' + JSON.stringify(catalog) + ';')
  .replace("export { DemoSession } from '../demo/worker';",'');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { handleApi } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const env = { SUPABASE_URL:'https://test.supabase.co', SUPABASE_PUBLISHABLE_KEY:'public-test-key' };
const originalFetch = globalThis.fetch;
let calls = [], handler = () => Response.json({});
globalThis.fetch = async (url,init) => { calls.push({url,init}); return handler(url,init); };
const request = (path, {method='GET',body,cookie,headers={}}={}) => new Request('https://app.example/api/v1/'+path, {
 method, headers:{ ...(body===undefined?{}:{'Content-Type':'application/json'}), ...(cookie?{cookie}:{}), ...headers },
 ...(body===undefined?{}:{body:JSON.stringify(body)}),
});
const session = {access_token:'access-token',refresh_token:'refresh-token',expires_in:3600};
const me = {id:'11111111-1111-4111-8111-111111111111',name:'Student',role:'student',active:true};
const cookie = '__Host-shikshak_access=access-token; __Host-shikshak_refresh=refresh-token';
let response;
try {
 response=await handleApi(request('catalog'),env); assert.equal(response.status,200); assert.equal((await response.json()).demo,false); assert.equal(calls.length,0);
 response=await handleApi(request('auth/me'),env); assert.equal(response.status,401);
 response=await handleApi(request('auth/login',{method:'POST',body:{email:'student@example.test',password:'test-password'},headers:{origin:'https://evil.example'}}),env); assert.equal(response.status,403);
 response=await handleApi(request('auth/me',{cookie,headers:{'sec-fetch-site':'cross-site'}}),env); assert.equal(response.status,403);
 response=await handleApi(new Request('https://app.example/api/v1/auth/login',{method:'POST',body:'invalid',headers:{'Content-Type':'application/json'}}),env); assert.equal(response.status,400);
 response=await handleApi(request('auth/signup',{method:'POST',body:{email:'student@example.test',password:'short',role:'admin'}}),env); assert.equal(response.status,400);
 handler=(url,init)=>url.includes('/auth/v1/token')?Response.json(session):Response.json(me);
 response=await handleApi(request('auth/login',{method:'POST',body:{email:'student@example.test',password:'test-password'}}),env);
 assert.equal(response.status,200); assert.equal((await response.json()).role,'student');
 const cookies=response.headers.getSetCookie(); assert.equal(cookies.length,2);
 assert(cookies.every(x=>x.includes('HttpOnly')&&x.includes('Secure')&&x.includes('SameSite=Lax')&&x.startsWith('__Host-')));
 assert(!cookies.join(';').includes('Domain='));
 handler=(url,init)=>url.includes('/auth/v1/signup')?Response.json({user:{id:me.id}}):Response.json(me);
 const signup={email:'student@example.test',password:'test-password',name:'Student',role:'student',homeArea:{lat:26.17431,lng:91.76619,city:'Guwahati',locality:'Rajgarh'}};
 response=await handleApi(request('auth/signup',{method:'POST',body:signup}),env); assert.equal(response.status,202); assert.equal((await response.json()).confirmationRequired,true);
 const payload=JSON.parse(calls.at(-1).init.body); assert.equal(payload.data.homeArea.lat,26.17); assert.equal(payload.data.homeArea.lng,91.77);
 let refreshed=false;
 handler=(url,init)=>{
  if(url.includes('refresh_token')){refreshed=true;return Response.json({...session,access_token:'new-access'});}
  if(new Headers(init.headers).get('Authorization')==='Bearer access-token') return Response.json({message:'JWT expired'},{status:401});
  return Response.json(me);
 };
 response=await handleApi(request('auth/me',{cookie}),env); assert.equal(response.status,200);assert(refreshed);assert(response.headers.getSetCookie().some(x=>x.includes('new-access')));
 handler=(url)=>url.includes('logout')?new Response(null,{status:204}):Response.json(me);
 response=await handleApi(request('auth/logout',{method:'POST',body:{},cookie}),env);
 assert.equal(response.status,200);assert.equal(response.headers.getSetCookie().filter(x=>x.includes('Max-Age=0')).length,2);
 handler=()=>Response.json({message:'This account is unavailable.'},{status:403});
 response=await handleApi(request('auth/me',{cookie}),env);assert.equal(response.status,403);
 handler=()=>Response.json({ok:true,schemaVersion:1});
 response=await handleApi(request('health'),env); assert.equal(response.status,200);assert.equal((await response.json()).ok,true);
 const teacher='22222222-2222-4222-8222-222222222222';
 handler=(url,init)=>{
  if(url.includes('/rest/')) {
   const p=JSON.parse(init.body);
   if(p.path==='auth/me')return Response.json(me);
   if(p.path.endsWith('/classroom'))return Response.json({studentId:me.id,teacherId:teacher});
   if(p.path.endsWith('/files'))return Response.json({id:p.input.id,name:p.input.name,sizeBytes:p.input.sizeBytes,mimeType:'application/pdf'});
  }
  return Response.json({});
 };
 let form=new FormData(); form.set('kind','submission');form.set('file',new File(['%PDF-1.7\nA test document'],'answers.pdf',{type:'application/pdf'}));
 response=await handleApi(new Request('https://app.example/api/v1/workspaces/student/connections/'+teacher+'/files',{method:'POST',headers:{cookie},body:form}),env);
 assert.equal(response.status,201);assert.equal((await response.json()).mimeType,'application/pdf');
 assert(calls.some(x=>x.url.includes('/storage/v1/object/classroom-pdfs/')));
 form=new FormData();form.set('kind','note');form.set('file',new File(['%PDF-1.7\nTest'],'notes.pdf',{type:'application/pdf'}));
 response=await handleApi(new Request('https://app.example/api/v1/workspaces/student/connections/'+teacher+'/files',{method:'POST',headers:{cookie},body:form}),env); assert.equal(response.status,400);
 form=new FormData();form.set('kind','submission');form.set('file',new File(['not a pdf'],'answers.pdf',{type:'application/pdf'}));
 response=await handleApi(new Request('https://app.example/api/v1/workspaces/student/connections/'+teacher+'/files',{method:'POST',headers:{cookie},body:form}),env);assert.equal(response.status,400);
 console.log('Backend HTTP checks passed: auth, cookies, refresh, CSRF, validation, status, private PDF upload and file-type enforcement.');
} finally {globalThis.fetch=originalFetch;}
