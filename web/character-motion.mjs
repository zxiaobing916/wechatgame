import * as THREE from 'three';

/** Rigid articulated prototype: no skin weights, cloth simulation or authored clips. */
export function createCharacterMotion(avatar, garments) {
  const joints = [];
  function joint(parent, objects, x, y, kind, side) {
    if (!objects.length) return;
    const pivot = new THREE.Group();
    pivot.name = `Motion_${kind}_${side}`;
    pivot.position.set(x, y, 0);
    parent.add(pivot);
    parent.updateWorldMatrix(true, true);
    for (const object of objects) pivot.attach(object);
    joints.push({pivot, kind, side});
  }
  for (const [label, side] of [['L', -1], ['R', 1]]) {
    const arm = avatar.getObjectByName('Arm' + label);
    const leg = avatar.getObjectByName('Leg' + label);
    joint(avatar, arm ? [arm] : [], side * .16 * 1.2, 1.335 * .72, 'arm', side);
    joint(avatar, leg ? [leg] : [], side * .092 * 1.2, .92 * .72, 'leg', side);
    for (const [id, garment] of Object.entries(garments)) {
      const children = [...garment.children];
      // Only separate sleeves/cuffs and trouser/boot meshes follow limbs.
      // Torso, cape and long skirt remain fixed until a skinned asset replaces them.
      joint(garment, children.filter(o => o.isMesh && o.position.x * side > .18 && o.position.y > 1.07), side * .16, 1.335, 'arm', side);
      if (id === 'ranger') joint(garment, children.filter(o => o.isMesh && o.position.x * side > .05 && o.position.y < .95), side * .083, .92, 'leg', side);
    }
  }
  let phase = 0, weight = 0, active = false;
  function reset() {
    phase = 0; weight = 0; active = false;
    for (const {pivot} of joints) pivot.rotation.x = 0;
  }
  function update(dt, moving) {
    active = moving;
    weight = THREE.MathUtils.damp(weight, moving ? 1 : 0, 12, dt);
    if (weight < .001 && !moving) { reset(); return; }
    phase += dt * 9;
    for (const {pivot, kind, side} of joints) {
      pivot.rotation.x = Math.sin(phase) * side * weight * (kind === 'arm' ? .22 : -.16);
    }
  }
  return {update, reset, get debug() {return {active, weight, phase, joints: joints.length, angles: joints.map(({pivot}) => pivot.rotation.x)};}};
}
