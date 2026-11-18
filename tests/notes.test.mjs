import test from 'node:test';
import assert from 'node:assert/strict';
import {lessons,sources,cards} from '../content.mjs';
import {renderTeachingFigure} from '../note-visuals.mjs';
import {studyNotes} from '../notes-content.mjs';
import {renderChapter,chapterSections,noteStats,noteAttribution,lessonPlainText} from '../note-reader.mjs';

test('every existing lesson has a complete, locally authored chapter and three answerable checks',()=>{
  assert.equal(lessons.length,50);assert.deepEqual(Object.keys(studyNotes).sort(),lessons.map(l=>l.id).sort());
  for(const l of lessons){
    const stats=noteStats(l.chapter);assert.ok(stats.words>=400,l.id);assert.equal(stats.checks,3,l.id);
    assert.equal((l.chapter.match(/^! /gm)||[]).length,3,l.id);
    for(const heading of ['What you will learn','Worked example','Common mistakes','Check your understanding','Remember'])assert.ok(l.chapter.includes('## '+heading),l.id+' '+heading);
    assert.ok(l.chapter.includes('\n|'),l.id+' comparison table');
    assert.doesNotMatch(l.chapter,/https?:\/\/|\]\(|refer to (the original|your original)|read the linked/i,l.id);
    assert.ok(l.references.every(id=>sources.some(s=>s.id===id)),l.id);
    const html=renderChapter(l.chapter,{prefix:l.id,contents:true});assert.equal((html.match(/class="note-check"/g)||[]).length,3);assert.doesNotMatch(html,/target=|href="https?:/);
    const sections=chapterSections(l.chapter,l.id);assert.equal(new Set(sections.map(s=>s.id)).size,sections.length);
    const rows=[...l.chapter.matchAll(/(?:^\|[^\n]+\n)+/gm)].map(m=>m[0].trim().split('\n').map(r=>r.split('|').length));
    for(const counts of rows)assert.ok(counts.every(c=>c===counts[0]),l.id+' inconsistent table columns');
  }
});
test('chapter rendering escapes executable markup in headings, paragraphs, tables, answers and IDs',()=>{
  const html=renderChapter('## <img src=x onerror=alert(1)>\n<script>alert(1)</script>\n| A | B |\n| <svg onload=x> | text |\n? <button onclick=x>\n! <iframe src=x>',{prefix:'" onclick="bad',contents:true});
  assert.doesNotMatch(html,/<script|<img|<svg|<iframe| onclick="bad/);assert.match(html,/&lt;script&gt;/);assert.match(html,/&quot;/);
  assert.throws(()=>renderChapter('? Missing answer'),'Incomplete questions must not silently render');
});
test('attribution stays inside the lesson and personal-note copies contain the whole teaching text',()=>{
  for(const l of lessons){const html=noteAttribution(l,sources);assert.doesNotMatch(html,/<a\b|https?:\/\//);const copy=lessonPlainText(l,sources);assert.ok(copy.includes('Worked example'));assert.ok(copy.includes('Model answer:'));assert.ok(copy.includes('References:'));assert.doesNotMatch(copy,/https?:\/\//);}
});
test('expanded lessons preserve recall identity and the original short summary used for recommendations',()=>{
  assert.equal(cards.length,251);assert.equal(cards[0].id,'seed-001');assert.equal(lessons[0].id,'lesson-1');assert.match(lessons[0].body,/consistent reference position/);
  assert.ok(lessons.every(l=>l.practice===l.chapter.match(/^\? (.+)$/m)[1]));
});
test('diagnostic and biomechanics examples retain their explicit units, denominators and time context',()=>{
  const statistics=lessons.find(l=>l.id==='lesson-21').chapter;assert.match(statistics,/TP \/ \(TP \+ FN\)/);assert.match(statistics,/TN \/ \(TN \+ FP\)/);assert.match(statistics,/NNT = 1\/ARR/);assert.match(statistics,/one year/);
  const torque=lessons.find(l=>l.id==='lesson-22').chapter;assert.match(torque,/150 N/);assert.match(torque,/6 N·m/);assert.match(torque,/ignores the forearm/);
});

test('teaching visuals use local assets, accessible alternatives and explicit process labels',()=>{const planes=renderTeachingFigure('anatomy100-note-02');assert.match(planes,/alt=/);assert.match(planes,/CC BY 4.0/);assert.match(planes,/src=".\/assets\/diagrams\/body-planes.webp"/);const renal=renderTeachingFigure('lesson-15');assert.match(renal,/reabsorbed/);assert.match(renal,/not successive chambers/);for(const lesson of lessons)assert.doesNotMatch(renderTeachingFigure(lesson.id),/href="https?:|src="https?:/);});
