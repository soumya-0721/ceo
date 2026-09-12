const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const MIME = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
http.createServer((req, res) => {
  let u = req.url.split('?')[0];
  if (u === '/') u = '/index.html';
  const fp = path.join(ROOT, u);
  if (fs.existsSync(fp) && fs.statSync(fp).isFile()) {
    res.writeHead(200, {'Content-Type': MIME[path.extname(fp)] || 'text/plain'});
    fs.createReadStream(fp).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(3000, () => console.log('CEO Dashboard running at http://localhost:3000'));
