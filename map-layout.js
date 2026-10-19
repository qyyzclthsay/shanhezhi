/* Display-only cartography. Campaign distance and travel time use scenario.js. */
(function (root, factory) {
  const scenario = typeof module === 'object' && module.exports ? require('./scenario.js') : root.TKScenario || root.TKEngine?.DATA || {};
  const layout = factory(scenario);
  if (typeof module === 'object' && module.exports) module.exports = layout;
  root.TKMapLayout = layout;
})(globalThis, function (scenario) {
  'use strict';
  // The narrow corridors need room for a full wall silhouette and its name.
  const adjustments = {
    tianshui:[315,390], hanzhong:[480,500], jiange:[285,590],
    chengdu:[200,765], jiangzhou:[440,810],
    changan:[549,405], tongguan:[645,380],
    luoyang:[790,385], hulao:[892,385], chenliu:[990,415],
    xuchang:[930,490], wan:[785,520],
    xiangyang:[765,625], jiangling:[800,710], jinyang:[800,190],
    ye:[930,285], puyang:[1015,328], nanpi:[1120,180],
    xiapi:[1240,455], xiaopei:[1140,465], lujiang:[1145,695], chaisang:[1035,775],
    jibei:[1130,355], langya:[1280,370], guangling:[1340,515],
    shangyong:[585,550],
    wujun:[1383,610],
  };
  function spread(value,stops) {
    for(let i=1;i<stops.length;i++)if(value<=stops[i][0]){const [a,b]=stops[i-1],[c,d]=stops[i];return b+(value-a)*(d-b)/(c-a);}
    return value;
  }
  function projectPoint(x,y) {
    return {x:spread(x,[[0,0],[800,800],[900,900],[1100,1160],[1300,1410],[1550,1550],[1600,1600]]),
      y:spread(y,[[0,0],[190,170],[330,310],[490,510],[650,680],[800,800],[1100,1100]])};
  }
  const positions = Object.freeze(Object.fromEntries((scenario.cities || []).map(city => {
    const [originalX,originalY] = adjustments[city.id] || [city.x,city.y];
    // Give the Central Plains and Xu province more of the map's open eastern
    // space; campaign geography remains independent of this display layout.
    const {x,y}=projectPoint(originalX,originalY);
    return [city.id, Object.freeze({x,y})];
  })));
  function position(cityOrId) {
    const id = typeof cityOrId === 'string' ? cityOrId : cityOrId?.id;
    return positions[id] || (cityOrId && typeof cityOrId === 'object' && Number.isFinite(cityOrId.x) && Number.isFinite(cityOrId.y) ? {x:cityOrId.x,y:cityOrId.y} : null);
  }
  const nodes=new Map((scenario.cities||[]).map(city=>[city.id,city]));
  function footprint(cityOrId) {
    const city=nodes.get(typeof cityOrId==='string'?cityOrId:cityOrId?.id)||cityOrId,p=position(city);
    if(!p||!city||typeof city!=='object')return null;
    const pass=city.kind==='pass',major=city.tier==='major',scale=pass?.86:major?.9:.69;
    const half=(pass?48:major?50:36)*scale,top=(major?61:43)*scale,bottom=(!pass&&city.terrain==='river'?24:12)*scale;
    return {x:p.x-half,y:p.y-top,width:half*2,height:top+bottom};
  }
  function outline(cityOrId) {
    const city=nodes.get(typeof cityOrId==='string'?cityOrId:cityOrId?.id)||cityOrId,p=position(city);
    if(!p||!city||typeof city!=='object')return [];
    const pass=city.kind==='pass',major=city.tier==='major',scale=pass?.86:major?.9:.69;
    // The visible front, corner roofs and central hall, excluding empty corners
    // of the broad culling rectangle, flags and the decorative quay.
    const points=pass?[[-48,11],[-43,-10],[-34,-23],[-29,-14],[-17,-14],[-17,-24],[-9,-30],[9,-30],[17,-24],[17,-14],[31,-14],[40,-22],[48,11]]:
      major?[[-49,12],[-49,-27],[-37,-27],[-37,-34],[-39.5,-35],[-34,-41],[-18,-41],[-18,-51],[-9.4,-59],[9.4,-59],[18,-51],[18,-41],[34,-41],[39.5,-35],[37,-34],[37,-27],[49,-27],[49,12]]:
      [[-31.5,10],[-31.5,-16],[-34.5,-17],[-31,-22],[-14,-22],[-14,-29],[-6,-35],[6,-35],[14,-29],[14,-22],[31,-22],[34.5,-17],[31.5,-16],[31.5,10]];
    return points.map(([x,y])=>({x:p.x+x*scale,y:p.y+y*scale}));
  }
  function approach(id,point) {
    const shape=outline(id);let nearest=null,best=Infinity;
    for(let i=0;i<shape.length;i++){
      const a=shape[i],b=shape[(i+1)%shape.length],dx=b.x-a.x,dy=b.y-a.y;
      const t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy)));
      const q={x:a.x+dx*t,y:a.y+dy*t},distance=Math.hypot(point.x-q.x,point.y-q.y);
      if(distance<best){nearest=q;best=distance;}
    }
    if(best<=1.2)return point;
    return {x:nearest.x+(point.x-nearest.x)*1.2/best,y:nearest.y+(point.y-nearest.y)*1.2/best};
  }
  function center(id) {const r=footprint(id);return {x:r.x+r.width/2,y:r.y+r.height/2};}
  function exitPoint(id,toward) {
    const box=footprint(id),c=center(id),dx=toward.x-c.x,dy=toward.y-c.y;
    const t=Math.min((box.width/2+3)/Math.max(.001,Math.abs(dx)),(box.height/2+3)/Math.max(.001,Math.abs(dy)));
    return {x:c.x+dx*t,y:c.y+dy*t};
  }
  const cachedRoutes=new Map();let routesBuilt=false;
  const key=(a,b)=>[a,b].sort().join('|');
  function intersects(a,b,c,d) {
    const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
    return cross(a,b,c)*cross(a,b,d)<-.0001&&cross(c,d,a)*cross(c,d,b)<-.0001;
  }
  function curve(a,b,bend) {
    const distance=Math.hypot(b.x-a.x,b.y-a.y),control={x:(a.x+b.x)/2-(b.y-a.y)/distance*bend,y:(a.y+b.y)/2+(b.x-a.x)/distance*bend};
    const count=Math.max(24,Math.ceil(distance/4));
    return Array.from({length:count+1},(_,i)=>{const t=i/count,u=1-t;return {x:u*u*a.x+2*u*t*control.x+t*t*b.x,y:u*u*a.y+2*u*t*control.y+t*t*b.y};});
  }
  function makeRoute(from,to,existing) {
    const a=exitPoint(from,center(to)),b=exitPoint(to,center(from)),distance=Math.hypot(b.x-a.x,b.y-a.y);
    const signature=key(from,to),seed=[...signature].reduce((n,ch)=>n+ch.charCodeAt(0),0),bend=Math.min(40,Math.max(14,distance*.16))*(seed%2?1:-1);
    const boxes=[...nodes.keys()].map(footprint);let best=null,bestScore=Infinity;
    for(const amount of [bend,-bend,bend*.45,-bend*.45,0,bend*1.8,-bend*1.8]) {
      const middle=curve(a,b,amount),points=[approach(from,a),...middle,approach(to,b)];
      const blocked=middle.reduce((sum,p)=>sum+boxes.filter(r=>p.x>r.x-1.5&&p.x<r.x+r.width+1.5&&p.y>r.y-1.5&&p.y<r.y+r.height+1.5).length,0);
      let crossings=0;
      for(const [ids,other] of existing){if(ids.split('|').some(id=>id===from||id===to))continue;
        for(let i=1;i<points.length;i++)for(let j=1;j<other.length;j++)if(intersects(points[i-1],points[i],other[j-1],other[j]))crossings++;
      }
      const score=blocked*10000+crossings*1000+Math.abs(Math.abs(amount)-Math.abs(bend))*.01;
      if(score<bestScore){best=points;bestScore=score;}if(score===0)break;
    }
    return Object.freeze(best.map(p=>Object.freeze(p)));
  }
  function route(from,to) {
    const a=typeof from==='string'?from:from?.id,b=typeof to==='string'?to:to?.id;
    if(!nodes.has(a)||!nodes.has(b)||a===b)return [];
    if(!routesBuilt){routesBuilt=true;
      for(const edge of scenario.edges||[]){const [u,v]=edge.slice().sort();cachedRoutes.set(key(u,v),makeRoute(u,v,cachedRoutes));}
    }
    const points=cachedRoutes.get(key(a,b));if(!points)return [];
    return a<b?points:points.slice().reverse();
  }
  return Object.freeze({position,positions,projectPoint,footprint,outline,route,width:scenario.map?.width || 1600,height:scenario.map?.height || 1100});
});
