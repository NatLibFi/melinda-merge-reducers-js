import {expect} from 'chai';
import {MarcRecord} from '@natlibfi/marc-record';
import createReducer from './genericDatafield';
import {READERS} from '@natlibfi/fixura';
import generateTests from '@natlibfi/fixugen';
//import createDebugLogger from 'debug';

generateTests({
  callback,
  path: [__dirname, '..', '..', 'test-fixtures', 'reducers', 'controlSubfields'],
  recurse: false,
  useMetadataFile: true,
  fixura: {
    failWhenNotFound: false,
    reader: READERS.JSON
  }
});

function callback({getFixture}) {
  const base = new MarcRecord(getFixture('base.json'), {subfieldValues: false});
  const source = new MarcRecord(getFixture('source.json'), {subfieldValues: false});
  const expectedRecord = getFixture('merged.json');
  const mergedRecord = createReducer()(base, source);
  expect(mergedRecord.toObject()).to.eql(expectedRecord);
}
