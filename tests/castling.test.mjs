import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { availableCastlingRights, positionToFen } from '../lib/position.ts';
import { applyUci, normalizeLegalUci } from '../lib/training.ts';

const position = {
  e1: { pieceType: 'wK' }, a1: { pieceType: 'wR' }, h1: { pieceType: 'wR' },
  e8: { pieceType: 'bK' }, a8: { pieceType: 'bR' }, h8: { pieceType: 'bR' },
};

test('custom setup preserves chosen castling rights and requires the matching home pieces', () => {
  assert.equal(availableCastlingRights(position), 'KQkq');
  assert.equal(positionToFen(position, 'w', 'KQkq'), 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  assert.equal(positionToFen(position, 'b', 'Qk').split(' ')[2], 'Qk');
  assert.equal(positionToFen(position, 'w', '').split(' ')[2], '-');
  const changed = { ...position, h1: { pieceType: 'bR' }, e8: undefined };
  assert.equal(availableCastlingRights(changed), 'Q');
  assert.equal(positionToFen(changed, 'w', 'KQkq').split(' ')[2], 'Q');
});

for (const [side, king, rook, destination, rookDestination, san] of [
  ['w', 'e1', 'h1', 'g1', 'f1', 'O-O'],
  ['w', 'e1', 'a1', 'c1', 'd1', 'O-O-O'],
  ['b', 'e8', 'h8', 'g8', 'f8', 'O-O'],
  ['b', 'e8', 'a8', 'c8', 'd8', 'O-O-O'],
]) {
  test(`${side} ${san} accepts king destination and rook gestures, moves both pieces, and consumes rights`, () => {
    const game = new Chess(positionToFen(position, side, 'KQkq'));
    const before = game.fen();
    for (const to of [destination, rook]) assert.equal(normalizeLegalUci(before, king + to), king + destination);
    assert.equal(game.fen(), before);
    assert.equal(applyUci(game, king + destination).san, san);
    assert.equal(game.get(destination)?.type, 'k');
    assert.equal(game.get(rookDestination)?.type, 'r');
    assert.equal(game.get(king), undefined);
    assert.equal(game.get(rook), undefined);
    assert.equal(game.fen().split(' ')[2], side === 'w' ? 'kq' : 'KQ');
  });
}

for (const [label, fen, move] of [
  ['no rights', '4k3/8/8/8/8/8/8/4K2R w - - 0 1', 'e1g1'],
  ['blocked kingside', '4k3/8/8/8/8/8/8/4KB1R w K - 0 1', 'e1h1'],
  ['blocked queenside b-file', '4k3/8/8/8/8/8/8/RN2K3 w Q - 0 1', 'e1a1'],
  ['in check', 'k3r3/8/8/8/8/8/8/4K2R w K - 0 1', 'e1g1'],
  ['through check', 'k4r2/8/8/8/8/8/8/4K2R w K - 0 1', 'e1h1'],
  ['into check', 'k5r1/8/8/8/8/8/8/4K2R w K - 0 1', 'e1g1'],
  ['black through check', '4k2r/8/8/8/8/8/8/K4R2 b k - 0 1', 'e8h8'],
]) test(`reject castling ${label}`, () => assert.equal(normalizeLegalUci(fen, move), null));

test('king and rook moves permanently remove rights even after returning home', () => {
  for (const [out, back, expected] of [['h1h2', 'h2h1', 'Q'], ['e1e2', 'e2e1', '-']]) {
    const game = new Chess(positionToFen(position, 'w', 'KQkq'));
    for (const move of [out, 'e8e7', back, 'e7e8']) applyUci(game, move);
    assert.equal(game.fen().split(' ')[2], expected);
    assert.equal(normalizeLegalUci(game.fen(), 'e1h1'), null);
  }
});


test('capturing a rook removes its castling right', () => {
  const game = new Chess(positionToFen(position, 'w', 'KQkq'));
  applyUci(game, 'h1h8');
  assert.equal(game.fen().split(' ')[2], 'Qq');
});

test('an attacked rook and attacked queenside b-file do not prevent legal castling', () => {
  assert.equal(normalizeLegalUci('k6r/8/8/8/8/8/8/4K2R w K - 0 1', 'e1h1'), 'e1g1');
  assert.equal(normalizeLegalUci('1r5k/8/8/8/8/8/8/R3K3 w Q - 0 1', 'e1a1'), 'e1c1');
});
