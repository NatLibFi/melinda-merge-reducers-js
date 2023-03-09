import fs from 'fs';
import path from 'path';

import {nvdebug} from './utils.js';
import {filterOperations} from './processFilter.js';
import {removeDuplicateDatafields} from './removeIdenticalDataFields';

import {recordNormalizeIndicators} from '@natlibfi/marc-record-validators-melinda/dist/indicator-fixes';
import {deleteAllPrepublicationNotesFromField500InNonPubRecord, removeWorsePrepubField500s, removeWorsePrepubField594s} from './prepublicationUtils.js';
import {mergeLisapainokset} from '@natlibfi/marc-record-validators-melinda/dist/mergeField500Lisapainokset';
import {recordResetSubfield6OccurrenceNumbers} from '@natlibfi/marc-record-validators-melinda/dist/reindexSubfield6OccurenceNumbers';

const defaultConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'reducers', 'config.json'), 'utf8'));

export default (config = defaultConfig) => (base, source) => {
  nvdebug('ENTERING postprocessor.js');

  //nvdebug(JSON.stringify(base));
  //nvdebug(JSON.stringify(source));

  //nvdebug(JSON.stringify(config.postprocessorDirectives));
  //const baseRecord = new MarcRecord(base, {subfieldValues: false});
  //nvdebug(`HSP CONF ${config}`);
  filterOperations(base, source, config.postprocessorDirectives); // declared in preprocessor

  deleteAllPrepublicationNotesFromField500InNonPubRecord(base);
  removeWorsePrepubField500s(base);
  removeWorsePrepubField594s(base);
  //base.fields.forEach(field => nvdebug(`WP5: ${fieldToString(field)}`));

  recordNormalizeIndicators(base); // Fix 245 and non-filing indicators
  //base.fields.forEach(field => nvdebug(`WP6: ${fieldToString(field)}`));

  mergeLisapainokset(base);
  //base.fields.forEach(field => nvdebug(`WP7: ${fieldToString(field)}`));


  removeDuplicateDatafields(base);
  recordResetSubfield6OccurrenceNumbers(base);
  return {base, source};
};

