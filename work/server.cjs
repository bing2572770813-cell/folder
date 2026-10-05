const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {readCatalog,savePrefab}=require('./prefab-catalog.cjs');
const root = path.resolve(__dirname, '../outputs');
const port = Number(process.env.FOLD_PORT || 4173);
const server = http.createServer(async (req,res) => {
  if(req.url==='/api/prefabs'){
    res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
    try{
      if(req.method==='GET'){res.end(JSON.stringify(await readCatalog()));return;}
      if(req.method==='POST'){
        if(req.headers.origin&&req.headers.origin!=='http://'+req.headers.host){res.writeHead(403);res.end(JSON.stringify({error:'来源无效'}));return;}
        let body='';for await(const part of req){body+=part;if(body.length>128000)throw new Error('实体文件过大');}
        const prefab=await savePrefab(JSON.parse(body));res.writeHead(201);res.end(JSON.stringify(prefab));return;
      }
      res.writeHead(405);res.end(JSON.stringify({error:'方法无效'}));return;
    }catch(error){res.writeHead(400);res.end(JSON.stringify({error:error.message}));return;}
  }

  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const target = path.resolve(root, '.' + (pathname==='/'?'/index.html':pathname));
  if (!target.startsWith(root+path.sep)) { res.writeHead(403);res.end();return; }
  fs.readFile(target,(err,data) => { if(err){res.writeHead(404);res.end('Not found');return;}res.setHeader('Content-Type',target.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(data); });
});
server.on('error',error=>{console.error(error.message);process.exit(1);});
server.listen(port,'127.0.0.1',()=>console.log('FOLD FIELD ready at http://127.0.0.1:'+port));
