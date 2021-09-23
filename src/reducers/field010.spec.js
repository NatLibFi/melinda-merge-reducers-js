import chai from 'chai';
import fs from 'fs';
import path from 'path';
import {MarcRecord} from '@natlibfi/marc-record';
import createReducer from './genericDatafield';
import fixturesFactory, {READERS} from '@natlibfi/fixura';
//import createDebugLogger from 'debug';

MarcRecord.setValidationOptions({subfieldValues: false});

// Tests:
// a: $a is differs, other subfields complement each other (don't merge, don't add)
// b: empty base
// c: $a agrees, orher subfields complement each other (merge)
// d: base and source contain identical field 010.
describe('reducers/field010', () => {
  //const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const {expect} = chai;
  const fixturesPath = path.join(__dirname, '..', '..', 'test-fixtures', 'reducers', 'field010');

  fs.readdirSync(fixturesPath).forEach(subDir => {
    const {getFixture} = fixturesFactory({root: [fixturesPath, subDir], reader: READERS.JSON, failWhenNotFound: false});
    it(subDir, () => {
      const base = new MarcRecord(getFixture('base.json'));
      const source = new MarcRecord(getFixture('source.json'));
      const expectedRecord = getFixture('merged.json');
      const mergedRecord = createReducer()(base, source);
      expect(mergedRecord.toObject()).to.eql(expectedRecord);
    });
  });
});
