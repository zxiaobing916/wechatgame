/** Original local prototype. Production transitions require authoritative server transactions. */
import { inspectCare } from './care.mjs';
import { createBatch, inspectBatch, harvestOwn, stealHarvest } from './harvest.mjs';

export class RanchError extends Error {
  constructor(code) { super(code); this.name = 'RanchError'; this.code = code; }
}
const fail = (code) => { throw new RanchError(code); };
const integer = (v) => Number.isSafeInteger(v) && v >= 0;
const validId = (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 128;
const record = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
  && [Object.prototype, null].includes(Object.getPrototypeOf(v));
const own = (v, key) => Object.hasOwn(v, key);
const safeAdd = (a, b) => { const result = a + b; if (!integer(result)) fail('NUMERIC_OVERFLOW'); return result; };
const requireCoins = (v) => { if (!integer(v)) fail('INVALID_COINS'); };
const requireTime = (v) => { if (!integer(v)) fail('INVALID_TIME'); };
const OWNER = 'local-owner';
export const RANCH_RULES = Object.freeze({ maleChance: .05, maleRestMs: 600000, growthMs: 28800000, adultSale: 90, capacity: 6, needsMs: 10800000, careReductionMs: 900000, feedCost: 3, supplyCapacity: 4, matingMs: 30000, gestationMs: 28800000, successChance: .65 });
export const RANCH_SPECIES = Object.freeze({
  sheep: Object.freeze({ name: '绵羊', level: 1, buy: 60, feed: 3, durationMs: 28800000, durationSeconds: 28800, yield: 4, sale: 18, available: true }),
  pegasus: Object.freeze({ name: '天马', level: 50, buy: 1800, feed: 120, durationMs: 3600000, durationSeconds: 3600, yield: 4, sale: 240, available: false }),
  qilin: Object.freeze({ name: '麒麟', level: 60, buy: 3000, feed: 180, durationMs: 7200000, durationSeconds: 7200, yield: 4, sale: 360, available: false }),
});
const species = (id) => typeof id === 'string' && own(RANCH_SPECIES, id) ? RANCH_SPECIES[id] : null;
function freezeState(state) {
  const freezeInventory = (items) => Object.freeze(items.map((item) => Object.freeze({ ...item })));
  return Object.freeze({ ...state,
    animals: Object.freeze(state.animals.map(animal => Object.freeze({...animal}))),
    supplies: Object.freeze({...state.supplies}),
    pairing: state.pairing ? Object.freeze({...state.pairing}) : null,
    batch: state.batch ? Object.freeze({ ...state.batch, ...(state.batch.parentIds ? {parentIds:Object.freeze([...state.batch.parentIds])} : {}), ...(state.batch.care ? {care:Object.freeze({...state.batch.care})} : {}), visitors: Object.freeze([...state.batch.visitors]) }) : null,
    inventory: freezeInventory(state.inventory),
    visitorInventory: Object.freeze(Object.fromEntries(Object.entries(state.visitorInventory).map(([key, items]) => [key, freezeInventory(items)]))),
    visitorCoins: Object.freeze({ ...state.visitorCoins }),
  });
}
export function createRanchState() {
  return freezeState({ version: 5, growthAt:null, breedingEnabled:true, animals: [], supplies: {water:0,feed:0}, pairing:null, needsAt:null, lastOutcome:null, attempts:0, speciesId: null, batch: null, cycle: 0, inventory: [], visitorInventory: {}, visitorCoins: {} });
}
function validateCommon(ranch) {
  try {
    if (!record(ranch) || !integer(ranch.cycle) || !Array.isArray(ranch.inventory)
        || !record(ranch.visitorInventory) || !record(ranch.visitorCoins)) fail('INVALID_RANCH');
    const config = ranch.speciesId === null ? null : species(ranch.speciesId);
    if (ranch.speciesId !== null && (!config || !config.available)) fail('INVALID_RANCH');
    const checkItems = (items, provenance) => Array.isArray(items) && items.every((item) => record(item)
      && config && item.productId === `${ranch.speciesId}-offspring` && item.kind === 'offspring'
      && integer(item.amount) && item.amount > 0 && item.amount <= config.yield
      && item.provenance === provenance && item.sellOnly === true && item.canBreed === false);
    if (!checkItems(ranch.inventory, 'harvested')) fail('INVALID_RANCH');
    for (const [visitorId, items] of Object.entries(ranch.visitorInventory)) {
      if (!validId(visitorId) || visitorId === OWNER || !checkItems(items, 'stolen')) fail('INVALID_RANCH');
    }
    for (const [visitorId, coins] of Object.entries(ranch.visitorCoins)) {
      if (!validId(visitorId) || visitorId === OWNER || !integer(coins)) fail('INVALID_RANCH');
    }
    if (!config && (ranch.cycle !== 0 || ranch.batch !== null || ranch.inventory.length
        || Object.keys(ranch.visitorInventory).length || Object.keys(ranch.visitorCoins).length)) fail('INVALID_RANCH');
    if (ranch.cycle === 0 && (ranch.inventory.length || Object.keys(ranch.visitorInventory).length
        || Object.keys(ranch.visitorCoins).length)) fail('INVALID_RANCH');
    if (ranch.batch !== null) {
      inspectBatch(ranch.batch, 0);
      inspectCare(ranch.batch, 0);
      if (!config || ranch.cycle < 1 || ranch.batch.ownerId !== OWNER || ranch.batch.kind !== 'offspring'
          || ranch.batch.productId !== `${ranch.speciesId}-offspring` || ranch.batch.initialYield !== config.yield
          || ranch.batch.collected || ranch.batch.stolen !== ranch.batch.visitors.length) fail('INVALID_RANCH');
    }
    return true;
  } catch { fail('INVALID_RANCH'); }
}
export function validateRanchState(ranch) {
  try {
    validateCommon(ranch);
    if (ranch.version !== 5 || typeof ranch.breedingEnabled !== 'boolean' || (ranch.growthAt !== null && !integer(ranch.growthAt)) || !Array.isArray(ranch.animals) || ranch.animals.length > RANCH_RULES.capacity
        || !record(ranch.supplies) || Object.keys(ranch.supplies).sort().join(',') !== 'feed,water'
        || !integer(ranch.attempts) || ![null,'success','failed'].includes(ranch.lastOutcome)) fail('INVALID_RANCH');
    for (const value of Object.values(ranch.supplies)) if (!integer(value) || value > RANCH_RULES.supplyCapacity) fail('INVALID_RANCH');
    const ids = new Set();
    for (const animal of ranch.animals) {
      if (!record(animal) || !validId(animal.id) || !['male','female'].includes(animal.sex) || ids.has(animal.id) || !integer(animal.restUntil) || !integer(animal.growthMs) || animal.growthMs > RANCH_RULES.growthMs) fail('INVALID_RANCH');
      for (const action of ['Water','Feed']) {
        const readyAt = animal[`${action.toLowerCase()}ReadyAt`], lastAt = animal[`last${action}At`];
        if (!integer(readyAt) || (lastAt !== null && (!integer(lastAt) || readyAt !== safeAdd(lastAt,RANCH_RULES.needsMs)))) fail('INVALID_RANCH');
      }
      ids.add(animal.id);
    }
    if (ranch.speciesId === null && (ranch.animals.length || ranch.attempts || ranch.lastOutcome !== null || ranch.supplies.water || ranch.supplies.feed)) fail('INVALID_RANCH');
    if (ranch.needsAt !== null && !integer(ranch.needsAt)) fail('INVALID_RANCH');
    if (!ranch.animals.length && ranch.needsAt !== null) fail('INVALID_RANCH');
    if (ranch.pairing !== null) {
      const pair = ranch.pairing;
      if (!record(pair) || ranch.batch !== null || !integer(pair.endsAt) || typeof pair.outcome !== 'boolean' || ranch.attempts < 1
          || !ranch.animals.some(a=>a.id === pair.maleId && a.sex === 'male')
          || !ranch.animals.some(a=>a.id === pair.femaleId && a.sex === 'female')) fail('INVALID_RANCH');
      safeAdd(pair.endsAt, RANCH_RULES.gestationMs);
      safeAdd(pair.endsAt, RANCH_RULES.maleRestMs);
    }
    if (ranch.batch?.parentIds !== undefined) {
      const ids = ranch.batch.parentIds;
      if (!Array.isArray(ids) || ids.length !== 2 || ids[0] === ids[1]
        || !ranch.animals.some(a=>a.id === ids[0] && a.sex === 'male' && a.growthMs === RANCH_RULES.growthMs)
        || !ranch.animals.some(a=>a.id === ids[1] && a.sex === 'female' && a.growthMs === RANCH_RULES.growthMs)) fail('INVALID_RANCH');
    }
    if (ranch.pairing && ranch.animals.some(a=>[ranch.pairing.maleId,ranch.pairing.femaleId].includes(a.id) && a.growthMs !== RANCH_RULES.growthMs)) fail('INVALID_RANCH');
    return true;
  } catch { fail('INVALID_RANCH'); }
}
/** Legacy ownership becomes one female; existing offspring and wallets remain intact. */
export function migrateRanchState(ranch) {
  if (ranch?.version === 5) { validateRanchState(ranch); return freezeState(ranch); }
  if (ranch?.version !== undefined && ![1,2,3,4].includes(ranch.version)) fail('INVALID_RANCH');
  validateCommon(ranch);
  const base = [2,3,4].includes(ranch.version) ? ranch : {...ranch,animals:ranch.speciesId ? [{id:'legacy-sheep',sex:'female'}] : [],
    supplies:{water:0,feed:0},pairing:null,needsAt:null,lastOutcome:null,attempts:0};
  if (!Array.isArray(base.animals)) fail('INVALID_RANCH');
  const hasGrowth = [3,4].includes(ranch.version);
  const migrated = {...base,version:5,growthAt:hasGrowth ? ranch.growthAt : null,
    breedingEnabled:hasGrowth ? ranch.breedingEnabled : true,needsAt:null,supplies:{water:0,feed:0},
    animals:base.animals.map(a=>{
      if (hasGrowth && (!integer(a.growthMs) || a.growthMs > 120000)) fail('INVALID_RANCH');
      return {...a,growthMs:hasGrowth ? a.growthMs * 240 : RANCH_RULES.growthMs,
        restUntil:hasGrowth ? (a.restUntil ?? 0) : 0,
        waterReadyAt:0,feedReadyAt:0,lastWaterAt:null,lastFeedAt:null};
    })};
  validateRanchState(migrated);
  return freezeState(migrated);
}
/** Wall-clock growth continues offline, independently of optional care. */
function settle(ranch, now) {
  if (ranch.growthAt !== null && now < ranch.growthAt) return ranch;
  const gain = Math.min(RANCH_RULES.growthMs,now-(ranch.growthAt ?? now));
  const supplies = Object.fromEntries(['water','feed'].map(action=>[action,
    ranch.animals.some(a=>a[`last${action === 'water' ? 'Water' : 'Feed'}At`] !== null && a[`${action}ReadyAt`] > now) ? RANCH_RULES.supplyCapacity : 0]));
  return {...ranch,growthAt:now,needsAt:null,supplies,animals:ranch.animals.map(a=>({...a,growthMs:Math.min(RANCH_RULES.growthMs,a.growthMs+gain)}))};
}
export function animalBusy(ranch, animalId) {
  validateRanchState(ranch);
  return Boolean((ranch.pairing && [ranch.pairing.maleId,ranch.pairing.femaleId].includes(animalId))
    || (ranch.batch && (!ranch.batch.parentIds || ranch.batch.parentIds.includes(animalId))));
}
export function canSellAnimal(ranch, animalId) {
  validateRanchState(ranch);
  return ranch.animals.some(a=>a.id === animalId && a.growthMs === RANCH_RULES.growthMs) && !animalBusy(ranch,animalId);
}
export function setBreedingEnabled(ranch, {enabled}) {
  validateRanchState(ranch);
  if (typeof enabled !== 'boolean') fail('INVALID_ENABLED');
  return Object.freeze({ranch:freezeState({...ranch,breedingEnabled:enabled})});
}
function draw(random) {
  if (typeof random !== 'function') fail('INVALID_RANDOM');
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) fail('INVALID_RANDOM');
  return value;
}
export function buyBreeder(ranch, { speciesId, level, coins, random = Math.random, now = 0 }) {
  requireTime(now);
  validateRanchState(ranch); requireCoins(coins);
  if (!integer(level) || level < 1) fail('INVALID_LEVEL');
  const config = species(speciesId);
  if (!config) fail('INVALID_SPECIES');
  if (level < config.level) fail('LEVEL_LOCKED');
  if (!config.available) fail('SPECIES_UNAVAILABLE');
  if (ranch.speciesId !== null && ranch.speciesId !== speciesId) fail('SPECIES_MISMATCH');
  if (ranch.animals.length >= RANCH_RULES.capacity) fail('RANCH_FULL');
  if (coins < config.buy) fail('INSUFFICIENT_COINS');
  let number = 1;
  while (ranch.animals.some(a=>a.id === `sheep-${number}`)) number++;
  ranch = settle(ranch,now);
  const animal = Object.freeze({growthMs:0,restUntil:0,waterReadyAt:0,feedReadyAt:0,lastWaterAt:null,lastFeedAt:null,id:`sheep-${number}`,sex:draw(random) < RANCH_RULES.maleChance ? 'male' : 'female'});
  return Object.freeze({ ranch: freezeState({ ...ranch, speciesId, needsAt:null, animals:[...ranch.animals,animal] }), coins: coins - config.buy, animal });
}
function removeAnimal(ranch, {animalId,coins,now = ranch.growthAt ?? 0}, adult) {
  validateRanchState(ranch); requireCoins(coins); requireTime(now);
  ranch = settle(ranch,now);
  const animal = ranch.animals.find(a=>a.id === animalId);
  if (!validId(animalId) || !animal) fail('INVALID_ANIMAL');
  if (animalBusy(ranch,animalId)) fail('BREEDING_ACTIVE');
  if (adult && animal.growthMs < RANCH_RULES.growthMs) fail('ANIMAL_NOT_MATURE');
  const animals = ranch.animals.filter(a=>a.id !== animalId);
  const refund = adult ? RANCH_RULES.adultSale : 30;
  return Object.freeze({ranch:freezeState({...ranch,animals,needsAt:animals.length ? ranch.needsAt : null}),coins:safeAdd(coins,refund),refund,income:refund});
}
export function rehomeBreeder(ranch, options) { return removeAnimal(ranch,options,false); }
export function sellAnimal(ranch, options) { return removeAnimal(ranch,options,true); }
export function careRanch(ranch, { action, coins, now = 0 }) {
  validateRanchState(ranch); requireCoins(coins); requireTime(now);
  ranch = settle(ranch,now);
  if (!['water','feed'].includes(action)) fail('INVALID_ACTION');
  if (!ranch.animals.length) fail('NO_BREEDER');
  const readyKey = `${action}ReadyAt`, lastKey = action === 'water' ? 'lastWaterAt' : 'lastFeedAt';
  const eligible = ranch.animals.filter(a=>now >= a[readyKey]);
  if (!eligible.length) fail('CARE_NOT_DUE');
  const nextReadyAt = safeAdd(now,RANCH_RULES.needsMs);
  const cost = action === 'feed' ? RANCH_RULES.feedCost : 0;
  if (coins < cost) fail('INSUFFICIENT_COINS');
  let savedMs = 0;
  const animals = ranch.animals.map(a=>{
    if (now < a[readyKey]) return a;
    const reduction = Math.min(RANCH_RULES.careReductionMs,RANCH_RULES.growthMs-a.growthMs);
    savedMs += reduction;
    return {...a,growthMs:a.growthMs+reduction,[readyKey]:nextReadyAt,[lastKey]:now};
  });
  return Object.freeze({ranch:freezeState({...ranch,animals,supplies:{...ranch.supplies,[action]:RANCH_RULES.supplyCapacity}}),
    coins:coins-cost,cost,savedMs,affectedAnimalIds:Object.freeze(eligible.map(a=>a.id))});
}
/** Persist chance at pairing start; polling/refresh never rerolls an active pairing. */
export function advanceRanch(ranch, { now, random = Math.random }) {
  validateRanchState(ranch); requireTime(now);
  const before = ranch;
  ranch = settle(ranch,now);
  const needsChanged = ranch.growthAt !== before.growthAt || ranch.needsAt !== before.needsAt;
  const result = (state, event = null) => Object.freeze({ranch:freezeState(state),changed:event !== null || needsChanged,event:event ?? (needsChanged ? 'needs' : null)});
  if (ranch.pairing) {
    if (now < ranch.pairing.endsAt) return result(ranch);
    const restUntil = safeAdd(ranch.pairing.endsAt,RANCH_RULES.maleRestMs);
    ranch = {...ranch,animals:ranch.animals.map(a=>a.id === ranch.pairing.maleId ? {...a,restUntil} : a)};
    if (!ranch.pairing.outcome) return result({...ranch,pairing:null,lastOutcome:'failed'},'failed');
    const cycle = safeAdd(ranch.cycle,1);
    const created = createBatch({batchId:`ranch-${ranch.attempts}-${cycle}-${ranch.pairing.endsAt}`,ownerId:OWNER,
      productId:`${ranch.speciesId}-offspring`,kind:'offspring',initialYield:species(ranch.speciesId).yield,
      maturesAt:safeAdd(ranch.pairing.endsAt,RANCH_RULES.gestationMs)});
    const batch = {...created,parentIds:[ranch.pairing.maleId,ranch.pairing.femaleId]};
    return result({...ranch,pairing:null,lastOutcome:'success',batch,cycle},'success');
  }
  const satiated = a => a.lastWaterAt !== null && a.lastFeedAt !== null && now < a.waterReadyAt && now < a.feedReadyAt;
  const male = ranch.animals.find(a=>satiated(a) && a.sex === 'male' && a.growthMs === RANCH_RULES.growthMs && now >= a.restUntil);
  const female = ranch.animals.find(a=>satiated(a) && a.sex === 'female' && a.growthMs === RANCH_RULES.growthMs);
  if (!ranch.breedingEnabled || ranch.batch || !male || !female || ranch.supplies.water < 1 || ranch.supplies.feed < 1) return result(ranch);
  const endsAt = safeAdd(now,RANCH_RULES.matingMs);
  safeAdd(endsAt,RANCH_RULES.gestationMs);
  safeAdd(endsAt,RANCH_RULES.maleRestMs);
  const attempts = safeAdd(ranch.attempts,1);
  safeAdd(ranch.cycle,1);
  const pairing = {maleId:male.id,femaleId:female.id,endsAt,outcome:draw(random) < RANCH_RULES.successChance};
  return result({...ranch,pairing,attempts,supplies:ranch.supplies},'started');
}
export function harvestOffspring(ranch, { now }) {
  validateRanchState(ranch); requireTime(now);
  if (!ranch.batch) fail('NO_BATCH');
  const { reward } = harvestOwn(ranch.batch, { actorId: OWNER, now });
  return Object.freeze({ ranch: freezeState({ ...ranch, batch: null, inventory: [...ranch.inventory, reward] }) });
}
export function stealOffspring(ranch, { visitorId, now }) {
  validateRanchState(ranch); requireTime(now);
  if (!ranch.batch) fail('NO_BATCH');
  const { batch, reward } = stealHarvest(ranch.batch, { visitorId, now, requestedAmount: 1 });
  const previous = own(ranch.visitorInventory, visitorId) ? ranch.visitorInventory[visitorId] : [];
  return Object.freeze({ ranch: freezeState({ ...ranch, batch,
    visitorInventory: { ...ranch.visitorInventory, [visitorId]: [...previous, reward] } }), reward });
}
function total(items, config) {
  const amount = items.reduce((sum, item) => safeAdd(sum, item.amount), 0);
  const income = amount * (config?.sale ?? 0);
  if (!integer(income)) fail('NUMERIC_OVERFLOW');
  return { amount, income };
}
export function sellOffspring(ranch, { coins }) {
  validateRanchState(ranch); requireCoins(coins);
  const { amount, income } = total(ranch.inventory, species(ranch.speciesId));
  return Object.freeze({ ranch: freezeState({ ...ranch, inventory: [] }), coins: safeAdd(coins, income), amount });
}
export function sellVisitorOffspring(ranch, { visitorId }) {
  validateRanchState(ranch);
  if (!validId(visitorId) || visitorId === OWNER) fail('INVALID_VISITOR');
  const items = own(ranch.visitorInventory, visitorId) ? ranch.visitorInventory[visitorId] : [];
  const { amount, income } = total(items, species(ranch.speciesId));
  if (!amount) return Object.freeze({ ranch: freezeState(ranch), amount, income });
  const prior = own(ranch.visitorCoins, visitorId) ? ranch.visitorCoins[visitorId] : 0;
  return Object.freeze({ ranch: freezeState({ ...ranch,
    visitorInventory: { ...ranch.visitorInventory, [visitorId]: [] },
    visitorCoins: { ...ranch.visitorCoins, [visitorId]: safeAdd(prior, income) } }), amount, income });
}
