//import createDebugLogger from 'debug';

import {
  tagToRegexp,
  mergeOrAddField
} from './mergeField.js';


import {
  preprocessForBaseAndSource,
  postprocessRecord
} from './mergePreAndPostprocess.js';

import {fieldToString} from './utils.js';
import createDebugLogger from 'debug';

const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');

/* What about Kirjavälitys exceptions?
*
*
*/

// Array of datafields *that are handled by the generic code*!
// Hmm... This list is incomplete. How to handle 6XX etc?


// Non-repeatables: 010, 018, 044, 049, 243, 254, 263, 306, 357, 507 514, 841, 882
// '027 030 031 043 085 088 222 247 310', // is repeatable but listed in copyIfMissing. Why?

const datafieldString = '010 013 015 016 017 018 020 022 024 025 026 027 028 030 031 032 033 034 035 036 037 038 039 040 041 042 043 044 045 046 047 048 049 ' +
  '050 051 052 055 060 061 066 070 080 082 083 084 085 086 088 ' +
  '100 110 111 130 ' +
  '210 222 240 242 243 245 246 247 ' +
  '250 251 254 255 256 257 258 260 263 264 270 ' +
  '300 306 307 310 321 335 336 337 338 340 341 342 343 344 345 346 347 348 351 352 355 357 362 363 365 366 370 377 380 381 382 383 384 385 386 388 ' +
  '490 ' +
  '500 501 502 504 505 506 507 508 509 510 511 513 514 515 516 518 520 521 522 524 525 526 530 532 533 534 535 ' +
  '536 538 540 541 542 544 545 546 547 550 552 555 556 561 562 563 565 567 580 581 583 584 585 586 588 ' +
  '590 591 592 593 594 595 596 597 598 599 ' + // How about these?
  '600 610 611 630 647 648 650 651 653 654 655 656 657 658 882 688 ' +
  // NB!  700, 710, 711 and 730 are handled by corresponding 1XX. It's semi-magic.
  '720 740 751 752 753 754 758 ' +
  '760 762 765 767 770 772 773 774 775 776 777 780 785 786 787 ' +
  '800 810 811 830 ' +
  '841 842 843 844 845 850 852 853 854 855 856 863 864 865 866 867 868 876 877 878 880 881 882 883 884 885 886 887 ' +
  '900 910 911 935 940 960 973 995 LOW CAT SID';

const datafields = datafieldString.split(' ');

export default () => (record, record2) => {
  record.fields.forEach(field => {
    preprocessForBaseAndSource(field);
  }); // Preprocess input record. Not necessary the best place to do it.
  datafields.forEach(tag => {
    //debug(`CURR TAG: ${tag}...`);
    const tagAsRegexp = tagToRegexp(tag);
    const candidateFields = record2.get(tagAsRegexp); // Get array of source fields
    candidateFields.forEach(candField => {
      debug(`Now processing ${fieldToString(candField)}`);
      mergeOrAddField(record, candField);
    });
  });
  postprocessRecord(record);
  return record;
};


