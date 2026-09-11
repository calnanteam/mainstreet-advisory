// Run with Node.js 24: node scripts/check-preview-policy.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { matchesGlob } from 'node:path';

const policies = {"vercel.json":["main"]};
for (const [file, allowed] of Object.entries(policies)) {
  const rules = JSON.parse(readFileSync(file, 'utf8')).git.deploymentEnabled;
  assert.deepEqual(rules, Object.fromEntries([['**', false], ...allowed.map(b => [b, true])]));
  for (const branch of ['review', 'fix/nested/branch', 'feature/new-work', ...allowed]) {
    const matches = Object.entries(rules).filter(([pattern]) => matchesGlob(branch, pattern));
    assert.equal(!matches.length || matches.some(([, enabled]) => enabled), allowed.includes(branch), branch);
  }
}
const workflow = readFileSync('.github/workflows/vercel-preview-on-label.yml', 'utf8');
const deployJob = workflow.split('\n  deploy:\n')[1];
assert.match(deployJob, /github.event_name == 'pull_request_target'/);
assert.match(deployJob, /github.event.pull_request.head.repo.full_name == github.repository/);
assert.doesNotMatch(deployJob, /actions\/checkout|persist-credentials: true/);
const source = workflow.split('          script: |\n')[1].split('\n').map(l => l.slice(12)).join('\n');
const run = new (Object.getPrototypeOf(async function() {}).constructor)(
  'context', 'github', 'fetch', 'process', 'setTimeout', source,
);
const projects = {"preview":{"name":"mainstreet-advisory-ca4y","id":"prj_w3rEhIoNSXJ6Sr6NaQkGT8amPSbA"}};
const sha = 'a'.repeat(40);
async function exercise(label, { fork = false, closed = false, state = 'READY', target = null, actualSha = sha, token = 'test-token' } = {}) {
  const requests = [], comments = [];
  const context = {
    repo: { owner: 'calnanteam', repo: 'mainstreet-advisory' },
    payload: { label: { name: label }, pull_request: {
      number: 7, state: closed ? 'closed' : 'open', head: { sha, ref: 'fix/nested/branch', repo: {
        id: 123, full_name: fork ? 'outsider/fork' : 'calnanteam/mainstreet-advisory',
      } },
    } },
  };
  const fetch = async (url, options) => {
    requests.push({ url, ...options });
    return { ok: true, json: async () => options.method === 'POST'
      ? { id: 'dpl_test', readyState: 'QUEUED' }
      : { id: 'dpl_test', projectId: projects[label]?.id, readyState: state,
          target, gitSource: { sha: actualSha }, url: 'preview.example.vercel.app' } };
  };
  const execute = () => run(context, { rest: { issues: { createComment: async c => comments.push(c) } } },
    fetch, { env: { VERCEL_TOKEN: token } }, resolve => resolve());
  if (fork || closed || !Object.hasOwn(projects, label) || !token || state !== 'READY' || target || actualSha !== sha) {
    await assert.rejects(execute);
    assert.equal(comments.length, 0);
    if (fork || closed || !Object.hasOwn(projects, label) || !token) assert.equal(requests.length, 0);
    return;
  }
  await execute();
  assert.equal(requests.length, 2);
  assert.equal(requests[0].method, 'POST');
  assert.equal(requests[1].method, 'GET');
  assert.deepEqual(JSON.parse(requests[0].body), {
    name: projects[label].name, project: projects[label].id,
    gitSource: { type: 'github', repoId: 123, ref: 'fix/nested/branch', sha },
  });
  assert.equal(comments.length, 1);
  assert.equal(comments[0].issue_number, 7);
  assert.ok(comments[0].body.includes(sha));
}
for (const label of Object.keys(projects)) await exercise(label);
await exercise('preview', { fork: true });
await exercise('preview', { closed: true });
await exercise('unrelated');
await exercise('constructor');
await exercise('preview', { token: '' });
await exercise('preview', { state: 'BLOCKED' });
await exercise('preview', { target: 'production' });
await exercise('preview', { actualSha: 'b'.repeat(40) });
console.log('Preview branch policy and mocked deployment checks passed.');
