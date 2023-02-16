import fs from 'fs';
import path from 'path';
//import {MarcRecord} from '@natlibfi/marc-record';
import {/*fieldRenameSubfieldCodes, fieldToString,*/ nvdebug /*recordReplaceField, stringToRegex*/} from './utils.js';
import {filterOperations} from './processFilter.js';
import {removeDuplicateDatafields} from './removeIdenticalDataFields';

import {recordNormalizeIndicators} from '@natlibfi/marc-record-validators-melinda/dist/indicator-fixes';
import {deleteAllPrepublicationNotesFromField500InNonPubRecord, removeWorsePrepubField500s, removeWorsePrepubField594s} from './prepublicationUtils.js';
//import {mergeLisapainokset} from './mergeField500Lisapainokset.js';
import {mergeLisapainokset} from '@natlibfi/marc-record-validators-melinda/dist/mergeField500Lisapainokset';
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

  recordNormalizeIndicators(base); // Fix 245 and non-filing indicators
  mergeLisapainokset(base);
  removeDuplicateDatafields(base);
  return {base, source};
};

