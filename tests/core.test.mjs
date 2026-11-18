import test from 'node:test';
import assert from 'node:assert/strict';
import {DAY,defaults,dayKey,scheduleCard,reviewQueue,validateBackup,recordMistake,interleave,selectStudyCards} from '../core.mjs';
import {cards,courses,sources,lessons} from '../content.mjs';
import {anatomyCards,anatomyLessons,anatomyOutcomes} from '../anatomy100.mjs';
test('Again creates a short relearning interval and resets consecutive successes',()=>{
  const first=scheduleCard(null,'easy',1000),again=scheduleCard(first,'again',2000);
  assert.equal(first.due,1000+4*DAY);assert.equal(again.due,602000);assert.equal(again.successes,0);assert.equal(again.lapses,1);assert.equal(again.reviews,2);
});
test('Successful intervals increase, are ordered and have a cap',()=>{
  const old={interval:10,reviews:3,lapses:0,successes:3};
  const hard=scheduleCard(old,'hard',0),good=scheduleCard(old,'good',0),easy=scheduleCard(old,'easy',0);
  assert.ok(hard.interval<good.interval&&good.interval<easy.interval);
  assert.equal(scheduleCard({...old,interval:300},'easy').interval,365);
  assert.throws(()=>scheduleCard(null,'unknown'));
});
test('Queue keeps overdue reviews and limits new cards across courses',()=>{
  const s=defaults(),now=Date.UTC(2027,1,25,2);s.settings.newLimit=2;
  s.schedule[cards[0].id]=scheduleCard(null,'good',now-2*DAY);
  s.history.push({type:'recall',at:now,new:true,card:cards[1].id,grade:'good'});
  s.schedule[cards[1].id]=scheduleCard(null,'good',now);
  const q=reviewQueue(cards,s,now);assert.equal(q.filter(c=>!s.schedule[c.id]).length,1);assert.ok(q.some(c=>c.id===cards[0].id));
});
test('Adelaide day boundaries and local timezone work',()=>{
  assert.equal(dayKey(Date.UTC(2027,0,1,14),'Australia/Adelaide'),'2027-01-02');
  assert.match(dayKey(Date.now(),'local'),/^\d{4}-\d{2}-\d{2}$/);
});
test('New card interleaving alternates subjects without losing items',()=>{
  assert.deepEqual(interleave([{course:'A',id:1},{course:'A',id:2},{course:'B',id:3}]).map(c=>c.id),[1,3,2]);
});
test('A repeated mistake reopens the record and keeps its reflection',()=>{
  const s=defaults(),c=cards[0];recordMistake(s,c,'Recall',100);s.mistakes[c.id].reflection='My explanation';s.mistakes[c.id].resolved=true;recordMistake(s,c,'Quiz',200);
  assert.equal(s.mistakes[c.id].count,2);assert.equal(s.mistakes[c.id].resolved,false);assert.equal(s.mistakes[c.id].reflection,'My explanation');
});
test('Backup restores every learning record with no prototype injection',()=>{
  const s=defaults();s.schedule[cards[0].id]=scheduleCard(null,'good',100);recordMistake(s,cards[0],'Recall',100);
  s.notes.push({id:'note-1',course:'BIOL1006',title:'My note',cue:'Question?',body:'Body',summary:'Summary',updated:100});
  s.customCards.push({id:'custom-abc',course:'BIOL1006',topic:'Topic',question:'Question',answer:'Answer',source:'user',wrong:[]});
  s.tasks.push({id:'task-1',title:'Review',course:'BIOL1006',date:'2027-02-01',done:false});
  s.history.push({type:'quiz',at:100,card:cards[0].id,correct:false});
  s.stationLogs.push({station:'consent',at:100,checked:2,total:5,reflection:'Improve'});
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(s))),s);
  const injected=JSON.parse(JSON.stringify(s));injected.schedule=JSON.parse('{"__proto__":{"interval":1}}');assert.throws(()=>validateBackup(injected));
});
test('Backup validation rejects incompatible, oversized and malformed values',()=>{
  assert.throws(()=>validateBackup({version:5}));
  for(const mutate of [s=>s.settings.newLimit=99,s=>s.history.push({type:'quiz',at:0,correct:'yes'}),s=>s.notes.push({id:'bad'}),s=>s.schedule['seed-001']={interval:-2}]){const s=defaults();mutate(s);assert.throws(()=>validateBackup(s));}
});
test('Both honours streams total 192 units, 24 in every semester',()=>{
  for(const stream of ['professional','research']){const plan=courses.filter(c=>c.stream==='both'||c.stream===stream);assert.equal(plan.reduce((s,c)=>s+c.units,0),192);for(let y=1;y<=4;y++)for(let sem=1;sem<=2;sem++)assert.equal(plan.filter(c=>c.year===y&&c.semester===sem).reduce((s,c)=>s+c.units,0),24);}
});
test('Every question and note maps to a known course and source',()=>{
  const ids=new Set(),knownCourses=new Set(courses.map(c=>c.id)),knownSources=new Set(sources.map(s=>s.id));
  for(const c of cards){assert.ok(!ids.has(c.id));ids.add(c.id);assert.ok(knownCourses.has(c.course));assert.ok(knownSources.has(c.source));assert.ok(c.wrong.length===0||c.wrong.length===3);assert.ok(!c.wrong.includes(c.answer));}
  for(const l of lessons){assert.ok(knownCourses.has(l.course));assert.ok(knownSources.has(l.source));}
});
test('All six uploaded outcomes have recall, quiz and source-linked notes',()=>{
  for(const outcome of anatomyOutcomes){
    const pack=anatomyCards.filter(c=>c.outcome===outcome.id);
    assert.ok(pack.length>0);assert.ok(pack.some(c=>c.wrong.length===3));
    assert.ok(anatomyLessons.some(l=>l.outcome===outcome.id));
    for(const item of [...pack,...anatomyLessons.filter(l=>l.outcome===outcome.id)]){
      const source=sources.find(s=>s.id===item.source);assert.equal(source.type,'Uploaded PDF');
      assert.ok(source.page>=1&&source.page<=30);assert.ok(item.references.every(id=>sources.some(s=>s.id===id)));
    }
  }
});
test('Outcome selection works independently of the current semester and excludes unrelated cards',()=>{
  const settings={...defaults().settings,year:2,semester:2};
  for(let outcome=1;outcome<=6;outcome++){
    const pool=selectStudyCards(cards,courses,settings,{course:'BIOL1006',outcome:String(outcome)});
    assert.ok(pool.length>0);assert.ok(pool.every(c=>c.outcome===outcome&&c.course==='BIOL1006'));
    assert.equal(pool.length,anatomyCards.filter(c=>c.outcome===outcome).length);
  }
  const active=selectStudyCards(cards,courses,{...settings,year:1,semester:2});
  assert.ok(active.every(c=>c.course!=='BIOL1006'));assert.ok(active.length>0);
});
test('New anatomy schedules survive backup restoration without changing original seed IDs',()=>{
  assert.equal(cards.find(c=>c.id==='seed-001').question,'In anatomical position, where do the palms face?');
  assert.equal(cards.find(c=>c.id==='seed-086').question,'What covers bone surfaces where they articulate in a typical synovial joint?');
  const s=defaults();for(const c of anatomyCards){s.schedule[c.id]=scheduleCard(null,'good',1000);s.history.push({type:'recall',card:c.id,grade:'good',at:1000,new:true});}
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(s))),s);
});
