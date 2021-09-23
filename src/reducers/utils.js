import {normalizeSync} from 'normalize-diacritics';
import createDebugLogger from 'debug';

import fs from 'fs';
import path from 'path';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

// Get array of field tags for use in other functions
export function getTags(fields) {
  const tags = fields.map(field => field.tag);
  return tags;
}

export function fieldsAreIdentical(field1, field2) {
  if (field1.tag !== field2.tag) { // NB! We are skipping normalizations here on purpose! They should be done beforehand...
    return false;
  }
  return localFieldToString(field1) === localFieldToString(field2);

  /*
  if ('value' in field1) { // 001-009
    return localFieldToString(field1) === localFieldToString(field2);
  }

  if ('subfields' in field1) {
    if (field1.ind1 === field2.ind1 && field1.ind2 === field2.ind2 && field1.subfields.length === field2.subfields.length) {
      // NB! This does not check order of subfields, which might or might nor be a bad idea.
      // NV would just do localFieldToString() and compare them strings...
      // NV: Also this is a subset check, not an equality check.
      // This is the original (Artturi?) way...
      return field1.subfields.every(sf => field2.subfields.some(sf2 => sf.code === sf2.code && sf.value === sf2.value));
    }
    return false;
  }

  */
}

// Modified from copy functionality in marc-record-merge
// Changed function name from checkIdenticalness to getNonIdenticalFields / SS 28.5.2021
export function getNonIdenticalFields(baseFields, sourceFields) {
  debug(`gNIF() in... ${baseFields.length} vs ${sourceFields.length}`);

  /*
  const baseFieldsAsString = baseFields.map(field => localFieldToString(field));
  return sourceFields.filter(sourceField => baseFieldsAsString.some(fieldAsString => fieldAsString === localFieldToString(sourceField)));
*/
  // Return array of non-identical fields (source fields not present in base)
  return sourceFields.filter(filterNonIdentical);

  function filterNonIdentical(sourceField) {
    return baseFields.some(baseField => fieldsAreIdentical(sourceField, baseField)) === false;
  }
}

function localFieldToString(f) {
  if ('subfields' in f) {
    return `${f.tag} ${f.ind1}${f.ind2} ‡${formatSubfields(f)}`;
  }
  return `${f.tag}    ${f.value}`;
  function formatSubfields(field) {
    return field.subfields.map(sf => `${sf.code}${sf.value || ''}`).join('‡');
  }
}

export function fieldToString(f) { // copied aped from marc-record-js, NB! Overrides the normal json output (oops)
  return localFieldToString(f);
}

// Copy fields from source to base
// Used for non-identical fields
// Copy all (typically non-identical in our context) fields from source to base
export function copyFields(record, fields) {
  fields.forEach(f => {
    debug(`Field ${fieldToString(f)} copied from source to base`);
    record.insertField(f);
  });
  // const tags = fields.map(field => field.tag);
  // tags.forEach(tag => debug('Field '+ mapDataField(copied from source to base`));
  return record;
}

// Get field specs from melindaCustomMergeFields.json
const melindaFields = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'reducers', 'melindaCustomMergeFields.json'), 'utf8'));
export function getFieldSpecs(tag) {
  const [fieldSpecs] = melindaFields.fields.filter(field => field.tag === tag);
  return fieldSpecs;
}

function subfieldIsRepeatable(currFieldSpecs, subfieldCode) {
  // These we know or "know":
  if ('0159'.indexOf(subfieldCode) > -1) {
    // Uh, can $0 appear on any field?
    return true;
  }

  if ('6'.indexOf(subfieldCode) > -1) {
    return false;
  }

  const subfieldSpecs = currFieldSpecs.subfields.filter(subfield => subfield.code === subfieldCode);
  if (subfieldSpecs.length !== 1) {
    return false; // repeatable if not specified?
  }
  return subfieldSpecs[0].repeatable;
}

export function fieldIsRepeatable(tag, code = null) {
  const fieldSpecs = melindaFields.fields.filter(field => field.tag === tag);
  if (fieldSpecs.length !== 1) {
    if (!code) {
      debug(` WARNING! Getting field ${tag} data failed! Default to unrepeatable field.`);
      return false;
    }
    debug(` WARNING! Getting field ${tag}$${code} data failed! Default to repeatable subfield.`);
    return true;
  }
  if (!code) { // Field is repeatable:
    return fieldSpecs[0].repeatable;
  }
  return subfieldIsRepeatable(fieldSpecs[0], code);
}

// Normalize subfield values for comparison, returns array of normalized subfields
export function normalizeSubfields(field) {
  const normalizedSubs = field.subfields
    .map(({code, value}) => ({code, value: normalizeStringValue(value)}));
  return normalizedSubs;
}

export function normalizeStringValue(value) {
  // Regexp options: g: global search, u: unicode
  // Note: normalize-diacritics also changes "äöå" to "aoa"
  const punctuation = /[.,\-/#!?$%^&*;:{}=_`~()[\]]/gu;
  return normalizeSync(value).toLowerCase().replace(punctuation, '', 'u').replace(/\s+/gu, ' ').trim();
}

export function subfieldsAreIdentical(subfieldA, subfieldB) {
  return subfieldA.code === subfieldB.code && subfieldA.value === subfieldB.value;
}

// Compare base and source subfield arrays defined by the given array of subfield codes
// Returns true if all compared subfields are equal
export function compareAllSubfields(baseField, sourceField, codes) {
  const baseSubsNorm = baseField.subfields
    .filter(subfield => codes.indexOf(subfield.code) !== -1)
    .map(({code, value}) => ({code, value: normalizeStringValue(value)}));
  const sourceSubsNorm = sourceField.subfields
    .filter(subfield => codes.indexOf(subfield.code) !== -1)
    .map(({code, value}) => ({code, value: normalizeStringValue(value)}));

  // Get base subfields for which a matching source subfield is found
  const equalSubfieldsBase = baseSubsNorm
    .filter(baseSub => sourceSubsNorm
      .some(sourceSub => subfieldsAreIdentical(baseSub, sourceSub)));
  //debug(`equalSubfieldsBase: ${JSON.stringify(equalSubfieldsBase, undefined, 2)}`);

  // Get source subfields for which a matching base subfield is found
  const equalSubfieldsSource = sourceSubsNorm
    .filter(sourceSub => baseSubsNorm
      .some(baseSub => subfieldsAreIdentical(sourceSub, baseSub)));
  //debug(`equalSubfieldsSource: ${JSON.stringify(equalSubfieldsSource, undefined, 2)}`);

  // If the same number of matches is found both ways, all compared subfields are equal
  if (baseSubsNorm.length === equalSubfieldsBase.length &&
    sourceSubsNorm.length === equalSubfieldsSource.length &&
    equalSubfieldsBase.length === equalSubfieldsSource.length) {
    codes.forEach(code => debug(`Subfield (${code}): all equal in source and base`));
    return true;
  }
  codes.forEach(code => debug(`Subfield (${code}): not equal in source and base`));
  return false;
}

// Get non-repeatable subfields to copy from source to base
// Filter out dropped and identifying subfields, if given
export function getNonRepSubs(sourceField, nonRepCodes, dropCodes = [], idCodes = []) {
  const nonRepSubs = sourceField.subfields
    .filter(subfield => nonRepCodes
      .filter(code => dropCodes.indexOf(code) === -1 && idCodes.indexOf(code) === -1).indexOf(subfield.code) !== -1);
  return nonRepSubs;
}


// Default subfield sort order if no custom order is given
const sortDefault = [
  '8',
  '6',
  '7',
  '3',
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'k',
  'l',
  'm',
  'n',
  'o',
  'p',
  'q',
  'r',
  's',
  't',
  'u',
  'v',
  'w',
  'x',
  'y',
  'z',
  '4',
  '2',
  '0',
  '1',
  '5',
  '9'
];

export function sortSubfields(subfields, order = sortDefault, orderedSubfields = []) {
  const [filter, ...rest] = order;
  if (filter === undefined) {
    return [...orderedSubfields, ...subfields];
  }
  //debug(`### Subfield sort filter: ${JSON.stringify(filter)}`);
  //debug(`### Subfields: ${JSON.stringify(subfields)}`);
  //debug(`### Ordered subfields: ${JSON.stringify(orderedSubfields)}`);
  /* eslint-disable */
  const filtered = subfields.filter(sub => {
    if (typeof filter === 'string') {
      return sub.code === filter;
    }

  });
  const restSubfields = subfields.filter(sub => {
    if (typeof filter === 'string') {
      return sub.code !== filter;
    }
    /* eslint-enable */
  });
  if (filtered.length > 0) {
    return sortSubfields(restSubfields, rest, [...orderedSubfields, ...filtered]);
  }
  return sortSubfields(restSubfields, rest, orderedSubfields);
}


// NVOLK's marc record modifications
function internalFieldHasSubfield(field, subfieldCode, subfieldValue) {
  if (subfieldValue === null) {
    return field.subfields.some(sf => sf.code === subfieldCode);
  }
  return field.subfields.some(sf => sf.code === subfieldCode && subfieldValue === sf.value);
}

export function fieldHasSubfield(field, subfieldCode, subfieldValue = null) {
  return internalFieldHasSubfield(field, subfieldCode, subfieldValue);
}

export function fieldHasNSubfields(field, subfieldCode, subfieldValue = null) {
  const relevantSubfields = field.subfields.filter(sf => sf.code === subfieldCode);
  if (subfieldValue === null) {
    return relevantSubfields.length;
  }
  const subset = relevantSubfields.filter(value => value === subfieldValue);
  return subset.length;
}

/**
 * renameSubfieldCodes
 *
 * */
export function fieldRenameSubfieldCodes(field, origCode, targetCode) {
  // should we clone this?
  field.subfields.map(currSub => {
    if (currSub.code === origCode) {
      currSub.code = targetCode; // eslint-disable-line functional/immutable-data
      return currSub;
    }
    return currSub;
  });
  return field;
}

export function recordHasField(record, tag) {
  const re = new RegExp(`^${tag}$`, 'u');
  const yeOldeFields = record.get(re);
  return yeOldeFields.length > 0;
}


// should this go to marc_record
export function recordReplaceField(record, originalField, newField) {
  const index = record.fields.findIndex(field => field === originalField);
  if (index === -1) {
    debug('WARNING: recordReplaceField: Failed to find the original field');
    // Should this function return something for success or failure?
    return record;
  }
  record.removeField(originalField);
  record.insertField(newField);
  return record;
}

