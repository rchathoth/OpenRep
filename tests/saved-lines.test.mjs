import test from 'node:test';
import assert from 'node:assert/strict';
import { addCompletedLine, readSavedLines, writeSavedLines } from '../lib/saved-lines.ts';

const entry = { id: 'a', name: 'Opening', fen: 'fen', playerSide: 'w', boardOrientation: 'white', completedLines: [] };
test('completed move sequences are unique per saved position', () => {
  const other = { ...entry, id: 'b' };
  const first = addCompletedLine([entry, other], 'a', ['e2e4', 'e7e5']);
  assert.deepEqual(first[0].completedLines, ['e2e4 e7e5']);
  assert.deepEqual(first[1].completedLines, []);
  assert.deepEqual(addCompletedLine(first, 'a', ['e2e4', 'e7e5']), first);
  assert.equal(addCompletedLine(first, 'a', ['e2e4', 'c7c5'])[0].completedLines.length, 2);
  assert.deepEqual(addCompletedLine(first, 'a', []), first);
});
test('storage round trips and rejects malformed saved data', () => {
  let value = null;
  globalThis.localStorage = { getItem: () => value, setItem: (_key, next) => { value = next; } };
  assert.deepEqual(readSavedLines(), []);
  writeSavedLines([entry]);
  assert.deepEqual(readSavedLines(), [entry]);
  value = '{}';
  assert.throws(() => readSavedLines());
});
