import {defaults, validateBackup} from './core.mjs';
import {googleClientId} from './google-config.mjs';
import {createDrive, fingerprint, scope, syncDecision, validClientId} from './drive-sync.mjs';

const configKey = 'physio-study-google-client';
const checkpointKey = 'physio-study-cloud-checkpoint';
const defaultSnapshot = JSON.stringify(defaults());
const labelTime = value => new Date(value).toLocaleString();
const syncBadges = {
  'signed-out': 'Google sync off',
  'sign-in': 'Signing in…',
  'checking': 'Checking Google Drive…',
  'uploading': 'Uploading to Google Drive…',
  'downloading': 'Loading cloud progress…',
  'synced': 'Synced to Google Drive',
  'pending': 'Changes waiting to upload',
  'offline': 'Offline · sync paused',
  'review': 'Sync needs your attention',
  'available': 'Newer cloud progress available',
  'error': 'Sync paused',
  'local-error': 'Device save needs attention'
};
const readStorage = key => {
  try { return localStorage.getItem(key); } catch { return null; }
};

export function createCloudAccount({esc, heading, getLocal, applyLocal, mayApply, notify, exportBackup}) {
  let clientId = googleClientId || readStorage(configKey) || '';
  let checkpoint;
  try { checkpoint = JSON.parse(readStorage(checkpointKey)); } catch { checkpoint = null; }
  let remote, user, expiresAt, interval, queued;
  let ready = false, loading = false, busy = false, conflict = null;
  let message = 'Sign in to check your cloud copy.';
  let mode = 'signed-out';
  let localChanged = false;
  let localUnavailable = false;
  let editVersion = 0;

  function statusMode() {
    if (localUnavailable) return 'local-error';
    if (navigator.onLine === false && (remote || checkpoint || localChanged)) return 'offline';
    if (mode === 'synced' && localChanged) return 'pending';
    return mode;
  }

  function statusMarkup() {
    const state = statusMode();
    const details = {
      'synced': 'This device matches Google Drive. You can switch devices.',
      'pending': 'Keep this tab open or choose Sync now before switching devices.',
      'offline': 'Google Drive will be checked when you reconnect if you’re still signed in.',
      'local-error': 'Reload if another tab changed your progress, or export a backup in Settings.'
    };
    const lastSync = Number.isFinite(checkpoint?.syncedAt)
      ? `<time datetime="${new Date(checkpoint.syncedAt).toISOString()}">${esc(labelTime(checkpoint.syncedAt))}</time>`
      : 'No time recorded on this device';
    const pending = localChanged && state !== 'pending' && state !== 'local-error'
      ? '<p class="small">This device has changes awaiting cloud confirmation.</p>' : '';
    return `<section class="sync-summary" aria-label="Google sync status" aria-live="polite">
      <strong class="sync-badge" data-sync-state="${state}">${syncBadges[state]}</strong>
      <p class="small">${esc(details[state] || message)}</p>${pending}
      <p class="small muted">Last successful sync on this device · ${lastSync}</p>
    </section>`;
  }

  function refresh() {
    const host = document.getElementById('cloud-account');
    if (host) host.innerHTML = accountPanel();
    const status = document.getElementById('cloud-status');
    if (status) {
      const state = statusMode();
      status.dataset.syncState = state;
      status.textContent = state === 'signed-out' && localChanged ? 'Sign in to upload changes' : syncBadges[state];
    }
  }

  function setStatus(text, nextMode = mode) {
    message = text;
    mode = nextMode;
    refresh();
  }

  function warmGoogle() {
    if (!validClientId(clientId) || loading || ready) return;
    if (window.google?.accounts?.oauth2) { ready = true; refresh(); return; }
    loading = true;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      loading = false;
      ready = Boolean(window.google?.accounts?.oauth2);
      if (!ready) { setStatus('Google sign-in could not load. Try again.', 'error'); return; }
      refresh();
    };
    script.onerror = () => {
      loading = false;
      script.remove();
      setStatus('Google sign-in could not load. Check your connection and try again.', 'error');
    };
    document.head.append(script);
  }

  function disconnect(text, nextMode = 'signed-out') {
    clearInterval(interval);
    clearTimeout(queued);
    remote = null;
    user = null;
    expiresAt = 0;
    conflict = null;
    setStatus(text, nextMode);
  }

  function connect() {
    if (!ready || busy || remote) return;
    busy = true;
    setStatus('Waiting for Google to finish signing in.', 'sign-in');
    const failed = () => {
      busy = false;
      setStatus('Google sign-in did not finish. Check pop-up settings and try again.', 'error');
    };
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId, scope, include_granted_scopes: false, prompt: 'select_account',
        error_callback: failed,
        callback: async response => {
          if (response.error || !response.access_token || !window.google.accounts.oauth2.hasGrantedAllScopes(response, scope)) {
            busy = false;
            setStatus('Grant access to Study Desk’s private Drive storage to sync.', 'error');
            return;
          }
          try {
            const drive = createDrive(response.access_token);
            const account = await drive.account();
            if (!account?.permissionId) throw new Error('Google could not identify the Drive account.');
            user = account;
            expiresAt = Date.now() + Number(response.expires_in || 3600) * 1000;
            remote = drive;
            interval = setInterval(() => void synchronize(), 60000);
          } catch (error) {
            disconnect(syncError(error), 'error');
          } finally {
            busy = false;
            refresh();
          }
          if (remote) void synchronize();
        }
      });
      client.requestAccessToken();
    } catch { failed(); }
  }

  function accountPanel() {
    const status = statusMarkup();
    if (!validClientId(clientId)) {
      return `<h2>Set up Google sync</h2><p>Study Desk needs a Google web client ID to open the sign-in window.</p>
        <details><summary>Enter your Study Desk client ID</summary><form id="cloud-setup"><label for="cloud-client-id">Google web client ID</label>
        <input id="cloud-client-id" name="google-client" required autocomplete="off" placeholder="…apps.googleusercontent.com"><div class="button-row"><button class="primary" type="submit">Save client ID</button></div></form></details>${status}`;
    }
    if (!user) {
      const button = !ready && !loading
        ? '<button data-action="cloud-retry">Load Google sign-in</button>'
        : loading ? '<button disabled>Loading Google sign-in…</button>'
        : `<button class="cloud-google" data-action="cloud-connect" ${busy ? 'disabled' : ''}><img src="./assets/google-sign-in.png" alt="Sign in with Google"></button>`;
      return `<h2>Continue on another device</h2><p>Sign in to save your personal notes, cards, reviews, quizzes, tasks and unfinished sessions to Study Desk’s private space in your Google Drive.</p>${button}${status}<p class="small muted">PDFs and diagram exercises use their own backup in Diagram practice. Sign in again after closing or refreshing the page.</p>${googleClientId ? '' : `<button data-action="cloud-reset" ${busy ? 'disabled' : ''}>Change client ID</button>`}`;
    }
    const choices = conflict ? `<section class="notice cloud-choices"><h3>${conflict.reason === 'remote' ? 'Newer progress is available' : 'Choose which progress to continue with'}</h3>
      <p>${conflict.reason === 'remote' ? 'Load the cloud copy to continue from your other device.' : 'Check each copy before choosing. The chosen copy becomes your active progress.'}</p>
      <div class="button-row">${conflict.reason === 'remote' ? '' : `<button data-action="cloud-use-local" ${busy ? 'disabled' : ''}>Keep this device’s copy</button>`}<button data-action="cloud-export">Export this device’s copy</button></div>
      ${conflict.heads.map((file, index) => `<div class="cloud-version"><span>Cloud copy ${index + 1} · ${esc(labelTime(file.createdTime))}</span><button data-action="cloud-use-remote" data-id="${esc(file.id)}" ${busy ? 'disabled' : ''}>Use this cloud copy</button></div>`).join('')}</section>` : '';
    return `<h2>Google Drive connected</h2><p>${esc(user.emailAddress || user.displayName || 'Google account')}</p>${status}${choices}
      <div class="button-row"><button class="primary" data-action="cloud-sync-now" ${busy ? 'disabled' : ''}>Sync now</button><button data-action="cloud-sign-out" ${busy ? 'disabled' : ''}>Sign out</button></div>`;
  }

  function render(main) {
    main.innerHTML = heading('Account & sync', 'Continue studying with the same Google account on each device.') +
      `<section class="panel cloud-account" id="cloud-account">${accountPanel()}</section><p><a href="#settings">Settings &amp; backup</a> · <a href="#privacy">Privacy</a></p>`;
    warmGoogle();
    if (remote && conflict?.reason === 'remote') void synchronize();
  }

  const syncError = error => error instanceof TypeError || error.name === 'TimeoutError'
    ? 'Could not reach Google Drive. Your progress is saved on this device.' : error.message;

  async function synchronize(choice) {
    if (!remote || busy) return;
    if (Date.now() >= expiresAt) { disconnect('Google sign-in expired. Sign in again to resume syncing.'); return; }
    const previousChoice = conflict;
    busy = true;
    setStatus('Comparing this device with your cloud copy.', 'checking');
    try {
      const local = getLocal();
      if (!local) throw new Error('Reload this tab or recover your local study data before syncing.');
      const startingEditVersion = editVersion;
      const digest = await fingerprint(local.snapshot);
      const heads = await remote.list();
      const sameAccount = checkpoint?.account === user.permissionId && checkpoint?.clientId === clientId;
      if (startingEditVersion === editVersion) localChanged = !sameAccount ? local.snapshot !== defaultSnapshot : digest !== checkpoint.digest;
      const decision = syncDecision({heads, checkpoint: sameAccount ? checkpoint : null, digest,
        blank: local.snapshot === defaultSnapshot, accountChanged: Boolean(checkpoint && !sameAccount && local.snapshot !== defaultSnapshot)});
      let method = decision;
      let snapshot = local.snapshot;
      let target = heads[0];
      if (choice) {
        // Do not resolve a different set of edits from the one the user saw.
        if (!previousChoice || previousChoice.digest !== digest || headKey(previousChoice.heads) !== headKey(heads)) {
          conflict = {heads, digest, reason: 'changed'};
          setStatus('Progress changed while you were choosing. Check the current copies.', 'review');
          return;
        }
        method = choice === 'local' ? 'upload' : 'download';
        if (choice !== 'local') target = heads.find(file => file.id === choice);
      }
      if (method === 'download' || method === 'compare') {
        if (method === 'download') setStatus('Retrieving your progress from Google Drive.', 'downloading');
        snapshot = JSON.stringify(validateBackup(await remote.read(target?.id)));
        if (snapshot === local.snapshot && method === 'compare') method = 'current';
        else if (method === 'compare') method = 'choose';
      }
      if (method === 'choose' || (method === 'download' && !mayApply())) {
        conflict = {heads, digest, reason: method === 'choose' ? 'changed' : 'remote'};
        setStatus(method === 'choose' ? 'Choose which copy to continue with.' : 'Open Account & sync to load your newer progress.', method === 'choose' ? 'review' : 'available');
        return;
      }
      if (getLocal()?.marker !== local.marker) { queue(1500); setStatus('Checking your latest changes shortly.', 'pending'); return; }
      if (method === 'download' && !mayApply()) {
        conflict = {heads, digest, reason: 'remote'};
        setStatus('Open Account & sync to load your newer progress.', 'available');
        return;
      }
      if (method === 'upload' || (choice && heads.length > 1)) {
        setStatus('Saving a copy of your progress to Google Drive.', 'uploading');
        target = await remote.write(snapshot, heads.map(file => file.id));
      }
      if (method === 'download' && snapshot !== local.snapshot && (!mayApply() || !applyLocal(snapshot, local.marker))) {
        throw new Error('Local progress changed or could not be saved. Both copies are still available.');
      }
      const syncedAt = method === 'current' && sameAccount && checkpoint.id === target.id && Number.isFinite(checkpoint.syncedAt)
        ? checkpoint.syncedAt : Date.now();
      checkpoint = {clientId, account: user.permissionId, id: target.id, digest: await fingerprint(snapshot), syncedAt};
      try { localStorage.setItem(checkpointKey, JSON.stringify(checkpoint)); } catch { /* A new tab can safely compare both copies again. */ }
      conflict = null;
      const latest = getLocal();
      localUnavailable = !latest;
      localChanged = latest?.snapshot !== snapshot;
      if (localChanged) queue(15000);
      setStatus('', localChanged ? 'pending' : 'synced');
    } catch (error) {
      if (error.expired) disconnect(error.message);
      else setStatus(syncError(error), 'error');
    } finally {
      busy = false;
      refresh();
    }
  }

  function headKey(heads) { return heads.map(file => file.id).sort().join(','); }
  function queue(delay) { clearTimeout(queued); queued = setTimeout(() => void synchronize(), delay); }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-action^="cloud-"]');
    if (!button) return;
    switch (button.dataset.action) {
      case 'cloud-retry': warmGoogle(); refresh(); break;
      case 'cloud-reset':
        if (busy || remote || googleClientId) break;
        clientId = '';
        try { localStorage.removeItem(configKey); } catch { /* The setting is reset in this tab. */ }
        setStatus('Enter the client ID for your Study Desk project.');
        break;
      case 'cloud-connect': connect(); break;
      case 'cloud-sign-out': if (!busy) { disconnect('Signed out. Your progress is saved on this device.'); notify('Signed out of Google Drive sync.'); } break;
      case 'cloud-sync-now': void synchronize(); break;
      case 'cloud-use-local': void synchronize('local'); break;
      case 'cloud-use-remote': if (conflict?.heads.some(file => file.id === button.dataset.id)) void synchronize(button.dataset.id); break;
      case 'cloud-export': exportBackup(); break;
    }
  });
  document.addEventListener('submit', event => {
    if (event.target.id !== 'cloud-setup') return;
    event.preventDefault();
    const value = new FormData(event.target).get('google-client');
    if (typeof value !== 'string' || !validClientId(value.trim())) { setStatus('Enter the web client ID ending in .apps.googleusercontent.com.'); return; }
    clientId = value.trim();
    try { localStorage.setItem(configKey, clientId); } catch { notify('Browser storage is unavailable. The client ID is set for this tab.'); }
    warmGoogle();
    refresh();
  });
  window.addEventListener('online', () => { refresh(); void synchronize(); });
  window.addEventListener('offline', refresh);

  async function readLocalStatus() {
    try {
      const local = getLocal();
      localUnavailable = !local;
      if (!local) { refresh(); return; }
      const previousEdit = editVersion;
      const previousCheckpoint = checkpoint;
      const dirty = previousCheckpoint ? await fingerprint(local.snapshot) !== previousCheckpoint.digest : local.snapshot !== defaultSnapshot;
      if (previousEdit === editVersion && previousCheckpoint === checkpoint && !busy) localChanged = dirty;
    } catch { localUnavailable = true; }
    refresh();
  }

  return {
    render,
    initialize: readLocalStatus,
    localSaved() {
      editVersion++;
      const needsRefresh = !localChanged || localUnavailable;
      localUnavailable = false;
      localChanged = true;
      if (remote) queue(15000);
      if (needsRefresh) refresh();
    },
    localSaveFailed() { editVersion++; localUnavailable = true; refresh(); },
    status() { return message; }
  };
}
