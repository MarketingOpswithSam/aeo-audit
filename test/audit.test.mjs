import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';

test('exits 2 with usage when given no URL', () => {
  const r = spawnSync('node', ['audit.mjs'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Usage/);
});

test('fails cleanly on an unreachable page', () => {
  const r = spawnSync('node', ['audit.mjs', 'http://127.0.0.1:1/'], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /FAIL\s+page loads/);
});

const PAGE = `<!doctype html><html><head>
<title>Tom &amp; Jerry, a guide | Brand</title>
<meta name="description" content="A description that is comfortably inside the recommended length range for search results pages.">
<link rel="canonical" href="http://x/"></head><body><h1>Hi</h1>
<img src="a.svg" alt data-x="1"><img src="b.png" alt=""><img src="c.png" alt="A chart"><img src="d.png">
</body></html>`;

test('decodes entities and treats empty alt as decorative', async () => {
  const srv = createServer((req, res) => {
    if (req.url === '/') { res.setHeader('content-type', 'text/html'); res.end(PAGE); } else { res.statusCode = 404; res.end(); }
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${srv.address().port}/`;
  const out = await new Promise((resolve) => {
    const p = spawn('node', ['audit.mjs', url]); let o = '';
    p.stdout.on('data', (d) => (o += d)); p.on('close', () => resolve(o));
  });
  srv.close();
  assert.match(out, /title length - 28 chars/); // "&amp;" counts as one character, not five
  assert.match(out, /1 of 4 images have no alt attribute \(2 marked decorative/);
});

test('separates AI search bots from training bots and treats llms.txt as optional', async () => {
  const ROBOTS = 'User-agent: GPTBot\nDisallow: /\n\nUser-agent: OAI-SearchBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n';
  const srv = createServer((req, res) => {
    if (req.url === '/') { res.setHeader('content-type', 'text/html'); res.end(PAGE); }
    else if (req.url === '/robots.txt') { res.setHeader('content-type', 'text/plain'); res.end(ROBOTS); }
    else { res.statusCode = 404; res.end(); }
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const out = await new Promise((resolve) => {
    const p = spawn('node', ['audit.mjs', `http://127.0.0.1:${srv.address().port}/`]); let o = '';
    p.stdout.on('data', (d) => (o += d)); p.on('close', () => resolve(o));
  });
  srv.close();
  assert.match(out, /warn\s+AI search bots allowed - blocked: OAI-SearchBot/);
  assert.match(out, /info\s+AI training bots - blocked: GPTBot/);
  assert.match(out, /info\s+llms\.txt - not present/);
});
