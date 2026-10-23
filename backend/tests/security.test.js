import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('server exposes a health endpoint', () => {
  const body = fs.readFileSync(__dirname + '/../src/index.js', 'utf8');
  assert.ok(body.includes('/api/health'), 'health endpoint required');
});

test('no hard-coded secret fallback in server entry', () => {
  const body = fs.readFileSync(__dirname + '/../src/index.js', 'utf8');
  assert.ok(!/process\.env\.(JWT_SECRET|SESSION_SECRET)\s*\|\|\s*['"][^'"]+['"]/.test(body), 'secrets must fail closed');
});
