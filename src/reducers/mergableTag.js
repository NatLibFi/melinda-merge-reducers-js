//import createDebugLogger from 'debug';
//import {nvdebug} from './utils';
//const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

// Actually I hope that 066. 842-845, 852-855. 863-868, 876-878 and HLI are already removed


const defaultNonMergableFields = [
  '066', // 066 - Character sets present (NR)
  '382', // 382: merging would be madness due to $n position etc...
  // However, this will miss cases, where only $5 or $9 differs...
  // 59X: always copy, never merge. NB! No specs exist!
  '590',
  '591',
  '592',
  '593',
  '594',
  '595',
  '596',
  '597',
  '598',
  '599',
  '654',
  '656',
  '657',
  '658',
  '662',
  '668',
  '752',
  '753',
  '754',
  '758',
  '760',
  '762',
  '765',
  '767',
  '770',
  '772',
  '774',
  '775',
  '776',
  '777',
  '780',
  '785',
  '786',
  '787',
  // Them 8XX fields are holdings related fields:
  '841',
  '842',
  '843',
  '844',
  '845',
  '852',
  '853',
  '854',
  '855',
  '856', // This is mergable but so risky, that let's just ignore these
  '863',
  '864',
  '865',
  '866',
  '867',
  '868',
  '876',
  '877',
  '878',
  '881',
  '882',
  '883',
  '884',
  '885',
  '886',
  '887',
  '900',
  '901',
  '910',
  '940',
  '960',
  '995',
  'CAT',
  'HLI',
  'LOW',
  'SID'
];

export function mergableTag(tag, config) {
  if (config.skipMergeTags && Array.isArray(config.skipMergeTags)) {

    return !config.skipMergeTags.includes(tag);
  }

  return !defaultNonMergableFields.includes(tag);
}
