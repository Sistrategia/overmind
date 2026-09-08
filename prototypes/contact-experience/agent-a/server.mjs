import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { makeSeed, project, save, current, personas } from './model.mjs';
const variants=['dispatch','ledger','relay'];
const states=Object.fromEntries(variants.map(v=>[v,makeSeed()]));
const streams=new Map(), presence=new Map();
const root=fileURLToPath(new URL('.',import.meta.url));
const mime={'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.md':'text/plain'};
function send(res,status,data) {res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function notify(v) { for(const res of streams.get(v)||[]) res.write(`data: ${JSON.stringify({type:'refresh'})}\n\n`); }
function people(v) {return [...presence.values()].filter(x=>x.variant===v && Date.now()-x.seen<45000).map(({tab,persona,contact,section})=>({tab,persona,contact,section}));}
const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    if (url.pathname.startsWith('/demo/')) {
      const [, ,v,op]=url.pathname.split('/');
      if(!variants.includes(v)) return send(res,404,{code:'not_found'});
      const persona=url.searchParams.get('persona');
      if(!personas[persona]) return send(res,403,{code:'forbidden'});
      if(op==='events') {
        res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive'});res.write('data: {"type":"connected"}\n\n');
        if(!streams.has(v)) streams.set(v,new Set());streams.get(v).add(res);
        req.on('close',()=>{streams.get(v).delete(res);const tab=url.searchParams.get('tab');if(presence.get(tab)?.variant===v)presence.delete(tab);notify(v);});return;
      }
      if(op==='state') return send(res,200,{...project(states[v],persona),presence:people(v)});
      if(req.method!=='POST') return send(res,405,{code:'method'});
      let body='';for await (const c of req) {body+=c;if(body.length>1000000) return send(res,413,{code:'too_large'});}
      const data=JSON.parse(body||'{}');
      if(op==='presence') {const previous=presence.get(data.tab);const next={tab:String(data.tab),persona,variant:v,contact:data.contact==='norte'?'norte':'lina',section:['Contact','Editing channels','History','Activity'].includes(data.section)?data.section:'Contact',seen:Date.now()};presence.set(data.tab,next);if(!previous||previous.persona!==persona||previous.contact!==next.contact||previous.section!==next.section)notify(v);return send(res,200,{});}
      if(op==='reset') {
        if(!personas[persona].edit) return send(res,403,{code:'forbidden'});
        states[v]=makeSeed(data.atThree===true);notify(v);return send(res,200,{});
      }
      if(op==='bruno') {
        if(!personas[persona].edit) return send(res,403,{code:'forbidden'});
        const state=states[v], r=current(state,'lina');
        const result=save(state,{id:'lina',epoch:state.epoch,expectedEntityVersion:r.revision,persona:'Bruno',commands:[{kind:'phone.replace',ordinal:1,value:{...r.snapshot.phone[0],extension:r.snapshot.phone[0].extension==='44'?'45':'44',label:'Bruno · office'}}]});notify(v);return send(res,result.status,result);
      }
      if(op==='save') {const result=save(states[v],{...data,persona});notify(v);return send(res,result.status,result);}
      return send(res,404,{code:'not_found'});
    }
    let file = url.pathname==='/' || variants.some(v=>url.pathname===`/${v}` || url.pathname===`/${v}/`) ? 'index.html' : decodeURIComponent(url.pathname).slice(1);
    if(file.includes('..') || file.includes('\\') || !/^[\w./-]+$/.test(file)) return send(res,403,{code:'forbidden'});
    // Serve only prototype public assets; no server code or arbitrary workspace files.
    if(!['index.html','app.js','shared.mjs','styles.css'].includes(file) && !/^evidence\/[\w-]+\.png$/.test(file)) return send(res,404,{code:'not_found'});
    const data=await readFile(root+file);const ext=file.slice(file.lastIndexOf('.'));
    res.writeHead(200,{'Content-Type':mime[ext]||'application/octet-stream','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'"});res.end(data);
  } catch(e) {send(res,e.code==='ENOENT'?404:400,{code:'request_error',message:'Local request could not be processed.'});}
});
const port=Number(process.env.PORT||4317);
server.listen(port,'127.0.0.1',()=>process.stdout.write(`Overmind Agent A: http://127.0.0.1:${port}\n`));
