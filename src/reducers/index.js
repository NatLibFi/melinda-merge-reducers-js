//import createDebugLogger from 'debug';
import internalFields from './internalFields';
import leader from './leader';
import field006 from './field006';
import field007 from './field007';
import field008 from './field008';
//import field995 from './field995';
import genericDatafield from './genericDatafield';

// const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

// ### Keskeneräinen
// ### Sariannan testicommit: toimiiko uusi token? Tämän rivin saa poistaa.

// Processing rules for MARC fields by field tag
// Copy duplicate instance of non-identical field from source to base
// Added field 995 to the list / 25.5.2021
/* eslint-disable require-unicode-regexp */
const copyIfDifferent = new RegExp(String((/^(?<tags1>013|015|016|017|028|035|050|052|055|060|070|080|082|083|084|210|242|246|250|255|258|321)$/u).source) +
  (/^(?<tags2>336|337|338|340|341|342|343|344|346|347|348|351|352|355|362|363|365|366|370|377)$/u).source +
  (/^(?<tags3>380|381|382|383|385|386|388|490|500|501|502|504|505|506|508|509|510|511|513|515|518)$/u).source +
  (/^(?<tags4>520|521|522|524|525|530|534|535|536|538|540|541|542|544|545|546|547|550|552|555)$/u).source +
  (/^(?<tags5>556|561|562|563|565|567|580|581|584|585|586|720|740|751|752|753|754|758|760)$/u).source +
  (/^(?<tags6>762|765|767|770|772|775|776|777|780|785|786|787|856|883|886|887|900|910|911|940|995)$/u).source);

// Copy field from source only if missing from base (compareTagsOnly = true)
const copyIfMissing = /^(?<tags>010|018|027|030|031|043|044|049|085|088|222|243|247|260|263|264|306|310|357|384|507|514)$/u;

// Special rules defined for certain sets of fields
// Exclude subfields from identicalness comparison and/or drop subfields from source before copying
// Fields are considered identical if all other subfields than excludeSubfields are identical
const copySpecial1 = /^(?<tags>036)$/u; // Exclude subfields b, 6 and 8
const copySpecial2 = /^(?<tags>648|653|655|656|657)$/u; // Exclude subfield 9
const copySpecial3 = /^(?<tags>800|810|811)$/u; // Drop subfield 4
const copySpecial4 = /^(?<tags>600|610|611|630|650|651|654|662)$/u; // Exclude subfield 9 and drop 4

// Customized reducers still to be done for fields:
// mainEntry: 100|110|111|130|700|710|711|730

// Huom. tarkistettava missä järjestyksessä reducerit ajetaan
// Ensin ajetaan ne joiden tuottama tulos vaikuttaa siihen mitä joillekin toisille kentille tehdään
// eslint-disable-next-line
const allReducers = [
  internalFields(), // LOW, CAT, SID
  leader(), // Test 01
  field006(), // Tests 02 and 03
  field007(), // Tests 04 and 05
  field008(), // Tests 06, 07, and 08
  genericDatafield() // Import tests?

];

export const localCopyReducerConfigs = [
  {tagPattern: copyIfDifferent},
  {tagPattern: copyIfMissing, compareTagsOnly: true},
  {tagPattern: copySpecial1, excludeSubfields: ['b', '6', '8']},
  {tagPattern: copySpecial2, excludeSubfields: ['9']},
  {tagPattern: copySpecial3, dropSubfields: ['4']},
  {tagPattern: copySpecial4, excludeSubfields: ['9'], dropSubfields: ['4']}
];

export const localReducers = [
  //internalFields(), // LOW, CAT, SID
  leader(), // Test 01
  field006(), // Tests 02 and 03
  field007(), // Tests 04 and 05
  field008(), // Tests 06, 07, and 08
  genericDatafield()

];
