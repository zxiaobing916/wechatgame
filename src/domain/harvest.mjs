/** Original domain prototype. Production must run these transitions atomically on a server. */
export class HarvestError extends Error {
  constructor(code) { super(code); this.name = 'HarvestError'; this.code = code; }
}

const fail = (code) => { throw new HarvestError(code); };
const id = (value) => typeof value === 'string' && value.trim().length > 0 && value.length <= 128;
const integer = (value) => Number.isSafeInteger(value) && value >= 0;
const requireId = (value) => { if (!id(value)) fail('INVALID_ID'); };
const requireTime = (value) => { if (!integer(value)) fail('INVALID_TIME'); };

export function createBatch({ batchId, ownerId, productId, kind, initialYield, maturesAt }) {
  [batchId, ownerId, productId].forEach(requireId);
  if (!['crop', 'offspring'].includes(kind)) fail('INVALID_KIND');
  if (!integer(initialYield) || initialYield < 1) fail('INVALID_YIELD');
  requireTime(maturesAt);
  return Object.freeze({ batchId, ownerId, productId, kind, initialYield, maturesAt,
    stolen: 0, visitors: Object.freeze([]), collected: false, revision: 0 });
}

function validate(batch) {
  if (!batch || typeof batch !== 'object') fail('INVALID_BATCH');
  createBatch(batch);
  if (!integer(batch.stolen) || batch.stolen > Math.floor(batch.initialYield / 2)
      || !Array.isArray(batch.visitors) || !batch.visitors.every(id)
      || new Set(batch.visitors).size !== batch.visitors.length
      || batch.visitors.includes(batch.ownerId)
      || batch.visitors.length > batch.stolen
      || (batch.stolen > 0 && batch.visitors.length === 0)
      || typeof batch.collected !== 'boolean' || !integer(batch.revision)
      || batch.revision !== batch.visitors.length + Number(batch.collected)) fail('INVALID_BATCH');
}

function ready(batch, now) {
  validate(batch); requireTime(now);
  if (batch.collected) fail('ALREADY_COLLECTED');
  if (now < batch.maturesAt) fail('NOT_MATURE');
}

export function inspectBatch(batch, now) {
  validate(batch); requireTime(now);
  const mature = now >= batch.maturesAt;
  return Object.freeze({ mature, collected: batch.collected,
    remaining: batch.collected ? 0 : batch.initialYield - batch.stolen,
    stealable: !mature || batch.collected ? 0 : Math.floor(batch.initialYield / 2) - batch.stolen,
    ownerGuarantee: Math.ceil(batch.initialYield / 2) });
}

/** requestedAmount is trusted game configuration, NEVER a visitor-supplied reward amount. */
export function stealHarvest(batch, { visitorId, requestedAmount, now }) {
  ready(batch, now); requireId(visitorId);
  if (visitorId === batch.ownerId) fail('OWNER_CANNOT_STEAL');
  if (!integer(requestedAmount) || requestedAmount < 1) fail('INVALID_AMOUNT');
  if (batch.visitors.includes(visitorId)) fail('ALREADY_VISITED');
  const available = Math.floor(batch.initialYield / 2) - batch.stolen;
  if (available === 0) fail('THEFT_CAP_REACHED');
  const amount = Math.min(requestedAmount, available);
  const next = Object.freeze({ ...batch, stolen: batch.stolen + amount,
    visitors: Object.freeze([...batch.visitors, visitorId]), revision: batch.revision + 1 });
  const reward = Object.freeze({ productId: batch.productId, kind: batch.kind,
    amount, provenance: 'stolen', sellOnly: true, canBreed: false });
  return Object.freeze({ batch: next, reward });
}

export function harvestOwn(batch, { actorId, now }) {
  ready(batch, now); requireId(actorId);
  if (actorId !== batch.ownerId) fail('NOT_OWNER');
  return Object.freeze({
    batch: Object.freeze({ ...batch, visitors: Object.freeze([...batch.visitors]), collected: true, revision: batch.revision + 1 }),
    // Breeding rights are a separate unlock system; a harvest never grants them implicitly.
    reward: Object.freeze({ productId: batch.productId, kind: batch.kind,
      amount: batch.initialYield - batch.stolen, provenance: 'harvested', sellOnly: true, canBreed: false }),
  });
}
