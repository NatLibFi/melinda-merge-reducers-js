import createDebugLogger from 'debug';

export default () => (base, source) => {
  const debug = createDebugLogger('@natlibfi/melinda-marc-record-merge-reducers');
  const baseFields = base.get(/^LDR$/u);
  const sourceFields = source.get(/^LDR$/u);
  debug(`baseFields: ${JSON.stringify(baseFields, undefined, 2)}`);
  debug(`base.leader: ${base.leader}`);
  debug(`sourceFields: ${JSON.stringify(sourceFields, undefined, 2)}`);
  debug(`source.leader: ${source.leader}`);

  // Test 01: If LDR 000/06 or 07 is different, do not merge
  /* eslint-disable functional/no-conditional-statement */
  if (source.leader[6] !== base.leader[6] || source.leader[7] !== base.leader[7]) {
    throw new Error(`LDR 000/06 or 07 is different in base and source`);
  }
  return base;
};
