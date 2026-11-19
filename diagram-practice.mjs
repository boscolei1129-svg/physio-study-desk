import {createScanStudy} from './scan-study.mjs';
const example={id:'openstax-planes',title:'Body planes · ready-to-use exercise',src:'./assets/diagrams/body-planes.webp',source:'OpenStax, Anatomy and Physiology 2e, Figure 1.14 · CC BY 4.0. Label masks added for practice.',url:'https://openstax.org/books/anatomy-and-physiology-2e/pages/1-6-anatomical-terminology',labels:[{x:1,y:1,w:13,h:8,answer:'Sagittal plane'},{x:83,y:6,w:17,h:12,answer:'Frontal (coronal) plane'},{x:83,y:28,w:17,h:8,answer:'Transverse plane'},{x:70,y:71,w:28,h:5,answer:'Oblique plane'}],stats:{correct:0,again:0}};
const clone=x=>JSON.parse(JSON.stringify(x));
function database(){return new Promise((resolve,reject)=>{const r=indexedDB.open('physio-study-diagrams-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('diagrams',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(new Error('Diagram storage is unavailable in this browser.'));});}
async function transact(mode,action){const db=await database();return new Promise((resolve,reject)=>{const t=db.transaction('diagrams',mode),r=action(t.objectStore('diagrams'));let value;r.onsuccess=()=>value=r.result;t.oncomplete=()=>{db.close();resolve(value);};t.onerror=()=>{db.close();reject(new Error('Could not save diagrams. Export a diagram backup or free browser storage.'));};});}
export function validateDiagram(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||typeof value.id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(value.id)||typeof value.title!=='string'||value.title.length>200||typeof value.src!=='string'||value.src.length>4500000||!(value.src===example.src||/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value.src))||!Array.isArray(value.labels)||value.labels.length>60)throw new Error('Invalid diagram backup.');
  const labels=value.labels.map(l=>{if(!l||!['x','y','w','h'].every(k=>Number.isFinite(l[k])&&l[k]>=0&&l[k]<=100)||l.w<.3||l.h<.3||l.x+l.w>100.1||l.y+l.h>100.1||typeof l.answer!=='string'||!l.answer.trim()||l.answer.length>300)throw new Error('Invalid label mask.');return {x:l.x,y:l.y,w:l.w,h:l.h,answer:l.answer};});
  return {id:value.id,title:value.title,src:value.src,labels,source:typeof value.source==='string'?value.source.slice(0,1000):'My uploaded diagram',url:value.id===example.id?example.url:'',stats:{correct:Math.max(0,Math.min(100000,Number(value.stats?.correct)||0)),again:Math.max(0,Math.min(100000,Number(value.stats?.again)||0))}};
}
export function createDiagramPractice(ctx){
  const {$,esc,main,heading,notify,go,icon}=ctx;
  let active=null,editing=false,revealed=new Set(),pdf=null,pdfName='',pdfPage=1,busy=false,renderToken=0,draftRect=null,drag=null,editingMask=null;
  const list=async()=>{const saved=await transact('readonly',s=>s.getAll());return [saved.find(x=>x.id===example.id)||clone(example),...saved.filter(x=>x.id!==example.id)];};
  async function put(diagram){await transact('readwrite',s=>s.put(validateDiagram(diagram)));}
  function attribution(d){return `<p class="small muted diagram-attribution">${esc(d.source||'My uploaded diagram · stored privately on this device')}${d.url?` <a href="${d.url}" target="_blank" rel="noopener noreferrer">Source</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">Licence</a>`:''}</p>`;}
  function viewer(){if(!active)return '';return `<section class="diagram-workspace"><div class="section-title"><h2>${esc(active.title)}</h2><button data-action="diagram-close">Back to diagrams</button></div>${attribution(active)}${scanner.toolbar()}
    <div class="diagram-columns"><div class="diagram-surface ${editing&&!scanner.showingNotes()?'editing':''}" id="diagram-surface"><img src="${esc(active.src)}" alt="Anatomy illustration for label identification" draggable="false">${(scanner.showingNotes()?[]:active.labels).map((l,i)=>`<button class="diagram-mask ${!editing&&revealed.has(i)?'revealed':''}" style="left:${l.x}%;top:${l.y}%;width:${l.w}%;height:${l.h}%" data-action="diagram-reveal" data-index="${i}" aria-label="${revealed.has(i)?'Hide':'Reveal'} label ${i+1}">${i+1}</button>`).join('')}<div id="mask-draft" hidden></div></div>
    ${scanner.notes()||`<aside class="diagram-controls">${editing?`<h3>Cover a label</h3><p class="small">Drag a rectangle over a printed label, name its answer, then add the mask. You can also enter percentages below.</p><form id="mask-form"><label for="mask-answer">Hidden label / correct answer</label><input id="mask-answer" maxlength="300" required><div class="mask-coordinates">${[['x','Left',0],['y','Top',0],['w','Width',20],['h','Height',7]].map(([id,label,value])=>`<div><label for="mask-${id}">${label} %</label><input id="mask-${id}" type="number" min="${['w','h'].includes(id)?'.3':'0'}" max="100" step=".1" value="${value}" required></div>`).join('')}</div><button type="submit" id="mask-submit">Add label mask</button></form><ol class="mask-list">${active.labels.map((l,i)=>`<li><span>${i+1}. ${esc(l.answer)}</span><div class="button-row"><button data-action="mask-edit" data-index="${i}">Edit</button><button data-action="mask-remove" data-index="${i}">Remove</button></div></li>`).join('')}</ol><label for="diagram-title">Exercise title</label><input id="diagram-title" maxlength="200" value="${esc(active.title)}"><div class="button-row"><button class="primary" data-action="diagram-save" ${active.labels.length?'':'disabled'}>Save & practise</button><button data-action="diagram-cancel-edit">Cancel editing</button></div><p class="small muted">Save your masks before leaving this page.</p>`:`<h3>Identify, then reveal.</h3><p class="small">Say the structure or plane name before tapping its numbered mask.</p><ol class="diagram-answer-list">${active.labels.map((l,i)=>`<li><button data-action="diagram-reveal" data-index="${i}">${i+1}. ${revealed.has(i)?esc(l.answer):'Reveal label'}</button>${revealed.has(i)?`<div class="button-row"><button data-action="diagram-rate" data-index="${i}" data-grade="correct">I knew it</button><button data-action="diagram-rate" data-index="${i}" data-grade="again">Try again</button></div>`:''}</li>`).join('')}</ol><div class="button-row"><button data-action="diagram-hide-all">Hide all labels</button>${active.id!==example.id?'<button data-action="diagram-edit">Edit masks</button>':''}</div><p class="small muted">Self-checks: ${active.stats?.correct||0} recalled · ${active.stats?.again||0} to practise again. These do not alter your flashcard schedule.</p>`}</aside>`}</div></section>`;}
  async function render(){if(!location.hash.startsWith('#diagrams'))return;const token=++renderToken;editingMask=null;
    main.innerHTML=heading('See it. Name it. Recall it.','Hide anatomy labels, identify the structure and reveal one answer at a time.')+`<section class="panel diagram-upload"><div class="scan-entry"><label for="scan-file">Scan to Study</label><p class="small muted">Turn a slide screenshot into editable notes and suggested label covers.</p><input id="scan-file" type="file" ${scanner.busy()?'disabled':''} accept="image/png,image/jpeg,image/webp"></div><h2>Use your Anatomy 100 PDF or a diagram image</h2><p class="small">Select a PDF page or image, then cover its printed labels. Your uploaded files and masks stay in this browser; they are not uploaded to GitHub.</p><label for="diagram-file">Open PDF, PNG, JPEG or WebP (up to 25 MB)</label><input id="diagram-file" type="file" ${scanner.busy()?'disabled':''} accept="application/pdf,image/png,image/jpeg,image/webp"><div id="pdf-picker" ${pdf?'':'hidden'}><label for="diagram-page">PDF page${pdf?' · '+pdf.numPages+' pages':''}</label><input id="diagram-page" type="number" min="1" max="${pdf?.numPages||500}" value="${pdfPage}"><button data-action="pdf-use-page">Use this page</button></div><p id="diagram-status" role="status">${busy?'Opening your file…':''}</p></section><div class="learning-shortcuts"><button data-action="diagram-export">Export diagram backup</button><label class="file-button" for="diagram-import">Import diagram backup</label><input id="diagram-import" type="file" accept="application/json,.json" hidden><a href="#outcomes">Anatomy learning outcomes</a></div><div id="diagram-content">${active?viewer():'<p class="muted">Loading diagram exercises…</p>'}</div>`;
    if(!active)try{const records=await list();if(token!==renderToken||!location.hash.startsWith('#diagrams'))return;$('#diagram-content').innerHTML=`<div class="diagram-gallery">${records.map(d=>`<article class="panel"><h2>${esc(d.title)}</h2><p class="small muted">${d.labels.length} hidden ${d.labels.length===1?'label':'labels'} · ${d.id===example.id?'OpenStax starting exercise':'Your private exercise'}</p><button class="primary" data-action="diagram-open" data-id="${d.id}">Practise labels ${icon('arrow')}</button></article>`).join('')}</div><p class="small muted">Export diagrams separately from your study backup. The export contains your saved page images and masks; the original PDF is not stored.</p>`;}catch(error){if(token===renderToken){$('#diagram-content').innerHTML=`<p class="notice">${esc(error.message)} You can still try the starting exercise.</p><button data-action="diagram-example">Open body planes</button>`;}}
  }
  async function imageData(blob){
    const bitmap=await createImageBitmap(blob);
    const scale=Math.min(1,2400/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));
    canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const context=canvas.getContext('2d');
    context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);
    context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    bitmap.close();
    return canvas.toDataURL('image/jpeg',.9);
  }
  async function usePage(){if(!pdf||busy)return;const value=Number($('#diagram-page')?.value||pdfPage);if(!Number.isInteger(value)||value<1||value>pdf.numPages){notify('Choose a valid page number.');return;}busy=true;pdfPage=value;$('#diagram-status').textContent='Rendering page '+value+'…';
    try{const page=await pdf.getPage(value),natural=page.getViewport({scale:1}),scale=Math.min(2,1800/Math.max(natural.width,natural.height)),viewport=page.getViewport({scale});const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;active={id:'diagram-'+crypto.randomUUID(),title:pdfName+' · page '+value,src:canvas.toDataURL('image/jpeg',.88),source:pdfName+' · PDF page '+value+' · your private upload',labels:[],stats:{correct:0,again:0}};editing=true;revealed.clear();}catch(error){notify('Could not render this page: '+error.message);}finally{busy=false;render();}}
  document.addEventListener('change',async e=>{
    if(['diagram-file','scan-file'].includes(e.target.id)){
      const autoScan=e.target.id==='scan-file',prior=active;
      const file=e.target.files[0];if(!file)return;if(file.size>25000000){notify('Choose a file smaller than 25 MB.');return;}
      if(busy)return;editingMask=null;busy=true;$('#diagram-status').textContent='Opening your file…';
      try{if(!autoScan&&(file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf'))){const lib=await import('./vendor/pdfjs/pdf.mjs');lib.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.mjs',import.meta.url).href;lib.GlobalWorkerOptions.rendererSrc=new URL('./vendor/pdfjs/pdf.renderer.mjs',import.meta.url).href;await pdf?.destroy();pdf=await lib.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,useSystemFonts:true,standardFontDataUrl:new URL('./vendor/pdfjs/standard_fonts/',import.meta.url).href,wasmUrl:new URL('./vendor/pdfjs/wasm/',import.meta.url).href}).promise;if(pdf.numPages>500){await pdf.destroy();pdf=null;throw new Error('Choose a PDF with at most 500 pages.');}pdfName=file.name;pdfPage=1;active=null;editing=false;}else if(['image/png','image/jpeg','image/webp'].includes(file.type)){await pdf?.destroy();pdf=null;pdfName='';active={id:'diagram-'+crypto.randomUUID(),title:file.name,src:await imageData(file),source:file.name+' · your private upload',labels:[],stats:{correct:0,again:0}};editing=true;revealed.clear();}else throw new Error('Choose a PDF, PNG, JPEG or WebP file.');}catch(error){notify('File not opened: '+error.message);}finally{busy=false;render();}
      if(autoScan&&active!==prior&&active?.source===file.name+' · your private upload')void scanner.start();
    }
    if(e.target.id==='diagram-import'){
      const file=e.target.files[0];if(!file)return;try{if(file.size>30000000)throw new Error('Choose a backup smaller than 30 MB.');const data=JSON.parse(await file.text());if(data.version!==1||!Array.isArray(data.diagrams)||data.diagrams.length>30)throw new Error('Unsupported diagram backup.');const records=data.diagrams.map(validateDiagram);const existing=await list(),ids=new Set(existing.map(d=>d.id));for(const d of records){if(ids.has(d.id)&&d.id!==example.id)d.id='diagram-'+crypto.randomUUID();if(d.id===example.id&&ids.has(d.id))continue;await put(d);ids.add(d.id);}active=null;notify('Diagram backup imported. Existing exercises were kept.');render();}catch(error){notify('Diagram import failed: '+error.message);}
    }
  });
  document.addEventListener('click',async e=>{const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action;
    try{
      if(a==='pdf-use-page')await usePage();
      if(a==='diagram-example'){active=clone(example);editing=false;revealed.clear();render();}
      if(a==='diagram-open'){active=(await list()).find(d=>d.id===b.dataset.id);editing=false;revealed.clear();render();}
      if(a==='diagram-close'){active=null;editing=false;render();}
      if(a==='diagram-cancel-edit'){active=null;editing=false;render();}
      if(a==='diagram-reveal'&&active&&!editing){const i=Number(b.dataset.index);revealed.has(i)?revealed.delete(i):revealed.add(i);render();}
      if(a==='diagram-hide-all'){revealed.clear();render();}
      if(a==='diagram-rate'&&active){const grade=b.dataset.grade;if(!['correct','again'].includes(grade))return;active.stats[grade]=(active.stats[grade]||0)+1;revealed.delete(Number(b.dataset.index));await put(active);render();}
      if(a==='diagram-edit'&&active){editing=true;revealed.clear();render();}
      if(a==='mask-edit'&&active&&editing){
        const index=Number(b.dataset.index),label=active.labels[index];
        if(!label)return;
        editingMask=index;
        for(const key of ['x','y','w','h'])$('#mask-'+key).value=label[key].toFixed(1);
        $('#mask-answer').value=label.answer;
        $('#mask-submit').textContent='Update label mask';
        $('#mask-answer').focus();
      }
      if(a==='mask-remove'&&active){editingMask=null;active.labels.splice(Number(b.dataset.index),1);render();}
      if(a==='diagram-save'&&active){active.title=$('#diagram-title').value.trim()||'My diagram';if(active.id===example.id){const copy={...active,id:'diagram-'+crypto.randomUUID()};await put(copy);Object.assign(active,validateDiagram(copy));}else await put(active);editing=false;revealed.clear();notify('Diagram and masks saved privately on this device.');render();}
      if(a==='diagram-export'){const records=await list(),body=JSON.stringify({version:1,diagrams:records});if(body.length>30000000)throw new Error('Your diagrams exceed the 30 MB export limit.');const url=URL.createObjectURL(new Blob([body],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='physio-diagrams-backup.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    }catch(error){notify(error.message);}
  });
  document.addEventListener('submit',e=>{if(e.target.id!=='mask-form')return;e.preventDefault();if(!active||!editing)return;try{const mask={...Object.fromEntries(['x','y','w','h'].map(k=>[k,Number($('#mask-'+k).value)])),answer:$('#mask-answer').value.trim()};const labels=[...active.labels];if(editingMask===null)labels.push(mask);else labels[editingMask]=mask;validateDiagram({...active,labels});active.labels=labels;editingMask=null;active.title=$('#diagram-title').value.trim()||active.title;render();}catch(error){notify(error.message);}});
  document.addEventListener('input',e=>{if(e.target.id==='diagram-title'&&active)active.title=e.target.value;});
  document.addEventListener('pointerdown',e=>{const surface=e.target.closest('#diagram-surface.editing');if(!surface||e.target.closest('button')||!editing)return;const rect=surface.getBoundingClientRect();draftRect=null;drag={id:e.pointerId,x:Math.max(0,Math.min(100,(e.clientX-rect.left)/rect.width*100)),y:Math.max(0,Math.min(100,(e.clientY-rect.top)/rect.height*100))};surface.setPointerCapture(e.pointerId);e.preventDefault();});
  document.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const surface=$('#diagram-surface');if(!surface){drag=null;return;}const r=surface.getBoundingClientRect(),x=Math.max(0,Math.min(100,(e.clientX-r.left)/r.width*100)),y=Math.max(0,Math.min(100,(e.clientY-r.top)/r.height*100));draftRect={x:Math.min(x,drag.x),y:Math.min(y,drag.y),w:Math.abs(x-drag.x),h:Math.abs(y-drag.y)};const d=$('#mask-draft');d.hidden=false;Object.assign(d.style,{left:draftRect.x+'%',top:draftRect.y+'%',width:draftRect.w+'%',height:draftRect.h+'%'});});
  document.addEventListener('pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;drag=null;if(draftRect){for(const k of ['x','y','w','h'])$('#mask-'+k).value=draftRect[k].toFixed(1);$('#mask-answer').focus();}});
  document.addEventListener('pointercancel',()=>{drag=null;});
  const scanner=createScanStudy({$,esc,notify,rerender:render,getDiagram:()=>active,
    scanCourseOptions:ctx.scanCourseOptions,saveScannedNote:ctx.saveScannedNote,
    editLabels(suggestions){
      editing=true;
      editingMask=null;
      revealed.clear();
      const additions=suggestions.filter(candidate=>!active.labels.some(label=>
        Math.abs(label.x-candidate.x)<2&&Math.abs(label.y-candidate.y)<2));
      const accepted=additions.slice(0,60-active.labels.length);
      active.labels.push(...accepted);
      return accepted.length;
    }
  });
  return {render};
}
