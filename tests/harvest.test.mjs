import test from 'node:test';
import assert from 'node:assert/strict';
import { createBatch, inspectBatch, stealHarvest, harvestOwn, HarvestError } from '../src/domain/harvest.mjs';

const make = (overrides = {}) => createBatch({ batchId: 'field-1:batch-1', ownerId: 'owner',
  productId: 'watermelon', kind: 'crop', initialYield: 40, maturesAt: 100, ...overrides });
const steal = (batch, visitorId, requestedAmount = 3, now = 100) => stealHarvest(batch, { visitorId, requestedAmount, now });
const code = (expected) => (error) => error instanceof HarvestError && error.code === expected;

test('visitors share a fixed half-yield budget; final visitor receives only the remainder', () => {
  const original = make();
  let batch = original;
  let total = 0;
  for (let i = 0; i < 7; i++) {
    const result = steal(batch, `visitor-${i}`);
    total += result.reward.amount;
    batch = result.batch;
    assert.equal(result.reward.amount, i === 6 ? 2 : 3);
  }
  assert.equal(total, 20);
  assert.equal(original.stolen, 0);
  assert.deepEqual(original.visitors, []);
  assert.equal(inspectBatch(batch, 100).stealable, 0);
  assert.throws(() => steal(batch, 'late'), code('THEFT_CAP_REACHED'));
  assert.equal(harvestOwn(batch, { actorId: 'owner', now: 100 }).reward.amount, 20);
});

test('odd yields round theft down; one offspring is fully protected', () => {
  const result = steal(make({ initialYield: 41 }), 'friend', 100);
  assert.equal(result.reward.amount, 20);
  assert.equal(harvestOwn(result.batch, { actorId: 'owner', now: 100 }).reward.amount, 21);
  assert.throws(() => steal(make({ initialYield: 1, kind: 'offspring' }), 'friend'), code('THEFT_CAP_REACHED'));
});

test('repeat visitor cannot steal again, but can visit a new batch', () => {
  const result = steal(make(), 'friend');
  assert.throws(() => steal(result.batch, 'friend'), code('ALREADY_VISITED'));
  assert.equal(steal(make({ batchId: 'next' }), 'friend').reward.amount, 3);
});

test('maturity boundary and collection close both owner and visitor actions', () => {
  const batch = make();
  assert.equal(inspectBatch(batch, 99).stealable, 0);
  assert.throws(() => steal(batch, 'friend', 3, 99), code('NOT_MATURE'));
  assert.throws(() => harvestOwn(batch, { actorId: 'owner', now: 99 }), code('NOT_MATURE'));
  const result = harvestOwn(batch, { actorId: 'owner', now: 100 });
  assert.equal(result.reward.amount, 40);
  assert.equal(inspectBatch(result.batch, 100).remaining, 0);
  assert.throws(() => steal(result.batch, 'friend'), code('ALREADY_COLLECTED'));
  assert.throws(() => harvestOwn(result.batch, { actorId: 'owner', now: 100 }), code('ALREADY_COLLECTED'));
});

test('offspring theft produces sale-only inventory, never a breeding unlock', () => {
  const result = steal(make({ productId: 'qilin-calf', kind: 'offspring', initialYield: 5 }), 'friend');
  assert.deepEqual(result.reward, { productId: 'qilin-calf', kind: 'offspring', amount: 2,
    provenance: 'stolen', sellOnly: true, canBreed: false });
});

test('ownership, malformed inputs, and corrupt state are rejected without mutation', () => {
  const batch = make();
  assert.throws(() => steal(batch, 'owner'), code('OWNER_CANNOT_STEAL'));
  assert.throws(() => harvestOwn(batch, { actorId: 'stranger', now: 100 }), code('NOT_OWNER'));
  for (const requestedAmount of [0, -1, 1.5, NaN, Infinity, '3']) {
    assert.throws(() => steal(batch, 'friend', requestedAmount), code('INVALID_AMOUNT'));
  }
  assert.throws(() => steal(batch, ''), code('INVALID_ID'));
  assert.throws(() => steal(batch, 'friend', 3, NaN), code('INVALID_TIME'));
  assert.throws(() => make({ initialYield: 0 }), code('INVALID_YIELD'));
  assert.throws(() => steal({ ...batch, stolen: 21 }, 'friend'), code('INVALID_BATCH'));
  assert.equal(batch.stolen, 0);
});

test('returned states are immutable and revisions identify atomic write expectations', () => {
  const batch = make();
  const stolen = steal(batch, 'friend');
  assert.equal(stolen.batch.revision, 1);
  assert.equal(harvestOwn(stolen.batch, { actorId: 'owner', now: 100 }).batch.revision, 2);
  assert.throws(() => stolen.batch.visitors.push('injected'), TypeError);
  assert.throws(() => { stolen.batch.stolen = 0; }, TypeError);
});
