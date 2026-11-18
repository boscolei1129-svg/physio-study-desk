import {foundationNotes} from './notes/foundations.mjs';
import {anatomyNotes} from './notes/anatomy.mjs';

export const studyNotes={...foundationNotes,...anatomyNotes};
const os='https://openstax.org/books/anatomy-and-physiology-2e/pages/';
export const noteSources=[
  ['note-axial','OpenStax · Axial muscles of the abdominal wall and thorax',os+'11-4-axial-muscles-of-the-abdominal-wall-and-thorax'],
  ['note-vessels','OpenStax · Circulatory pathways',os+'20-5-circulatory-pathways'],
  ['note-skull','OpenStax · The skull',os+'7-2-the-skull'],
  ['note-upper-bones','OpenStax · Bones of the upper limb',os+'8-2-bones-of-the-upper-limb'],
  ['note-lower-bones','OpenStax · Bones of the lower limb',os+'8-4-bones-of-the-lower-limb'],
  ['note-tension','OpenStax · Nervous system control of muscle tension',os+'10-4-nervous-system-control-of-muscle-tension'],
  ['note-testicular','OpenStax · Testicular reproductive system',os+'27-1-anatomy-and-physiology-of-the-testicular-reproductive-system'],
  ['note-ovarian','OpenStax · Ovarian reproductive system',os+'27-2-anatomy-and-physiology-of-the-ovarian-reproductive-system'],
  ['note-decisions','Oxford CEBM · Making a decision','https://www.cebm.ox.ac.uk/resources/ebm-tools/making-a-decision'],
  ['note-diagnostics','FDA · Reporting studies evaluating diagnostic tests','https://www.fda.gov/regulatory-information/search-fda-guidance-documents/statistical-guidance-reporting-results-studies-evaluating-diagnostic-tests-guidance-industry-and-fda'],
  ['note-country','Adelaide University · Footprint on Country','https://adelaide.edu.au/about/first-nations/footprint-on-country/'],
  ['note-snuffbox','NCBI Bookshelf · Hand anatomical snuff box','https://www.ncbi.nlm.nih.gov/books/NBK482228/'],
  ['note-pulses','NCBI Bookshelf · Peripheral pulse','https://www.ncbi.nlm.nih.gov/books/NBK542175/'],
  ['note-femoral','Locating Femoral Vein by Anatomic Landmarks · Cadaveric study','https://pmc.ncbi.nlm.nih.gov/articles/PMC12032564/'],
  ['note-ebp','NSW Health CIAP · Steps of evidence-based practice','https://www.ciap.health.nsw.gov.au/training/ebp-learning-modules/module1/the-steps-of-evidence-based-practice.html']
].map(([id,title,url])=>({id,title,url,type:'Lesson reference',description:'Reference checked for the original in-app lessons on 19 November 2026. Complete explanations and exercises are included in the app; this external reference is optional.'}));
export const extraNoteReferences={
  'lesson-1':['terms'],'lesson-2':['movement'],'lesson-3':['upper'],'lesson-4':['homeo'],'lesson-5':['cells'],'lesson-6':['muscle'],'lesson-7':['breath'],
  'lesson-8':['note-ebp'],'lesson-9':['scale'],'lesson-10':['conduct'],'lesson-11':['conduct','torque'],'lesson-12':['note-upper-bones','upper'],
  'lesson-13':['lower'],'lesson-14':['neuron'],'lesson-15':['renal'],'lesson-16':['immune'],'lesson-17':['conduct','aiatsis','note-country'],
  'lesson-18':['naccho'],'lesson-19':['icf'],'lesson-20':['icf','thresholds'],'lesson-21':['note-diagnostics','note-decisions'],'lesson-22':['torque'],'lesson-23':['digest'],'lesson-24':['bone'],
  'anatomy100-note-01':['terms'],'anatomy100-note-02':['terms'],'anatomy100-note-03':['movement'],'anatomy100-note-04':['check-tissues'],
  'anatomy100-note-05':['note-tension','neuron'],'anatomy100-note-06':['conduct'],'anatomy100-note-07':['note-upper-bones','upper','note-snuffbox'],
  'anatomy100-note-08':['note-lower-bones','lower'],'anatomy100-note-09':['note-vessels','note-pulses','note-femoral'],'anatomy100-note-10':['bone'],
  'anatomy100-note-11':['note-vessels'],'anatomy100-note-12':['note-vessels'],'anatomy100-note-13':['note-axial','check-psoas','breath'],
  'anatomy100-note-14':['upper'],'anatomy100-note-15':['upper'],'anatomy100-note-16':['upper','check-lumbricals'],
  'anatomy100-note-17':['lower','check-psoas'],'anatomy100-note-18':['lower','check-foot'],'anatomy100-note-19':['digest'],
  'anatomy100-note-20':['digest'],'anatomy100-note-21':['breath'],'anatomy100-note-22':['renal'],
  'anatomy100-note-23':['note-testicular'],'anatomy100-note-24':['note-ovarian','check-implantation'],
  'anatomy100-note-25':['note-skull'],'anatomy100-note-26':['note-skull']
};
