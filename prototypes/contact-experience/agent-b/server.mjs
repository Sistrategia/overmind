import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {fixture,project,save,clone,VARIANTS,PERSONAS} from './model.js';
const root=path.dirname(fileURLToPath(import.meta.url));
const stores=Object.fromEntries(VARIANTS.map(v=>[v,fixture()]));
const port=Number(process.env.PORT||4318);
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.svg':'image/svg+xml','.md':'text/plain'};
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname.startsWith('/_demo/')) {
      const variant=url.searchParams.get('variant');const persona=url.searchParams.get('persona');
      if(!VARIANTS.includes(variant)||!PERSONAS[persona])return json(res,400,{code:'invalid_demo_context'});
      const db=stores[variant];
      if(req.method==='GET'&&url.pathname==='/_demo/state')return json(res,200,project(db,persona));
      if(req.method!=='POST')return json(res,405,{code:'method_not_allowed'});
      let body='';for await(const chunk of req){body+=chunk;if(body.length>1024*1024)return json(res,413,{code:'too_large'});}
      const data=body?JSON.parse(body):{};
      if(url.pathname==='/_demo/reset') {if(!PERSONAS[persona].edit)return json(res,403,{code:'forbidden'});stores[variant]=fixture(data.conflict===true);return json(res,200,{reset:true});}
      if(url.pathname==='/_demo/bruno') {
        if(!PERSONAS[persona].edit)return json(res,403,{code:'forbidden'});
        const current=db.contacts.lina,draft=clone(current);draft.phone[0].extension=current.phone[0].extension==='18'?'19':'18';draft.phone[0].label='Direct line';
        const result=save(db,{persona:'Bruno',contact:'lina',expectedEntityVersion:current.revision,draft});return json(res,result.status,result);
      }
      if(url.pathname==='/_demo/save') {
        const result=save(db,{...data,persona});
        // Uncertain mode commits, then drops the acknowledgement. The UI must investigate.
        if(data.uncertain&&result.status===200&&!result.unchanged)return json(res,500,{code:'commit_uncertain',automaticRetryAllowed:false});
        return json(res,result.status,result);
      }
      return json(res,404,{code:'not_found'});
    }
    let file=decodeURIComponent(url.pathname);
    if(file==='/'||VARIANTS.some(v=>file===`/${v}`||file.startsWith(`/${v}/`)))file='/index.html';
    const resolved=path.resolve(root,'.'+file);
    if(!resolved.startsWith(root+path.sep)||file.includes('node_modules')||file.includes('server.mjs'))return json(res,404,{code:'not_found'});
    const data=await readFile(resolved);res.writeHead(200,{'Content-Type':mime[path.extname(resolved)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
  }catch(error){json(res,error.code==='ENOENT'?404:400,{code:error.code==='ENOENT'?'not_found':'invalid_request'});}
});
server.listen(port,'127.0.0.1',()=>process.stdout.write(`Agent B prototypes: http://127.0.0.1:${port}\nRelay /relay · Atelier /atelier · Trace /trace\n`));
