import test from 'node:test';
import assert from 'node:assert/strict';
import {formatScan, renderPersonalNote} from '../slide-ocr.mjs';
import {escapeNote} from '../note-reader.mjs';
import {validateDiagram} from '../diagram-practice.mjs';

const line = (text, x, y, w, h, confidence = 96) => ({text, confidence, box: {x0:x, y0:y, x1:x+w, y1:y+h}});

test('slide text keeps the wording, promotes headings and combines wrapped bullets', () => {
  const lines = [line('Rotator cuff',30,14,225,34), line('Main actions:',30,69,150,18),
    line('• Stabilises the',30,108,150,16), line('glenohumeral joint',42,126,160,16),
    line('• Assists rotation',30,160,160,16)];
  const result = formatScan({lines,width:640,height:420});
  assert.equal(result.title,'Rotator cuff');
  assert.equal(result.body,'## Main actions\n\n- Stabilises the glenohumeral joint\n- Assists rotation');
  assert.deepEqual(result.labels,[]);
});

test('suggested covers fit the original image and ignore low-confidence text', () => {
  const lines = [line('Supraspinatus',0,85,85,17),line('Infraspinatus',90,180,109,19),line('n0isefragment',9,140,45,14,20)];
  const {labels} = formatScan({lines,width:200,height:200});
  assert.equal(labels.length,2);
  const validated = validateDiagram({id:'scan-test', title:'Test scan', src:'data:image/jpeg;base64,AAAA', labels});
  assert.deepEqual(validated.labels.map(label=>label.answer),['Supraspinatus','Infraspinatus']);
  assert.equal(labels[0].x,0);
  assert.equal(labels[1].x+labels[1].w,100);
  assert.equal(labels[1].y+labels[1].h,100);
});

test('personal notes render their formatting and escape text from an image', () => {
  const note = renderPersonalNote('## Attachments\n\n- Scapula\n- <img src=x onerror=alert(1)>\n\nA plain sentence.',escapeNote);
  assert.match(note,/<h3>Attachments<\/h3>/);
  assert.match(note,/<ul><li>Scapula<\/li><li>&lt;img/);
  assert.doesNotMatch(note,/<img/);
  assert.match(note,/<p>A plain sentence.<\/p>/);
});
