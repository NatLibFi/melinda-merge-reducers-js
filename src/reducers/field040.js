import createDebugLogger from 'debug';

import {
  getRepCodes,
  getNonRepCodes,
  getRepSubs,
  getNonRepSubs,
  modifyBaseField,
  sortSubfields
} from './utils.js';

// Test 18: Copy new field from source to base record (case 1)
// Test 19: Copy subfields from source field to base field (case 2)

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const fieldTag = /^040$/u; // Tag in regexp format (for use in MarcRecord functions)
  const tagString = fieldTag.source.slice(1, 4); // Tag number as string
  const baseFields = base.get(fieldTag); // Get array of base fields
  const sourceFields = source.get(fieldTag); // Get array of source fields
  debug(`sourceFields: ${JSON.stringify(sourceFields, undefined, 2)}`);

  // Get arrays of repeatable and non-repeatable subfield codes from melindaCustomMergeFields.json
  const repCodes = getRepCodes(tagString);
  const nonRepCodes = getNonRepCodes(tagString);

  // Since 040 is a non-repeatable field, there can be only one instance in both source and base
  // The arrays can be destructured into objects right away
  const [baseField] = baseFields;
  debug(`baseField: ${JSON.stringify(baseField, undefined, 2)}`);
  const [sourceField] = sourceFields;
  debug(`sourceField: ${JSON.stringify(sourceField, undefined, 2)}`);

  // Run the function to get the base record to return
  return field040(base, tagString, baseField, sourceField, repCodes, nonRepCodes);

  function field040(base, tagString, baseField, sourceField, repCodes, nonRepCodes) {
    debug(`Working on field ${tagString}`);

    // In all cases, source $a value is copied to a new $d and $a is removed
    transferSubfieldValue(sourceField, 'a', 'd');
    debug(`sourceField final: ${JSON.stringify(sourceField, undefined, 2)}`);
    debug(`sourceFields final: ${JSON.stringify(sourceFields, undefined, 2)}`);

    // Transfer the value of one subfield to another
    // For 040: transfer source $a value to $d to prepare for copying to Melinda
    function transferSubfieldValue(field, origSub, targetSub) {
      // Get string value of original subfield
      const transferredValue = String(field.subfields
        .filter(sub => sub.code === origSub)
        .map(sub => sub.value));
      // Add new target subfield instance with value transferred from original subfield
      /* eslint-disable functional/immutable-data */
      field.subfields.push({code: targetSub, value: transferredValue});
      // Remove old original subfield completely (filter to new array without it) and sort subfields
      const newSubfields = sortSubfields(field.subfields.filter(subfield => subfield.code !== origSub));
      // Replace subfields with new array
      /* eslint-disable functional/immutable-data */
      field.subfields = newSubfields;
    }

    // Case 1: If field 040 is missing completely from Melinda, copy it from source as a new field
    if (baseFields.length === 0) {
      debug(`Missing field ${tagString} copied from source to Melinda`);
      sourceFields.forEach(f => base.insertField(f));
      return base;
    }

    // Case 2: If field 040 exists in Melinda, copy missing subfields from source

    // Copy other subfields from source field to base field
    // For non-repeatable subfields, the value existing in base (Melinda) is preferred
    // Non-repeatable subfields are copied from source only if missing completely in base
    // 040: $a, $b, $c, $8
    const nonRepSubsToCopy = getNonRepSubs(sourceField, nonRepCodes);
    debug(`nonRepSubsToCopy: ${JSON.stringify(nonRepSubsToCopy, undefined, 2)}`);

    // Repeatable subfields are copied if the value is different
    // 040: $d, $e, $8
    const repSubsToCopy = getRepSubs(baseField, sourceField, repCodes);
    //debug(`repSubsToCopy: ${JSON.stringify(repSubsToCopy, undefined, 2)}`);

    // Create modified base field and replace old base record in Melinda with it (exception to general rule of data immutability)
    // Subfields in the modified base field are arranged by default in alphabetical order (a-z, 0-9)
    // To use a different sorting order, set it as the second parameter in sortSubfields
    // Example 1: copy subfield sort order from source field
    // const orderFromSource = sourceField.subfields.map(subfield => subfield.code);
    // Example 2: Custom sort order for field 040
    // const sort040 = ['a', 'b', 'c', 'e', 'd', '6', '8'];

    const modifiedBaseField = JSON.parse(JSON.stringify(baseField));
    const sortedSubfields = sortSubfields([...baseField.subfields, ...nonRepSubsToCopy, ...repSubsToCopy]);
    /* eslint-disable functional/immutable-data */
    modifiedBaseField.subfields = sortedSubfields;
    modifyBaseField(base, baseField, modifiedBaseField);
    debug(`Base after modification: ${JSON.stringify(base, undefined, 2)}`);
    return base; // Base record returned in case 2
  }
};
