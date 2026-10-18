import test from 'node:test';
import assert from 'node:assert/strict';
import {createShakeDetector,createMotionInput} from '../web/shake-input.mjs';
test('small motions ignored, opposing pulses trigger bounded strength with cooldown',()=>{
 const events=[],d=createShakeDetector(s=>events.push(s));
 const at=(x,t)=>d.sample({x,y:0,z:9.8},t);
 at(0,0);at(.5,50);at(0,100);assert.equal(events.length,0);
 at(9,150);at(-9,200);assert.equal(events.length,1);assert.ok(events[0]<=1);
 at(9,250);at(-9,300);assert.equal(events.length,1);
 at(0,1700);at(9,1750);at(-9,1800);assert.equal(events.length,2);
 d.reset();at(-9,3000);assert.equal(events.length,2);
});
test('permission denial does not attach sensor; explicit successful start and stop detach',async()=>{
 let added=0,removed=0;const host={DeviceMotionEvent:{requestPermission:async()=> 'denied'},addEventListener(){added++;},removeEventListener(){removed++;},performance:{now:()=>0}};
 const input=createMotionInput({host,onShake(){}});assert.equal(await input.start(),false);assert.equal(added,0);
 host.DeviceMotionEvent.requestPermission=async()=> 'granted';assert.equal(await input.start(),true);await input.start();assert.equal(added,1);input.stop();assert.equal(removed,1);
});
test('WeChat acceleration uses g-to-SI conversion and disabled gameplay ignores shakes',async()=>{
 let callback,time=0,events=0,enabled=false;const host={performance:{now:()=>time},wx:{startAccelerometer(o){o.success();},onAccelerometerChange(fn){callback=fn;},offAccelerometerChange(){callback=null;},stopAccelerometer(){}}};
 const input=createMotionInput({host,onShake(){events++;},enabled:()=>enabled});await input.start();
 function fire(x){time+=50;callback({x,y:0,z:1});}fire(0);fire(1);fire(-1);assert.equal(events,0);
 enabled=true;fire(0);fire(1);fire(-1);assert.equal(events,1);input.dispose();assert.equal(callback,null);
});
