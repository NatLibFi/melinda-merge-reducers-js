//import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';
import {
  fieldHasSubfield,
  fieldHasNSubfields,
  fieldIsRepeatable,
  fieldToString,
  fieldsAreIdentical,
  normalizeStringValue,
  recordHasField
} from './utils.js';

import {
  cloneAndPreprocessField
} from './mergePreAndPostprocess.js';

import {
  getMergeConstraintsForTag
} from './mergeConstraints.js';

// Specs: https://workgroups.helsinki.fi/x/K1ohCw (though we occasionally differ from them)...

import {controlSubfieldsPermitMerge} from './controlSubfields.js';

import {
  bottomUpSortSubfields,
  isSubfieldGoodForMerge,
  mergeSubfield
} from './mergeSubfield.js';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

const counterpartRegexps = {
  '100': /^[17]00$/u, '110': /^[17]10$/u, '111': /^[17]11$/u, '130': /^[17]30$/u,
  '700': /^[17]00$/u, '710': /^[17]10$/u, '711': /^[17]11$/u, '730': /^[17]30$/u
};

function uniqueKeyMatches(baseField, sourceField, forcedKeyString = null) {
  // NB! Assume that field1 and field2 have same relevant subfields.
  // What to do if if base
  // const keySubfieldsAsString = forcedKeyString || getUniqueKeyFields(field1);
  const keySubfieldsAsString = forcedKeyString || getMergeConstraintsForTag(baseField.tag, 'key');
  //return mandatorySubfieldComparison(baseField, sourceField, keySubfieldsAsString);
  return optionalSubfieldComparison(baseField, sourceField, keySubfieldsAsString);
}

function mandatorySubfieldComparison(field1, field2, keySubfieldsAsString) {
  if (keySubfieldsAsString === null) { // does not currently happen
    // If keySubfieldsAsString is undefined, (practically) everything is the string.
    // When everything is the string, the strings need to be (practically) identical.
    // (NB! Here order matters. We should probably make it matter everywhere.)
    // (However, keySubfieldsAsString === '' will always succeed. Used by 040 at least.)
    return fieldToString(field1) === fieldToString(field2);
  }

  const subfieldArray = keySubfieldsAsString.split('');

  return subfieldArray.every(subfieldCode => {
    const subfields1 = field1.subfields.filter(subfield => subfield.code === subfieldCode);
    const subfields2 = field2.subfields.filter(subfield => subfield.code === subfieldCode);
    // Assume that at least 1 instance must exist and that all instances must match
    if (subfields1.length !== subfields2.length) {
      debug(`mSC: Unique key: subfield ${subfieldCode} issues...`);
      return false;
    }

    return subfields1.every(sf => {
      const normSubfieldValue = normalizeStringValue(sf.value);
      return subfields2.some(sf2 => {
        const normSubfieldValue2 = normalizeStringValue(sf2.value);
        if (normSubfieldValue === normSubfieldValue2) {
          debug(` mandatory pairing succeeded for normalized subfield ‡${sf.code} '${normSubfieldValue}'`);
          return true;
        }
        debug(`failed to pair ${normSubfieldValue} and ${normSubfieldValue2}`);
        return false;
      });
    });

  });
}

function normalizedSubfieldsMatch(subfields1, subfields2) {
  //debug(`nSM ${subfields1.length} vs ${subfields2.length}`);
  if (subfields1.length === 0 || subfields2.length === 0) {
    return true;
  }
  //debug(`nSM $${subfields1[0].code} ${subfields1.length} vs ${subfields2.length}`);
  const vals1 = subfields1.map(subfield => normalizeStringValue(subfield.value));
  const vals2 = subfields2.map(subfield => normalizeStringValue(subfield.value));
  const vals1b = vals1.filter(value => !vals2.includes(value));
  const vals2b = vals2.filter(value => !vals1.includes(value));
  if (vals1b.length === 0 || vals2b.length === 0) {
    return true;
  }
  return false;
}

function optionalSubfieldComparison(field1, field2, keySubfieldsAsString) {
  if (keySubfieldsAsString === null) {
    return true;
  }
  const subfieldArray = keySubfieldsAsString.split('');
  //debug(`  COMPARE SUBS ${keySubfieldsAsString}`);
  //debug(`    LEN b4 filth: ${field1.subfields.length} vs ${field2.subfields.length}`);
  return subfieldArray.every(subfieldCode => {
    //debug(`NOW ${subfieldCode}`);
    const subfields1 = field1.subfields.filter(subfield => subfield.code === subfieldCode);
    const subfields2 = field2.subfields.filter(subfield => subfield.code === subfieldCode);
    return normalizedSubfieldsMatch(subfields1, subfields2);

    /*
    if (subfields1.length === 0 || subfields2.length === 0) {
      return true;
    }

    return subfields1.every(sf => {
      const normSubfieldValue = normalizeStringValue(sf.value);
      return subfields2.some(sf2 => {
        const normSubfieldValue2 = normalizeStringValue(sf2.value);
        if (normSubfieldValue === normSubfieldValue2) {
          debug(`pairing succeed for normalized '${normSubfieldValue}'`);
          return true;
        }
        debug(`failed to pair ${normSubfieldValue} and ${normSubfieldValue2}`);
        return false;
      });
    });
*/
  });
}

function localTagToRegexp(tag) {
  if (tag in counterpartRegexps) {
    // Are the hard-coded hacks actually used? Check...
    const regexp = counterpartRegexps[tag];
    //debug(`regexp for ${tag} found: ${regexp}`);
    return regexp;
  }
  // debug(`WARNING: locallocalTagToRegexp(${tag}): no precompiled regexp found.`);
  return new RegExp(`^${tag}$`, 'u');
}

export function tagToRegexp(tag) {
  return localTagToRegexp(tag);
}

function areRequiredSubfieldsPresent(field) {
  const subfieldString = getMergeConstraintsForTag(field.tag, 'required');
  if (subfieldString === null) {
    return true;
  } // nothing is required
  const subfieldArray = subfieldString.split('');
  return subfieldArray.every(sfcode => {
    const result = fieldHasSubfield(field, sfcode);
    if (!result) {
      debug(`Required subfield ‡${sfcode} not found in '${fieldToString(field)}'!`);
      return false;
    }
    return true;
  });
}

function arePairedSubfieldsInBalance(field1, field2) {
  const subfieldString = getMergeConstraintsForTag(field1.tag, 'paired');
  if (subfieldString === null) {
    return true;
  }
  const subfieldArray = subfieldString.split('');

  return subfieldArray.every(sfcode => fieldHasNSubfields(field1, sfcode) === fieldHasNSubfields(field2, sfcode));
}


function indicatorsMatch(field1, field2) {
  // The value of 245 IND1 depends on other fields, and those field might diffent from Melinda and incoming record:
  if (field1.ind1 !== field2.ind1 && !['245'].includes(field1.tag)) {
    debug('indicator 1 check failed');
    return false;
  }
  // "ohitusindikaattori" difference does not trigger failure:
  if (field1.ind2 !== field2.ind2 && !['240', '243', '245'].includes(field1.tag)) {
    debug('indicator 1 check failed');
    return false;
  }
  // NB! There are cases where indicator values are, says # and 1, and the define value (here 1) should be used. (Eg. field 100.)
  // However, we do not let them pass yet.
  return true;
}


function mergablePair(baseField, sourceField, fieldSpecificCallback = null) {
  // Indicators *must* be equal:
  if (!indicatorsMatch(baseField, sourceField) ||
    !controlSubfieldsPermitMerge(baseField, sourceField)) {
    return false;
  }
  //debug('mergablePair()... wp2');
  // NB! field1.tag and field2.tag might differ (1XX vs 7XX). Therefore required subfields might theoretically differ as well. Thus check both:
  if (!areRequiredSubfieldsPresent(baseField) || !areRequiredSubfieldsPresent(sourceField)) {
    return false;
  }
  //debug('mergablePair()... wp3');
  // Stuff of Hacks! Eg. require that both fields either have or have not X00$t:
  if (!arePairedSubfieldsInBalance(baseField, sourceField)) {
    debug('required subfield pair check failed.');
    return false;
  }
  //debug('Test semantics...');
  if (!semanticallyMergablePair(baseField, sourceField)) {
    return false;
  }
  return fieldSpecificCallback === null || fieldSpecificCallback(baseField, sourceField);
}

function compareName(baseField, sourceField) {
  // 100$a$t: remove $t and everything after that
  const reducedField1 = fieldToNamePart(baseField);
  const reducedField2 = fieldToNamePart(sourceField);

  // compare the remaining subsets:
  if (uniqueKeyMatches(reducedField1, reducedField2)) {
    //debug(`    name match: '${fieldToString(reducedField1)}'`);
    return true;
  }
  debug(`    name mismatch: '${fieldToString(reducedField1)}' vs '${fieldToString(reducedField2)}'`);
  return false;
}


function semanticallyMergablePair(baseField, sourceField) {
  // On rare occasions a field contains a title part and partial checks are required:
  if (!compareTitlePart(baseField, sourceField)) {
    debug(` ${baseField.tag} is unmergable: Title part mismatch.`);
    return false;
  }

  // TODO: we should check lifespan here, $d YYYY

  // Handle the field specific "unique key" (=set of fields that make the field unique
  if (!compareName(baseField, sourceField)) {
    debug('Unmergable: Name part mismatch');
    return false;
  }
  //debug(' Semantic checks passed! We are MERGABLE!');

  return true;
}


function namePartThreshold(field) {
  // Threshold is only applicaple to some tags..
  if (!(/[10]0$/u).test(field.tag)) {
    return -1;
  }
  const t = field.subfields.findIndex(currSubfield => currSubfield.code === 't');
  const u = t; // field.subfields.findIndex(currSubfield => currSubfield.code === 'u');
  if (t === -1) {
    return u;
  }
  if (u === -1) {
    return t;
  }
  return t > u ? u : t;
}

function fieldToNamePart(field) {
  const index = namePartThreshold(field);
  const subsetField = {'tag': field.tag, 'ind1': field.ind1, 'ind2': field.ind2, subfields: field.subfields.filter((sf, i) => i < index || index === -1)};

  /*
  if (index > -1) { // eslint-disable-line functional/no-conditional-statement
    debug(`Name subset: ${fieldToString(subsetField)}`);
  }
  */
  return subsetField;
}

function fieldToTitlePart(field) {
  // Take everything after 1st subfield $t...
  const index = field.subfields.findIndex(currSubfield => currSubfield.code === 't');
  const subsetField = {'tag': field.tag, 'ind1': field.ind1, 'ind2': field.ind2, subfields: field.subfields.filter((sf, i) => i >= index)};
  debug(`Title subset: ${fieldToString(subsetField)}`);
  return subsetField;
}

function fieldCanHaveTitlePart(field) {
  return ['100', '110', '111', '700', '710', '711'].includes(field.tag);
}

function containsTitlePart(field) {
  return fieldCanHaveTitlePart(field) && fieldHasSubfield(field, 't');
}

function compareTitlePart(field1, field2) {
  if (!containsTitlePart(field1)) {
    return !containsTitlePart(field2);
  }
  if (!containsTitlePart(field2)) {
    return false;
  }

  debug(`TITLE PARTS NEED TO BE COMPARED`);

  // 100$a$t: remove $t and everything after that
  const subset1 = fieldToTitlePart(field1);
  const subset2 = fieldToTitlePart(field2);
  return mandatorySubfieldComparison(subset1, subset2, 'dfhklmnoprstxvg');
}


export function getCounterpart(record, field) {
  if (getMergeConstraintsForTag(field.tag, 'skip') || getMergeConstraintsForTag(field.tag, 'mergable') === false) {
    // debug(`${field.tag}/mergable is ${tmp} `);
    return null;
  }
  // Get tag-wise relevant 1XX and 7XX fields:
  const counterpartCands = record.get(localTagToRegexp(field.tag));
  // debug(counterpartCands);

  if (!counterpartCands || counterpartCands.length === 0) {
    return null;
  }

  debug(`Compare incoming '${fieldToString(field)}' with (up to) ${counterpartCands.length} existing field(s)`);
  const index = counterpartCands.findIndex((currCand) => {
    if (mergablePair(currCand, field)) {
      debug(`  OK pair found: '${fieldToString(currCand)}'. Returning it!`);
      return true;
    }
    debug(`  FAILED TO PAIR: '${fieldToString(currCand)}'. Skipping it!`);
    return false;
  });
  if (index > -1) {
    return counterpartCands[index];
  }
  return null;
}

function removeEnnakkotieto(field) {
  const tmp = field.subfields.filter(subfield => subfield.code !== 'g' || subfield.value !== 'ENNAKKOTIETO.');
  // remove only iff some other subfield remains
  if (tmp.length > 0) { // eslint-disable-line functional/no-conditional-statement
    field.subfields = tmp; // eslint-disable-line functional/immutable-data
  }
}

function mergeField(record, targetField, sourceField) {
  // Duplicate field:
  if (fieldToString(sourceField) === fieldToString(targetField)) {
    // No need to try every field separately.
    // Also no need to postprocess the resulting field.
    return record;
  }

  // If a base ennakkotieto is merged with real data, remove ennakkotieto subfield:
  if (fieldHasSubfield(targetField, 'g', 'ENNAKKOTIETO.') && !fieldHasSubfield(sourceField, 'g', 'ENNAKKOTIETO.')) { // eslint-disable-line functional/no-conditional-statement
    removeEnnakkotieto(targetField);
    targetField.merged = 1; // eslint-disable-line functional/immutable-data
  }

  sourceField.subfields.forEach(candSubfield => {
    const originalValue = fieldToString(targetField);
    mergeSubfield(record, targetField, candSubfield);
    const newValue = fieldToString(targetField);
    if (originalValue !== newValue) { // eslint-disable-line functional/no-conditional-statement
      debug(`  MERGING SUBFIELD '‡${candSubfield.code} ${candSubfield.value}' TO '${originalValue}'`);
      debug(`   RESULT: '${newValue}'`);
      //debug(`   TODO: sort subfields, handle punctuation...`);
    }
    //else { debug(`  mergeSubfield() did not add '‡${candSubfield.code} ${candSubfield.value}' to '${originalValue}'`); }

  });
  return record;
}

function checkSolitariness(record, tag) {
  // Some of the fields are repeatable as per Marc21 specs, but we still don't want to multiple instances of tag.
  // These are listed in https://workgroups.helsinki.fi/x/K1ohCw . (However, we do not always agree with specs.)
  const solitary = getMergeConstraintsForTag(tag, 'solitary');
  if (solitary) {
    // Blocking is requested by specs for a field with 'solitary':true.
    // However, we won't block if all existing relevant fields come from source record.
    const candidateFields = record.get(tagToRegexp(tag));
    //return true;
    return candidateFields.some(field => !field.added);

  }
  // No reason to block:
  return false;
}

function repetitionBlocksAdding(record, tag) {
  // It's not a repetition:
  if (!recordHasField(record, tag)) {
    return false;
  }
  // It's a repetition:
  if (!fieldIsRepeatable(tag)) {
    return true; // blocked
  }
  // Solitariness is a hack, see checkSolitariness() for details.
  return checkSolitariness(record, tag);
}

function fieldCanBeAdded(record, field) {
  if (repetitionBlocksAdding(record, field.tag)) {
    debug(`Unrepeatable field already exists. Failed to add '${fieldToString(field)}'.`);
    return false;
  }

  if (field.tag === '240' && recordHasField(record, '130')) {
    return false;
  }
  if (field.tag === '830' && !fieldHasSubfield(field, 'x')) {
    return false;
  }
  // We could block 260/264 pairs here.

  return true;
}

function addField(record, field) {
  if (!fieldCanBeAdded(record, field)) {
    return record;
  }

  field.subfields = field.subfields.filter(sf => isSubfieldGoodForMerge(field.tag, sf.code)); // eslint-disable-line functional/immutable-data

  if (field.subfields.length === 0) {
    debug(`ERROR: No subfields in field-to-add`);
    return record;
  }
  debug(`Add as ${fieldToString(field)}`);
  // Do we need to sort unmerged subfields?
  return record.insertField(bottomUpSortSubfields(field));
}

function skipMergeOrAddField(record, field) {
  // We are not interested in this field, whatever the case:
  // (Currently fields: 066,  and some 8XX fields))
  if (getMergeConstraintsForTag(field.tag, 'skip')) {
    return true;
  }
  // Skip duplicate field:
  if (record.fields.some(baseField => fieldsAreIdentical(field, baseField))) {
    //debug(`mergeOrAddField(): field '${fieldToString(field)}' already exists! No action required!`);
    return true;
  }

  return false;
}

export function mergeOrAddField(record, field) {
  const newField = cloneAndPreprocessField(field, record);

  if (skipMergeOrAddField(record, newField)) {
    return record;
  }

  const counterpartField = getCounterpart(record, newField);

  if (counterpartField) {
    debug(`mergeOrAddfield(): Got counterpart: '${fieldToString(counterpartField)}'. Thus try merge...`);
    mergeField(record, counterpartField, newField);
    return record;
  }
  // NB! Counterpartless field is inserted to 7XX even if field.tag says 1XX:
  debug(`mergeOrAddField(): No mergable counterpart found for '${fieldToString(field)}'. Try to add it instead.`);
  return addField(record, newField);
}
