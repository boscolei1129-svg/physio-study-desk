import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {cards,courses,lessons,sources,stations} from '../content.mjs';
for(const source of sources){
  if(source.type==='Uploaded PDF'){assert.equal(source.url,null);assert.equal(source.filename,'Human_Anatomy_100_compressed.pdf');assert.ok(Number.isInteger(source.page)&&source.page>=1&&source.page<=30);}
  else assert.equal(new URL(source.url).protocol,'https:');
}
for(const name of ['index.html','styles.css','app.mjs','core.mjs','content.mjs','anatomy100.mjs','icon.svg','manifest.webmanifest','sw.js'])assert.ok((await readFile(new URL('../'+name,import.meta.url),'utf8')).length);
const counts={courses:courses.length,recallCards:cards.length,quizQuestions:cards.filter(c=>c.wrong.length===3).length,notes:lessons.length,practiceStations:stations.length,sources:sources.length};
console.log('Content and static assets verified:',JSON.stringify(counts));
