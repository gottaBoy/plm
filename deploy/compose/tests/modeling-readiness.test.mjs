import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '../../../..');
const script = join(root, 'scripts/modeling-readiness.sh');
const mockCurl = join(directory, 'fixtures/readiness-curl.mjs');
const credentials = {
  MODEL_READINESS_LOGINNAME: 'probe-user',
  MODEL_READINESS_PASSWORD: 'probe-password-secret',
};
const token = 'test-token-do-not-print';
const login = { http: '200', body: JSON.stringify({ token }) };
const ready = { http: '200', body: '[]' };

function probe(t, responses, overrides = {}, { missingCurl = false } = {}) {
  const temp = mkdtempSync(join(tmpdir(), 'plm-readiness-test-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const callsFile = join(temp, 'calls.jsonl');
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith('MODEL_READINESS_') || key === 'SERVER_PORT') delete env[key];
  }
  Object.assign(env, overrides, {
    TMPDIR: temp,
    TEST_CURL_RESPONSES: JSON.stringify(responses),
    TEST_CURL_CALLS: callsFile,
    TEST_NODE: process.execPath,
    TEST_MOCK_CURL: mockCurl,
    TEST_READINESS_SCRIPT: script,
  });
  if (missingCurl) env.PATH = temp;

  const wrapper = missingCurl
    ? '. "$TEST_READINESS_SCRIPT"'
    : 'curl() { "$TEST_NODE" "$TEST_MOCK_CURL" "$@"; }\n. "$TEST_READINESS_SCRIPT"';
  const result = spawnSync('/bin/sh', ['-c', wrapper], {
    env,
    encoding: 'utf8',
    timeout: 5000,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, result.stderr);
  const calls = existsSync(callsFile)
    ? readFileSync(callsFile, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse)
    : [];
  const output = `${result.stdout}${result.stderr}`;
  for (const secret of [token, credentials.MODEL_READINESS_PASSWORD]) {
    assert.ok(!output.includes(secret), 'Probe output must not disclose credentials or tokens');
  }
  for (const call of calls) {
    assert.equal(call.mode, 0o600, 'Response files must be private');
    assert.equal(existsSync(call.output), false, 'Response files must be removed after the probe');
  }
  return { ...result, calls };
}

function option(call, name) {
  return call.args[call.args.indexOf(name) + 1];
}

function headers(call) {
  return call.args.flatMap((value, index) => value === '-H' ? [call.args[index + 1]] : []);
}

test('logs in through UAA, then performs the actual read-only PLM POST', t => {
  const result = probe(t, [login, ready], credentials);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.calls.length, 2);
  const [auth, api] = result.calls;
  assert.equal(auth.args.at(-1), 'http://ibizlab-uaa-api:32666/v7/login');
  assert.deepEqual(JSON.parse(option(auth, '--data-raw')), {
    loginname: credentials.MODEL_READINESS_LOGINNAME,
    password: credentials.MODEL_READINESS_PASSWORD,
  });
  assert.equal(api.args.at(-1), 'http://127.0.0.1:30251/ibizplm/serviceapi/psdelogics/fetchdefault');
  assert.deepEqual(JSON.parse(option(api, '--data-raw')), { page: 0, size: 1 });
  assert.ok(headers(api).includes(`Authorization: Bearer ${token}`));
  assert.ok(headers(api).includes('Content-Type: application/json'));
  assert.equal(option(auth, '--connect-timeout'), '2');
  assert.equal(option(api, '--connect-timeout'), '2');
  assert.equal(option(auth, '--max-time'), '5');
  assert.equal(option(api, '--max-time'), '8');
  assert.equal(auth.args[0], '-q');
  assert.equal(api.args[0], '-q');
});

test('an explicit authentication URL remains configurable', t => {
  const url = 'http://configured-uaa.invalid:32666/v7/login';
  const result = probe(t, [login, ready], {
    ...credentials,
    MODEL_READINESS_AUTH_URL: url,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.calls[0].args.at(-1), url);
});

test('a supplied token bypasses login and preserves the configured API URL', t => {
  const url = 'http://127.0.0.1:30252/ibizplm/serviceapi/psdelogics/fetchdefault';
  const result = probe(t, [ready], {
    ...credentials,
    MODEL_READINESS_TOKEN: token,
    MODEL_READINESS_URL: url,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.calls.length, 1);
  assert.equal(result.calls[0].args.at(-1), url);
  assert.ok(headers(result.calls[0]).includes(`Authorization: Bearer ${token}`));
});

test('the default API URL honors SERVER_PORT', t => {
  const result = probe(t, [ready], {
    MODEL_READINESS_TOKEN: token,
    SERVER_PORT: '30252',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.calls[0].args.at(-1), 'http://127.0.0.1:30252/ibizplm/serviceapi/psdelogics/fetchdefault');
});

test('the OAuth access_token response is still supported', t => {
  const result = probe(t, [
    { body: JSON.stringify({ access_token: token }) },
    ready,
  ], credentials);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(headers(result.calls[1]).includes(`Authorization: Bearer ${token}`));
});

test('missing credentials fail before making any request', t => {
  for (const overrides of [
    {},
    { MODEL_READINESS_LOGINNAME: credentials.MODEL_READINESS_LOGINNAME },
    { MODEL_READINESS_PASSWORD: credentials.MODEL_READINESS_PASSWORD },
  ]) {
    const result = probe(t, [], overrides);
    assert.equal(result.status, 1);
    assert.equal(result.calls.length, 0);
    assert.match(result.stderr, /no token or login credentials/);
  }
});

for (const http of ['301', '302', '401', '403', '404', '500', '503']) {
  test(`authentication HTTP ${http} fails even when a token is present`, t => {
    const result = probe(t, [{ ...login, http }], credentials);
    assert.equal(result.status, 1);
    assert.equal(result.calls.length, 1);
    assert.match(result.stderr, new RegExp(`authentication returned HTTP ${http}`));
  });
}

test('authentication HTTP 200 without a nonempty token fails', t => {
  for (const body of ['', '{}', '{"token":""}', '{"token":null}', '<html>Sign in</html>']) {
    const result = probe(t, [{ http: '200', body }], credentials);
    assert.equal(result.status, 1);
    assert.equal(result.calls.length, 1);
    assert.match(result.stderr, /authentication response has no token/);
  }
});

for (const exit of [7, 28]) {
  test(`authentication curl exit ${exit} fails, including partial HTTP 200 responses`, t => {
    const result = probe(t, [{ ...login, exit }], credentials);
    assert.equal(result.status, 1);
    assert.equal(result.calls.length, 1);
    assert.match(result.stderr, new RegExp(`authentication transport failed \\(curl exit ${exit}\\)`));
  });
}

for (const http of ['301', '302', '401', '403', '404', '500', '503']) {
  test(`PLM business POST HTTP ${http} is not ready`, t => {
    const result = probe(t, [login, { ...ready, http }], credentials);
    assert.equal(result.status, 1);
    assert.equal(result.calls.length, 2);
    assert.match(result.stderr, /PLM API/);
    assert.ok(result.stderr.includes(http));
  });
}

for (const exit of [7, 28]) {
  test(`PLM curl exit ${exit} fails even after receiving a partial HTTP 200 array`, t => {
    const result = probe(t, [login, { ...ready, exit }], credentials);
    assert.equal(result.status, 1);
    assert.equal(result.calls.length, 2);
    assert.match(result.stderr, new RegExp(`PLM API transport failed \\(curl exit ${exit}\\)`));
  });
}

test('whitespace and empty arrays are accepted; no records are required', t => {
  for (const body of ['[]', '\n  []\r\n', '[\n  {"id":"read-only-fixture"}\n]\n']) {
    const result = probe(t, [{ http: '200', body }], { MODEL_READINESS_TOKEN: token });
    assert.equal(result.status, 0, result.stderr);
  }
});

test('empty, non-array and incomplete API response bodies are not ready', t => {
  for (const body of [
    '', 'null', '{}', '<html>Sign in</html>', '{"error":"not ready"}',
    '{"data":\n[]\n}', '[', '[{"id":"incomplete"}', '[] trailing-text',
  ]) {
    const result = probe(t, [{ http: '200', body }], { MODEL_READINESS_TOKEN: token });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /non-array or incomplete/);
  }
});

test('missing curl reports a dependency failure without attempting a request', t => {
  const result = probe(t, [], credentials, { missingCurl: true });
  assert.equal(result.status, 1);
  assert.equal(result.calls.length, 0);
  assert.match(result.stderr, /curl is unavailable/);
});
