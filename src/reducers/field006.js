import createDebugLogger from 'debug';
import {getNonIdenticalFields, copyFields} from './utils.js';

// Test 02: If Leader 000/06 is 'o' or 'p' in source, copy 006 from source to base as new field (2x)
// Test 03: If Leader 000/06 is something else, do nothing

// NV: Moved these of the arrow function
const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
const regexp006 = /^006$/u;

export default () => (base, source) => {
  // No action required, always keep base (do this first as we save, uh, like 0.01 ms by not doing unnecessary stuff):
  if (source.leader[6] !== 'o' && source.leader[6] !== 'p') {
    debug('Keeping base field 006');
    return base;
  }

  const baseFields = base.get(regexp006);
  const sourceFields = source.get(regexp006);
  const nonIdenticalFields = getNonIdenticalFields(baseFields, sourceFields);

  if (nonIdenticalFields.length === 0) {
    debug('Identical fields in source and base');
    return base;
  }

  return copyFields(base, nonIdenticalFields);
};
