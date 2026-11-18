import {renderTeachingFigure} from './note-visuals.mjs';
// A deliberately small, escaped teaching-text renderer. It never creates outbound links or runs HTML.
export const escapeNote=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const inline=x=>escapeNote(x).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
export function noteStats(text){return {words:text.trim().split(/\s+/).length,minutes:Math.max(1,Math.ceil(text.trim().split(/\s+/).length/200)),checks:(text.match(/^\? /gm)||[]).length};}
export function chapterSections(text,prefix='note'){
  return [...text.matchAll(/^## (.+)$/gm)].map((m,i)=>({title:m[1],id:prefix+'-section-'+i}));
}
export function renderChapter(text,{prefix='note',contents=false,lessonId=''}={}){
  const lines=text.trim().split(/\r?\n/),sections=chapterSections(text,prefix);let out='',i=0,section=0;
  while(i<lines.length){const line=lines[i].trim();
    if(!line){i++;continue;}
    if(line.startsWith('## ')){out+=`<h2 id="${escapeNote(sections[section++].id)}" tabindex="-1">${inline(line.slice(3))}</h2>`;i++;continue;}
    if(line.startsWith('? ')){
      const question=line.slice(2),answer=lines[i+1]?.trim();
      if(!answer?.startsWith('! '))throw new Error('A retrieval question needs a model answer.');
      out+=`<details class="note-check"><summary>${inline(question)}<span class="check-hint">Reveal model answer</span></summary><div class="model-answer"><span class="eyebrow">MODEL ANSWER</span><p>${inline(answer.slice(2))}</p></div></details><p class="print-answer"><strong>${inline(question)}</strong><br>${inline(answer.slice(2))}</p>`;i+=2;continue;
    }
    if(line.startsWith('|')){
      const rows=[];while(i<lines.length&&lines[i].trim().startsWith('|'))rows.push(lines[i++].trim().replace(/^\||\|$/g,'').split('|').map(x=>x.trim()));
      const header=rows.shift();const data=rows.filter(r=>!r.every(c=>/^:?-+:?$/.test(c)));
      out+=`<div class="note-table-scroll" role="region" aria-label="Comparison table" tabindex="0"><table><thead><tr>${header.map(c=>`<th scope="col">${inline(c)}</th>`).join('')}</tr></thead><tbody>${data.map(r=>`<tr>${r.map(c=>`<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;continue;
    }
    if(line.startsWith('- ')){const items=[];while(i<lines.length&&lines[i].trim().startsWith('- '))items.push(lines[i++].trim().slice(2));out+='<ul>'+items.map(x=>'<li>'+inline(x)+'</li>').join('')+'</ul>';continue;}
    const paragraph=[line];i++;while(i<lines.length&&lines[i].trim()&&!/^(## |\? |\||- )/.test(lines[i].trim()))paragraph.push(lines[i++].trim());out+='<p>'+inline(paragraph.join(' '))+'</p>';
  }
  const nav=contents?`<nav class="note-toc" aria-label="In this lesson"><span class="eyebrow">IN THIS LESSON</span>${sections.map(s=>`<button data-action="note-section" data-section="${escapeNote(s.id)}">${escapeNote(s.title)}</button>`).join('')}</nav>`:'';
  return nav+`<div class="chapter-content">${renderTeachingFigure(lessonId)}${out}</div>`;
}
export function noteAttribution(lesson,sources){
  const refs=[...new Set([lesson.source,...(lesson.references||[])])].map(id=>sources.find(s=>s.id===id)).filter(Boolean);
  return `<details class="note-attribution"><summary>References & content scope</summary><p>Original study explanations and fictional examples for this topic, reviewed 19 November 2026. These references are attribution; all explanations and model answers are available here.</p><ul>${refs.map(s=>`<li>${escapeNote(s.title)}${s.page?` · ${escapeNote(s.filename)} · page ${s.page}`:''}</li>`).join('')}</ul><p>This lesson covers its stated topic. Your enrolled course outline determines assessed coverage. Later-year courses remain a roadmap; supervised practical teaching and community-led learning retain their own roles.</p></details>`;
}
export function lessonPlainText(lesson,sources){
  return lesson.chapter.replace(/^\? /gm,'Question: ').replace(/^! /gm,'Model answer: ').replace(/^## /gm,'').replace(/\*\*/g,'').trim()+'\n\nReferences: '+[...new Set([lesson.source,...(lesson.references||[])])].map(id=>sources.find(s=>s.id===id)?.title).filter(Boolean).join('; ');
}
