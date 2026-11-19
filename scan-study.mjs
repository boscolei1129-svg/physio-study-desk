import {renderPersonalNote, scanImage} from './slide-ocr.mjs';

export function createScanStudy({$, esc, notify, scanCourseOptions, saveScannedNote, rerender, getDiagram, editLabels}) {
  let draft = null;
  let scanning = null;
  let notePane = false;
  const currentDraft = () => draft?.diagram === getDiagram() ? draft : null;

  function toolbar() {
    const saved = currentDraft();
    return `<div class="button-row scan-actions">
      ${saved ? '' : `<button data-action="scan-image" ${scanning ? 'disabled' : ''}>${scanning ? 'Scanning…' : 'Scan to Study'}</button>`}
      ${saved ? '<button data-action="scan-show-note">Open notes draft</button><button data-action="scan-use-labels">Review suggested covers</button>' : ''}
    </div><p id="scan-progress" class="small muted" role="status">${scanning === getDiagram() ? 'Preparing the text scanner…' : ''}</p>`;
  }

  function notes() {
    const saved = currentDraft();
    if (!notePane || !saved) return '';
    return `<aside class="diagram-controls scan-notes">
      <h3>Review your scanned notes</h3>
      <p class="small muted">Compare with the image and correct any misread text. Use ## for a heading and - for a bullet.</p>
      <form id="scan-note-form">
        <label for="scan-note-title">Note title</label><input id="scan-note-title" maxlength="200" value="${esc(saved.title)}" required>
        <label for="scan-note-course">Course</label>${scanCourseOptions(saved.course)}
        <label for="scan-note-body">Editable notes</label><textarea id="scan-note-body" maxlength="20000" rows="8" required>${esc(saved.body)}</textarea>
        <details open><summary>Reading preview</summary><div class="scan-preview formatted-note" id="scan-note-preview">${renderPersonalNote(saved.body, esc)}</div></details>
        <div class="button-row"><button class="primary" type="submit">Save to My notes</button><button type="button" data-action="scan-use-labels">Review suggested covers</button>${saved.savedCopy ? '<a href="#notes">Open My notes</a>' : ''}</div>
      </form></aside>`;
  }

  async function start() {
    const diagram = getDiagram();
    if (!diagram || scanning) return;
    scanning = diagram;
    rerender();
    let completed = false;
    try {
      const result = await scanImage(diagram.src, status => {
        const progress = $('#scan-progress');
        if (getDiagram() === diagram && progress) progress.textContent = status;
      });
      if (getDiagram() !== diagram) return;
      if (!result.title && !result.body) throw new Error('No text found. Try a sharper screenshot with larger labels.');
      draft = {
        diagram,
        title: (result.title || diagram.title.replace(/\.(png|jpe?g|webp)$/i, '')).slice(0, 200),
        body: result.body.slice(0, 20000), labels: result.labels, reviewedLabels: false, course: ''
      };
      notePane = true;
      completed = true;
    } catch (error) {
      if (getDiagram() === diagram) notify(error.message);
    } finally {
      scanning = null;
      rerender();
      const title = $('#scan-note-title');
      if (completed && title) {
        $('#diagram-content')?.scrollIntoView({block: 'start', behavior: 'instant'});
        title.focus({preventScroll: true});
      }
    }
  }

  function covers() {
    const saved = currentDraft();
    if (!saved) return;
    if (!saved.reviewedLabels) {
      const added = editLabels(saved.labels);
      if (!added) notify('No new covers suggested. You can add or adjust covers manually.');
      saved.reviewedLabels = true;
    } else editLabels([]);
    notePane = false;
    rerender();
  }

  document.addEventListener('click', event => {
    switch (event.target.closest('[data-action]')?.dataset.action) {
      case 'scan-image': void start(); break;
      case 'scan-show-note': notePane = true; rerender(); break;
      case 'scan-use-labels': covers(); break;
    }
  });
  document.addEventListener('input', event => {
    const saved = currentDraft();
    if (!saved) return;
    if (event.target.id === 'scan-note-title') saved.title = event.target.value;
    if (event.target.id === 'scan-note-course') saved.course = event.target.value;
    if (event.target.id === 'scan-note-body') {
      saved.body = event.target.value;
      $('#scan-note-preview').innerHTML = renderPersonalNote(saved.body, esc);
    }
  });
  document.addEventListener('submit', event => {
    if (event.target.id !== 'scan-note-form') return;
    event.preventDefault();
    const saved = currentDraft();
    if (!saved || !saved.title.trim() || !saved.body.trim()) { notify('Add a title and some notes before saving.'); return; }
    const course = $('#scan-note-course').value;
    const signature = JSON.stringify([saved.title.trim(), saved.body.trim(), course]);
    if (saved.savedCopy === signature) { notify('This version is already in My notes.'); return; }
    if (saveScannedNote(saved.title.trim(), saved.body.trim(), course)) {
      saved.savedCopy = signature;
      notify('Scanned note saved. Find it under Notes → My notes.');
      rerender();
    }
  });

  return {start, toolbar, notes, busy: () => Boolean(scanning), showingNotes: () => notePane && Boolean(currentDraft())};
}
