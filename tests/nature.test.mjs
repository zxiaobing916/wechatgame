import test from 'node:test';
import assert from 'node:assert/strict';
import {MUTATIONS,mutationName,mutationValue,validateMutation,rollMutation} from '../src/domain/nature.mjs';
test('care probability boundaries, variants do not stack or reroll',()=>{
 for(const [source,prob,key] of [['water',.01,'dewdrop'],['feed',.01,'lush'],['fertilize',.01,'lush']]){
  const entity=Object.freeze({id:'a'});
  assert.equal(rollMutation(entity,{source,random:()=>prob}),entity);
  const win=rollMutation(entity,{source,random:()=>prob-1e-9});assert.equal(win.mutation,key);assert.equal(entity.mutation,undefined);
  assert.equal(rollMutation(win,{source,random:()=>{throw Error('Already mutated');}}),win);
 }
});
test('mutation values round down; invalid metadata cannot create extra sale income',()=>{
 assert.equal(mutationValue(3,'dewdrop'),4);assert.equal(mutationValue(90,'storm'),225);assert.equal(mutationValue(90,'frost'),180);assert.equal(mutationValue(90,null),90);
 assert.equal(mutationName('lush'),'丰盈');assert.equal(mutationName(undefined),'普通');
 assert.equal(validateMutation(null),true);assert.equal(validateMutation(undefined),true);assert.ok(Object.isFrozen(MUTATIONS.storm));
 for(const invalid of ['__proto__','unknown',{},3,false])assert.throws(()=>mutationValue(90,invalid),/INVALID_MUTATION/);
 assert.throws(()=>mutationValue(-1,'lush'),/INVALID_VALUE/);assert.throws(()=>mutationValue(Number.MAX_SAFE_INTEGER,'storm'),/NUMERIC_OVERFLOW/);
 for(const random of [()=>1,()=>-1,()=>NaN,null])assert.throws(()=>rollMutation({},{source:'water',random}),/INVALID_RANDOM/);
});
test('retired weather sources cannot mutate; legacy variants retain their value',()=>{
 for(const source of ['rain','snow','storm'])assert.throws(()=>rollMutation({},{source,random:()=>0}),/INVALID_SOURCE/);
 for(const mutation of ['frost','storm']){
  const entity=JSON.parse(JSON.stringify({mutation}));
  assert.equal(rollMutation(entity,{source:'water',random:()=>0}),entity);
  assert.equal(mutationValue(100,mutation),mutation==='frost'?200:250);
 }
});
