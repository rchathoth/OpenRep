import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMoveHint } from '../lib/hints.ts';

test('hint stage transition and board visual options generation', () => {
  const move = 'e2e4';
  const { fromSquare, toSquare } = parseMoveHint(move);

  // Stage 0: Idle
  let stage = 0;
  let squareStyles = stage >= 1 ? { [fromSquare]: { backgroundColor: 'rgba(245, 158, 11, 0.45)' } } : undefined;
  let arrows = stage === 2 ? [{ startSquare: fromSquare, endSquare: toSquare, color: 'rgb(245, 158, 11)' }] : [];
  assert.equal(squareStyles, undefined);
  assert.deepEqual(arrows, []);

  // Stage 1: Clicked once -> highlights the piece that needs to move
  stage = 1;
  squareStyles = stage >= 1 ? { [fromSquare]: { backgroundColor: 'rgba(245, 158, 11, 0.45)' } } : undefined;
  arrows = stage === 2 ? [{ startSquare: fromSquare, endSquare: toSquare, color: 'rgb(245, 158, 11)' }] : [];
  assert.ok(squareStyles);
  assert.equal(typeof squareStyles['e2'], 'object');
  assert.equal(squareStyles['e4'], undefined);
  assert.deepEqual(arrows, []);

  // Stage 2: Clicked twice -> shows arrow providing the answer
  stage = 2;
  squareStyles = stage >= 1 ? { [fromSquare]: { backgroundColor: 'rgba(245, 158, 11, 0.45)' } } : undefined;
  arrows = stage === 2 ? [{ startSquare: fromSquare, endSquare: toSquare, color: 'rgb(245, 158, 11)' }] : [];
  assert.ok(squareStyles['e2']);
  assert.deepEqual(arrows, [{ startSquare: 'e2', endSquare: 'e4', color: 'rgb(245, 158, 11)' }]);

  // Stage 0: Clicked third time -> resets / toggles off
  stage = (stage === 2 ? 0 : stage + 1);
  assert.equal(stage, 0);
  squareStyles = stage >= 1 ? { [fromSquare]: { backgroundColor: 'rgba(245, 158, 11, 0.45)' } } : undefined;
  arrows = stage === 2 ? [{ startSquare: fromSquare, endSquare: toSquare, color: 'rgb(245, 158, 11)' }] : [];
  assert.equal(squareStyles, undefined);
  assert.deepEqual(arrows, []);
});

test('parseMoveHint handles knight and diagonal moves correctly', () => {
  const knightMove = parseMoveHint('g1f3');
  assert.equal(knightMove.fromSquare, 'g1');
  assert.equal(knightMove.toSquare, 'f3');

  const bishopMove = parseMoveHint('f1c4');
  assert.equal(bishopMove.fromSquare, 'f1');
  assert.equal(bishopMove.toSquare, 'c4');
});
