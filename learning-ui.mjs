import {renderChapter,noteAttribution} from './note-reader.mjs';
import {buildGuidedPlan,relatedLessons,muscleNote} from './learning-core.mjs';
import {createDiagramPractice} from './diagram-practice.mjs';

export function createLearningTools(ctx){
  const {$,esc,main,heading,courses,lessons,anatomyOutcomes,allCards,cardById,sourceLink,save,render,go,notify,openModal}=ctx;
  const state=()=>ctx.state();
  const diagrams=createDiagramPractice(ctx);
  let pendingGuide=null;
  const pool=()=>ctx.currentCards();
  const actions=(items)=>`<div class="button-row">${items}</div>`;
  const linkNote=l=>`<button data-action="linked-note" data-id="${esc(l.id)}">Read full lesson</button>`;
  function saveGuide(){state().learning.guide.updated=Date.now();save();}
  function drawStep(){render();window.scrollTo({top:0,behavior:'instant'});main.focus({preventScroll:true});}
  function helpForCard(card){
    const note=relatedLessons(card,lessons)[0];
    return `<details class="linked-help"><summary>Understand this idea</summary>${note?`<span class="eyebrow">RELATED LESSON</span><h3>${esc(note.title)}</h3><p>${esc(note.body)}</p><div class="practice-prompt"><strong>Try again from memory</strong><p>${esc(note.practice)}</p></div>${sourceLink(note.source,note.references)}${actions(linkNote(note))}`:'<p>Use the explanation above and return to the in-app study library before trying again.</p>'}${actions(`<button data-action="guide-card" data-id="${card.id}">Learn → Recall → Quiz</button>`)}</details>`;
  }
  function startGuide(minutes,selection={}){
    if(state().learning.guide&&state().learning.guide.phase!=='done'&&!selection.replace){pendingGuide={minutes,selection};openModal('Replace your unfinished session?',`<p>Your previous attempts remain in your study history. This replaces the unfinished plan and its draft explanation.</p><div class="button-row"><button class="primary" data-action="confirm-new-guide">Start the new session</button><button data-action="close-modal">Keep my session</button></div>`);return;}
    const s=state(),course=selection.course||'',outcome=selection.outcome||'';
    const selected=course?allCards().filter(c=>c.course===course):pool();
    let scoped=selected.filter(c=>!outcome||String(c.outcome)===String(outcome));
    const note=selection.lesson?lessons.find(l=>l.id===selection.lesson):null;
    if(note){const exact=scoped.filter(c=>c.source===note.source);if(exact.length)scoped=exact;}
    if(!scoped.length){notify('This selection has no cards yet. Choose another course or add your own recall cards.');go('guided',{setup:1});return;}
    const guide=buildGuidedPlan({minutes,cards:scoped,lessons,queue:ctx.reviewQueue(scoped,s),mistakes:s.mistakes,course,outcome});
    if(note){guide.lessonIds=[note.id];guide.phase='learn';}
    s.learning.guide=guide;save();go('guided');render();
  }
  function advance(g){
    const next={learn:'recall',recall:'quiz',quiz:'review'};
    g.phase=next[g.phase]||'review';g.index=0;g.revealed=false;g.selected=null;g.draft='';
    if(g.phase==='recall'&&!g.cardIds.length)g.phase='quiz';
    if(g.phase==='quiz'&&!g.quizItems.length)g.phase='review';
    saveGuide();drawStep();
  }
  function renderGuide(params){
    const g=state().learning.guide;
    if(!g||g.phase==='done'||params.get('setup')==='1'){
      const course=params.get('course')||'',outcome=params.get('outcome')||'';
      main.innerHTML=heading('A clear next step.','Choose your time and focus. The app plans a manageable Learn → Recall → Quiz → Review session.')+`
        ${g&&g.phase!=='done'?`<section class="resume-strip"><div><strong>You have an unfinished guided session.</strong><p>Continue from ${esc(g.phase)} or replace it with the session below.</p></div><a class="primary-link" href="#guided">Resume session</a></section>`:''}
        <section class="panel guide-setup"><form id="guide-form"><label for="guide-minutes">Time available</label><select id="guide-minutes"><option value="10">10 minutes</option><option value="20">20 minutes</option><option value="30">30 minutes</option></select>
        <label for="guide-course">Study focus</label><select id="guide-course"><option value="">My selected semester</option>${[...new Set(allCards().map(c=>c.course))].map(id=>`<option value="${esc(id)}" ${id===course?'selected':''}>${esc(id)} · ${esc(courses.find(c=>c.id===id)?.title||id)}</option>`).join('')}</select>
        <div id="guide-outcome-wrap" ${course==='BIOL1006'?'':'hidden'}><label for="guide-outcome">Anatomy learning outcome</label><select id="guide-outcome"><option value="">All outcomes</option>${anatomyOutcomes.map(o=>`<option value="${o.id}" ${String(o.id)===outcome?'selected':''}>${o.id} · ${esc(o.title)}</option>`).join('')}</select></div>
        <p class="small muted">Time is a guide, not a deadline. Due reviews come first, new cards respect your daily limit, and mistakes get another check. Everything saves as you go.</p><button class="primary" type="submit">Plan my session ${ctx.icon('arrow')}</button></form></section>
        <div class="learning-shortcuts"><a href="#outcomes">Browse learning outcomes</a><a href="#diagrams">Practise anatomy diagrams</a><button data-action="muscle-template">Use a muscle template</button></div>`;return;
    }
    const missing=[...g.cardIds,...g.quizItems.map(x=>x.id)].some(id=>!cardById(id))||g.lessonIds.some(id=>!lessons.some(l=>l.id===id));
    if(missing){main.innerHTML=heading('This saved session needs a fresh plan.','Some study items are no longer available.')+'<a class="primary-link" href="#guided?setup=1">Plan a new session</a>';return;}
    const steps=['learn','recall','quiz','review'];
    let body='';
    if(g.phase==='learn'){
      const l=lessons.find(l=>l.id===g.lessonIds[g.index]);
      body=l?`<article class="lesson-card guided-reading"><span class="pill">${l.course} · Note ${g.index+1} / ${g.lessonIds.length}</span><h2>${esc(l.title)}</h2>${g.revealed?'<button data-action="guide-show-note">Show the note again</button>':`<div class="guide-note-body"><p>${esc(l.body)}</p><details class="guide-full-note"><summary>Read the complete lesson here</summary>${renderChapter(l.chapter,{prefix:"guide-"+l.id,lessonId:l.id})}${noteAttribution(l,ctx.sources)}</details><div class="button-row"><button data-action="guide-hide-note">Hide note & recall</button></div></div>`}<div class="practice-prompt"><strong>Explain it from memory</strong><p>${esc(l.practice)}</p></div><label for="guide-draft">My explanation from memory (saved)</label><textarea id="guide-draft" maxlength="20000">${esc(g.draft)}</textarea>${actions('<button class="primary" data-action="guide-next-note">'+(g.index+1<g.lessonIds.length?'Next short note':'Continue to recall')+' →</button>')}</article>`:'';
    }else if(g.phase==='recall'){
      const c=cardById(g.cardIds[g.index]);
      body=c?`<article class="flashcard"><span class="pill">${esc(c.course)} · Card ${g.index+1} / ${g.cardIds.length}</span><h2>${esc(c.question)}</h2>${g.revealed?`<div class="answer">${esc(c.answer)}</div>${sourceLink(c.source,c.references)}${helpForCard(c)}<p class="small muted">Rate what you recalled before revealing.</p><div class="ratings">${['again','hard','good','easy'].map(grade=>`<button class="rating-${grade}" data-action="guide-rate" data-grade="${grade}">${grade[0].toUpperCase()+grade.slice(1)}<small>${grade==='again'?'10 minutes':(()=>{const n=ctx.scheduleCard(state().schedule[c.id],grade).interval;return n+' '+(n===1?'day':'days');})()}</small></button>`).join('')}</div>`:`<label for="guide-draft">My answer from memory (saved)</label><textarea id="guide-draft" maxlength="20000">${esc(g.draft)}</textarea>${actions('<button class="primary" data-action="guide-reveal">Reveal answer</button>')}`}</article>`:'';
    }else if(g.phase==='quiz'){
      const item=g.quizItems[g.index],c=cardById(item?.id);
      const options=item?.order.map(n=>n===0?c.answer:c.wrong[n-1]);
      body=c?`<article class="flashcard"><span class="pill">${esc(c.course)} · Question ${g.index+1} / ${g.quizItems.length}</span><h2>${esc(c.question)}</h2>${options.map((text,i)=>`<button class="choice ${g.selected!==null?(item.order[i]===0?'correct':g.selected===i?'wrong':''):''}" data-action="guide-answer" data-index="${i}" ${g.selected!==null?'disabled':''}><span>${String.fromCharCode(65+i)}</span>${esc(text)}</button>`).join('')}${g.selected!==null?`<div class="feedback ${item.order[g.selected]===0?'':'incorrect'}"><strong>${item.order[g.selected]===0?'That’s right.':'A useful one to revisit.'}</strong><p>${esc(c.answer)}</p>${sourceLink(c.source,c.references)}${helpForCard(c)}</div>${actions('<button class="primary" data-action="guide-next-question">'+(g.index+1<g.quizItems.length?'Next question':'Review my session')+' →</button>')}`:''}</article>`:'';
    }else{
      const revisit=[...new Set([...g.ratings.filter(r=>r.grade==='again').map(r=>r.id),...g.answers.filter(a=>!a.correct).map(a=>a.id)])];
      body=`<section class="panel"><span class="eyebrow">SESSION REVIEW</span><h2>A little clearer than before.</h2><p>${g.ratings.length} cards rated · ${g.answers.filter(a=>a.correct).length} / ${g.answers.length} quiz answers correct.</p><p>${revisit.length?revisit.length+' ideas to explain once more. Cards rated Again return in 10 minutes; quiz mistakes are saved for later retesting.':'Take one idea with you and explain it without looking.'}</p>${actions('<button class="primary" data-action="guide-finish">Finish session</button><a class="primary-link" href="#mistakes">Review mistakes</a>')}</section>${revisit.map(id=>{const c=cardById(id);return `<article class="lesson-card"><h2>${esc(c.question)}</h2><p>${esc(c.answer)}</p>${sourceLink(c.source,c.references)}${helpForCard(c)}</article>`;}).join('')}`;
    }
    main.innerHTML=heading('One step at a time.',`About ${g.minutes} minutes · Progress saves automatically. You can pause whenever you need.`)+`
      <ol class="guide-steps" aria-label="Session steps">${steps.map((step,i)=>`<li ${g.phase===step?'aria-current="step"':''} class="${g.phase===step?'current':steps.indexOf(g.phase)>i?'complete':''}"><span>${i+1}</span>${step[0].toUpperCase()+step.slice(1)}</li>`).join('')}</ol>
      <div class="session-meta"><span>${esc(g.course||'Selected semester')}${g.outcome?' · Outcome '+esc(g.outcome):''}</span><a href="#today">Pause & save</a></div><section class="guided-shell">${body}</section>`;
  }
  function renderOutcomes(){
    main.innerHTML=heading('Anatomy, one outcome at a time.','Find a topic, read its lesson and practise the related questions.')+`<div class="learning-shortcuts"><a href="#diagrams">Diagram practice</a><button data-action="muscle-template">Muscle study template</button><a href="#courses?course=BIOL1006">Full Anatomy pack</a></div><div class="outcome-hub">${anatomyOutcomes.map(o=>{const cards=allCards().filter(c=>c.course==='BIOL1006'&&c.outcome===o.id),notes=lessons.filter(l=>l.course==='BIOL1006'&&l.outcome===o.id);const topics=[...new Set(cards.map(c=>c.topic))];return `<section class="outcome-block"><span class="eyebrow">OUTCOME ${o.id} · PDF pp. ${o.pages}</span><h2>${esc(o.title)}</h2><p class="small muted">${cards.length} recall cards · ${notes.length} ${notes.length===1?'note':'notes'}</p>${actions(`<button class="primary" data-action="guide-outcome" data-id="${o.id}">Study this outcome</button><a href="#notes?course=BIOL1006&outcome=${o.id}">Read notes</a><a href="#recall?course=BIOL1006&outcome=${o.id}">Recall</a><a href="#quiz?course=BIOL1006&outcome=${o.id}">Quiz</a>`)}<details><summary>Explore ${topics.length} ${topics.length===1?'topic':'topics'}</summary><ul class="topic-list">${topics.map(topic=>{const c=cards.find(c=>c.topic===topic);return `<li><span>${esc(topic)}</span><button data-action="guide-card" data-id="${c.id}">Study topic →</button></li>`;}).join('')}</ul></details></section>`;}).join('')}</div>`;
  }
  const example={name:'Supraspinatus',region:'Superior posterior scapula; one of the four rotator cuff muscles.',proximal:'Supraspinous fossa of the scapula.',distal:'Superior facet of the greater tubercle of the humerus.',action:'Assists shoulder abduction and contributes to glenohumeral stability.',nerve:'Suprascapular nerve (usually C5–C6).',application:'On a labelled model, trace its tendon beneath the acromion and explain how its attachments relate to abduction.',source:'NCBI Bookshelf — Anatomy, Shoulder and Upper Limb, Arm Abductor Muscles: https://www.ncbi.nlm.nih.gov/books/NBK537148/'};
  function muscleForm(prefill=false){const data=prefill?example:{};const fields=[['name','Muscle name'],['region','Location / region'],['proximal','Proximal attachments'],['distal','Distal attachments'],['action','Action'],['nerve','Innervation'],['application','Application question'],['source','Source / PDF page']];
    openModal('Build a muscle study note',`<p class="small muted">Connect location → attachments → action → innervation → application. Check details against your taught resources.</p><form id="muscle-form">${fields.map(([key,label])=>`<label for="muscle-${key}">${label}</label>${key==='name'?`<input id="muscle-${key}" required maxlength="150" value="${esc(data[key]||'')}">`:`<textarea id="muscle-${key}" ${['region','action','nerve','source'].includes(key)?'required':''} maxlength="2000" style="min-height:65px">${esc(data[key]||'')}</textarea>`}`).join('')}<label class="inline-check"><input id="muscle-cards" type="checkbox" checked>Create recall cards from my filled fields</label>${actions('<button type="submit" class="primary">Save note & cards</button><button type="button" data-action="muscle-example">Use a worked example</button>')}</form>`);
  }
  function afterRender(page){
    if(page==='today'){
      const g=state().learning.guide,r=state().learning.resume;
      const resume=g&&g.phase!=='done'?`<a class="primary-link" href="#guided">Resume ${esc(g.phase)} →</a>`:r?`<button class="primary" data-action="resume-session">Resume ${r.kind} →</button>`:'';
      main.querySelector('.collection-head')?.insertAdjacentHTML('afterend',`<section class="guided-start-strip"><div><span class="eyebrow">YOUR NEXT STUDY SESSION</span><h2>${resume?'Pick up where you left off.':'A little time. A clear plan.'}</h2><p>${resume?'Your place and answers are saved on this device.':'Learn a short note, recall the ideas, quiz yourself and review the gaps.'}</p></div><div class="guided-start-actions">${resume}<a href="#guided?setup=1" class="small">Choose focus</a><div class="time-choices" aria-label="Start a guided study session">${[10,20,30].map(n=>`<button data-action="guided-start" data-minutes="${n}" ${resume?'':'class="'+(n===10?'primary':'')+'"'}>${n} min</button>`).join('')}</div></div></section>`);
    }
    if(page==='notes')main.querySelector('.toolbar')?.insertAdjacentHTML('beforeend','<button data-action="muscle-template">Muscle template</button><a href="#outcomes">Learning outcomes</a>');
    if(page==='courses'&&location.hash.includes('BIOL1006'))main.querySelector('.course-detail .button-row')?.insertAdjacentHTML('beforeend','<a href="#outcomes">Browse outcomes & topics</a>');
    const saved=state().learning[page]||(state().learning.resume?.kind===page?state().learning.resume:null);
    if(['recall','quiz'].includes(page)&&saved&&!main.querySelector('.session-meta'))main.querySelector('.page-heading')?.insertAdjacentHTML('afterend',`<section class="resume-strip"><span>Continue your saved ${page} session from question ${saved.index+1}.</span><button data-action="resume-session" data-kind="${page}">Resume session</button></section>`);
    if(page==='guided'&&state().learning.guide?.phase!=='learn')return;
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action;
    if(a==='guided-start')startGuide(Number(b.dataset.minutes));
    if(a==='confirm-new-guide'&&pendingGuide){const pending=pendingGuide;pendingGuide=null;$('#modal').close();startGuide(pending.minutes,{...pending.selection,replace:true});}
    if(a==='guide-outcome')go('guided',{setup:1,course:'BIOL1006',outcome:b.dataset.id});
    if(a==='guide-card'){const c=cardById(b.dataset.id),note=relatedLessons(c,lessons)[0];startGuide(10,{course:c.course,outcome:c.outcome?String(c.outcome):'',lesson:note?.id});}
    if(a==='guide-lesson'){const l=lessons.find(l=>l.id===b.dataset.id);startGuide(10,{course:l.course,outcome:l.outcome?String(l.outcome):'',lesson:l.id});}
    if(a==='linked-note')ctx.showLesson(b.dataset.id);
    if(a==='resume-session')ctx.resumeSession(b.dataset.kind);
    if(a==='muscle-template')muscleForm();
    if(a==='muscle-example')muscleForm(true);
    const g=state().learning.guide;if(!g)return;
    if(a==='guide-hide-note'&&g.phase==='learn'){g.revealed=true;saveGuide();render();$('#guide-draft')?.focus();}
    if(a==='guide-show-note'&&g.phase==='learn'){g.revealed=false;saveGuide();render();}
    if(a==='guide-next-note'&&g.phase==='learn'){g.index++;g.draft='';g.revealed=false;if(g.index>=g.lessonIds.length)advance(g);else{saveGuide();drawStep();}}
    if(a==='guide-reveal'){g.revealed=true;saveGuide();render();}
    if(a==='guide-rate'&&g.phase==='recall'&&g.revealed){const c=cardById(g.cardIds[g.index]),grade=b.dataset.grade;if(!['again','hard','good','easy'].includes(grade))return;const s=state(),isNew=!s.schedule[c.id];s.schedule[c.id]=ctx.scheduleCard(s.schedule[c.id],grade);s.history.push({type:'recall',at:Date.now(),card:c.id,grade,new:isNew});if(grade==='again')ctx.recordMistake(s,c,'Guided recall');else if(['good','easy'].includes(grade)&&s.mistakes[c.id])s.mistakes[c.id].resolved=true;g.ratings.push({id:c.id,grade});g.index++;g.revealed=false;g.draft='';if(g.index>=g.cardIds.length)advance(g);else{saveGuide();drawStep();}}
    if(a==='guide-answer'&&g.phase==='quiz'&&g.selected===null){const selected=Number(b.dataset.index);if(![0,1,2,3].includes(selected))return;const item=g.quizItems[g.index],c=cardById(item.id),correct=item.order[selected]===0;g.selected=selected;g.answers.push({id:c.id,correct});state().history.push({type:'quiz',at:Date.now(),card:c.id,correct});if(!correct)ctx.recordMistake(state(),c,'Guided quiz');else if(state().mistakes[c.id])state().mistakes[c.id].resolved=true;saveGuide();render();}
    if(a==='guide-next-question'&&g.phase==='quiz'&&g.selected!==null){g.index++;g.selected=null;if(g.index>=g.quizItems.length)advance(g);else{saveGuide();drawStep();}}
    if(a==='guide-finish'){g.phase='done';g.index=0;saveGuide();go('today');notify('Session complete. Your reviews and corrections are saved.');}
  });
  document.addEventListener('input',e=>{if(e.target.id==='guide-draft'&&state().learning.guide){state().learning.guide.draft=e.target.value.slice(0,20000);saveGuide();}});
  document.addEventListener('change',e=>{if(e.target.id==='guide-course')$('#guide-outcome-wrap').hidden=e.target.value!=='BIOL1006';});
  document.addEventListener('submit',e=>{
    if(e.target.id==='guide-form'){e.preventDefault();startGuide(Number($('#guide-minutes').value),{course:$('#guide-course').value,outcome:$('#guide-course').value==='BIOL1006'?$('#guide-outcome').value:''});}
    if(e.target.id==='muscle-form'){
      e.preventDefault();const fields=Object.fromEntries(['name','region','proximal','distal','action','nerve','application','source'].map(k=>[k,$('#muscle-'+k).value.trim()]));if(!fields.name)return;
      const n=muscleNote(fields),s=state();s.notes.unshift({id:'note-'+crypto.randomUUID(),course:'BIOL1006',...n,updated:Date.now()});
      if($('#muscle-cards').checked)for(const [key,label] of [['region','location / region'],['proximal','proximal attachments'],['distal','distal attachments'],['action','action'],['nerve','innervation']])if(fields[key])s.customCards.push({id:'custom-'+crypto.randomUUID(),course:'BIOL1006',topic:fields.name,question:`What is the ${label} of ${fields.name}?`,answer:fields[key]+'\nSource: '+fields.source,source:'user',wrong:[]});
      save();$('#modal').close();ctx.showPersonalNotes();notify('Muscle note and selected recall cards saved.');
    }
  });
  return {renderGuide,renderOutcomes,helpForCard,afterRender,renderDiagrams:diagrams.render};
}
