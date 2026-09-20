import { appendFileSync, readFileSync, statSync, writeFileSync } from 'node:fs';

// Substitute curl output without opening sockets or launching the real curl.
const args = process.argv.slice(2);
const responses = JSON.parse(process.env.TEST_CURL_RESPONSES);
const callsFile = process.env.TEST_CURL_CALLS;
let callCount = 0;
try {
  callCount = readFileSync(callsFile, 'utf8').trim().split('\n').filter(Boolean).length;
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const response = responses[callCount];
if (!response) throw new Error('Unexpected curl invocation');

const outputIndex = args.indexOf('-o');
const formatIndex = args.indexOf('-w');
if (outputIndex < 0 || args[formatIndex + 1] !== '%{http_code}') {
  throw new Error('The probe must capture both the body and HTTP status');
}
const output = args[outputIndex + 1];
writeFileSync(output, response.body ?? '');
appendFileSync(callsFile, `${JSON.stringify({
  args,
  output,
  mode: statSync(output).mode & 0o777,
})}\n`);
process.stdout.write(response.http ?? '200');
process.exitCode = response.exit ?? 0;
