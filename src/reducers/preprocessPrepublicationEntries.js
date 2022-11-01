import {getCounterpart} from './counterpartField';
import {encodingLevelIsBetterThanPrepublication, getEncodingLevel, isEnnakkotietoField} from './prepublicationUtils';
import {nvdebugFieldArray} from './utils';

export function handlePrepublicationNameEntries(base, source) {
  const baseEncodingLevel = getEncodingLevel(base);
  if (!encodingLevelIsBetterThanPrepublication(baseEncodingLevel)) {
    // NB! Name entry fields can be merged or added to base later on. They just don't need preprocessing.
    return;
  }

  const fields = getNameEntries(source);
  if (fields.length === 0) {
    return;
  }

  const removableFields = fields.filter(field => !keepEntryField(base, field));
  nvdebugFieldArray(removableFields, 'remove source entry field');
  removableFields.forEach(field => source.removeField(field));
}

function getNameEntries(record) {
  const allNameEntries = record.get(/^(?:100|110|111|700|710|711)$/u);
  return allNameEntries.filter(field => isEnnakkotietoField(field));
}

function hasIsni(field) {
  return field.subfields.some(sf => sf.code === '0' && sf.value.includes('isni'));
}

function keepEntryField(base, sourceField) {
  return hasIsni(sourceField) || getCounterpart(base, sourceField, {});
}
