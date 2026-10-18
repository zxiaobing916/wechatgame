/** Two opposing acceleration pulses, SI units; independent of browser/WeChat. */
export function createShakeDetector(onShake,{threshold=5.5,cooldown=1400}={}){
 let previous=null,pulse=null,last=-Infinity;
 return {reset(){previous=null;pulse=null;},sample(v,now){
  if(!v||![v.x,v.y,v.z,now].every(Number.isFinite))return;
  if(!previous){previous={...v,time:now};return;}
  const age=now-previous.time,delta={x:v.x-previous.x,y:v.y-previous.y,z:v.z-previous.z};previous={...v,time:now};
  if(age<15||age>300){pulse=null;return;}
  const magnitude=Math.hypot(delta.x,delta.y,delta.z);if(magnitude<threshold)return;
  if(pulse&&now-pulse.time<=450&&delta.x*pulse.x+delta.y*pulse.y+delta.z*pulse.z<0&&now-last>=cooldown){last=now;pulse=null;onShake(Math.min(1,magnitude/16));return;}
  pulse={...delta,time:now};
 }};
}
export function createMotionInput({onShake,enabled=()=>true,host=globalThis}){
 let running=false,source=null;
 const detector=createShakeDetector(strength=>{if(enabled()&&!host.document?.hidden)onShake(strength);});
 const sample=v=>{if(enabled()&&!host.document?.hidden)detector.sample(v,host.performance.now());else detector.reset();};
 const webHandler=e=>sample(e.accelerationIncludingGravity||e.acceleration);
 const wxHandler=e=>sample({x:e.x*9.80665,y:e.y*9.80665,z:e.z*9.80665});
 function stop(){if(source==='web')host.removeEventListener('devicemotion',webHandler);if(source==='wx'){host.wx.offAccelerometerChange?.(wxHandler);host.wx.stopAccelerometer?.({});}source=null;running=false;detector.reset();}
 async function start(){
  if(running)return true;
  if(host.wx?.startAccelerometer&&host.wx?.onAccelerometerChange){
   try{await new Promise((resolve,reject)=>host.wx.startAccelerometer({interval:'game',success:resolve,fail:reject}));host.wx.onAccelerometerChange(wxHandler);source='wx';running=true;return true;}catch{return false;}
  }
  if(!host.DeviceMotionEvent)return false;
  try{if(typeof host.DeviceMotionEvent.requestPermission==='function'&&await host.DeviceMotionEvent.requestPermission()!=='granted')return false;
   host.addEventListener('devicemotion',webHandler);source='web';running=true;return true;
  }catch{return false;}
 }
 const visibility=()=>detector.reset();host.document?.addEventListener('visibilitychange',visibility);
 return {start,stop,get running(){return running;},dispose(){stop();host.document?.removeEventListener('visibilitychange',visibility);}};
}
