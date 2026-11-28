import assert from 'node:assert/strict';
import {build} from 'vite';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(join(tmpdir(),'shikshak-seo-'));
try {
 await build({configFile:false,build:{ssr:'backend/seo.ts',outDir:dir,emptyOutDir:true,minify:false}});
 await writeFile(join(dir,'package.json'),'{"type":"module"}');
 const {publicSeo,pages}=await import(pathToFileURL(join(dir,'seo.js')).href);
 const req=(path,method='GET')=>publicSeo(new Request('https://shikshak.co.in'+path,{method}));
 for(const p of pages){
 const r=req(p.path);assert.equal(r.status,200);const h=await r.text();
 assert.ok(h.includes('<h1>'));assert.ok(h.includes('rel="canonical" href="https://shikshak.co.in'+p.path+'"'));
 assert.equal(r.headers.has('X-Robots-Tag'),!p.index);assert.ok(h.includes('application/ld+json'));
 }
 const sitemap=await req('/sitemap.xml').text();
 for(const p of pages)assert.equal(sitemap.includes('<loc>https://shikshak.co.in'+p.path+'</loc>'),p.index);
 assert.equal(req('/teacher/private-id').status,404);
 assert.equal(req('/tutors/guwahati/unknown').status,404);
 assert.equal(req('/home-tuition/guwahati').status,308);
 assert.equal(req('/tutors/guwahati/').status,308);
 assert.equal(req('/api/v1/health'),null);
 assert.equal(await req('/sitemap.xml','HEAD').text(),'');
 console.log('SEO routes, metadata, sitemap and privacy defaults passed');
}finally{await rm(dir,{recursive:true,force:true});}
