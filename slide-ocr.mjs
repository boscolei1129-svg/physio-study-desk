const vendor = new URL('./vendor/ocr/', import.meta.url);
let enginePromise;

function loadEngine() {
  if (!enginePromise) enginePromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL('tesseract.min.js', vendor);
    script.onload = () => window.Tesseract?.createWorker ? resolve(window.Tesseract) : reject(new Error('Scanner could not load.'));
    script.onerror = () => reject(new Error('Scanner files are unavailable. Connect to the internet and try again.'));
    document.head.append(script);
  }).catch(error => { enginePromise = null; throw error; });
  return enginePromise;
}

export async function scanImage(src, onProgress) {
  const image = new Image();
  image.src = src;
  await image.decode();
  const engine = await loadEngine();
  let rejectWorker;
  const failed = new Promise((_, reject) => { rejectWorker = reject; });
  const creation = engine.createWorker('eng', 1, {
    workerPath: new URL('worker.min.js', vendor).href,
    corePath: new URL('tesseract-core-lstm.wasm.js', vendor).href,
    langPath: vendor.href,
    workerBlobURL: false,
    errorHandler: () => rejectWorker(new Error('The text scanner stopped. Try a smaller or sharper image.')),
    logger(event) {
      const percentage = Math.round((event.progress || 0) * 100);
      onProgress(event.status === 'recognizing text' ? `Reading text · ${percentage}%` : 'Preparing the text scanner…');
    }
  });
  let worker;
  try {
    worker = await Promise.race([creation, failed]);
    // Sparse-text mode captures disconnected labels as well as slide text.
    await Promise.race([worker.setParameters({tessedit_pageseg_mode: '11'}), failed]);
    const {data} = await Promise.race([worker.recognize(image, {}, {blocks: true}), failed]);
    return readScan(data, image.naturalWidth, image.naturalHeight);
  } finally {
    if (worker) await worker.terminate();
    else void creation.then(w => w.terminate()).catch(() => {});
  }
}

function readScan(data, width, height) {
  const lines = (data.blocks || []).flatMap(block => (block.paragraphs || []).flatMap(paragraph => paragraph.lines || []))
    .map(line => ({text: line.text.trim(), box: line.bbox, confidence: line.confidence}))
    .filter(line => line.text && line.box && line.box.y1 > line.box.y0 && line.box.x1 > line.box.x0);
  return formatScan({text: data.text, lines, width, height});
}

const bullet = /^(?:[•●◦▪‣∙*+«»–—-]|\d{1,2}[.)])\s+/u;
const sizeOf = line => line.box.y1 - line.box.y0;
const clamp = (value, max) => Math.max(0, Math.min(max, value));

export function formatScan({text = '', lines = [], width, height}) {
  const reliable = lines.filter(line => line.confidence >= 40 || /[A-Za-z]{3,}/.test(line.text));
  if (reliable.length) lines = reliable;
  const sized = lines.map(sizeOf).sort((a, b) => a - b);
  const normalSize = sized[Math.floor(sized.length / 2)] || 0;
  const top = lines.filter(line => line.box.y0 < height * .28 && line.text.length <= 120 &&
    line.confidence >= 55 && /[a-z]{3}/i.test(line.text) && !bullet.test(line.text) && !/[.!?:]$/.test(line.text));
  const titleLine = [...top].sort((a, b) => sizeOf(b) - sizeOf(a))[0];
  const foundTitle = titleLine && (sizeOf(titleLine) >= normalSize * 1.25 || titleLine === lines[0] && top.length === 1 && !/[.!?]$/.test(titleLine.text));
  const title = foundTitle ? titleLine.text : '';
  const source = lines.length ? lines : text.trim().split(/\r?\n/).filter(line => line.trim()).map(line => ({text: line.trim()}));
  const blocks = [];
  const bulletContinuation = new Set();
  const detached = [];
  const bodyStart = foundTitle ? titleLine.box.x0 : null;
  const briefLabel = line => line.confidence >= 55 && line.text.length <= 62 && line.text.split(/\s+/).length <= 7 &&
    /[a-z]{3}/i.test(line.text) && !bullet.test(line.text) && !/[.!?:]$/.test(line.text);
  const leftColumn = bodyStart !== null && lines.filter(line => Math.abs(line.box.x0 - bodyStart) < width * .13 && line !== titleLine).length >= 2;
  let previous;

  for (const line of source) {
    if (foundTitle && line === titleLine) continue;
    if (leftColumn && line.box.x0 - bodyStart > width * .27 && briefLabel(line)) {
      detached.push(line.text);
      continue;
    }
    const value = line.text.replace(/\s+/g, ' ');
    const short = value.length <= 75 && value.split(' ').length <= 9;
    if (bullet.test(value)) {
      blocks.push({kind: 'bullet', text: value.replace(bullet, '')});
    } else if (short && (value.endsWith(':') || line.box && sizeOf(line) >= normalSize * 1.25 && !/[.!?]$/.test(value))) {
      blocks.push({kind: 'heading', text: value.replace(/:$/, '')});
    } else {
      const priorBlock = blocks.at(-1);
      const close = previous?.box && line.box && line.box.y0 >= previous.box.y0 && line.box.y0 - previous.box.y1 <= normalSize * .85;
      const aligned = close && Math.abs(line.box.x0 - previous.box.x0) <= normalSize * 2;
      if (aligned && priorBlock && priorBlock.kind !== 'heading' && !/[.!?:]$/.test(priorBlock.text)) {
        priorBlock.text += ' ' + value;
        if (priorBlock.kind === 'bullet') bulletContinuation.add(line);
      }
      else blocks.push({kind: 'paragraph', text: value});
    }
    previous = line;
  }

  if (detached.length) blocks.push({kind: 'heading', text: 'Diagram labels'}, ...detached.map(value => ({kind: 'bullet', text: value})));
  const body = blocks.map((block, i) => {
    const prefix = block.kind === 'heading' ? '## ' : block.kind === 'bullet' ? '- ' : '';
    const separator = i === 0 ? '' : block.kind === 'bullet' && blocks[i-1].kind === 'bullet' ? '\n' : '\n\n';
    return separator + prefix + block.text;
  }).join('');

  const labels = lines.filter(line => (line !== titleLine || !foundTitle) && !bulletContinuation.has(line) && briefLabel(line))
    .slice(0, 60).map(({box, text: answer}) => {
    const pad = Math.max(3, (box.y1 - box.y0) * .15);
    const left = clamp(box.x0 - pad, width), top = clamp(box.y0 - pad, height);
    return {x: left / width * 100, y: top / height * 100,
      w: (clamp(box.x1 + pad, width) - left) / width * 100,
      h: (clamp(box.y1 + pad, height) - top) / height * 100, answer};
  }).filter(label => label.w >= .3 && label.h >= .3);

  return {title, body: body || (!title ? text.trim() : ''), labels};
}

// Format a small plain-text notation. All content remains editable and is always escaped.
export function renderPersonalNote(body, escape) {
  const lines = body.split(/\r?\n/);
  let markup = '';
  let list = [];
  const flush = () => {
    if (list.length) markup += `<ul>${list.map(item => `<li>${escape(item)}</li>`).join('')}</ul>`;
    list = [];
  };
  for (const line of lines) {
    if (line.startsWith('- ')) { list.push(line.slice(2)); continue; }
    flush();
    if (line.startsWith('## ')) markup += `<h3>${escape(line.slice(3))}</h3>`;
    else if (line.trim()) markup += `<p>${escape(line)}</p>`;
  }
  flush();
  return markup;
}
