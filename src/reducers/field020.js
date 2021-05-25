import createDebugLogger from 'debug';

import {
  checkIdenticalness,
  compareAllSubfields,
  getRepSubs,
  getNonRepSubs,
  sortSubfields,
  makeNewBaseField
} from './utils.js';

// Test 09: Copy new field from source to base record (case 1) (2x)
// Test 10: Copy subfields from source field to base field (case 2)
// Also in test 10: $8 only in base, not source, but seems to carry over into merged?
// Test 11: Both cases in the same record: copy a new field (case 1) and add subfields to an existing field (case 2)

const fieldTag = /^020$/u; // Tag in regexp format (for use in MarcRecord functions)
const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

// Define repeatable and non-repeatable subfield codes
const repCodes = ['q', 'z', '8'];
const nonRepCodes = ['a', 'c', '6'];

function mergeField020(base, baseField, sourceField) {
  debug(`Working on field 020`);
  // First check whether the values of identifying subfields are equal
  const idCodes = ['a'];

  // Case 1: If all identifying subfield values are not equal, the entire source field is copied to base as a new field
  if (compareAllSubfields(baseField, sourceField, idCodes) === false) {
    base.insertField(sourceField);
    idCodes.forEach(code => debug(`Subfield (${code}) not matching, source field copied as new field to base`));
    return base; // Base returned in case 1
  }

  // Case 2: If identifying subfield values are equal, continue with the merge process
  idCodes.forEach(code => debug(`Matching subfield (${code}) found in source and base, continuing with merge`));

  // If there are subfields to drop, define them first
  const dropCodes = ['c'];

  // Copy other subfields from source field to base field
  // For non-repeatable subfields, the value existing in base is preferred
  // Non-repeatable subfields are copied from source only if missing completely in base
  const nonRepSubsToCopy = getNonRepSubs(sourceField, nonRepCodes, dropCodes, idCodes);

  // Repeatable subfields are copied from source to base if the value is different
  const repSubsToCopy = getRepSubs(baseField, sourceField, repCodes, dropCodes, idCodes);

  // Create new base field to replace old one
  // Copy subfield sort order from source field
  const orderFromSource = sourceField.subfields.map(subfield => subfield.code);
  const sortedSubfields = sortSubfields([...baseField.subfields, ...nonRepSubsToCopy, ...repSubsToCopy], orderFromSource);
  return makeNewBaseField(base, baseField, sortedSubfields);
}

export default () => (base, source) => {
  const baseFields = base.get(fieldTag); // Get array of base fields
  const sourceFields = source.get(fieldTag); // Get array of source fields

  const nonIdenticalFields = checkIdenticalness(baseFields, sourceFields);

  if (nonIdenticalFields.length === 0) {
    debug(`Identical fields in source and base`);
    return base;
  }


  if (sourceFields.every(sourceField => baseFields.some(baseField => mergeField020(base, baseField, sourceField, repCodes, nonRepCodes)))) {
    // No filtering needed here since mergeField020 does it in a customized way
    return base;
  }
};
