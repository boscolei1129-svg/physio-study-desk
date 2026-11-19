import test from 'node:test';
import assert from 'node:assert/strict';
import {createDrive, latestVersions, syncDecision} from '../drive-sync.mjs';

const version = (id, parents = []) => ({id, description: JSON.stringify(parents)});

test('concurrent saves stay visible until a new version explicitly resolves both', () => {
  const root = version('root');
  const phone = version('phone', ['root']);
  const laptop = version('laptop', ['root']);
  assert.deepEqual(latestVersions([root, phone, laptop]).map(file => file.id).sort(), ['laptop', 'phone']);
  assert.deepEqual(latestVersions([root, phone, laptop, version('resolved', ['phone', 'laptop'])]).map(file => file.id), ['resolved']);
  assert.throws(() => latestVersions([version('root', ['root'])]));
});

test('first use and concurrent edits never silently replace nonempty progress', () => {
  const head = version('remote');
  const checkpoint = {id: 'remote', digest: 'synced'};
  const result = input => syncDecision({heads: [head], checkpoint, digest: 'synced', blank: false, ...input});
  assert.equal(result({heads: [], checkpoint: null}), 'upload');
  assert.equal(result({checkpoint: null, blank: true}), 'download');
  assert.equal(result({checkpoint: null}), 'compare');
  assert.equal(result({digest: 'new-local'}), 'upload');
  assert.equal(result({heads: [version('new-cloud')]}), 'download');
  assert.equal(result({heads: [version('new-cloud')], digest: 'new-local'}), 'compare');
  assert.equal(result({heads: [head, version('other')]}), 'choose');
  assert.equal(result({accountChanged: true, heads: []}), 'choose');
  assert.equal(result({heads: []}), 'choose');
});

test('Drive uses private app data across pages and keeps the access token in request headers', async () => {
  const calls = [];
  const client = createDrive('test-token', async (url, options) => {
    calls.push({url, options});
    const page = new URL(url).searchParams.get('pageToken');
    if (options.method === 'POST') return Response.json(version('new'));
    if (url.includes('alt=media')) return Response.json({version: 1});
    return Response.json(page ? {files: [version('latest', ['root'])]} : {files: [version('root')], nextPageToken: 'page-2'});
  });
  assert.deepEqual((await client.list()).map(file => file.id), ['latest']);
  assert.deepEqual(await client.read('latest'), {version: 1});
  assert.equal((await client.write('{"version":1}', ['latest'])).id, 'new');
  for (const call of calls) {
    assert.equal(call.options.headers.Authorization, 'Bearer test-token');
    assert.ok(!call.url.includes('test-token'));
  }
  assert.equal(new URL(calls[0].url).searchParams.get('spaces'), 'appDataFolder');
  assert.match(calls.at(-1).options.body, /"parents":\["appDataFolder"\]/);
  assert.match(calls.at(-1).options.body, /\{\"version\":1\}/);
  const expired = createDrive('expired', async () => new Response(null, {status: 401}));
  await assert.rejects(expired.list(), error => error.expired === true);
});
