import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloudAccount} from '../cloud-account.mjs';
import {defaults} from '../core.mjs';

test('sync status tracks confirmed saves, pending edits, reload and loss of connectivity', async () => {
  const storage = new Map();
  const files = [];
  const listeners = new Map();
  const panel = {innerHTML: ''};
  const footer = {dataset: {}, textContent: ''};
  let current = defaults();
  let pendingAction;
  let savedLocally = true;
  const mocks = {
    navigator: {onLine: true},
    localStorage: {getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value)},
    document: {
      getElementById: id => id === 'cloud-account' ? panel : footer,
      addEventListener: (type, handler) => listeners.set(type, handler)
    },
    window: {
      addEventListener: (type, handler) => listeners.set(type, handler),
      google: {accounts: {oauth2: {
        hasGrantedAllScopes: () => true,
        initTokenClient: config => ({requestAccessToken: () => { pendingAction = config.callback({access_token: 'test'}); }})
      }}}
    },
    fetch: async (url, options) => {
      if (url.includes('/about?')) return Response.json({user: {permissionId: 'test-account'}});
      if (options.method === 'POST') {
        const file = {id: `v${files.length + 1}`, description: JSON.stringify(files.map(file => file.id)), createdTime: new Date().toISOString()};
        files.push(file);
        return Response.json(file);
      }
      return Response.json({files});
    }
  };
  const originals = Object.keys(mocks).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  for (const [key, value] of Object.entries(mocks)) Object.defineProperty(globalThis, key, {configurable: true, writable: true, value});
  const click = action => listeners.get('click')({target: {closest: () => ({dataset: {action}})}});
  const start = () => createCloudAccount({
    esc: value => value, heading: () => '', notify() {}, exportBackup() {}, applyLocal: () => true, mayApply: () => true,
    getLocal: () => savedLocally ? {snapshot: JSON.stringify(current), marker: JSON.stringify(current)} : null
  });
  try {
    const account = start();
    account.render({});
    await account.initialize();
    assert.equal(footer.dataset.syncState, 'signed-out');
    click('cloud-connect');
    await pendingAction;
    for (let tries = 0; footer.dataset.syncState !== 'synced' && tries < 100; tries++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(footer.dataset.syncState, 'synced');
    const firstSync = JSON.parse(storage.get('physio-study-cloud-checkpoint')).syncedAt;
    assert.ok(Number.isFinite(firstSync));
    assert.match(panel.innerHTML, /You can switch devices/);

    current.settings.newLimit = 31;
    account.localSaved();
    assert.equal(footer.dataset.syncState, 'pending');
    assert.ok(panel.innerHTML.includes(new Date(firstSync).toISOString()));
    assert.doesNotMatch(panel.innerHTML, /You can switch devices/);
    mocks.navigator.onLine = false;
    listeners.get('offline')();
    assert.equal(footer.dataset.syncState, 'offline');
    click('cloud-sign-out');

    mocks.navigator.onLine = true;
    const reopened = start();
    await reopened.initialize();
    assert.equal(footer.textContent, 'Sign in to upload changes');
    assert.ok(panel.innerHTML.includes(new Date(firstSync).toISOString()));
    savedLocally = false;
    reopened.localSaveFailed();
    assert.equal(footer.dataset.syncState, 'local-error');
  } finally {
    click('cloud-sign-out');
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
