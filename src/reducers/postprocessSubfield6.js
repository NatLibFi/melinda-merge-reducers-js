//import createDebugLogger from 'debug';
import {MarcRecord} from '@natlibfi/marc-record';
import {/*fieldToString, fieldHasNSubfields,*/ fieldHasSubfield/*, nvdebug*/} from './utils';

//const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
//const debugData = debug.extend('data');


const sf6Regexp = /^[0-9][0-9][0-9]-[0-9][0-9]/u;

// Remove unpaired
export default () => (base, source) => {
  const baseRecord = new MarcRecord(base, {subfieldValues: false});
  recordRemovePairlessFields(baseRecord, false);
  return {base: baseRecord, source};
};

function get6s(field) {
  return field.subfields.filter(sf => sf.code === '6');
}

/*
function numberOf6s(field) {
  const sixes = get6s(field);
  return sixes.length;
}
*/

function subfieldApplies(subfield, lookFor) {
  if (subfield.code !== '6') {
    return false;
  }
  return subfield.value.substring(0, 6) === lookFor;
}

function getPairValue(subfield6, myTag) {
  const index = subfield6.value.substring(4, 6);
  const lookFor = `${myTag}-${index}`;
  return lookFor;
}

function findPairForSubfield6(subfield6, myTag, fields) {
  // We keep the crap!
  if (!subfield6.value.match(sf6Regexp)) {
    return undefined;
  }
  // Only valid $6 value that fails to map to another field is iffy...
  const referredTag = subfield6.value.substring(0, 3);
  //const index = subfield6.value.substring(4, 6);
  const lookFor = getPairValue(subfield6, myTag);
  const relevantFields = fields.filter(field => field.tag === referredTag && field.subfields.some(sf => subfieldApplies(sf, lookFor)));
  if (relevantFields.length === 0) {
    return undefined;
  }
  // This should always return just one (not sanity checking this for now):
  return relevantFields[0];
}

/*
export function resetCorrespondingField880(field, record, oldTag, newTag) {
  const sixes = get6s(field);
  if (sixes.length === 0) { // speed things up
    return;
  }
  const cand880Fields = record.fields.filter(field => field.tag === '880');
  sixes.forEach(sf6 => fix880(sf6));

  function fix880(sf6) {
    const pairValue = getPairValue(sf6, oldTag);
    const newPairValue = `${newTag}-${pairValue.substring(4, 6)}`;
    cand880Fields.forEach(f => f.subfields.forEach(sf => fix880Subfield6(sf, pairValue, newPairValue)));
  }

  function fix880Subfield6(sf, oldValue, newValue) {
    if (sf.code === '6' && sf.value === oldValue) {
      sf.value = newValue; // eslint-disable-line functional/immutable-data
      return;
    }
  }
}
*/

/*
function subfield6HasNoPair(subfield6, ownTag, fields) {
  // We keep the crap!
  if (!subfield6.value.match(sf6Regexp)) {
    return true; // huh!?!, had function name there: fieldHasNSubfields;
  }
  // Only valid $6 value that fails to map to another field is iffy...
  const referredTag = subfield6.value.substring(0, 3);
  const index = subfield6.value.substring(4, 6);
  const lookFor = `${ownTag}-${index}`;

  const relevantFields = fields.filter(field => field.tag === referredTag && field.subfields.some(sf => subfieldApplies(sf, lookFor)));
  return relevantFields.length === 0; // Valid pair not found
}
*/

function cleanAndReturnTrueIfDeletable(field, fields) {
  const sixes = get6s(field);
  const pairlessSixes = sixes.filter(sf => !findPairForSubfield6(sf, field.tag, fields));

  if (pairlessSixes.length) {
    if (field.tag !== '880' || pairlessSixes.length < sixes.length) {
      const remainingSubfields = field.subfields.filter(sf => pairlessSixes.every(sf2 => sf2.code !== sf.code || sf2.value !== sf.value));
      if (remainingSubfields.length) { // Just clean up the crappy $6s as decent $6 remains
        field.subfields = remainingSubfields; // eslint-disable-line functional/immutable-data
        return false;
      }
      return true;
    }
    return true;
  }
  return false;
}


export function recordRemovePairlessFields(record, removedOnlyMerged) {
  const relevantFields = record.fields.filter(field => fieldHasSubfield(field, '6'));
  const deletableFields = relevantFields.filter(field => cleanAndReturnTrueIfDeletable(field, relevantFields, removedOnlyMerged));

  deletableFields.forEach(field => record.removeField(field));

  //const deletableFields = getDeletableFieldsAndRemoveUnneeded6s(recordRemovePairlessFields);

}
