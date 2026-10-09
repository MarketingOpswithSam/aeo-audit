import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

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
