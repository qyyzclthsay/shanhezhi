(function (root) {
  'use strict';
  let api=null,host=null,selectedId=null,returnFocus=null;
  const data=()=>api?.E?.DATA;
  const esc=value=>api?.esc?api.esc(value):String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=value=>api?.fmt?api.fmt(value):String(Number(value)||0);
  const color=f=>/^#[\da-f]{3,8}$/i.test(f?.color||'')?f.color:'#526877';
  const mapPosition=city=>root.TKMapLayout?.position(city)||city;
  const byId=id=>host?.querySelector('#'+id);
  const focus=element=>element?.focus?.({preventScroll:true});

  // These summaries always describe the scenario's opening position, not a save.
  function buildFactionInfo(factionId) {
    const source=data(),faction=source?.factions.find(f=>f.id===factionId);
    if(!faction)return null;
    const places=source.cities.filter(c=>c.owner===factionId);
    const officers=source.generals.filter(g=>g.faction===factionId&&g.status==='serving');
    const capital=places.find(c=>c.id===faction.capital)||places[0]||null;
    const strength=g=>(g.leadership||0)+(g.force||0)+(g.intellect||0);
    const representatives=officers.slice().sort((a,b)=>Number(b.id===faction.leaderId)-Number(a.id===faction.leaderId)||strength(b)-strength(a)).slice(0,3);
    const opening=api.E.openingProfile?.(factionId)||null;
    return {faction,capital,places,officers,representatives,opening,
      cityCount:places.filter(c=>c.kind!=='pass').length,
      passCount:places.filter(c=>c.kind==='pass').length,
      officerCount:officers.length,strongholdCount:places.length};
  }

  function locationMap(factionId) {
    const info=buildFactionInfo(factionId);if(!info)return '';
    const source=data(),width=source.map?.width||1600,height=source.map?.height||1100;
    const selected=new Set(info.places.map(c=>c.id)),nodes=new Map(source.cities.map(c=>[c.id,c]));
    const accent=color(info.faction),capital=info.capital;
    const regions=['幽州','冀州','关中','雍凉','益州','荆州','扬州'];
    const regionLabels=regions.map(region=>{
      const places=source.cities.filter(c=>c.region===region);if(!places.length)return '';
      const x=places.reduce((n,c)=>n+mapPosition(c).x,0)/places.length,y=places.reduce((n,c)=>n+mapPosition(c).y,0)/places.length-68;
      return `<text x="${x.toFixed(1)}" y="${Math.max(40,y).toFixed(1)}" class="start-map-region">${esc(region)}</text>`;
    }).join('');
    const roads=source.edges.map(([a,b])=>{
      if(!nodes.has(a)||!nodes.has(b))return '';
      const from=mapPosition(nodes.get(a)),to=mapPosition(nodes.get(b));
      const ours=selected.has(a)&&selected.has(b);
      return `<path d="M${from.x} ${from.y}L${to.x} ${to.y}" stroke="${ours?accent:'#b5b5a9'}" stroke-width="${ours?7:3}" opacity="${ours?.65:.45}" fill="none"/>`;
    }).join('');
    const points=source.cities.map(c=>{
      const ours=selected.has(c.id),isCapital=c.id===capital?.id;
      const p=mapPosition(c);
      const mark=c.kind==='pass'?`<rect x="${p.x-(ours?10:5)}" y="${p.y-(ours?10:5)}" width="${ours?20:10}" height="${ours?20:10}" rx="2"/>`:`<circle cx="${p.x}" cy="${p.y}" r="${ours?13:6}"/>`;
      return `<g data-map-city="${esc(c.id)}" data-owned="${ours?'true':'false'}" fill="${ours?accent:c.owner==='neutral'?'#50555C':'#b9b6aa'}" opacity="${ours?1:.62}">${isCapital?`<circle cx="${p.x}" cy="${p.y}" r="28" fill="none" stroke="${accent}" stroke-width="4"/>`:''}${mark}<title>${esc(c.name)}${ours?' · '+esc(info.faction.name):c.owner==='neutral'?' · 无主':''}</title></g>`;
    }).join('');
    let capitalLabel='';
    if(capital){
      const p=mapPosition(capital),left=p.x>width-250,labelX=p.x+(left?-40:40),labelY=p.y+11;
      capitalLabel=`<text data-map-capital="${esc(capital.id)}" x="${labelX}" y="${labelY}" text-anchor="${left?'end':'start'}" class="start-map-capital" fill="${accent}" stroke="#f1eadb" stroke-width="11" paint-order="stroke">${esc(capital.name)}</text>`;
    }
    return `<svg class="start-location-map" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(info.faction.name)}开局据点分布：${info.cityCount}城，${info.passCount}关；首府${esc(capital?.name||'暂无')}" focusable="false"><title>${esc(info.faction.name)}开局版图</title><desc>上北下南，左西右东。控制据点：${info.places.map(c=>esc(c.name)).join('、')}。方形为关口，圆形为城池。</desc><rect width="${width}" height="${height}" rx="24" fill="#f0eadc"/>${regionLabels}${roads}${points}${capitalLabel}<g transform="translate(${width-96} 86)" fill="#8e806a"><path d="M0 0L-13 38L0 30L13 38Z"/><text x="0" y="-14" text-anchor="middle" font-size="35">北</text><text x="35" y="38" font-size="25">东</text></g></svg>`;
  }

  function portrait(person,className='') {
    const art=root.TKPortraits?.render(person||{}, {size:'small',isRuler:data().factions.some(f=>f.leaderId===person?.id)})||`<span>${esc(person?.name?.slice(0,1)||'将')}</span>`;
    return `<span class="start-portrait ${className}" aria-hidden="true"><span class="start-portrait-art">${art}</span>${root.TKTroops?.badge(person)||''}</span>`;
  }
  function setVisible(label) {
    if(!host)return false;
    if(host.hidden)returnFocus=document.activeElement;
    host.hidden=false;host.setAttribute('aria-label',label);document.body.classList.add('at-title');return true;
  }
  function homeArtwork() {
    const cover=root.TKAssets.cover;
    return `<div class="start-cover custom-cover"><img src="${cover.large}" srcset="${cover.small} 480w, ${cover.large} 941w" sizes="(max-width:760px) 100vw, 52vw" width="941" height="1672" alt="山河志：无面群英战图" fetchpriority="high" decoding="async"></div>`;
  }
  function campaignSummary() {
    if(!api.hasCampaign())return '暂无可继续的征程';
    const state=api.getState();if(!state)return '继续已保存的征程';
    const faction=state.factions?.find(f=>f.id===state.player)||data().factions.find(f=>f.id===state.player);
    const places=state.cities?.filter(c=>c.owner===state.player)||[];
    return `${faction?.leader||faction?.name||'当前势力'} · ${state.year} 年 ${state.month} 月 ${state.day} 日 · ${places.length} 座城关`;
  }
  function showHome() {
    if(!api||!setVisible('山河志主菜单'))return;
    const saved=!!api.hasCampaign();
    host.innerHTML=`<div class="start-home illustrated-home"><div class="start-home-content">${homeArtwork()}<div class="start-command"><header class="start-brand"><p class="start-edition">三国 · 策略</p><h1 id="start-title">山河志</h1><p class="start-scenario"><span>群雄割据</span><span>公元 ${data().startYear||194} 年</span></p></header><nav class="start-home-menu" aria-label="主菜单"><button type="button" class="start-menu-button start-menu-main" id="start-new" aria-label="开始游戏"><span>开始游戏</span></button><button type="button" class="start-menu-button" id="start-continue" aria-label="继续游戏" aria-describedby="start-save-summary"${saved?'':' disabled'}><span>继续游戏</span></button><p class="start-save-summary" id="start-save-summary">${esc(campaignSummary())}</p><div class="start-menu-secondary"><button type="button" class="start-menu-button" id="start-settings"><span>设置</span></button><button type="button" class="start-menu-button" id="start-help"><span>游戏说明</span></button></div></nav></div></div></div>`;
    byId('start-new').onclick=showFactions;
    byId('start-continue').onclick=()=>{if(api.hasCampaign())api.onContinue();};
    byId('start-settings').onclick=()=>api.onSettings();
    byId('start-help').onclick=()=>api.onHelp();
    focus(byId(saved?'start-continue':'start-new'));
  }
  function difficultyBadge(profile, factionId = '') {
    if(!profile)return '';
    return `<span class="start-difficulty" data-difficulty="${esc(profile.difficulty)}"${factionId?` data-start-difficulty="${esc(factionId)}"`:''} title="开局难度：${esc(profile.difficulty)}">${esc(profile.difficulty)}</span>`;
  }
  function openingResources(profile) {
    if(!profile)return '';
    const support=profile.support;
    const extra=[[support.gold,'金'],[support.grain,'粮'],[support.troops,'首府兵源']].filter(([amount])=>amount>0).map(([amount,label])=>`${label} +${fmt(amount)}`).join('、');
    const supplies=extra?`玩家额外补给：${extra}，已计入上方数值。`:'本势力无额外补给。';
    const talent=support.talentName?`另已发现${support.talentName}，需礼金招募。`:'';
    return `<section class="start-opening" aria-label="开局资源与难度"><div class="start-opening-heading"><h3>开局资源</h3>${difficultyBadge(profile)}</div><dl class="start-opening-resources"><div><dt>金</dt><dd id="start-opening-gold">${fmt(profile.gold)}</dd></div><div><dt>粮</dt><dd id="start-opening-grain">${fmt(profile.grain)}</dd></div><div><dt>总驻军</dt><dd id="start-opening-troops">${fmt(profile.troops)}</dd></div></dl><details class="start-supply-details"><summary>${extra?'已含弱势力补给':'补给与难度说明'}${support.talentName?' · 已发现'+esc(support.talentName):''}</summary><p class="start-opening-note">${esc(profile.difficultyDetail)}<span>${esc(supplies)}${esc(talent)}</span></p></details></section>`;
  }
  function talentGuide(info) {
    const roster=api.E.rosterOverview?.();
    const freeCount=roster?.free??data().generals.filter(g=>g.status==='free').length;
    return `<details class="start-people-guide"><summary>文武与招募 <span>在职 ${info.officerCount} · 天下在野 ${freeCount}</span></summary><div class="start-people-content"><div class="start-employed"><b>开局在职</b><ul class="start-employed-list" aria-label="开局在职文武">${info.officers.map(g=>`<li>${portrait(g)}<span>${esc(g.name)}</span></li>`).join('')}</ul></div><p class="start-roster-rule">在野人才需先寻访再邀请；普通人才更常见，名人才优先关联势力。</p></div></details>`;
  }
  function factionDetail(info) {
    const f=info.faction,leader=info.officers.find(g=>g.id===f.leaderId)||data().generals.find(g=>g.id===f.leaderId);
    return `<section class="start-faction-overview" style="--start-faction:${color(f)}" aria-label="${esc(f.leader||f.name)}势力详情"><div class="start-detail-heading">${portrait(leader)}<div><span class="start-eyebrow">${esc(info.capital?.region||'天下')} · 首府 ${esc(info.capital?.name||'暂无')}</span><h2>${esc(f.leader||f.name)}</h2><p>${esc(f.description||'立足一方，经营城池，逐鹿天下。')}</p></div></div><div class="start-detail-body"><div class="start-detail-stats"><dl class="start-faction-facts"><div><dt>城池</dt><dd>${fmt(info.cityCount)}</dd></div><div><dt>关口</dt><dd>${fmt(info.passCount)}</dd></div><div><dt>在职文武</dt><dd>${fmt(info.officerCount)}</dd></div></dl>${openingResources(info.opening)}<div class="start-representatives"><h3>代表人物</h3><div>${info.representatives.map(g=>`<span>${portrait(g)}<b>${esc(g.name)}</b></span>`).join('')}</div></div></div><div class="start-map-panel"><div class="start-map-heading"><h3>开局版图</h3><span>${info.places.map(c=>esc(c.name)).join(' · ')}</span></div>${locationMap(f.id)}<div class="start-map-key"><span><i style="background:${color(f)}"></i>所选势力</span><span>□ 关口　○ 城池</span></div></div></div>${talentGuide(info)}<p class="start-allies"><b>开局盟约</b>　${(api.E.OPENING_ALLIANCES||[]).filter(t=>[t.a,t.b].includes(f.id)).map(t=>esc(data().factions.find(other=>other.id===(t.a===f.id?t.b:t.a)).name)+" · "+(t.days===365?"四季":"两季")).join("　")||"暂无；可在游戏中出使结盟"}</p></section>`;
  }
  function selectFaction(id,announce=true) {
    const info=buildFactionInfo(id);if(!info)return;
    selectedId=id;
    host.querySelectorAll('[data-start-faction]').forEach(input=>{input.checked=input.value===id;});
    byId('start-faction-detail').innerHTML=factionDetail(info);
    byId('start-choice-summary').textContent=`以${info.faction.leader||info.faction.name}开始征程`;
    if(announce)byId('start-selection-status').textContent=`已选择${info.faction.leader||info.faction.name}，${info.cityCount}座城、${info.passCount}处关口、${info.officerCount}位文武。${info.opening?`开局${info.opening.difficulty}，金${fmt(info.opening.gold)}、粮${fmt(info.opening.grain)}、总驻军${fmt(info.opening.troops)}。`:''}点击开始征程后才会进入游戏。`;
  }
  function showFactions() {
    if(!api||!setVisible('选择势力'))return;
    if(!buildFactionInfo(selectedId))selectedId=data().factions.find(f=>f.leaderId==='liubei'||f.id==='shu')?.id||data().factions[0]?.id;
    const cards=data().factions.map(f=>{
      const info=buildFactionInfo(f.id),leader=data().generals.find(g=>g.id===f.leaderId);
      return `<label class="start-faction-card" style="--start-faction:${color(f)}"><input type="radio" name="start-faction" value="${esc(f.id)}" data-start-faction="${esc(f.id)}"${f.id===selectedId?' checked':''}><span class="start-faction-card-inner">${portrait(leader)}<span class="start-faction-card-copy"><span class="start-card-title"><strong>${esc(f.leader||f.name)}</strong>${difficultyBadge(info.opening,f.id)}</span><small>${esc(info.capital?.name||'暂无首府')} · ${info.cityCount}城 · ${info.passCount}关</small></span><span class="start-card-mark" aria-hidden="true">✓</span></span></label>`;
    }).join('');
    host.innerHTML=`<div class="start-factions"><header class="start-select-header"><button type="button" class="start-back" id="start-back">← 返回主菜单</button><span>群雄割据 · ${data().startYear||194} 年 ${data().startMonth||6} 月</span></header><div class="start-select-title"><h1>选择势力</h1><p>${data().startYear||194} 年群雄格局，版图为玩法改编。</p></div><div class="start-selection-layout"><fieldset class="start-faction-field"><legend>可选势力 · ${data().factions.length} 路诸侯</legend><div class="start-faction-grid">${cards}</div><p class="start-keyboard-note">方向键切换 · 选择后即可查看详情</p></fieldset><div id="start-faction-detail"></div></div><footer class="start-selection-footer"><div><strong id="start-choice-summary"></strong><span>确认后才会进入游戏。</span></div><button type="button" class="start-confirm" id="start-confirm">开始征程 <span aria-hidden="true">→</span></button></footer><p id="start-selection-status" class="start-visually-hidden" role="status" aria-live="polite"></p></div>`;
    byId('start-back').onclick=showHome;
    host.querySelectorAll('[data-start-faction]').forEach(input=>{input.onchange=()=>{if(input.checked)selectFaction(input.value);};});
    byId('start-confirm').onclick=()=>{if(buildFactionInfo(selectedId))api.onStart(selectedId);};
    selectFaction(selectedId,false);
    focus(host.querySelector(`[data-start-faction="${selectedId}"]`));
  }
  function hide() {
    if(!host)return;
    host.hidden=true;document.body.classList.remove('at-title');
    if(returnFocus?.isConnected&&!host.contains?.(returnFocus))focus(returnFocus);
    returnFocus=null;
  }
  function isOpen() {return !!host&&!host.hidden;}
  function mount(nextApi) {
    if(!nextApi?.E?.DATA||!['getState','hasCampaign','onContinue','onStart','onSettings','onHelp'].every(key=>typeof nextApi[key]==='function'))throw new Error('TKStart.mount requires the start-screen API.');
    api=nextApi;host=document.getElementById('start-screen');
    if(!host)throw new Error('TKStart requires #start-screen.');
    selectedId=data().factions.find(f=>f.leaderId==='liubei'||f.id==='shu')?.id||data().factions[0]?.id;
    returnFocus=null;
  }
  root.TKStart={mount,showHome,showFactions,hide,isOpen,buildFactionInfo,locationMap};
})(globalThis);
