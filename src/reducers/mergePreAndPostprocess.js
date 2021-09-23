//import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';
import {fieldFixPunctuation} from './punctuation.js';
import {
  fieldHasSubfield,
  fieldRenameSubfieldCodes
  //fieldToString
} from './utils.js';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

export function postprocessField(field) {
  // TODO: indicator update for article length (eg. 245)
  return field;
}

const sf6Regexp = /^[0-9][0-9][0-9]-[0-9][0-9]/u;

function subfield6Index(subfield) {
  if (!subfield.value.match(sf6Regexp)) {
    return 0;
  }
  const tailPart = subfield.value.substring(4, 6); // 4 is for "TAG-"
  const result = parseInt(tailPart, 10);
  debug(`SF6: ${subfield.value} => ${tailPart} => ${result}`);
  return result;
}

function fieldSubfield6Index(field) {
  const sf6s = field.subfields.filter(subfield => subfield.code === '6');
  if (sf6s.length === 0) {
    return 0;
  }
  // There's supposed to be just instance of subfield 6:
  return subfield6Index(sf6s[0]);
}

function getMaxSubfield6(record) {
  // Should we cache the value here?
  const vals = record.fields.map((field) => {
    if (field.added) {
      return 0;
    } // field already added from source
    return fieldSubfield6Index(field);
  });
  return Math.max(...vals);
}

/*
function updateSubfield6(field, index) {
  const sf6s = field.subfields.filter(subfield => subfield.code === '6');
  const strindex = index < 10 ? `0${index}` : `${index}`;
  sf6s[0].value.replace(sf6s[0].substring(4, 6), strindex);
}
*/

function cloneField(field) {
  // mark it as coming from source:
  field.added = 1; // eslint-disable-line functional/immutable-data
  return JSON.parse(JSON.stringify(field));
}

export function postprocessRecord(record) {
  record.fields.forEach(field => {
    // remove merge-specific information:
    if (field.merged) { // eslint-disable-line functional/no-conditional-statement
      
      fieldFixPunctuation(field); // NB! This won't fix existing or added fields!
      // DO YOUR SHIT
      delete field.merged; // eslint-disable-line functional/immutable-data
      // NB! We could
      // - remove subsets?
      // - Fix X00 ind2 etc
    }
    if (field.added) { // eslint-disable-line functional/no-conditional-statement
      delete field.added; // eslint-disable-line functional/immutable-data
    }
  });
}

function convertOriginalToModifyingAgency(field) {
  // Convert source record's 040$a 040$d, since it can not be an $a of the base record.
  if (field.tag === '040') { // eslint-disable-line functional/no-conditional-statement
    debug(`  Convert source record's 040$a to $d`);
    fieldRenameSubfieldCodes(field, 'a', 'd');
  }
}

function mainEntryToAddedEntry(field) {
  if (field.tag === '100' || field.tag === '110' || field.tag === '111' || field.tag === '130') { // eslint-disable-line functional/no-conditional-statement
    debug(`  Convert source record's ${field.tag} to 7XX`);
    field.tag = `7${field.tag.substring(1)}`; // eslint-disable-line functional/immutable-data
  }
}

function reindexSubfield6s(field, record) {
  if (record && fieldHasSubfield(field, '6')) {
    const baseMax = getMaxSubfield6(record);
    debug(`MAX SF6 is ${baseMax}`);
    // This is done for every subfield $6... Could be optimized esp. if this includes the fields added by this script...
    if (baseMax) {

      return {'tag': field.tag,
        'ind1': field.ind1,
        'ind2': field.ind2,
        // 'merged': 1,
        'subfields': field.subfields.map((sf) => {
          if (sf.code === '6') { // eslint-disable-line functional/no-conditional-statement
            const index = subfield6Index(sf) + baseMax;
            const strindex = index < 10 ? `0${index}` : `${index}`;
            sf.value = sf.value.substring(0, 4) + strindex + sf.value.substring(6); // eslint-disable-line functional/immutable-data
            debug(`SF6 is now ${sf.value}`);
          }
          return sf;
        })};
    }
  }
}

// NB! These are defined also in mergeSubfield.js. Do something...
const notYear = /^\([1-9][0-9]*\)[,.]?$/u;

function datesAssociatedWithName(field) {
  // Skip irrelevant fields:
  if (!field.tag.match(/^[1678]00$/u)) {
    return field;
  }

  if (field.subfields.some(sf => sf.code === 'd' && notYear.test(sf.value))) { // eslint-disable-line functional/no-conditional-statement
    field.subfields = field.subfields.filter(sf => sf.code !== 'd' || !notYear.test(sf.value)); // eslint-disable-line functional/immutable-data
  }

}

function normalizeFIN11(value) {
  if ((/^\(FI-ASTERI-N\)[0-9]{9}$/u).test(value)) {
    return `(FIN11)${value.substring(13)}`; // eslint-disable-line functional/immutable-data
  }
  if ((/^https?:\/\/urn\.fi\/URN:NBN:fi:au:finaf:[0-9]{9}$/u).test(value)) {
    return `(FIN11)${value.slice(-9)}`;
  }
  return false;
}

export function normalizeSubfield0Value(value) {
  if ((/^\(FI-MELINDA\)[0-9]{9}$/u).test(value)) {
    return `(FIN01)${value.substring(12)}`; // eslint-disable-line functional/immutable-data
  }
  if ((/^\(FI-ASTERI-S\)[0-9]{9}$/u).test(value)) {
    return `(FIN10)${value.substring(13)}`; // eslint-disable-line functional/immutable-data
  }
  if ((/^\(FI-ASTERI-A\)[0-9]{9}$/u).test(value)) {
    return `(FIN12)${value.substring(13)}`; // eslint-disable-line functional/immutable-data
  }
  if ((/^\(FI-ASTERI-W\)[0-9]{9}$/u).test(value)) {
    return `(FIN13)${value.substring(13)}`; // eslint-disable-line functional/immutable-data
  }
  return normalizeFIN11(value) || value;
}

/*
function normalizeSubfield0(field) {
  field.subfields.forEach((subfield) => {
    const originalValue = subfield.value;
    if (subfield.code === '0') { // eslint-disable-line functional/no-conditional-statement
      if ((/^\((?:FI-ASTERI-N|FI-MELINDA)\)[0-9]{9}$/u).test(subfield.value)) {
        subfield.value = normalizeSubfield0Value(subfield.value); // eslint-disable-line functional/immutable-data
      }
      // TODO: isni to https form
      if (subfield.value !== originalValue) { // eslint-disable-line functional/no-conditional-statement
        debug(`Update ${field.tag}$${subfield.code} : '${originalValue}' => '${subfield.value}'`);
      }
    }
  });
}
*/

export function preprocessForBaseAndSource(field) {
  if (!field.subfields) {
    return;
  }
  // Not sure whether we actually want any of these here... However, this is still a good place for something...
  // Eg. umlaut normalizations...

  datesAssociatedWithName(field); // remove $d (1)
  //normalizeSubfield0(field);
}

export function cloneAndPreprocessField(originalField, record) {
  // source-only preprocessing:
  const field = cloneField(originalField);

  convertOriginalToModifyingAgency(field); // 040$a => $040$d
  mainEntryToAddedEntry(field); // 1XX => 7XX
  reindexSubfield6s(field, record); // field's $6 values start from record's max $6 value + 1
  // shared stuff:
  preprocessForBaseAndSource(field);

  return field;
}


