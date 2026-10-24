export function json(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', ...headers });
  res.end(JSON.stringify(body));
}
export async function bodyJson(req, limit = 262_144) {
  let size=0;const chunks=[];
  for await (const chunk of req) {
    size+=chunk.length;
    if(size>limit) { const e=new Error('Request body too large');e.status=413;throw e; }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export function validOrigin(req, base) {
  return !req.headers.origin || req.headers.origin === new URL(base).origin;
}
