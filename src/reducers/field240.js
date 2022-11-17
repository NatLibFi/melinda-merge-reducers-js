// NB! I have (apparently) downgraded this to an example file, since this can be handled by the generic code.
// There relevant stuff has been copied to config.json, and everything works fine even without this.

//import {MarcRecord} from '@natlibfi/marc-record';
import createDebugLogger from 'debug';
import {fieldToString, nvdebug} from './utils';
import {mergeField} from './mergeField';

import {MarcRecord} from '@natlibfi/marc-record';
import {default as normalizeEncoding} from '@natlibfi/marc-record-validators-melinda/dist/normalize-utf8-diacritics';

import {postprocessRecords} from './mergeOrAddPostprocess.js';
import {preprocessBeforeAdd} from './processFilter.js';
import {addField} from './addField';

// This reducer will take all 240 fields from source record, and then either merge them with host,
// copy them or ignore/skip/drop them.
//
// Specs: https://workgroups.helsinki.fi/x/K1ohCw (though we occasionally differ from them)...

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers:field240');

// Should this load default configuration?
export default () => (base, source) => {

  const baseRecord = new MarcRecord(base, {subfieldValues: false});
  const sourceRecord = new MarcRecord(source, {subfieldValues: false});


  // This condition allow merging of base's field 240 with source's field 240, but before add-stage,
  // rule remove's source field 240 if base has either 130 and 240. (The latter is irrelevant, since
  // marc21 specs prevents copying of a non-repeatable field 240. However, we have it here, as for educational
  // reasons + specs wanted this functionality.)
  const config = {'config': {'tagPattern': '^240$',
    'addConfiguration': {
      'preprocessorDirectives': [
        {
          'operation': 'removeField',
          'comment': 'this should be done after field merge and before copy (could be merged, but not added)',
          'recordType': 'source',
          'fieldSpecification': {
            'tag': '240'
          },
          'requireBaseField': {
            'tagPattern': '^(130|240)$'
          }
        }
      ]
    }}};

  // We should clone the records here and just here...
  //recordPreprocess(baseRecord); // fix composition et al
  //recordPreprocess(sourceRecord); // fix composition et al
  normalizeEncoding().fix(baseRecord);
  normalizeEncoding().fix(sourceRecord);

  const activeTagPattern = /^240$/u;
  nvdebug(`MERGE CONFIG: ${JSON.stringify(config)}`);
  preprocessBeforeAdd(baseRecord, sourceRecord, config.preprocessorDirectives);

  const candidateFields = sourceRecord.get(activeTagPattern);

  candidateFields.forEach(candField => {
    nvdebug(`Now merging (or trying to) field ${fieldToString(candField)}`, debug);
    if (!mergeField(baseRecord, candField, config)) {
      addField(baseRecord, candField, config);
      return;
    }
  });

  // Remove deleted fields and field.merged marks:
  postprocessRecords(baseRecord, sourceRecord);

  return {base: baseRecord, source: sourceRecord};
  //return {baseRecord2, sourceRecord2};

};
