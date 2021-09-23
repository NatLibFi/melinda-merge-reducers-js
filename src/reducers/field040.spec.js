import chai from 'chai';
import fs from 'fs';
import path from 'path';
import {MarcRecord} from '@natlibfi/marc-record';
//import createReducer from './field040';
import createReducer from './genericDatafield';
import fixturesFactory, {READERS} from '@natlibfi/fixura';
//import createDebugLogger from 'debug';

/**
  * Test 18: base: no 040, format: has 040
  *
  * Test 19:     $a FI-Hhu38 $e rda $d FI-Em
  *          vs: $a FI-Hc $b fin $e jotain $d FI-Hhant $x noise
  *           =  $a FI-Hhu38 $b fin $e rda $e jotain $d FI-Em $d FI-Hc $FI-Hhant
  *
  */
MarcRecord.setValidationOptions({subfieldValues: false});

describe('reducers/field040', () => {
  //const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const {expect} = chai;
  const fixturesPath = path.join(__dirname, '..', '..', 'test-fixtures', 'reducers', 'field040');

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
