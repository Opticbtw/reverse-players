'use strict';
// Reverse live-players server. Counts how many launchers are open right now.
// Each launcher POSTs /beat every few seconds; one that stops (closed) drops off after TTL.
const http = require('http');

const TTL = 15000;              // a launcher is "online" if it checked in within the last 15s
const seen = new Map();         // id -> last-seen time (ms)

function count() {
  const now = Date.now();
  for (const [id, t] of seen) if (now - t > TTL) seen.delete(id);
  return seen.size;
}
function readBody(req, cb) {
  let d = '';
  req.on('data', (c) => { d += c; if (d.length > 1e4) req.destroy(); });
  req.on('end', () => cb(d));
  req.on('error', () => cb(''));
}
function idOf(body) {
  try { const v = JSON.parse(body || '{}').id; return (typeof v === 'string' && v.length <= 64) ? v : ''; }
  catch (e) { return ''; }
}
function send(res, obj) {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = req.url.split('?')[0];
  if (url === '/beat' && req.method === 'POST') {
    readBody(req, (b) => { const id = idOf(b); if (id) seen.set(id, Date.now()); send(res, { count: count() }); });
    return;
  }
  if (url === '/leave') { // POST or sendBeacon on launcher close
    readBody(req, (b) => { const id = idOf(b); if (id) seen.delete(id); send(res, { count: count() }); });
    return;
  }
  if (url === '/count' || url === '/') { send(res, { count: count() }); return; }
  res.writeHead(404); res.end();
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Reverse presence server listening on ' + PORT));
