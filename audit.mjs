#!/usr/bin/env node
// aeo-audit: check a live page for the SEO and answer-engine basics.
//   node audit.mjs https://example.com/blog/post
//   node audit.mjs https://example.com/a https://example.com/b --json
// Zero dependencies. Node 18+. Exits 1 if any check fails.
const args = process.argv.slice(2);
const asJson = args.includes('--json');
const urls = args.filter((a) => !a.startsWith('--'));
if (!urls.length) {
  console.error('Usage: node audit.mjs <url> [<url> ...] [--json]');
  process.exit(2);
}

const UA = { 'user-agent': 'aeo-audit/1.0 (+https://github.com/MarketingOpswithSam/aeo-audit)' };
const get = async (u) => {
  try {
    const r = await fetch(u, { headers: UA, redirect: 'follow' });
    return { status: r.status, url: r.url, text: r.status === 200 ? await r.text() : '' };
  } catch (e) {
    return { status: 0, url: u, text: '', error: e.message };
  }
};

const decode = (s) =>
  s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[e]));
const tag = (html, re) => decode((html.match(re) || [])[1]?.trim() ?? '');
const meta = (html, attr, name) =>
  tag(html, new RegExp(`<meta[^>]+${attr}=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i')) ||
  tag(html, new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*${attr}=["']${name}["']`, 'i'));

function jsonLdTypes(html) {
  const types = new Set();
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = (n) => {
        if (Array.isArray(n)) return n.forEach(walk);
        if (n && typeof n === 'object') {
          [].concat(n['@type'] || []).forEach((t) => types.add(t));
          Object.values(n).forEach(walk);
        }
      };
      walk(JSON.parse(m[1]));
    } catch {
      types.add('__invalid_json_ld__');
    }
  }
  return types;
}

async function audit(url) {
  const results = [];
  const add = (level, check, detail = '') => results.push({ level, check, detail });
  const page = await get(url);
  if (page.status !== 200) {
    add('fail', 'page loads', `HTTP ${page.status}${page.error ? ' ' + page.error : ''}`);
    return results;
  }
  const html = page.text;
  const origin = new URL(page.url).origin;

  const title = tag(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!title) add('fail', 'title tag', 'missing');
  else if (title.length > 60) add('warn', 'title length', `${title.length} chars (aim for 60 or fewer)`);
  else add('pass', 'title length', `${title.length} chars`);

  const desc = meta(html, 'name', 'description');
  if (!desc) add('fail', 'meta description', 'missing');
  else if (desc.length > 160) add('warn', 'meta description length', `${desc.length} chars (Google has no hard limit, but long ones get cut off in results; about 160 is safe)`);
  else if (desc.length < 70) add('info', 'meta description length', `${desc.length} chars (short, consider saying more)`);
  else add('pass', 'meta description', `${desc.length} chars`);

  const h1s = (html.match(/<h1[\s>]/gi) || []).length;
  add(h1s === 1 ? 'pass' : 'fail', 'one H1', `found ${h1s}`);

  const canonical = tag(html, /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  if (!canonical) add('fail', 'canonical', 'missing');
  else if (/\.html($|\?)/.test(canonical)) add('warn', 'canonical', `ends in .html: ${canonical}`);
  else add('pass', 'canonical', canonical);

  if (/<meta[^>]+name=["']robots["'][^>]*noindex/i.test(html)) add('fail', 'indexable', 'noindex is set');
  else add('pass', 'indexable');

  for (const p of ['og:title', 'og:description', 'og:image'])
    add(meta(html, 'property', p) ? 'pass' : 'warn', p);

  const types = jsonLdTypes(html);
  if (types.has('__invalid_json_ld__')) add('fail', 'JSON-LD parses', 'a block is not valid JSON');
  add(types.size ? 'pass' : 'warn', 'structured data', [...types].filter((t) => t !== '__invalid_json_ld__').join(', ') || 'none');
  const isArticle = ['Article', 'BlogPosting', 'NewsArticle'].some((t) => types.has(t));
  if (isArticle) add('info', 'FAQPage schema', types.has('FAQPage') ? 'present (Google no longer shows FAQ rich results, but the markup is harmless)' : 'not present (optional: Google no longer shows FAQ rich results)');

  // An empty alt (alt="" or a bare `alt`) is valid: it marks a decorative image.
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const noAlt = imgs.filter((i) => !/\salt(\s|=|\/|>)/i.test(i)).length;
  const emptyAlt = imgs.filter((i) => /\salt(\s*=\s*(""|'')|\s|\/|>)/i.test(i) && !/\salt\s*=\s*["'][^"']+["']/i.test(i)).length;
  add(noAlt ? 'warn' : 'pass', 'image alt attribute', `${noAlt} of ${imgs.length} images have no alt attribute (${emptyAlt} marked decorative with empty alt)`);

  const text = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, ' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  add(words >= 300 ? 'pass' : 'warn', 'word count', `${words} words`);

  // Site-level files, checked once per origin
  const robots = await get(origin + '/robots.txt');
  add(robots.status === 200 ? 'pass' : 'warn', 'robots.txt', `HTTP ${robots.status}`);
  if (robots.status === 200) {
    // A bot is blocked when its group (or the * group, if it has none) disallows /.
    const groups = [];
    for (const block of robots.text.split(/\n\s*\n/)) {
      const agents = [...block.matchAll(/^\s*user-agent:\s*(\S+)/gim)].map((m) => m[1].toLowerCase());
      const rules = [...block.matchAll(/^\s*(allow|disallow):\s*(\S*)/gim)].map((m) => [m[1].toLowerCase(), m[2]]);
      if (agents.length) groups.push({ agents, rules });
    }
    const blockedFor = (bot) => {
      const g = groups.find((x) => x.agents.includes(bot.toLowerCase())) || groups.find((x) => x.agents.includes('*'));
      if (!g) return false;
      const allowAll = g.rules.some(([k, v]) => k === 'allow' && v === '/');
      return !allowAll && g.rules.some(([k, v]) => k === 'disallow' && v === '/');
    };
    const searchBlocked = ['OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot'].filter(blockedFor);
    add(searchBlocked.length ? 'warn' : 'pass', 'AI search bots allowed', searchBlocked.length ? `blocked: ${searchBlocked.join(', ')} (you will not appear in those answers)` : 'OAI-SearchBot, Claude-SearchBot, PerplexityBot not blocked');
    const trainBlocked = ['GPTBot', 'ClaudeBot', 'Google-Extended'].filter(blockedFor);
    add('info', 'AI training bots', trainBlocked.length ? `blocked: ${trainBlocked.join(', ')} (a valid choice: opts out of model training, not search answers)` : 'not blocked');
    add(/sitemap:/i.test(robots.text) ? 'pass' : 'warn', 'sitemap listed in robots.txt');
  }
  const llms = await get(origin + '/llms.txt');
  add(llms.status === 200 ? 'pass' : 'info', 'llms.txt', llms.status === 200 ? 'present' : 'not present (optional: Google says sites do not need it)');
  return results;
}

let failed = 0;
const all = {};
for (const url of urls) {
  const res = await audit(url);
  all[url] = res;
  failed += res.filter((r) => r.level === 'fail').length;
  if (asJson) continue;
  const icon = { pass: 'PASS', info: 'info', warn: 'warn', fail: 'FAIL' };
  console.log(`\n${url}`);
  for (const r of res) console.log(`  ${icon[r.level]}  ${r.check}${r.detail ? ' - ' + r.detail : ''}`);
  const c = (l) => res.filter((r) => r.level === l).length;
  console.log(`  => ${c('pass')} pass, ${c('info')} info, ${c('warn')} warn, ${c('fail')} fail`);
}
if (asJson) console.log(JSON.stringify(all, null, 2));
process.exit(failed ? 1 : 0);
