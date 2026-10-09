# aeo-audit

Check any live page for the SEO and answer-engine basics in one command. No dependencies, no account, no API key.

I built it because the same handful of problems kept shipping on pages that looked finished: a title that gets cut off, no canonical, an H1 missing, images with no alt text, FAQ content with no FAQ schema, a robots.txt that quietly blocks AI crawlers.

## Run it

No install needed:

```bash
npx github:MarketingOpswithSam/aeo-audit https://yoursite.com/blog/some-post
```

Or clone it:

```bash
git clone https://github.com/MarketingOpswithSam/aeo-audit.git
cd aeo-audit
node audit.mjs https://yoursite.com/blog/some-post
```

Needs Node 18 or newer. Pass several URLs to audit them in one go. Add `--json` for machine-readable output.

## What it checks

| Area | Checks |
| --- | --- |
| Basics | title length, meta description length, exactly one H1, canonical, not set to noindex |
| Sharing | og:title, og:description, og:image |
| Structured data | JSON-LD parses, which schema types are present, FAQPage on article pages |
| Content | image alt text, word count |
| Site files | robots.txt, whether GPTBot / ClaudeBot / PerplexityBot / Google-Extended / OAI-SearchBot are blocked, sitemap listed, llms.txt |

Each check comes back `PASS`, `warn` or `FAIL`. The script exits with code 1 if anything fails, so you can run it in CI or a publish checklist and stop a bad page before it goes live.

## Why the AI-crawler and llms.txt checks

More buyers now get their first answer from ChatGPT, Perplexity, Copilot or Google's AI results. If your robots.txt blocks those crawlers, or your best pages have no FAQ markup, you are invisible to them. These checks are cheap to run and expensive to miss.

## Limits

It reads the HTML the server returns. Content added by JavaScript after load will not be seen, and it does not replace Search Console or a full crawler. Treat it as a fast pre-publish gate.

## Licence

MIT. Use it, fork it, change the thresholds.

Built by [Marketing Ops with Sam](https://marketingopswithsam.com).
