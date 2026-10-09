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
| Structured data | JSON-LD parses, which schema types are present, FAQPage noted on article pages |
| Content | images with no alt attribute (empty alt is accepted as decorative), word count |
| Site files | robots.txt, whether AI **search** bots (OAI-SearchBot, Claude-SearchBot, PerplexityBot) are blocked, whether AI **training** bots (GPTBot, ClaudeBot, Google-Extended) are blocked, sitemap listed, llms.txt |

Each check comes back `PASS`, `info`, `warn` or `FAIL`. Only `FAIL` makes the script exit with code 1, so you can run it in CI or a publish checklist and stop a bad page before it goes live.

## What counts as a problem, and what doesn't

- **Blocking AI search bots is a warning.** If OAI-SearchBot, Claude-SearchBot or PerplexityBot are disallowed, you will not be shown in those products' answers.
- **Blocking AI training bots is only info.** GPTBot, ClaudeBot and Google-Extended relate to model training. Blocking them is a legitimate choice and does not remove you from search answers.
- **llms.txt is optional.** Google says sites do not need it and no major AI system is confirmed to use it, so a missing file is `info`, not a warning.
- **FAQ schema is info.** Google no longer shows FAQ rich results. The markup is harmless.
- **Meta descriptions:** Google has no fixed limit, but long ones get cut off. The check warns above 160 characters.

## Read more

[Should you block GPTBot? Which AI crawlers to allow and which to block](https://marketingopswithsam.com/blog/block-gptbot-or-allow-ai-crawlers) explains the search-bot and training-bot split this tool reports on.

## Limits

It reads the HTML the server returns. Content added by JavaScript after load will not be seen, and it does not replace Search Console or a full crawler. Treat it as a fast pre-publish gate.

## Licence

MIT. Use it, fork it, change the thresholds.

Built by [Marketing Ops with Sam](https://marketingopswithsam.com).
