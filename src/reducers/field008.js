import createDebugLogger from 'debug';
import {getNonIdenticalFields, recordReplaceField} from './utils.js';

// base record level codes from highest (1) to lowest (10)
// levelValue = value of 000/17
// levelCode 1 is given if the value is either empty ' ' (space) or '^', depending on where the record comes from
/*
const levelCodes = [
  {levelCode: 1, levelValue: ' '},
  {levelCode: 1, levelValue: '^'},
  {levelCode: 2, levelValue: '4'},
  {levelCode: 3, levelValue: '1'},
  {levelCode: 4, levelValue: '5'},
  {levelCode: 5, levelValue: '7'},
  {levelCode: 6, levelValue: '2'},
  {levelCode: 7, levelValue: '3'},
  {levelCode: 8, levelValue: '8'},
  {levelCode: 9, levelValue: 'u'},
  {levelCode: 10, levelValue: 'z'}
];
*/

const ldr17ToLevelCode = {' ': 1, '^': 1, '4': 2, '1': 3, '5': 4, '7': 5, '2': 6, '3': 7, '8': 8, 'u': 9, 'z': 10};

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
const regexp008 = /^008$/u;

function getLevelCode(record) {
  const ldr17 = record.leader.charAt(17); //record.leader[17];
  if (ldr17 in ldr17ToLevelCode) {
    const lc = ldr17ToLevelCode[ldr17];
    debug(`Level code is ${lc}`);
    return lc;
  }
  debug(`LEVEL CODE '${ldr17}' NOT FOUND. USING DEFAULT VALUE 10.`);
  return 10;
  //return levelCodes.filter(level => level.levelValue === record.leader[17])[0].levelCode;
}

function yearLanguageAndCountryAgree(field1, field2) {
  // First check that these character positions are the same in source and base:
  // 008/07-10 (year of publication), 008/15-17 (country), 008/35-37 (language)
  // Then select the 008 field from the record with the higher base level code
  const basePubYear = field1.value.slice(7, 11);
  const baseLanguage = field1.value.slice(35, 38);
  const baseCountry = field1.value.slice(15, 18);
  const sourcePubYear = field2.value.slice(7, 11);
  const sourceCountry = field2.value.slice(15, 18);
  const sourceLanguage = field2.value.slice(35, 38);
  return basePubYear === sourcePubYear && baseCountry === sourceCountry && baseLanguage === sourceLanguage;
}

function requiresModification(originalRecord, alternativeRecord) {
  if (getLevelCode(originalRecord) <= getLevelCode(alternativeRecord)) { // smaller is better!
    // The original version is better or as good as the alternative version.
    return false;
  }
  const baseFields = originalRecord.get(regexp008);
  const sourceFields = alternativeRecord.get(regexp008);

  const nonIdenticalFields = getNonIdenticalFields(baseFields, sourceFields);

  if (nonIdenticalFields.length === 0 || sourceFields.length === 0) {
    // debug('Identical fields in source and base');
    return false;
  }
  if (baseFields.length === 0) {
    return true;
  }
  // Field 008 is (or at least it should be) non-repeatable. Examine only the 1st elements:
  return yearLanguageAndCountryAgree(baseFields[0], sourceFields[0]);
}

export default () => (base, source) => {
  if (requiresModification(base, source)) {
    const baseFields = base.get(regexp008);
    const sourceFields = source.get(regexp008);
    // Test 06: If the level code of the source record is better (smaller number)
    // Replace base field 008 with field 008 from source
    debug(`Replacing base field ${baseFields[0].tag}`);
    // Field 008 is non-repeatable. This [0] is/should be a safe approach:
    return recordReplaceField(base, baseFields[0], sourceFields[0]);
  }
  // Test 07: If the level code of the base record is better or the same, keep existing 008
  // Test 08: If the character positions for year, language and country are not the same, keep existing 008
  debug('Keeping base field 008');
  return base;
};
