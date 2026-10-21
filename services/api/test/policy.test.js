import test from 'node:test';
import assert from 'node:assert/strict';
import { ownerFilter } from '../src/policy.js';
test('all task filters bind the authenticated owner', () => {
  assert.deepEqual(ownerFilter(7), { usuarioId: 7 });
  assert.deepEqual(ownerFilter(7, 12), { usuarioId: 7, id: 12 });
});
test('invalid principals cannot produce unscoped filters', () => {
  for (const value of [undefined, null, 0, -1, NaN, '1', 1.5, Infinity]) assert.throws(() => ownerFilter(value));
  for (const value of [null, 0, -1, NaN, '1', 1.5, Infinity]) assert.throws(() => ownerFilter(1, value));
});
