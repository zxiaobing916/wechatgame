/** Cream pastoral material palette: broad highlights, no photographic grain. */
export function createArtMaterials() {
  function fabric(material) {
    material.map=null;material.bumpMap=null;
    material.roughness=.88;material.metalness=0;material.needsUpdate=true;
  }
  function applyAvatar(avatar) {
    avatar.traverse(o=>{
      if(!o.isMesh)return;
      if(o.name==='OutfitUnderskirt'){o.scale.x*=.95;o.scale.z*=.95;}
      for(const m of Array.isArray(o.material)?o.material:[o.material]){
        if(/^Outfit/.test(o.name))fabric(m);
        if(/hair/i.test(m.name)){m.roughness=.72;m.metalness=0;}
        if(/skin/i.test(m.name)){m.roughness=.8;m.metalness=0;}
        if(/gold/i.test(m.name)){m.roughness=.55;m.metalness=.18;}
      }
    });
  }
  return {fabric,applyAvatar,dispose(){}};
}
