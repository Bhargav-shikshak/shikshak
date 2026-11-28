import { catalog } from '../demo/seed';
const SITE = 'https://shikshak.co.in';
const CITY = '/tutors/guwahati';
type Page = { path: string; heading: string; description: string; advice: string; index: boolean };
const slug = (s: string) => s.toLowerCase().replace(/[–—]/g,'-').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const esc = (s: string) => s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const make = (path:string,heading:string,description:string,advice:string,index=false): Page => ({path,heading,description,advice,index});
const directory = make(CITY,'Find home tutors in Guwahati','Explore home tuition by subject, class level and neighbourhood in Guwahati, Assam.','Compare teaching qualifications, availability, and the final lesson quote. Sign in to browse current tutor listings and request a class. Teachers can accept or decline requests, and confirmed bookings have a shared classroom for notes and assignments.',true);
const teaching = make('/tuition-jobs/guwahati','Home tuition opportunities in Guwahati','Create an independent tutor listing and receive class requests from learners in Guwahati.','Choose your subjects and academic levels, set your hourly base rate and availability, and publish your listing for signed-in learners. Requests depend on demand; registration does not guarantee work or earnings.',true);
export const pages: Page[] = [directory,teaching,
 ...catalog.subjects.map(s=>make(CITY+'/'+(s==='Mathematics'?'maths':slug(s)),s+' tuition in Guwahati','Explore '+s.toLowerCase()+' tutoring options in Guwahati.','Discuss the syllabus, learning goals, lesson frequency and how progress will be reviewed. Sign in to check current tutor availability.')),
 ...catalog.localities.map(a=>make(CITY+'/areas/'+a.id,'Home tuition in '+a.name+', Guwahati','Explore home tutoring options near '+a.name+' in Guwahati.','Check your preferred teaching area, subject, class level and travel-inclusive lesson quote. Sign in for location-aware discovery.')),
 ...catalog.grades.map(g=>make(CITY+'/levels/'+slug(g),g+' tuition in Guwahati','Explore tutoring for '+g.toLowerCase()+' in Guwahati.','Discuss the school board or course, current learning gaps and assessment goals. Sign in to check matching listings.'))
];
const byPath = new Map(pages.map(p=>[p.path,p]));
const link = (p:Page)=>'<a href="'+esc(p.path)+'">'+esc(p.heading)+'</a>';
const links = (items:Page[])=>'<ul>'+items.map(p=>'<li>'+link(p)+'</li>').join('')+'</ul>';
const headers = (index:boolean,type='text/html; charset=utf-8')=>({'Content-Type':type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff',...(!index?{'X-Robots-Tag':'noindex, follow'}:{})});
const css='body{margin:0;background:#fbf9f4;color:#24372e;font:16px/1.65 system-ui,sans-serif}header,main,footer{max-width:1020px;margin:auto;padding:24px}header{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}a{color:#285b48;text-underline-offset:3px}h1{font-size:clamp(2rem,5vw,3.5rem);line-height:1.12}p{max-width:72ch}.button{display:inline-block;padding:12px 18px;border-radius:8px;background:#285b48;color:white;text-decoration:none;margin-right:12px}.panel{border:1px solid #d4ddd4;border-radius:12px;padding:20px;margin:24px 0}ul{columns:2;list-style:none;padding:0}li{break-inside:avoid;padding:5px 0}@media(max-width:600px){ul{columns:1}header,main,footer{padding:18px}}';
function html(p:Page,status=200):Response {
 const url=SITE+p.path, title=p.heading+' | Shikshak', isTeaching=p===teaching;
 const graph={'@context':'https://schema.org','@graph':[
 {'@type':'Organization','@id':SITE+'/#organization',name:'Shikshak',url:SITE+'/',logo:SITE+'/shikshak-logo.png'},
 {'@type':'WebSite','@id':SITE+'/#website',name:'Shikshak',url:SITE+'/',publisher:{'@id':SITE+'/#organization'}},
 {'@type':'WebPage','@id':url+'#webpage',name:p.heading,url,description:p.description,isPartOf:{'@id':SITE+'/#website'},inLanguage:'en-IN'},
 {'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Shikshak',item:SITE+'/'},{'@type':'ListItem',position:2,name:p.heading,item:url}]}]};
 const content=status===404?'<h1>Page not found</h1><p>This public page is unavailable.</p>':
 '<p>GUWAHATI · ASSAM</p><h1>'+esc(p.heading)+'</h1><p>'+esc(p.description)+'</p><p><a class="button" href="/#signup/'+(isTeaching?'teacher':'student')+'">'+(isTeaching?'Join as a tutor':'Find a tutor')+'</a><a href="/#login">Log in</a></p><section class="panel"><h2>'+ (isTeaching?'How to get started':'How to choose a tutor') +'</h2><p>'+esc(p.advice)+'</p><p>Current listings are available in the signed-in workspace. Public tutor profiles are not enabled.</p></section><h2>Explore subjects</h2>'+links(pages.filter(x=>x.path.startsWith(CITY+'/')&&!x.path.includes('/areas/')&&!x.path.includes('/levels/')))+'<h2>Explore neighbourhoods</h2>'+links(pages.filter(x=>x.path.includes('/areas/')))+'<h2>Explore academic levels</h2>'+links(pages.filter(x=>x.path.includes('/levels/')));
 return new Response('<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+'</title><meta name="description" content="'+esc(p.description)+'"><meta name="robots" content="'+(p.index?'index, follow':'noindex, follow')+'"><link rel="canonical" href="'+esc(url)+'"><link rel="icon" href="/shikshak-logo.png"><meta property="og:title" content="'+esc(title)+'"><meta property="og:description" content="'+esc(p.description)+'"><meta property="og:url" content="'+esc(url)+'"><meta property="og:site_name" content="Shikshak"><script type="application/ld+json">'+JSON.stringify(graph).replace(/</g,'\\u003c')+'</script><style>'+css+'</style></head><body><header><a href="/">Shikshak</a><nav aria-label="Public navigation">'+link(directory)+' · '+link(teaching)+'</nav></header><main>'+content+'</main><footer><a href="/">Home</a> · <a href="/#privacy">Privacy</a> · <a href="/#terms">Terms</a></footer></body></html>',{status,headers:headers(p.index)});
}
export function publicSeo(request:Request):Response|null {
 const url=new URL(request.url), path=url.pathname.replace(/\/+$/,'')||'/';
 if(!['GET','HEAD'].includes(request.method)) return null;
 let r:Response;
 if(path==='/sitemap.xml'){
 const entries=['/',...pages.filter(p=>p.index).map(p=>p.path)];
 r=new Response('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+entries.map(p=>'<url><loc>'+esc(SITE+p)+'</loc></url>').join('')+'</urlset>',{headers:headers(true,'application/xml; charset=utf-8')});
 }else if(path==='/home-tuition/guwahati'){r=new Response(null,{status:308,headers:{Location:SITE+CITY}});}
 else if(byPath.has(path)){r=path!==url.pathname?new Response(null,{status:308,headers:{Location:SITE+path}}):html(byPath.get(path)!);}
 else if(/^\/(tutors|home-tuition|tuition-jobs|teacher)(\/|$)/.test(path)){r=html(make('/not-found','Page not found','This page is unavailable.',''),404);}
 else return null;
 return request.method==='HEAD'?new Response(null,{status:r.status,headers:r.headers}):r;
}
