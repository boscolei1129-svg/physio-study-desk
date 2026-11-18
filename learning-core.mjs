const grades=['again','hard','good','easy'];
const phases=['learn','recall','quiz','review','done'];
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const text=x=>typeof x==='string'&&x.length<=20000;
const id=x=>typeof x==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(x);
const number=x=>Number.isFinite(x)&&x>=0;
const index=x=>Number.isInteger(x)&&x>=0&&x<=60000;
function check(ok){if(!ok)throw new Error('Invalid saved study session.');}
function ids(list,limit=100){check(Array.isArray(list)&&list.length<=limit&&list.every(id)&&new Set(list).size===list.length);return [...list];}
function items(list){check(Array.isArray(list)&&list.length<=50);return list.map(x=>{check(object(x)&&id(x.id)&&Array.isArray(x.order)&&x.order.length===4&&[...x.order].sort().join(',')==='0,1,2,3');return {id:x.id,order:[...x.order]};});}
function shuffled(list,random){const out=[...list];for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
export function relatedLessons(card,lessons){
  const words=new Set((card.topic+' '+card.question).toLowerCase().match(/[a-z]{4,}/g)||[]);
  return lessons.filter(l=>l.course===card.course).map(l=>({lesson:l,score:(l.source===card.source?100:0)+(card.outcome&&l.outcome===card.outcome?40:0)+[...words].filter(w=>(l.title+' '+l.body).toLowerCase().includes(w)).length})).sort((a,b)=>b.score-a.score).map(x=>x.lesson);
}
export function buildGuidedPlan({minutes=10,cards,lessons,queue,mistakes={},course='',outcome='',now=Date.now(),random=Math.random}){
  if(![10,20,30].includes(minutes))throw new Error('Choose 10, 20 or 30 minutes.');
  const filtered=cards.filter(c=>(!course||c.course===course)&&(!outcome||String(c.outcome)===String(outcome)));
  const allowed=new Set(filtered.map(c=>c.id));
  const budget={10:[6,3,1],20:[12,5,2],30:[18,7,3]}[minutes];
  // The supplied queue already enforces due dates and the global daily new-card limit.
  const eligible=queue.filter(c=>allowed.has(c.id));
  const chosen=eligible.slice(0,budget[0]);
  const weak=filtered.filter(c=>mistakes[c.id]&&!mistakes[c.id].resolved);
  const quizPool=[...new Map([...weak,...chosen,...filtered].filter(c=>c.wrong.length===3).map(c=>[c.id,c])).values()];
  const lessonIds=[...new Set((chosen.length?chosen:filtered.slice(0,3)).flatMap(c=>relatedLessons(c,lessons).slice(0,1).map(l=>l.id)))].slice(0,budget[2]);
  const quizItems=quizPool.slice(0,budget[1]).map(c=>({id:c.id,order:shuffled([0,1,2,3],random)}));
  const phase=lessonIds.length?'learn':chosen.length?'recall':quizItems.length?'quiz':'review';
  return {minutes,course,outcome,phase,index:0,lessonIds,cardIds:chosen.map(c=>c.id),quizItems,ratings:[],answers:[],revealed:false,selected:null,draft:'',started:now,updated:now};
}
export function validateLearning(input){
  if(input===undefined)return {guide:null,resume:null,recall:null,quiz:null};
  check(object(input));const out={guide:null,resume:null,recall:null,quiz:null};
  if(input.guide!=null){const g=input.guide;check(object(g)&&[10,20,30].includes(g.minutes)&&phases.includes(g.phase)&&index(g.index)&&text(g.course)&&g.course.length<=20&&text(g.outcome)&&g.outcome.length<=20&&typeof g.revealed==='boolean'&&(g.selected===null||[0,1,2,3].includes(g.selected))&&text(g.draft)&&number(g.started)&&number(g.updated));
    const lessonIds=ids(g.lessonIds),cardIds=ids(g.cardIds),quizItems=items(g.quizItems);
    check(Array.isArray(g.ratings)&&g.ratings.length<=cardIds.length&&g.ratings.every(x=>object(x)&&cardIds.includes(x.id)&&grades.includes(x.grade)));
    check(Array.isArray(g.answers)&&g.answers.length<=quizItems.length&&g.answers.every(x=>object(x)&&quizItems.some(q=>q.id===x.id)&&typeof x.correct==='boolean'));
    const length={learn:lessonIds.length,recall:cardIds.length,quiz:quizItems.length,review:0,done:0}[g.phase];check(g.phase==='review'||g.phase==='done'?g.index===0:g.index<length);
    check(g.ratings.every((r,i)=>r.id===cardIds[i])&&g.answers.every((a,i)=>a.id===quizItems[i].id));
    if(g.phase==='learn')check(g.ratings.length===0&&g.answers.length===0&&g.selected===null);
    if(g.phase==='recall')check(g.ratings.length===g.index&&g.answers.length===0&&g.selected===null);
    if(g.phase==='quiz')check(g.ratings.length===cardIds.length&&g.answers.length===g.index+(g.selected===null?0:1));
    if(g.phase==='review'||g.phase==='done')check(g.ratings.length===cardIds.length&&g.answers.length===quizItems.length);
    out.guide={minutes:g.minutes,course:g.course,outcome:g.outcome,phase:g.phase,index:g.index,lessonIds,cardIds,quizItems,ratings:g.ratings.map(x=>({id:x.id,grade:x.grade})),answers:g.answers.map(x=>({id:x.id,correct:x.correct})),revealed:g.revealed,selected:g.selected,draft:g.draft,started:g.started,updated:g.updated};
  }
  if(input.resume!=null){const r=input.resume;check(object(r)&&['recall','quiz'].includes(r.kind)&&index(r.index)&&number(r.updated));
    if(r.kind==='recall'){const cardIds=ids(r.cardIds,60000);check(r.index<=cardIds.length&&typeof r.revealed==='boolean'&&typeof r.practice==='boolean'&&text(r.course)&&r.course.length<=20&&text(r.draft)&&Array.isArray(r.ratings)&&r.ratings.length<=cardIds.length&&r.ratings.every(x=>grades.includes(x)));out.resume={kind:r.kind,cardIds,index:r.index,revealed:r.revealed,practice:r.practice,ratings:[...r.ratings],course:r.course,draft:r.draft,updated:r.updated};}
    else{const quizItems=items(r.items);check(r.index<=quizItems.length&&(r.selected===null||[0,1,2,3].includes(r.selected))&&Array.isArray(r.answers)&&r.answers.length<=quizItems.length&&r.answers.every(x=>object(x)&&typeof x.correct==='boolean'&&[0,1,2,3].includes(x.selected)));out.resume={kind:r.kind,items:quizItems,index:r.index,selected:r.selected,answers:r.answers.map(x=>({correct:x.correct,selected:x.selected})),updated:r.updated};}
  }
  for(const kind of ['recall','quiz'])if(input[kind]!=null){out[kind]=validateLearning({resume:input[kind]}).resume;check(out[kind].kind===kind);}
  if(out.resume&&!out[out.resume.kind])out[out.resume.kind]=out.resume;
  return out;
}
export function muscleNote(fields){
  const labels=[['region','Location / region'],['proximal','Proximal attachments'],['distal','Distal attachments'],['action','Action'],['nerve','Innervation'],['application','Application question'],['source','Source / page']];
  return {title:fields.name,body:labels.map(([key,label])=>label+'\n'+(fields[key]||'To check in my taught resource.')).join('\n\n'),cue:'Explain '+fields.name+': location, attachments, action and innervation.',summary:fields.action||''};
}
