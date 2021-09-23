/**
*
* @licstart  The following is the entire license notice for the JavaScript code in this file.
*
* Generic MARC record merge reducers for use with marc-record-merge
*
* Copyright (C) 2021 University Of Helsinki (The National Library Of Finland)
*
* This file is part of melinda-marc-record-merge-reducers-js
*
* melinda-marc-record-merge-reducers-js program is free software: you can redistribute it and/or modify
* it under the terms of the GNU Lesser General Public License as
* published by the Free Software Foundation, either version 3 of the
* License, or (at your option) any later version.
*
* melinda-marc-record-merge-reducers-js is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU Lesser General Public License for more details.
*
* You should have received a copy of the GNU Affero General Public License
* along with this program.  If not, see <http://www.gnu.org/licenses/>.
*
* @licend  The above is the entire license notice
* for the JavaScript code in this file.
*
*/

/* eslint-disable new-cap */
import validateFactory from '@natlibfi/marc-record-validate';
//import validateFactoryPunctuation from '@natlibfi/marc-record-validators-melinda/src/punctuation/';
import {
  //FieldExclusion,
  //FieldStructure,
  FieldsPresent,
  Punctuation
  //EmptyFields,
  //EndingPunctuation
  //IsbnIssn,
  //SubfieldExclusion
} from '@natlibfi/marc-record-validators-melinda';
import createDebugLogger from 'debug';

// ### Kopioitu täältä: https://github.com/NatLibFi/melinda-record-import-transformer-helmet
// ### Muokkaa vielä oikeat validaattorit mergeä varten
export default async () => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  debug(`### testing`);
  const validate = validateFactory([
    await FieldsPresent([/^100$/u]),
    await Punctuation()
    //await EndingPunctuation()
    //await FieldsPresent([/^(100|110|111|130|700|710|711|730)$/]),
    //await FieldsPresent([/^336$/, /^337$/, /^338$/]),
    /*
    await FieldExclusion([
    /^(001|091|092|093|094|095|256|533|574|575|576|577|578|599)$/,
    {tag: /^264$/, subfields: [{code: /^a$/, value: /^\[.*\]$/}]},
    {tag: /^650$/, subfields: [{code: /^a$/, value: /^overdrive$/i}]},
    {tag: /^(648|650|651|655)$/, subfields: [{code: /^2$/, value: /^(ysa|musa|allars|cilla)$/}]},
    {tag: /^041$/, dependencies: [{leader: /^.{6}[g|i]/}]}
    ]),
    await EmptyFields(),
    await IsbnIssn({hyphenateISBN: true}),
    await SubfieldExclusion([{tag: /^041$/, subfields: [{code: /a|d/, value: /^zxx$/}]}]),
    await FieldStructure([{tag: /^007$/, dependencies: [{leader: /^.{6}[^at]/}]}]),
    await EndingPunctuation() */
  ]);
  //  const validatePunctuation = await validateFactoryPunctuation();

  return async (record, fix, validateFixes) => {
    const opts = fix ? {fix, validateFixes} : {fix};
    const result = await validate(record, opts);
    //const result = await validatePunctuation(prevalidated.record, opts);
    return {
      record: result.record,
      failed: result.valid === false,
      messages: result.report
    };
  };
};
