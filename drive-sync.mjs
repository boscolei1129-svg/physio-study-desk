const drive = 'https://www.googleapis.com/drive/v3';
const upload = 'https://www.googleapis.com/upload/drive/v3';
export const scope = 'https://www.googleapis.com/auth/drive.appdata';
export const validClientId = id => /^\d+-[a-z\d_-]+\.apps\.googleusercontent\.com$/i.test(id);
const fileName = 'physio-study-snapshot-v1.json';
const validId = id => typeof id === 'string' && /^[\w-]{1,150}$/.test(id);

export async function fingerprint(snapshot) {
  const bytes = new TextEncoder().encode(snapshot);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, '0')).join('');
}

// Immutable versions preserve both edits when devices save at the same time.
export function latestVersions(files) {
  const replaced = new Set();
  for (const file of files) {
    if (!validId(file.id)) throw new Error('A cloud save has an invalid identifier.');
    const parents = JSON.parse(file.description || '[]');
    if (!Array.isArray(parents) || !parents.every(id => validId(id) && id !== file.id)) {
      throw new Error('A cloud save has invalid version information.');
    }
    for (const parent of parents) replaced.add(parent);
  }
  const heads = files.filter(file => !replaced.has(file.id));
  if (files.length && !heads.length) throw new Error('Cloud save history could not be read safely.');
  return heads.sort((a, b) => Date.parse(b.createdTime) - Date.parse(a.createdTime));
}

export function syncDecision({ heads, checkpoint, digest, blank, accountChanged }) {
  if (accountChanged || heads.length > 1) return 'choose';
  if (!heads.length) return checkpoint ? 'choose' : 'upload';
  if (!checkpoint) return blank ? 'download' : 'compare';
  if (heads[0].id === checkpoint.id) return digest === checkpoint.digest ? 'current' : 'upload';
  return digest === checkpoint.digest ? 'download' : 'compare';
}

export function createDrive(token, request = fetch) {
  async function get(url, options = {}) {
    const response = await request(url, {
      ...options,
      signal: AbortSignal.timeout(20000),
      headers: {...options.headers, Authorization: `Bearer ${token}`}
    });
    if (!response.ok) {
      if (response.status === 401) throw Object.assign(new Error('Google sign-in expired. Sign in again to resume syncing.'), {expired: true});
      if (response.status === 403) throw new Error('Drive access was denied. Check that Drive API is enabled and app storage access was granted.');
      throw new Error(`Google Drive could not sync (${response.status}). Try again.`);
    }
    return response;
  }

  async function list() {
    const query = new URLSearchParams({
      spaces: 'appDataFolder',
      q: `name = '${fileName}' and trashed = false`,
      fields: 'nextPageToken,incompleteSearch,files(id,description,createdTime)',
      pageSize: '1000'
    });
    const files = new Map();
    do {
      const result = await (await get(`${drive}/files?${query}`)).json();
      if (result.incompleteSearch || !Array.isArray(result.files)) throw new Error('Drive returned an incomplete list. Try syncing again.');
      for (const file of result.files) files.set(file.id, file);
      if (!result.nextPageToken) break;
      if (result.nextPageToken === query.get('pageToken')) throw new Error('Drive could not finish listing the saves.');
      query.set('pageToken', result.nextPageToken);
    } while (true);
    return latestVersions([...files.values()]);
  }

  async function write(snapshot, parents) {
    const boundary = 'study-' + crypto.randomUUID();
    const metadata = {name: fileName, mimeType: 'application/json', parents: ['appDataFolder'], description: JSON.stringify(parents)};
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${snapshot}\r\n--${boundary}--\r\n`;
    const response = await get(`${upload}/files?uploadType=multipart&fields=id%2CcreatedTime`, {
      method: 'POST', headers: {'Content-Type': `multipart/related; boundary=${boundary}`}, body
    });
    const file = await response.json();
    if (!validId(file.id)) throw new Error('Drive did not confirm the save. Check cloud versions before retrying.');
    return file;
  }

  return {
    list, write,
    async account() { return (await (await get(`${drive}/about?fields=user(permissionId,emailAddress,displayName)`)).json()).user; },
    async read(id) {
      if (!validId(id)) throw new Error('Invalid cloud save.');
      return (await get(`${drive}/files/${id}?alt=media`)).json();
    }
  };
}
