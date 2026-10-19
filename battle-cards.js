(function(root,factory){'use strict';const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;root.TKBattle=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const STATS=[['leadership','统'],['force','武'],['intellect','智'],['politics','政'],['charisma','魅']],TYPES={infantry:'步',archer:'弓',cavalry:'骑'};
  const clamp=(n,a,b)=>Math.min(b,Math.max(a,n)),number=n=>Math.max(0,Math.floor(Number(n)||0));
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>number(n).toLocaleString('zh-CN');
  // Largest remainders preserve every soldier, including tiny garrisons.
  function allocate(total,weights){
    total=number(total);const sum=weights.reduce((a,b)=>a+b,0)||1,raw=weights.map(w=>total*w/sum),parts=raw.map(Math.floor);
    const order=raw.map((x,i)=>({i,f:x-parts[i]})).sort((a,b)=>b.f-a.f||a.i-b.i);
    let left=total-parts.reduce((a,b)=>a+b,0);for(let i=0;left>0;i++,left--)parts[order[i%order.length].i]++;
    return parts;
  }
  function buildModel(battle,result,playerFaction){
    const make=side=>{
      const total=number(battle[side==='attacker'?'attackers':'defenders']),remaining=clamp(number(result[side==='attacker'?'attackersRemaining':'defendersRemaining']),0,total);
      const officers=(battle[side+'Generals']||[]).slice(0,5),gs=officers.length?officers:[{id:'garrison-'+side,name:'地方守军',garrison:true}];
      const initial=allocate(total,gs.map(g=>Math.max(1,(Number(g.leadership)||45)+35))),losses=allocate(total-remaining,initial);
      return {side,faction:battle[side+'Faction'],total,remaining,units:battle[side+'Units']||{},training:battle[side+'Training']??20,morale:battle[side+'Morale']??75,cards:gs.map((g,i)=>({general:g,initial:initial[i],losses:losses[i],remaining:initial[i]-losses[i],curve:.85+i*.1}))};
    };
    const attacker=make('attacker'),defender=make('defender'),ours=playerFaction===battle.defenderFaction?'defender':'attacker',simulation=['lanes-v1','lanes-v2'].includes(result.simulation?.version)?result.simulation:null;
    if(simulation)for(const side of ['attacker','defender']){
      const army=side==='attacker'?attacker:defender;
      army.cards.forEach((c,i)=>{c.initial=simulation.initial[side][i].troops;c.type=simulation.initial[side][i].type;c.remaining=simulation.frames.at(-1)[side][i].troops;c.losses=c.initial-c.remaining;});
    }
    return {attacker,defender,left:ours,right:ours==='attacker'?'defender':'attacker',rounds:simulation?.rounds||24,duration:simulation?clamp(simulation.rounds*550,14000,36000):18000,simulation};
  }
  function frameAt(model,progress){
    const p=clamp(Number(progress)||0,0,1),frame={progress:p};
    if(model.simulation){
      const t=p*model.rounds,i=Math.floor(t),a=model.simulation.frames[i],b=model.simulation.frames[Math.min(model.rounds,i+1)];frame.events=a.events;
      for(const side of ['attacker','defender']){const cards=a[side].map((c,j)=>({troops:Math.round(c.troops+(b[side][j].troops-c.troops)*(t-i)),initial:model[side].cards[j].initial,routed:c.routed}));frame[side]={cards,total:cards.reduce((n,c)=>n+c.troops,0)};}return frame;
    }
    for(const side of ['attacker','defender']){const cards=model[side].cards.map(c=>({troops:c.initial-Math.floor(c.losses*Math.pow(p,c.curve)),initial:c.initial}));frame[side]={cards,total:cards.reduce((n,c)=>n+c.troops,0)};}return frame;
  }
  function create(container,battle,result,options={}){
    const model=buildModel(battle,result,options.playerFaction),factions=options.factions||root.TKScenario?.factions||[];
    const faction=id=>factions.find(f=>f.id===id)||{name:'地方守军',color:'#777773'};
    const portrait=g=>g.garrison?'<span class="battle-garrison" aria-label="地方守军">守</span>':root.TKPortraits?.render(g,{size:'small',isRuler:!!g.wasRuler,rulerLabel:'出战时君主'})||`<span class="battle-garrison">${esc(g.name[0])}</span>`;
    const column=side=>{
      const army=model[side],f={...faction(army.faction),name:battle[side+'FactionName']||faction(army.faction).name},left=side===model.left;
      return `<section class="battle-side" data-side="${side}" style="--army-color:${/^#[a-f\d]{6}$/i.test(f.color)?f.color:'#737373'}" aria-label="${left?'我方':'敌方'}阵容"><header class="battle-side-heading"><div><small>${left?'我方':'敌方'} · ${side==='attacker'?'进攻':'守城'}</small><h3>${esc(f.name)}</h3></div><strong data-army-total="${side}">${fmt(army.total)}</strong></header><div class="battle-army-meta"><span>训 ${army.training} · 士气 ${army.morale}</span><span>${army.cards.length} 路阵位</span></div><div class="battle-card-list">${army.cards.map((c,i)=>`<article class="battle-officer" data-battle-card="${side}-${i}" aria-label="${esc(c.general.name)}所部"><div class="battle-card-face"><span class="battle-portrait-art">${portrait(c.general)}</span>${root.TKTroops?.badge(c.type||c.general)||''}</div><div class="battle-card-info"><div class="battle-card-name"><h4>${esc(c.general.name)}</h4><span>${i+1}路</span></div><div class="battle-card-stats">${STATS.map(([key,label])=>`<span title="${{leadership:'统率',force:'武力',intellect:'智力',politics:'政治',charisma:'魅力'}[key]}">${label}<b>${c.general.garrison?'—':number(c.general[key])}</b></span>`).join('')}</div></div><div class="battle-card-troops"><span>所部兵力</span><strong data-card-troops>${fmt(c.initial)}</strong><small data-card-loss></small><em data-card-duty></em></div><div class="battle-strength-bar" role="meter" aria-label="${esc(c.general.name)}剩余兵力" aria-valuemin="0" aria-valuemax="${c.initial}" aria-valuenow="${c.initial}"><i data-card-bar></i></div><span class="battle-hit-number" aria-hidden="true" data-card-hit></span></article>`).join('')}</div></section>`;
    };
    container.innerHTML=`<div class="battle-stage-note"><span>${esc({plain:'平原',mountain:'山地',river:'水乡',forest:'林地'}[battle.terrain]||'城下')} · 城防 ${battle.wall||0}</span><strong data-battle-phase>两军列阵</strong><span>同路交锋 · 邻路支援</span></div><div class="battle-card-arena">${column(model.left)}${column(model.right)}</div><p class="battle-card-footnote">伤亡按各路实际交锋结算；一方兵力归零结束，零兵不代表将领阵亡；俘获另行判定。</p>`;
    const cards={};for(const side of ['attacker','defender'])cards[side]=model[side].cards.map((_,i)=>{const el=container.querySelector(`[data-battle-card="${side}-${i}"]`);return {el,count:el.querySelector('[data-card-troops]'),loss:el.querySelector('[data-card-loss]'),bar:el.querySelector('[data-card-bar]'),meter:el.querySelector('[role="meter"]'),hit:el.querySelector('[data-card-hit]'),duty:el.querySelector('[data-card-duty]')};});
    const totals={attacker:container.querySelector('[data-army-total="attacker"]'),defender:container.querySelector('[data-army-total="defender"]')},phase=container.querySelector('[data-battle-phase]');
    let speed=1,paused=false,destroyed=false,completed=false,elapsed=0,wallElapsed=0,last=null,raf=0,lastPaint=-100,lastRound=0,lastImpact=-1000,previous=frameAt(model,0);
    function paint(p){
      const frame=frameAt(model,p),round=Math.min(model.rounds,Math.floor(p*model.rounds));phase.textContent=p>=1?'交战结束':p===0?'两军列阵':`交锋 ${Math.max(1,round)} / ${model.rounds}`;
      for(const side of ['attacker','defender']){totals[side].textContent=fmt(frame[side].total);cards[side].forEach((view,i)=>{
        const value=frame[side].cards[i],initial=model[side].cards[i].initial,loss=initial-value.troops,hit=previous[side].cards[i].troops-value.troops;
        view.count.textContent=fmt(value.troops);view.loss.textContent=loss?'损 '+fmt(loss):'';view.bar.style.transform=`scaleX(${initial?value.troops/initial:0})`;view.meter.setAttribute('aria-valuenow',String(value.troops));view.el.classList.toggle('is-routed',value.routed||value.troops===0);const action=frame.events?.find(e=>e.side===side&&e.from===i);view.duty.textContent=value.routed?'兵力耗尽':action?.support?'转援 '+(action.to+1)+'路':action?'交锋 '+(action.to+1)+'路':'';
        if(round!==lastRound&&wallElapsed-lastImpact>=500){view.el.classList.remove('is-hit');if(hit>0&&p<1){void view.el.offsetWidth;view.el.classList.add('is-hit');view.hit.textContent='−'+fmt(hit);}}
      });}if(round!==lastRound){if(wallElapsed-lastImpact>=500)lastImpact=wallElapsed;previous=frame;lastRound=round;}
    }
    function tick(now){
      if(destroyed||completed)return;if(last!==null&&!paused&&!root.document?.hidden){const dt=Math.min(100,Math.max(0,now-last));wallElapsed+=dt;elapsed+=dt*speed;}last=now;
      if(elapsed-lastPaint>=70||elapsed>=model.duration){paint(elapsed/model.duration);lastPaint=elapsed;}
      if(elapsed>=model.duration){completed=true;paint(1);options.onComplete?.();return;}raf=root.requestAnimationFrame(tick);
    }
    paint(0);raf=root.requestAnimationFrame(tick);
    return {pause(){paused=true;},resume(){paused=false;last=null;},setSpeed(value){if([1,4,8].includes(value))speed=value;},destroy(){destroyed=true;root.cancelAnimationFrame(raf);},get complete(){return completed;}};
  }
  return {create,buildModel,frameAt};
});
