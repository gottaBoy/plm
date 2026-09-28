import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const testDir = dirname(fileURLToPath(import.meta.url));
const composeDir = resolve(testDir, '..');
const harness = resolve(composeDir, 'source-platform-smoke.sh');
const composeFile = resolve(composeDir, 'docker-compose-platform-local.yml');
const targetEnv = resolve(composeDir, 'source-built-target.env');
const plmWebGatewayConfig = resolve(
  composeDir,
  'nacos-configs/deployapp-ibizservicerunner-plmweb.txt',
);

function runHarness(env) {
  return new Promise((resolveRun, reject) => {
    const child = spawn('/bin/bash', [harness], {
      cwd: composeDir,
      env: { ...process.env, ...env },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('source smoke harness timed out'));
    }, 15_000);
    child.on('error', reject);
    child.on('close', (status, signal) => {
      clearTimeout(timeout);
      resolveRun({ status, signal, stdout, stderr });
    });
  });
}

function listen(server) {
  return new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolveListen(server.address().port);
    });
  });
}

function close(server) {
  return new Promise(resolveClose => server.close(() => resolveClose()));
}

function serviceServer(kind) {
  return createServer((request, response) => {
    let body = '';
    request.on('data', chunk => { body += chunk; });
    request.on('end', () => {
      const authorized = request.headers.authorization === 'Bearer contract-token';
      if (request.url === '/v7/login' && request.method === 'POST') {
        const valid = body.includes('"loginname":"contract-user"') &&
          body.includes('"password":"contract-password"');
        response.writeHead(valid ? 200 : 401, { 'content-type': 'application/json' });
        response.end(valid ? JSON.stringify({ access_token: 'contract-token' }) : '{}');
        return;
      }
      if (request.url === '/') {
        response.writeHead(kind === 'gateway' ? 404 : 401);
        response.end();
        return;
      }
      if (request.url?.includes('/dictionaries/codelist/SysOperator')) {
        response.writeHead(authorized ? 200 : 401, { 'content-type': 'application/json' });
        response.end(authorized ? JSON.stringify({ code: 'SysOperator', items: [] }) : '{}');
        return;
      }
      response.writeHead(404);
      response.end();
    });
  });
}

test('target-port Compose env pins source-built images and formal ports', () => {
  const config = JSON.parse(execFileSync('docker', [
    'compose', '--env-file', targetEnv, '-f', composeFile, 'config', '--format', 'json',
  ], { cwd: composeDir, encoding: 'utf8' }));
  const allinone = config.services['ibiz-ebsx-allinone-local'];
  const gateway = config.services['ibiz-ebsx-gateway-local'];
  assert.equal(allinone.image, 'aibiz/ibiz-ebsx-allinone-rt:8.1.0.584.1-local');
  assert.equal(gateway.image, 'aibiz/ibiz-ebsx-gateway:8.1.0.584.1-local');
  assert.equal(allinone.ports[0].published, '30000');
  assert.equal(gateway.ports[0].published, '30086');
  assert.equal(allinone.build.args.JAVA_IMAGE,
    'eclipse-temurin@sha256:bc033b57e11b773c3043babfd664e7a5ef110805548b921cbfc3e8c67a0725d6');
  assert.equal(config.services['ibiz-ebsx-allinone'], undefined);
  assert.equal(config.services['ibiz-ebsx-gateway'], undefined);
});

test('source smoke covers login, unauthorized API, allinone auth, and gateway route', async t => {
  const allinone = serviceServer('allinone');
  const gateway = serviceServer('gateway');
  const allinonePort = await listen(allinone);
  const gatewayPort = await listen(gateway);
  t.after(async () => {
    await close(allinone);
    await close(gateway);
  });

  const result = await runHarness({
    AIBIZ_ALLINONE_URL: `http://127.0.0.1:${allinonePort}`,
    AIBIZ_GATEWAY_URL: `http://127.0.0.1:${gatewayPort}`,
    AIBIZ_LOGINNAME: 'contract-user',
    AIBIZ_PASSWORD: 'contract-password',
    AIBIZ_REPORT_DIR: resolve(composeDir, '.artifacts/test-source-platform-smoke'),
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /PASS allinone POST \/v7\/login .*token_present=true/);
  assert.match(result.stdout, /PASS gateway routed API without token http=401/);
  assert.match(result.stdout, /PASS gateway routed API with token http=200/);
  assert.doesNotMatch(result.stdout, /contract-token|contract-password/);
});

test('source smoke fails on transport errors and route misses', async t => {
  const allinone = serviceServer('allinone');
  const allinonePort = await listen(allinone);
  t.after(() => close(allinone));

  const result = await runHarness({
    AIBIZ_ALLINONE_URL: `http://127.0.0.1:${allinonePort}`,
    AIBIZ_GATEWAY_URL: 'http://127.0.0.1:9',
    AIBIZ_LOGINNAME: 'contract-user',
    AIBIZ_PASSWORD: 'contract-password',
    AIBIZ_REPORT_DIR: resolve(composeDir, '.artifacts/test-source-platform-smoke-fail'),
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /FAIL gateway GET \/ .*curl_exit=/);
  assert.match(result.stdout, /FAIL gateway routed API without token .*curl_exit=/);

  const routeMiss = serviceServer('allinone');
  const routePort = await listen(routeMiss);
  t.after(() => close(routeMiss));
  const routeResult = await runHarness({
    AIBIZ_ALLINONE_URL: `http://127.0.0.1:${routePort}`,
    AIBIZ_GATEWAY_URL: `http://127.0.0.1:${routePort}`,
    AIBIZ_LOGINNAME: 'contract-user',
    AIBIZ_PASSWORD: 'contract-password',
    AIBIZ_GATEWAY_ROUTE_PATH: '/missing-route',
    AIBIZ_REPORT_DIR: resolve(composeDir, '.artifacts/test-source-platform-smoke-route-miss'),
  });
  assert.notEqual(routeResult.status, 0);
  assert.match(routeResult.stdout, /FAIL gateway routed API without token http=404/);
});

test('source smoke script is strict shell and does not expose credentials in its output', async () => {
  const source = await readFile(harness, 'utf8');
  const gatewayConfig = await readFile(plmWebGatewayConfig, 'utf8');
  assert.equal(spawnSync('bash', ['-n', harness]).status, 0);
  assert.match(source, /Authorization: Bearer/);
  assert.match(source, /token_present=true/);
  assert.match(source, /curl_exit=/);
  assert.match(
    source,
    /ROUTE_PATH="\$\{AIBIZ_GATEWAY_ROUTE_PATH:-\/ibizplm__plmweb\/dictionaries\/codelist\/SysOperator\}"/,
  );
  assert.match(gatewayConfig, /Path=\/ibizplm__plmweb\/config[^"]*\/ibizplm__plmweb\/dictionaries/);
  assert.doesNotMatch(source, /\/api\/ibizplm__plmweb/);
  assert.doesNotMatch(source, /printf .*TOKEN/);
});
