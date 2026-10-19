(function(root,factory){'use strict';const common=typeof module==='object'&&module.exports;const api=factory(common?require('./troop-assignments.js'):root.TKTroopAssignments,root);if(common)module.exports=api;root.TKTroops=api;})(globalThis,function(assignments,root){
  'use strict';
  const ids=['scout','shield','spear','crossbow','cavalry'];
  // Row attacks column. This is the exact matrix supplied by the player.
  const matrix=[[0,.2,-.1,.1,-.2],[-.2,0,.1,.2,-.1],[.1,-.1,0,-.2,.2],[-.1,-.2,.2,0,.1],[.2,.1,-.2,-.1,0]];
  const definitions={
    scout:{name:'斥候',color:'#69785a',forceWeight:.25,detail:'武力与智力取较强一项为主；善于侦察与迂回。'},
    shield:{name:'盾兵',color:'#6e7c88',forceWeight:.75,detail:'武力为主，智力为辅；适合稳守正面。'},
    spear:{name:'枪兵',color:'#a87843',forceWeight:.8,detail:'武力为主，智力为辅；适合列阵迎击。'},
    crossbow:{name:'弩兵',color:'#91724c',forceWeight:.35,detail:'武力与智力取较强一项为主；射艺、组织远射皆有所长。'},
    cavalry:{name:'骑兵',color:'#985b4a',forceWeight:.85,detail:'武力为主，智力为辅；善于平原突击。'}
  };
  function typeOf(g){return assignments?.assignments?.[typeof g==='string'?g:g?.id]?.type||assignments?.common?.[g?.commonKind]|| (g?.commonKind==='civil'?'scout':g?.garrison?'shield':g?.role==='civil'?'scout':'spear');}
  function info(g){const type=ids.includes(g)?g:typeOf(g);return {id:type,...definitions[type],reason:assignments?.assignments?.[g?.id]?.reason||definitions[type].detail};}
  function counter(a,b){return matrix[ids.indexOf(a)]?.[ids.indexOf(b)]||0;}
  function badge(g,extra=''){const t=info(g),asset=root.TKAssets?.troops?.[t.id];return `<span class="troop-badge ${extra}" data-troop="${t.id}" title="${t.detail}">${asset?`<img src="${asset.small}" width="24" height="24" alt="" loading="lazy" decoding="async">`:''}<span>${t.name}</span></span>`;}
  function table(){return `<table class="troop-counter-table"><caption>我方伤害修正 · 行为我方，列为敌方</caption><thead><tr><th>我方 / 敌方</th>${ids.map(id=>`<th>${badge(id)}</th>`).join('')}</tr></thead><tbody>${ids.map(a=>`<tr><th>${badge(a)}</th>${ids.map(b=>{const n=Math.round(counter(a,b)*100);return `<td class="${n>0?'favorable':n<0?'unfavorable':''}">${n?(n>0?'+':'')+n+'%':'—'}</td>`;}).join('')}</tr>`).join('')}</tbody></table>`;}
  function allocate(total,weights){total=Math.max(0,Math.floor(total));if(!weights.length)return [];const sum=weights.reduce((a,b)=>a+b,0)||1,raw=weights.map(w=>total*w/sum),out=raw.map(Math.floor),order=raw.map((n,i)=>({i,f:n-out[i]})).sort((a,b)=>b.f-a.f||a.i-b.i);for(let n=total-out.reduce((a,b)=>a+b,0),i=0;n>0;n--,i++)out[order[i%order.length].i]++;return out;}
  function commandProfile(g){
    const specialist=g?.role==='civil'?(g.intellect||0):Math.max(g?.force||0,g?.role==='ruler'?(g.intellect||0):0);
    const command=Math.max(g?.leadership||0,Math.round(specialist*.85)),rank=Math.min(5,Math.floor((g?.xp||0)/40));
    const base=Math.floor((1000+command*15)/50)*50,capacity=Math.min(3000,base+rank*100);
    // Promotions use original abilities, so aging cannot demote an officer.
    const original=g?.baseStats||g||{},ability=original.role==='civil'||g?.role==='civil'?original.intellect:Math.max(original.force||0,g?.role==='ruler'?(original.intellect||0):0);
    const merit=Math.max(original.leadership||0,Math.round((ability||0)*.85));
    const startingRank=g?.commonKind?2:merit>=90?6:merit>=75?5:merit>=60?4:3;
    const officialRank=Math.min(8,startingRank+Math.floor((g?.xp||0)/40));
    const officers=officialRank>=8?5:officialRank>=6?4:officialRank>=4?3:officialRank>=2?2:1;
    return {command,rank,officialRank,officers,capacity,base,growth:rank*100,maximum:Math.min(3000,base+500),nextXp:rank<5?(rank+1)*40:null};
  }
  function formation(generals,total){const gs=generals?.length?generals.slice(0,5):[{id:'garrison',name:'地方守军',garrison:true,leadership:35,force:35,intellect:35,politics:30,charisma:35,xp:0}];const amounts=allocate(total,gs.map(g=>commandProfile(g).capacity));return gs.map((g,i)=>({general:g,type:typeOf(g),initial:amounts[i],troops:amounts[i],lane:i,routed:amounts[i]===0}));}
  return {ids,definitions,matrix,counter,typeOf,info,badge,table,allocate,formation,commandProfile};
});
