//import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';
import {fieldHasSubfield, fieldToString, fieldsAreIdentical, nvdebug, hasCopyright, removeCopyright, subfieldToString} from './utils';
import {cloneAndNormalizeFieldForComparison, cloneAndRemovePunctuation} from './normalize';
import {mergeOrAddSubfield} from './mergeOrAddSubfield';
import {mergeIndicators} from './mergeIndicator';
import {mergableTag} from './mergableTag';
import {getCounterpart} from './counterpartField';
import {default as normalizeEncoding} from '@natlibfi/marc-record-validators-melinda/dist/normalize-utf8-diacritics';
import {postprocessRecords} from './mergeOrAddPostprocess.js';
import {preprocessBeforeAdd} from './processFilter.js';

import fs from 'fs';
import path from 'path';
import {fieldGetSubfield6Pairs} from './subfield6Utils';
import {fieldsToString} from '@natlibfi/marc-record-validators-melinda/dist/utils';

const defaultConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'reducers', 'config.json'), 'utf8'));

//import {sortAdjacentSubfields} from './sortSubfields';
// import identicalFields from '@natlibfi/marc-record-validators-melinda/dist/identical-fields';

// Specs: https://workgroups.helsinki.fi/x/K1ohCw (though we occasionally differ from them)...

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:mergeField');
//const debugData = debug.extend('data');
const debugDev = debug.extend('dev');

const defCandFieldsRegexp = /^(?:0[1-9][0-9]|[1-9][0-9][0-9]|CAT|LOW|SID)$/u;


// Should this load default configuration?
//export default (tagPattern = undefined, config = defaultConfig.mergeConfiguration) => (base, source) => {
export default (tagPattern = undefined, config = defaultConfig.mergeConfiguration) => (baseRecord, sourceRecord) => {
  nvdebug(`ENTERING mergeField.js`, debugDev);
  //const baseRecord = new MarcRecord(base, {subfieldValues: false});
  //const sourceRecord = new MarcRecord(source, {subfieldValues: false});

  const activeTagPattern = getTagPattern(tagPattern, config);

  //debugData(JSON.stringify(baseRecord));
  //debugData(JSON.stringify(sourceRecord));

  //sourceRecord.fields.forEach(f => nvdebug(`SRC1: ${fieldToString(f)}`));

  //nvdebug(`MERGE CONFIG: ${JSON.stringify(config)}`, debugDev);

  normalizeEncoding().fix(baseRecord);
  normalizeEncoding().fix(sourceRecord);

  preprocessBeforeAdd(baseRecord, sourceRecord, config.preprocessorDirectives);


  //sourceRecord.fields.forEach(f => nvdebug(`SRC2: ${fieldToString(f)}`));

  const candidateFields = sourceRecord.get(activeTagPattern);
  //  .filter(field => !isMainOrCorrespondingAddedEntryField(field)); // current handle main entries as well


  candidateFields.forEach(candField => {
    debug(`Now merging (or trying to) field ${fieldToString(candField)}`);
    // If $6 is merged from 700 to 100, the corresponding 880 field will change!
    const candFieldPairs880 = candField.tag === '880' ? undefined : fieldGetSubfield6Pairs(candField, sourceRecord);
    nvdebug(`SELF: ${fieldToString(candField)}`, debugDev);
    nvdebug(`PAIR: ${candFieldPairs880 ? fieldsToString(candFieldPairs880) : 'NADA'}`, debugDev);
    mergeField(baseRecord, candField, config, candFieldPairs880);
  });

  // Remove deleted fields and field.merged marks:
  postprocessRecords(baseRecord, sourceRecord);

  return {base: baseRecord, source: sourceRecord};
  //return {baseRecord2, sourceRecord2};

  function getTagPattern(tagPattern, config) {
    if (tagPattern) {
      return tagPattern;
    }
    if (config.tagPattern) {
      return config.tagPattern;
    }
    return defCandFieldsRegexp;
  }
};


// NB! Can be do this via config.json?
function removeEnnakkotieto(field) {
  const tmp = field.subfields.filter(subfield => subfield.code !== 'g' || subfield.value !== 'ENNAKKOTIETO.');
  // remove only iff some other subfield remains
  if (tmp.length > 0) { // eslint-disable-line functional/no-conditional-statement
    field.subfields = tmp; // eslint-disable-line functional/immutable-data
  }
}


function copyrightYearHack(baseRecord, baseField, sourceField) {
  if (baseField.tag !== '264' || sourceField.tag !== '260') {
    return;
  }
  const relevantSubfields = sourceField.subfields.filter(sf => sf.code === 'c' && hasCopyright(sf.value));

  relevantSubfields.forEach(sf => {
    // Add new:
    const value = sf.value.replace(/\.$/u, '');
    baseRecord.insertField({'tag': '264', 'ind1': ' ', 'ind2': '4', 'subfields': [{'code': 'c', value}]});
    // Modify original subfield:
    sf.value = removeCopyright(sf.value); // eslint-disable-line functional/immutable-data
  });
}

function mergeField2(baseRecord, baseField, sourceField, config, candFieldPairs880 = []) {
  //// Identical fields
  // No need to check every subfield separately.
  // Also no need to postprocess the resulting field.
  if (fieldToString(baseField) === fieldToString(sourceField)) {
    return baseRecord;
  }

  // If a base ennakkotieto is merged with real data, remove ennakkotieto subfield:
  // (If our prepub normalizations are ok, this should not be needed.
  //  However, it's simple and works well enough, so let's keep it here.)
  if (fieldHasSubfield(baseField, 'g', 'ENNAKKOTIETO.') && !fieldHasSubfield(sourceField, 'g', 'ENNAKKOTIETO.')) { // eslint-disable-line functional/no-conditional-statement
    removeEnnakkotieto(baseField);
    baseField.merged = 1; // eslint-disable-line functional/immutable-data
  }

  copyrightYearHack(baseRecord, baseField, sourceField);

  mergeIndicators(baseField, sourceField, config);


  // We want to add the incoming subfields without punctuation, and add puctuation later on.
  // (Cloning is harmless, but probably not needed.)
  // NEW: we also drag the normalized version along. It is needed for the merge-or-add decision
  const normalizedSourceField = cloneAndNormalizeFieldForComparison(sourceField); //cloneAndRemovePunctuation(sourceField);
  const strippedSourceField = cloneAndRemovePunctuation(sourceField);

  //nvdebug(`  MERGING SUBFIELDS OF '${fieldToString(sourceField)}' (original)`, debugDev);
  //nvdebug(`  MERGING SUBFIELDS OF '${fieldToString(normalizedSourceField)}' (comparison)`, debugDev);
  nvdebug(`  MERGING SUBFIELDS OF '${fieldToString(strippedSourceField)}' (merge/add)`, debugDev);

  sourceField.subfields.forEach((originalSubfield, index) => {
  //strippedSourceField.subfields.forEach((subfieldForMergeOrAdd, index) => {
    const normalizedSubfield = normalizedSourceField.subfields[index];
    const punctlessSubfield = strippedSourceField.subfields[index];
    const originalValue = fieldToString(baseField);

    const subfieldData = {'code': originalSubfield.code, 'originalValue': originalSubfield.value, 'normalizedValue': normalizedSubfield.value, 'punctuationlessValue': punctlessSubfield.value};

    mergeOrAddSubfield(baseField, subfieldData, candFieldPairs880); // candSubfield);
    const newValue = fieldToString(baseField);
    if (originalValue !== newValue) { // eslint-disable-line functional/no-conditional-statement
      nvdebug(`  MERGING SUBFIELD '${subfieldToString(punctlessSubfield)}' TO '${originalValue}'`, debugDev);
      nvdebug(`   RESULT: '${newValue}'`, debugDev);
      //debug(`   TODO: sort subfields, handle punctuation...`);
    }
    //else { debug(`  mergeOrAddSubfield() did not add '‡${fieldToString(subfieldForMergeOrAdd)}' to '${originalValue}'`); }

  });
}


function skipMergeField(baseRecord, sourceField, config) {
  if (!mergableTag(sourceField.tag, config)) {
    nvdebug(`skipMergeField(): field '${fieldToString(sourceField)}' listed as skippable!`, debugDev);
    return true;
  }

  // Skip duplicate field:
  if (baseRecord.fields.some(baseField => fieldsAreIdentical(sourceField, baseField))) {
    nvdebug(`skipMergeField(): field '${fieldToString(sourceField)}' already exists! No merge required!`, debugDev);
    sourceField.deleted = 1; // eslint-disable-line functional/immutable-data
    return true;
  }

  return false;
}

export function mergeField(baseRecord, sourceField, config, candFieldPairs880 = []) {
  nvdebug(`MERGE SOURCE FIELD '${fieldToString(sourceField)}'`, debugDev); //  mergeField config: ${JSON.stringify(config)}`, debugDev);
  // skip duplicates and special cases:
  if (skipMergeField(baseRecord, sourceField, config)) {
    nvdebug(`mergeField(): don't merge '${fieldToString(sourceField)}'`, debugDev);
    return false;
  }

  nvdebug(`mergeField(): Try to merge '${fieldToString(sourceField)}'.`, debugDev);
  const counterpartField = getCounterpart(baseRecord, sourceField, config);

  if (counterpartField) {
    nvdebug(`mergeField(): Got counterpart: '${fieldToString(counterpartField)}'. Thus try merge...`, debugDev);
    mergeField2(baseRecord, counterpartField, sourceField, config, candFieldPairs880);
    sourceField.deleted = 1; // eslint-disable-line functional/immutable-data
    return true;
  }
  // NB! Counterpartless field is inserted to 7XX even if field.tag says 1XX:
  debug(`mergeField(): No mergable counterpart found for '${fieldToString(sourceField)}'.`);
  return false;
}

