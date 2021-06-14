// import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';

import {
  controlSubfieldsPermitMerge,
  fieldHasSubfield,
  fieldIsRepeatable,
  fieldToString,
  normalizeStringValue
} from './utils.js';

import {
  getCounterpart,
  mergeField
} from './mergeField.js';

import {
  mergeSubfield
} from './mergeSubfield.js';


// Specs: https://workgroups.helsinki.fi/x/K1ohCw
// Field 240 is handled independently before this.

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
// All fields used for main entry, 1XX and 240 are unrepeatable
const fieldTag = /^(?:100|110|111|130|700|710|711|730)$/u; // Tag in regexp format (for use in MarcRecord functions)


// Test 01: Same 100 in both source and base => do not copy
// Test 02: Base has 100, source has 100 with more subfields => copy additional subfields to base 100
// Test 03: Base has 100, source has 110 => copy source 110 as 710 to base
// Test 04: Base has no 1XX/7XX, source has 110 => copy source 110 as 710 to base
// Test 05: Base has 100 and 710, source has same 110 as base 710 => do not copy
// Test 06: Base has 100 and 710, source has 110 with more subfields => copy additional subfields to base 710
// ### tästä eteenpäin ei tehty valmiiksi
// Test 07: Combine fx00 with and without $0
// Test 08: Combine identical fx00
// Test 09: Combine fx00 with identical static name subfields, $d missing from base (Punctuation change)
// Test 10: Combine fx00 with identical static name subfields, $d missing from source (Punctuation change)
// Test 11: Combine fx00 with differing $e (Punctuation change)
// Test 12: Combine fx00 with missing $e (Punctuation change)
// Test 13: Combine fx00 with missing $e, multiple $e  (Punctuation change)
// Test 14: Combine fx00 with $d missing year of death in base
// Test 15: Combine fx00 with $d missing year of death in source
// Test 16: Combine fx00 with $d missing year of death in base

/*
  // ### Keskeneräinen


  // 100/110/111/130 -kenttiä käsitellään ryhmänä niin, että ryhmä otetaan basesta.
  // Jos basessa ei ole 1xx-kenttää, mitään 1xx-kenttää ei myöskään tuoda siihen,
  // tässä tapauksessa sourcen 1xx-kenttä tuodaan baseen
  // vastaavaksi 7xx-sarjan kentäksi. (100→700, 110→710, 111→711, 130→730).
  // Samoin jos sourcessa on 'eri' 1xx-kenttä kuin basessa,
  // sourcen 1xx-kenttä tuodaan baseen vastaavaksi 7xx-sarjan kentäksi.
  // Näissä vielä toki sitten se, että jos basessa on jo 'sama' 7xx-kenttä, kentät pitää yhdistää.

  // 100/110/111/130 ovat toisensa poissulkevia, eli tietueessa voi olla vain yksi näistä kerrallaan
  // Tietueessa voi olla 700/710/711/730-kenttiä silloinkin, jos siinä EI ole mitään 100/110/111/130-kenttiä
*/

function subfieldsAreEqualish(sf1, sf2) {
  return sf1.code === sf2.code && normalizeStringValue(sf1.value) === normalizeStringValue(sf2.value);
}

function equalishSubfieldExists(field, candSubfield) {
  return field.subfields.some(sf => subfieldsAreEqualish(sf, candSubfield));
}


function acceptEntrySubfieldA(field, candSubfield) {
  if (equalishSubfieldExists(field, candSubfield)) {
    return true;
  }
  debug(`Subfield ‡a check failed: '${candSubfield.value}' vs '${fieldToString(field)}'.`);
  return false;
}

const birthYearRegexp = /^(?<by>[1-9][0-9]*)-(?:[1-9][0-9]*)?(?:[^0-9]*)$/u;
function subfieldDToBirthYear(content) {
  const min = 1000;
  const max = 2021;
  const result = birthYearRegexp.exec(content);
  if (result && min <= result.groups.by && result.groups.by <= max) {
    return result.groups.by;
  }
  return -1;
}

const deathYearRegexp = /^(?:[1-9][0-9]*)-(?<dy>[1-9][0-9]*)(?:[^0-9]*)$/u;
function subfieldDToDeathYear(content) {
  const min = 1000;
  const max = 2029; // This should be dynamic value. Current year etc.
  const result = deathYearRegexp.exec(content);
  if (result && min <= result.groups.dy && result.groups.dy <= max) {
    return result.groups.dy;
  }
  return -1;
}

function birthYearsAgree(sf1, sf2) {
  const b1 = subfieldDToBirthYear(sf1.value);
  const b2 = subfieldDToBirthYear(sf2.value);
  return b1 !== -1 && b1 === b2; // We want a proper birth year. Period. Everything else is too noisy to handle.
}

function deathYearsAgree(sf1, sf2) {
  const b1 = subfieldDToDeathYear(sf1.value);
  const b2 = subfieldDToDeathYear(sf2.value);
  if (b1 === -1 || b2 === -1) {
    return true;
  }
  return b1 === b2;
}

const legalX00d = /^[1-9][0-9]*-(?:[1-9][0-9]*)?[,.]?$/u;

function acceptEntrySubfieldD(field, candSubfield) {
  if (field.tag !== '100' && field.tag !== '700') {
    debug(`NB! Subfield ‡d is currently only checked for X00 fields.`);
    return true; // We are currently interested only in X00
  }
  const relevantSubfields = field.subfields.filter(subfield => subfield.code === 'd');

  if (relevantSubfields.length > 1) {
    return false;
  } // Cannot accept as field is crappy
  if (relevantSubfields.length === 0 || subfieldsAreEqualish(relevantSubfields[0], candSubfield)) {
    return true;
  }
  if (!legalX00d.test(candSubfield.value)) {
    debug(`D-FAIL ${candSubfield.value}`);
    return false;
  }
  return legalX00d.test(candSubfield.value) && legalX00d.test(relevantSubfields[0].value) &&
    birthYearsAgree(relevantSubfields[0], candSubfield) && deathYearsAgree(relevantSubfields[0], candSubfield);
}

function acceptEntrySubfield(field, candSubfield, index) { // Accept X00 and X10 equality
  // semantic check
  if (candSubfield.code === 'a') {
    return acceptEntrySubfieldA(field, candSubfield);
  }

  if (candSubfield.code === 'd') {
    return acceptEntrySubfieldD(field, candSubfield);
  }

  debug(`Accepted entry subfield ‡${candSubfield.code} without checking it.`);
  return true;
}

//// Everything below this point should be fine...

function insertField7XX(record, field) {
  const newField = JSON.parse(JSON.stringify(field));
  // Convert 1XX field to 7XX field (7XX field stays the same):
  newField.tag = `7${newField.tag.substring(1)}`; // eslint-disable-line functional/immutable-data
  record.insertField(newField);
  debug(`case 1: add "${fieldToString(newField)}" (source was 1XX)`);
  return record;
}

function mergeOrAddField(record, field) {
  const counterpartField = getCounterpart(record, field);
  if (counterpartField) {
    debug(`Got counterpart: '${fieldToString(counterpartField)}'`);
    mergeField(record, counterpartField, field);
    return record;
  }
  // NB! Counterpartless field is inserted to 7XX even if field.tag says 1XX:
  debug(`No counterpart found for '${fieldToString(field)}'. Adding it to 7XX.`);
  return insertField7XX(record, field);
}


export default () => (record, record2) => {
  const candidateFields = record2.get(fieldTag); // Get array of source fields
  candidateFields.forEach(candField => mergeOrAddField(record, candField));
  return record;
};
