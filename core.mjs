export const DAY = 86400000;
export const defaults = () => ({version:1,settings:{year:1,semester:1,stream:'professional',newLimit:12,timezone:'Australia/Adelaide'},schedule:{},mistakes:{},notes:[],customCards:[],tasks:[],history:[],stationLogs:[]});
export function dayKey(time=Date.now(),timezone='Australia/Adelaide') {
  return new Intl.DateTimeFormat('en-CA',{timeZone:timezone==='local'?Intl.DateTimeFormat().resolvedOptions().timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(time));
}
export function scheduleCard(previous,grade,now=Date.now()) {
  if (!['again','hard','good','easy'].includes(grade)) throw new Error('Unknown recall rating');
  const p=previous||{interval:0,reviews:0,lapses:0,successes:0};
  const interval=grade==='again'?0:grade==='hard'?Math.max(1,Math.round(p.interval*1.2)):grade==='good'?Math.max(1,p.interval+1,Math.round(p.interval*2.5)):Math.max(4,p.interval+2,Math.round(p.interval*3.3));
  const days=Math.min(365,interval);
  return {interval:days,due:now+(grade==='again'?600000:days*DAY),last:now,reviews:p.reviews+1,lapses:p.lapses+(grade==='again'?1:0),successes:grade==='again'?0:p.successes+1};
}
export function shuffle(items,random=Math.random) {
  const out=[...items]; for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];} return out;
}
export function interleave(items) {
  const groups=new Map();for(const item of items){if(!groups.has(item.course))groups.set(item.course,[]);groups.get(item.course).push(item);}
  const result=[];while(result.length<items.length){for(const group of groups.values())if(group.length)result.push(group.shift());}return result;
}
export function selectStudyCards(cards,courses,settings,{course='',outcome=''}={}) {
  const activeIds=new Set(courses.filter(c=>c.year===settings.year&&c.semester===settings.semester&&(c.stream==='both'||c.stream===settings.stream)).map(c=>c.id));
  return cards.filter(c=>(course?c.course===course:activeIds.has(c.course))&&(!outcome||(c.course==='BIOL1006'&&String(c.outcome)===String(outcome))));
}
export function reviewQueue(cards,state,now=Date.now()) {
  const today=dayKey(now,state.settings.timezone);
  const introduced=new Set(state.history.filter(h=>h.type==='recall'&&h.new&&dayKey(h.at,state.settings.timezone)===today).map(h=>h.card)).size;
  const due=cards.filter(c=>state.schedule[c.id]&&state.schedule[c.id].due<=now).sort((a,b)=>state.schedule[a.id].due-state.schedule[b.id].due);
  const fresh=interleave(cards.filter(c=>!state.schedule[c.id])).slice(0,Math.max(0,state.settings.newLimit-introduced));
  return [...due,...fresh];
}
export function recordMistake(state,card,reason,now=Date.now()) {
  const old=state.mistakes[card.id];
  state.mistakes[card.id]={card:card.id,course:card.course,count:(old?.count||0)+1,last:now,reason,reflection:old?.reflection||'',resolved:false};
}
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const safeId=x=>typeof x==='string'&&/^(seed-\d{3}|custom-[a-zA-Z0-9-]{1,80})$/.test(x);
const str=(x,max=20000)=>typeof x==='string'&&x.length<=max;
const num=(x,max=Number.MAX_SAFE_INTEGER)=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=max;
function assert(ok,message){if(!ok)throw new Error(message);}
// Rebuild an allow-listed structure so backup files cannot inject object properties or executable markup.
export function validateBackup(input) {
  assert(object(input)&&input.version===1,'This is not a supported Study Desk backup (version 1).');
  const out=defaults(),s=input.settings;
  assert(object(s)&&[1,2,3,4].includes(s.year)&&[1,2].includes(s.semester)&&['research','professional'].includes(s.stream),'Invalid study settings.');
  assert(Number.isInteger(s.newLimit)&&s.newLimit>=1&&s.newLimit<=50,'New cards per day must be 1–50.');
  assert(['Australia/Adelaide','local'].includes(s.timezone),'Invalid study timezone.');
  out.settings={year:s.year,semester:s.semester,stream:s.stream,newLimit:s.newLimit,timezone:s.timezone};
  for(const name of ['schedule','mistakes'])assert(object(input[name])&&Object.keys(input[name]).length<=20000,`Invalid ${name} data.`);
  for(const [id,p] of Object.entries(input.schedule)){
    assert(safeId(id)&&object(p)&&['interval','due','last','reviews','lapses','successes'].every(k=>num(p[k])),'Invalid review schedule.');
    assert(p.interval<=365&&Number.isInteger(p.reviews)&&Number.isInteger(p.lapses)&&Number.isInteger(p.successes),'Invalid review counts.');
    out.schedule[id]={interval:p.interval,due:p.due,last:p.last,reviews:p.reviews,lapses:p.lapses,successes:p.successes};
  }
  for(const [id,m] of Object.entries(input.mistakes)){
    assert(safeId(id)&&object(m)&&m.card===id&&str(m.course,20)&&num(m.count)&&num(m.last)&&str(m.reason,2000)&&str(m.reflection)&&typeof m.resolved==='boolean','Invalid mistake record.');
    out.mistakes[id]={card:id,course:m.course,count:m.count,last:m.last,reason:m.reason,reflection:m.reflection,resolved:m.resolved};
  }
  for(const key of ['notes','customCards','tasks','history','stationLogs'])assert(Array.isArray(input[key])&&input[key].length<=50000,`Invalid ${key} list.`);
  const unique=new Set();
  for(const n of input.notes){
    assert(object(n)&&str(n.id,100)&&!unique.has(n.id)&&str(n.course,20)&&str(n.title,200)&&str(n.cue)&&str(n.body)&&str(n.summary)&&num(n.updated),'Invalid note.');unique.add(n.id);
    out.notes.push({id:n.id,course:n.course,title:n.title,cue:n.cue,body:n.body,summary:n.summary,updated:n.updated});
  }
  unique.clear();
  for(const c of input.customCards){
    assert(object(c)&&safeId(c.id)&&c.id.startsWith('custom-')&&!unique.has(c.id)&&str(c.course,20)&&str(c.topic,200)&&str(c.question,4000)&&str(c.answer,10000),'Invalid custom card.');unique.add(c.id);
    out.customCards.push({id:c.id,course:c.course,topic:c.topic,question:c.question,answer:c.answer,source:'user',wrong:[]});
  }
  unique.clear();
  for(const t of input.tasks){
    assert(object(t)&&str(t.id,100)&&!unique.has(t.id)&&str(t.title,200)&&str(t.course,20)&&typeof t.done==='boolean'&&/^\d{4}-\d{2}-\d{2}$/.test(t.date)&&Number.isFinite(Date.parse(t.date)),'Invalid study task.');unique.add(t.id);
    out.tasks.push({id:t.id,title:t.title,course:t.course,date:t.date,done:t.done});
  }
  for(const h of input.history){
    assert(object(h)&&['recall','quiz','focus'].includes(h.type)&&num(h.at)&&(!h.card||safeId(h.card)),'Invalid study history.');
    if(h.type==='recall')assert(['again','hard','good','easy'].includes(h.grade)&&typeof h.new==='boolean','Invalid recall event.');
    if(h.type==='quiz')assert(typeof h.correct==='boolean','Invalid quiz event.');
    if(h.type==='focus')assert(num(h.minutes,180),'Invalid focus event.');
    out.history.push({type:h.type,at:h.at,...(h.card?{card:h.card}:{}),...(h.type==='recall'?{grade:h.grade,new:h.new}:{}),...(h.type==='quiz'?{correct:h.correct}:{}),...(h.type==='focus'?{minutes:h.minutes}:{})});
  }
  for(const l of input.stationLogs){assert(object(l)&&str(l.station,100)&&num(l.at)&&num(l.checked,20)&&num(l.total,20)&&l.checked<=l.total&&str(l.reflection),'Invalid practical reflection.');out.stationLogs.push({station:l.station,at:l.at,checked:l.checked,total:l.total,reflection:l.reflection});}
  return out;
}
export function studyDay(time=Date.now(),timezone='Australia/Adelaide') {
  return dayKey(time,timezone==='local'?Intl.DateTimeFormat().resolvedOptions().timeZone:timezone);
}
