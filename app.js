(function () {
  'use strict';
  const E = globalThis.TKEngine, $ = s => document.querySelector(s);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = n => Math.round(Number(n) || 0).toLocaleString('zh-CN');
  const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const SAVE_KEY = 'shanhezhi.campaign.v4';
  const SETTINGS_KEY = 'shanhezhi.preferences.v1';
  let state, selectedId, mapRenderer, toastTimer, endingShown = null, loadNotice = '', preserveInvalidSave = false, loadedRaw = null, hasCampaign = false, inGame = false, importGeneration = 0;
  const cleanSettings = value => ({worldSpeed:[1,2,4].includes(value?.worldSpeed)?value.worldSpeed:1,battleSpeed:[1,4,8].includes(value?.battleSpeed)?value.battleSpeed:value?.battleSpeed===2?4:1});
  let settings=cleanSettings(null);
  try { settings=cleanSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY))); } catch(_) {}
  function backupSave(key,raw) {
    try {
      for(let index=0;index<1000;index++){
        const candidate=index?key+'.'+index:key,existing=localStorage.getItem(candidate);
        if(existing===raw)return true;
        if(existing===null){localStorage.setItem(candidate,raw);return true;}
      }
      return false;
    }
    catch(_) { return false; } // Backup quota must never prevent a valid save from loading.
  }
  try {
    const current = localStorage.getItem(SAVE_KEY), legacy = current ? null : localStorage.getItem('shanhezhi.campaign.v3');
    const raw = current || legacy;
    loadedRaw=raw;
    if (raw) {
      if(legacy)backupSave('shanhezhi.backup.pre-v4',legacy);
      const parsed=JSON.parse(raw),enablingAging=parsed.version===4&&parsed.aging?.enabled===false,changingAging=parsed.version===4&&parsed.aging?.enabled===true&&parsed.aging?.yearsPerPoint===3&&parsed.aging?.daysPerPoint===1095&&parsed.aging?.declinePerPoint===.02;
      const upgradingAging=enablingAging||changingAging,upgradingSeasons=parsed.version===4&&(parsed.turnSystem!=='seasons-v1'||parsed.administrationSystem!=='assignments-v1');
      const upgradingRoster=parsed.version===4&&parsed.rosterRevision!==E.ROSTER_REVISION&&((parsed.rosterRevision===undefined&&parsed.generals?.length===70)||(parsed.rosterRevision==='roster-75-v1'&&parsed.generals?.length===75)||(parsed.rosterRevision==='roster-80-v2'&&parsed.generals?.length===80)||(parsed.rosterRevision==='roster-81-v3'&&parsed.generals?.length===81)||(parsed.rosterRevision==='roster-83-v4'&&parsed.generals?.length===83));
      const upgradingMap=parsed.version===4&&parsed.mapRevision===undefined&&parsed.cities?.length===48,mapBackup=upgradingMap?backupSave('shanhezhi.backup.pre-map-54-v4',raw):true;
      const upgradingLeadership=parsed.leadershipVersion===undefined,leadershipBackup=upgradingLeadership?backupSave('shanhezhi.backup.pre-succession-v4',raw):true;
      const upgradingCommands=parsed.commandSystem!=='season-commands-v1',commandsBackup=upgradingCommands?backupSave('shanhezhi.backup.pre-commands-v4',raw):true;
      const agingBackup=upgradingAging?backupSave(changingAging?'shanhezhi.backup.pre-aging-10-v4':'shanhezhi.backup.pre-aging-v4',raw):true;
      const seasonsBackup=upgradingSeasons?backupSave('shanhezhi.backup.pre-seasons-v4',raw):true;
      const rosterBackup=upgradingRoster?backupSave('shanhezhi.backup.pre-roster-v4',raw):true;
      const upgradingDiplomacy=parsed.diplomacy===undefined; if(upgradingDiplomacy)backupSave("shanhezhi.backup.pre-diplomacy-v4",raw);
      const changingDiplomacy=parsed.diplomacy?.version===1,diplomacyBackup=changingDiplomacy?backupSave('shanhezhi.backup.pre-diplomacy-2-v4',raw):true;
      const upgradingRealm=parsed.diplomacy?.version!==3||!parsed.recruitment,realmBackup=upgradingRealm?backupSave('shanhezhi.backup.pre-relations-v4',raw):true;
      const upgradingRatings=parsed.ratingsRevision!==E.DATA.ratingsRevision,ratingsBackup=upgradingRatings?backupSave('shanhezhi.backup.pre-ratings-84-v5',raw):true;
      const upgradingBalance=parsed.balanceRevision!==E.BALANCE_REVISION,balanceBackup=upgradingBalance?backupSave('shanhezhi.backup.pre-balance-v14',raw):true;
      state = E.migrateState(parsed);
      const previousIds=new Set((Array.isArray(parsed.generals)?parsed.generals:[]).map(g=>g?.id)),addedPeople=state?state.generals.filter(g=>!previousIds.has(g.id)):[];
      const rosterNotice=addedPeople.length?`已补入 ${addedPeople.length} 位人物：${addedPeople.map(g=>g.name).join('、')}，当前归属可在文武名录查看。`:'';
      if (!state) { preserveInvalidSave=!backupSave('shanhezhi.backup.invalid.v4',raw); loadNotice = preserveInvalidSave?'存档校验未通过且备份空间不足，原数据保留，暂停自动覆盖。可导入有效存档或开启新征程。':'存档校验未通过，原数据已另存备份。'; }
      else if(legacy)loadNotice='0.3 征程已升级为四季回合与人物年限。'+rosterNotice+'原版存档仍保留。';
      else if(upgradingCommands||upgradingSeasons||upgradingAging||upgradingRoster||upgradingLeadership||upgradingMap)loadNotice=(upgradingCommands?'征程已升级为每季共享军令：城务即时执行，委派免费；旧已付费工程继续完成。':'')+(upgradingAging?`人物年限已${changingAging?'调整':'启用'}：每 ${E.AGING.yearsPerPoint} 年减 1 点，首次入仕满 ${E.AGING.yearsPerPoint*10} 年退隐；已故与已退隐记录保留。`:'')+(upgradingRoster?rosterNotice:'')+(upgradingMap?'地图已补入六座城；既有兵粮、人物归属和行军保留。':'')+(upgradingLeadership?'已启用君主代政与传位。':'')+(commandsBackup&&agingBackup&&seasonsBackup&&rosterBackup&&leadershipBackup&&mapBackup?'升级前进度已备份。':'本机备份空间不足，请导出当前征程另存。');
      if(state&&upgradingBalance)loadNotice+='已调整携兵、普通人才限额与能力、城池容量和战斗规则；已有文武与兵粮保留。'+(balanceBackup?'升级前进度已备份。':'本机备份空间不足，请导出征程另存。');
      if(state&&upgradingRatings)loadNotice+='五维基础能力已更新；归属、战绩、俘虏和年限保留。'+(ratingsBackup?'原能力存档已备份。':'本机备份空间不足，请导出征程另存。');
      if(state&&upgradingDiplomacy)loadNotice+='已启用外交；旧档保持原有交战关系，可自行出使结盟。';
      if(state&&upgradingRealm)loadNotice+='已更新关系、归顺与限时寻访：谈盟失败下季可再试，成功仍冷却五年；旧盟约保留期限，曹操—袁绍预设盟约已取消。'+(realmBackup&&diplomacyBackup?'升级前存档已备份。':'本机备份空间不足，请导出征程另存。');
    }
  } catch (_) {
    if(loadedRaw){preserveInvalidSave=!backupSave('shanhezhi.backup.invalid.v4',loadedRaw);loadNotice=preserveInvalidSave?'存档读取异常，原数据保留，自动覆盖暂停。':'存档读取异常，原数据已另存备份。';}
    else loadNotice = '本机存档暂不可用，可通过保存面板手动导出。';
  }
  hasCampaign=!!state;
  // Existing UI modules need a valid world for their hidden initial render.
  // This preview is never playable or saved until a faction is confirmed.
  if (!state) state = E.createGame(E.DATA.factions.find(f=>f.leader==='刘备')?.id || E.DATA.factions[0].id,42);
  selectedId = E.ownedCities(state)[0]?.id || state.cities[0].id;
  const faction = id => E.getFaction(state,id) || {id,name:'无主',leader:'守军',color:'#50555C'};
  const canAct = () => inGame && hasCampaign && state.status==='playing' && !state.pendingBattle && !globalThis.TKCampaign?.busy;
  const cityCanAct = c => !!c && c.owner===state.player && canAct() && (c.occupiedUntil||0)<=state.totalDays;
  const canMarch = c => !!c && c.owner===state.player && canAct() && (c.occupiedUntil||0)<=state.totalDays;
  function toast(message) {
    clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').classList.add('show');
    document.querySelectorAll('.dialog-feedback').forEach(e=>e.remove());
    const active=$('#battle-dialog').open?$('#battle-dialog'):$('#main-dialog').open?$('#main-dialog'):null;
    if(active){const note=document.createElement('p');note.className='dialog-feedback';note.setAttribute('role','status');note.textContent=message;(active.querySelector('.dialog-body')||active.querySelector('.battle-controls'))?.prepend(note);}
    toastTimer=setTimeout(()=>{$('#toast').classList.remove('show');document.querySelectorAll('.dialog-feedback').forEach(e=>e.remove());},5000);
  }
  function save() {
    if(preserveInvalidSave){$('#autosave').textContent='原始存档已保留 · 自动覆盖暂停';return;}
    if(!hasCampaign){$('#autosave').textContent='选择势力后开启征程';return;}
    try {localStorage.setItem(SAVE_KEY,JSON.stringify(state));$('#autosave').textContent='已自动保存';}
    catch(_){$('#autosave').textContent='本机存储不可用，请手动导出存档';}
  }
  function render() {
    const p=faction(state.player),owned=E.ownedCities(state),inc=E.incomePreview(state);
    const troops=owned.reduce((n,c)=>n+c.troops,0)+(state.armies||[]).filter(a=>a.faction===state.player).reduce((n,a)=>n+a.troops,0);
    const command=E.commandStatus?.(state)||{remaining:0,total:0};
    $('#resources').innerHTML=`<div class="resource command-resource" title="全势力共享，下季刷新">${icon('flag')}<div><small>军令</small><strong>${command.remaining}<small> / ${command.total}</small></strong></div></div>`+[['coin','国库',p.gold,`每月 +${inc.gold} 金`],['grain','粮草',p.grain,`每月 ${inc.netGrain>=0?'+':''}${inc.netGrain} 粮`],['swords','兵力',troops,'含出征部队']].map(([i,l,v,s])=>`<div class="resource resource-${i}" title="${esc(s)}">${icon(i)}<div><small>${l}</small><strong>${fmt(v)}</strong></div></div>`).join('');
    const city=E.getCity(state,selectedId)||owned[0]||state.cities[0];selectedId=city.id;
    mapRenderer?.setState(state,selectedId,null);TKCity.render(city);
    const cal=E.calendarInfo(state);
    $('#actions-label').textContent=`${state.year} 年 · ${cal.periodName}`;
    $('#turn-income').textContent=`${state.month} 月 ${state.day} 日`;
    $('#end-turn').disabled=!canAct();$('#end-turn').innerHTML=state.status==='playing'?`${cal.isPeriodStart?'推进一季':'继续本季'} ${icon('arrow')}`:'征程已结束';
    $('#end-turn').title='到下个季首停下；军情中断后继续同一季，不增加回合';
    globalThis.TKCampaign?.renderGlobal();globalThis.TKSeasons?.render();renderNextStep();renderRealmCounts(owned);
    globalThis.TKSuccession?.render();globalThis.TKDiplomacy?.render();
    // Let the current action present its battle / prisoner result before succession notices.
    setTimeout(()=>globalThis.TKSuccession?.maybeShow(),0);
  }
  function renderRealmCounts(owned){
    const candidates=owned.flatMap(c=>E.availableTalents(state,c.id).filter(g=>E.hireOffer(state,c.id,g.id).ok)),searches=(state.recruitment?.missions||[]).filter(m=>m.owner===state.player);
    const captives=E.prisoners(state),period=E.calendarInfo(state).period;
    const untreated=captives.filter(g=>g.lastPrisonerDecisionPeriod!==period);
    const talentHint=[candidates.length?`${candidates.length} 人可礼聘`:'寻访与礼聘人才',searches.length?`${searches.length} 队寻访中`:''].filter(Boolean).join(' · ');
    $('#talents-btn').innerHTML=`人才${candidates.length?` <span>${candidates.length}</span>`:''}`;
    $('#talents-btn').title=talentHint;$('#talents-btn').setAttribute('aria-label',`人才 · ${talentHint}`);
    const prisonerHint=`${captives.length} 人在押 · ${untreated.length?`${untreated.length} 人本季待处置`:'本季无需处理'}`;
    $('#prisoners-btn').title=prisonerHint;$('#prisoners-btn').setAttribute('aria-label',`俘虏 · ${prisonerHint}`);
  }
  function renderNextStep(){
    const incoming=state.armies.find(a=>a.faction!==state.player&&a.kind==='attack'&&E.getCity(state,a.destinationId||a.toId)?.owner===state.player);
    let title='可整军、招贤，或推进一季',label='',action=null;
    if(state.status!=='playing')title='本次征程已结束';
    else if(E.leadershipInfo?.(state).status==='pending'){title='请选定新君主';label='选择继任者';action=()=>globalThis.TKSuccession?.showCouncil();}
    else if(incoming){title=`敌军接近${E.getCity(state,incoming.destinationId||incoming.toId).name}`;label='查看敌军';action=()=>TKCampaign.inspectMovement(incoming);}
    $('#next-step').classList.toggle('has-alert',!!action);
    $('#next-step').innerHTML=`<div><strong>${esc(title)}</strong></div>${label?`<button id="next-step-action" class="secondary-button">${esc(label)}</button>`:''}`;
    if(action){$('#next-step-action').onclick=action;$('#next-step-action').disabled=!canAct();}
  }
  function selectCity(id) {
    const c=E.getCity(state,id);if(!c)return;
    selectedId=id;mapRenderer?.setSelectedArmy(null);render();
    if(window.matchMedia?.('(max-width:680px)').matches)$('#city-panel').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function showTargets(fromId){
    const from=E.getCity(state,fromId);if(!canMarch(from))return;
    const targets=E.reachableTargets(state,fromId).sort((a,b)=>a.troops-b.troops);
    dialog('选择进攻目标',`${from.name}出兵 · 可沿我方或盟友道路抵达`,targets.length?`<p class="simple-city-note">先选目标，下一步已有推荐编队，可调整后再出发。</p><div class="target-list">${targets.map(c=>`<button class="target-choice" data-attack-target="${c.id}"><span class="faction-badge" style="--faction-color:${esc(faction(c.owner).color)}">${esc(faction(c.owner).name)}</span><strong>${esc(c.name)}</strong><span>守军 ${fmt(c.troops)} · 约 ${E.marchPlan(state,fromId,c.id).travelDays} 日${E.marchPlan(state,fromId,c.id).borrowed.length?" · 借道":""}</span><b>选择 ›</b></button>`).join('')}</div>`:'<p>暂无可用进军路线。可先在外交中结盟借道，或调兵前往其他前线。</p>',`<button class="secondary-button" data-close>返回地图</button>`,'medium');
    document.querySelectorAll('[data-attack-target]').forEach(button=>button.onclick=()=>TKCampaign.showArmy(fromId,button.dataset.attackTarget));
  }
  function dialog(title,subtitle,body,footer='',size='normal') {
    document.querySelectorAll('.simple-menu[open]').forEach(menu=>menu.open=false);
    const d=$('#main-dialog');d.className=`main-dialog ${size==='wide'?'wide-dialog':size==='medium'?'medium-dialog':''}`;
    $('#dialog-content').innerHTML=`<div class="dialog-header"><div><span class="eyebrow">${subtitle}</span><h2>${title}</h2></div><button class="icon-button" data-close aria-label="关闭">${icon('close')}</button></div><div class="dialog-body">${body}</div>${footer?`<div class="dialog-footer">${footer}</div>`:''}`;
    d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>d.close());if(!d.open)d.showModal();d.scrollTop=0;
  }
  function exportSave(){if(!hasCampaign)return;const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`山河志-群雄割据-${state.year}-${state.month}-${state.day}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('存档已导出。');}
  function showSave(){
    dialog('保存与导入','游戏会自动保存',`<p>继续游戏时会自动恢复本机进度。想留一份备份，点击“导出存档”。</p><p class="help-note">导入会替换当前征程，建议先导出一份。</p><p class="help-note">精简地图需要开启新征程；可先导出原存档留作备份。</p>`,`<button class="secondary-button" id="import-save">导入存档</button><button class="primary-button" id="export-save">导出存档</button>`);
    $('#import-save').onclick=()=>$('#load-input').click();$('#export-save').onclick=exportSave;
    $('#export-save').disabled=!hasCampaign;
  }
  function showSettings(){
    const speeds=(current,label,battle=false)=>(battle?[1,4,8]:[1,2,4]).map(n=>`<option value="${n}" ${n===current?'selected':''}>${n}×${n===1?' · 标准':''}${label&&n===4?' · 快速':''}</option>`).join('');
    dialog('设置','播放速度',`<div class="settings-fields"><label class="field-label" for="setting-world-speed">逐日观察速度<select id="setting-world-speed">${speeds(settings.worldSpeed,true)}</select><small>仅影响“运行天下”的流转速度，不改变每季天数。</small></label><label class="field-label" for="setting-battle-speed">战斗回放速度<select id="setting-battle-speed">${speeds(settings.battleSpeed,true,true)}</select><small>用于之后打开的战斗回放，不改变战斗结果。</small></label></div><p class="help-note" id="settings-status" role="status">修改后自动保存到本机。</p>`,`<button class="secondary-button" id="settings-save">管理存档</button><button class="primary-button" data-close>完成</button>`);
    const update=()=>{settings=cleanSettings({worldSpeed:Number($('#setting-world-speed').value),battleSpeed:Number($('#setting-battle-speed').value)});TKCampaign.applySettings?.(settings);try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));$('#settings-status').textContent='设置已保存。';}catch(_){$('#settings-status').textContent='本机存储不可用，本次设置已生效，关闭后可能无法保留。';}};
    $('#setting-world-speed').onchange=update;$('#setting-battle-speed').onchange=update;$('#settings-save').onclick=showSave;
  }
  function enterGame(){
    if(!hasCampaign)return;
    inGame=true;TKStart.hide();mapRenderer?.setActive?.(true);render();mapRenderer?.focusCity?.(selectedId);if(!TKCampaign.presentFormation?.())checkEnding();
  }
  function leaveGame(){
    inGame=false;TKCampaign.pause?.();mapRenderer?.setActive?.(false);
    globalThis.TKSuccession?.render();globalThis.TKDiplomacy?.render();
    document.querySelectorAll('.simple-menu[open]').forEach(menu=>menu.open=false);
    $('#main-dialog').close();save();
  }
  function showHome(){
    if(TKCampaign.busy||$('#battle-dialog').open)return;
    leaveGame();TKStart.showHome();
  }
  function showNew(){
    if(TKCampaign.busy||$('#battle-dialog').open)return;
    leaveGame();TKStart.showFactions();
  }
  function startCampaign(factionId){
    const choice=E.DATA.factions.find(f=>f.id===factionId);if(!choice)return;
    const commit=()=>{importGeneration++;TKCampaign.pause?.();state=E.createGame(choice.id,Date.now()>>>0);hasCampaign=true;preserveInvalidSave=false;loadedRaw=null;selectedId=E.ownedCities(state).find(c=>c.id===choice.capital)?.id||E.ownedCities(state)[0].id;endingShown=null;$('#main-dialog').close();save();enterGame();mapRenderer.focusCity?.(selectedId);toast('征程开启。选择城池整军，或从“人才”招贤。');};
    if(!hasCampaign&&!loadedRaw){commit();return;}
    dialog(`以${esc(choice.leader)}开启新征程`,'替换当前征程',`<p>开始后将替换本机当前进度。${hasCampaign?'可先导出当前存档，之后随时导入继续。':'当前不可读取的存档也会被替换。'}</p>`,`<button class="secondary-button" data-close>返回选择</button>${hasCampaign?'<button class="secondary-button" id="new-export">先导出存档</button>':''}<button class="primary-button" id="confirm-new">确认开始</button>`);
    if(hasCampaign)$('#new-export').onclick=exportSave;
    $('#confirm-new').onclick=commit;
  }
  function showCities(){
    const own=E.ownedCities(state),others=state.cities.filter(c=>c.owner!==state.player);
    const cards=list=>list.map(c=>`<button class="city-list-button" data-select-city="${c.id}" data-search="${esc(c.name+faction(c.owner).name+(c.region||''))}"><i style="background:${esc(faction(c.owner).color)}"></i><span>${esc(c.name)}${c.kind==='pass'?' · 关':''}</span><small>${fmt(c.troops)}兵 · ${E.cityGenerals(state,c.id).length}将</small></button>`).join('');
    dialog('城池','选择后回到地图',`<label class="field-label">查找城池<input id="city-search" type="search" placeholder="城名或势力名"></label><h3>我的城池 · ${own.length}</h3><div class="city-grid">${cards(own)||'<p>暂无城池。</p>'}</div><details class="quiet-details" id="other-cities"><summary>其他势力 · ${others.length} 座城关</summary><div class="city-grid">${cards(others)}</div></details><p id="city-search-empty" hidden>没有找到对应的城池。</p>`,'','medium');
    $('#city-search').oninput=()=>{const q=$('#city-search').value.trim();let matches=0;document.querySelectorAll('[data-select-city]').forEach(b=>{b.hidden=!b.dataset.search.includes(q);if(!b.hidden)matches++;});$('#other-cities').open=!!q;$('#city-search-empty').hidden=matches>0;};
    document.querySelectorAll('[data-select-city]').forEach(b=>b.onclick=()=>{$('#main-dialog').close();selectCity(b.dataset.selectCity);mapRenderer.focusCity?.(b.dataset.selectCity);});
  }
  function showHelp(){
 dialog('游戏说明','部署与推进',`<div class="quick-guide"><section class="guide-step"><b>1</b><div><h3>选择城池</h3><p>查看驻军和将领，按需要募兵、练兵或出征。内政会自动委派并持续经营，可在“内政分工”调整人选。</p></div></section><section class="guide-step"><b>2</b><div><h3>按需要部署</h3><p>募兵、练兵、建设、寻访和外交使用军令；出征、调兵与内政委派不耗军令。每项操作都会显示花费，军令在下一季刷新。</p></div></section><section class="guide-step"><b>3</b><div><h3>推进时间</h3><p>准备好后点击底部“推进一季”。金粮按月结算，军队沿路行进；敌袭和交战会暂停提醒。</p></div></section></div><details class="quiet-details"><summary>查看详细规则</summary><div class="help-sections"><h3>固定兵种与战前布阵</h3><p>募兵增加通用兵源，每位人物固定率领一种兵种：弩兵、枪兵、骑兵、盾兵、斥候。部队抵达后天下暂停，敌阵先定，我方可调整阵位与方针；同路交锋，击溃对手后以55%伤害支援最近一路。克制修正为±10%或±20%，不等于必胜；统率、武力／智力、训练、士气、地形与城防共同影响伤亡。弩、斥候取武智较强项为主。战斗不可跳过，可4×、8×加速，一方兵力归零才结束。</p>${TKTroops.table()}<h3>怎样招到人才</h3><p>“人才”只列已发现的在野人物。委派文武寻访花1令、20金和20粮，随机8—15日；政治影响发现概率。首次成功寻访优先发现本势力关联人才，连续两次发现普通人才后，下次成功寻访必出具名人才；前两年其他势力不会寻访到你的关联人才。普通文武数量有限，可忽略候选或在已忽略名单恢复。邀请入仕的概率由使者魅力、礼金及归属倾向决定，成功才付礼金，每人每季可邀请一次。寻访结果自动暂停提醒，并保存在人才。天下名录只是图鉴，在职君主或敌臣不是招募候选。</p><h3>结盟与借道</h3><p>在“结盟·关系”委派文武出使，花1令谈两年盟约（8季），双方最多各有4位盟友。成功后同一对势力五年内不可再谈盟；失败关系−8，下季可以重试。概率由魅力、关系、礼物与实力差决定，最高90%；金粮报价根据实时军力、城关、文武与经济变化，成功才交付。修好花1令及金粮，关系+12；向明显强于自己的势力纳贡，关系+18，每季一次。斩首对方文武使关系−35，敌视、死敌的AI会更积极地进攻。归顺须对方仅1城、关系友善、连续结盟半年，我方至少3城且实力达到两倍；成功将整支势力直接并入，每季最多接纳一方。盟约到期前14日提醒；不自动出兵援助，也不能提前毁约。借道军队沿道路逐城经过，不占盟城，行军粮耗随路程增加。道路因盟约到期或城池易主失效时，自动沿原路安全撤回。</p><h3>俘虏与灭国</h3><p>主动进攻战败只撤退，不判定被俘、不增加守城连败。只有守城战败才判定：现任君主3%→8%→15%→25%（之后不再提高），其他文武30%→70%→100%；真正获胜清零，休整与进驻空城不清零。失去最后据点且无军队可投时，剩余在职文武归胜方关押；不会消失。招降需委派我方在城文武出使，不花金、不耗命令。成功率由使者魅力、双方实时国力、被俘者忠诚共同决定；君主更难劝降。失败后下季提高3个百分点、最多累计9个百分点，普通上限70%，君主上限35%。故主灭亡后为100%，仍需委派使者，每人每季处置一次。</p><h3>君主与传位</h3><p>君主被俘后由本势力文武代政，救回即复位；死亡、退隐或投往他国后正式继位。我方自行选继任者，AI自动决定，只能选本势力未被俘、未下线的在职文武。孙策之后优先推荐已加入本势力的孙权。继位不耗军令与金粮，待选时暂停时间；无人可选则军府暂代，募得人才后再择主。无城无军的势力仍按灭国结算。</p><h3>城池与年限</h3><p>城池驻将不限；大城12000兵、普通城8000兵、关口4000兵。每城1名太守，兴商、屯田各1名负责人，可由太守兼任，1—3名文武即可经营。每队1名主将与数名副将：主将2—3阶可编2人、4—5阶3人、6—7阶4人、8阶5人，随经验自动晋升。个人最高3000兵，全队最高12000兵；每40经验额外增加100携兵，最多增加500兵。统率为基础，武将以武力、文臣以智力的85%托底，不改写其原本五维。首次入仕起每 ${E.AGING.yearsPerPoint} 年减1点年限，五维每点线性降低 ${E.AGING.declinePerPoint*100}%，满 ${E.AGING.yearsPerPoint*10} 年退隐；转投不重置。普通年限变化不暂停、不弹窗，在人物面板和军报查看；退隐仍提醒。晚期名将作为在野人才提前可寻访。</p></div></details>`,`<button class="primary-button" data-close>开始部署</button>`,'medium');
}
  function checkEnding(){if(!inGame||!hasCampaign)return;if(state.status==='playing'){globalThis.TKSuccession?.maybeShow();return;}if(endingShown===state.status)return;endingShown=state.status;const won=state.status==='won';dialog(won?'天下归一':'山河待归','本次征程已结束',`<div class="victory-display"><span class="victory-emblem">${won?'统':'志'}</span><p>${esc(faction(state.player).leader)}</p><h3>${won?'四十六城、八雄关，尽归一旗。':'此番失利，来日再起。'}</h3><p>征战 ${state.totalDays} 日 · 终结 ${(state.eliminations||[]).filter(e=>e.byFaction===state.player).length} 方势力</p></div>`,`<button class="secondary-button" data-close>回望山河</button><button class="primary-button" id="restart">再启征程</button>`,'medium');$('#restart').onclick=showNew;}
  mapRenderer=TKMap.create($('#world-map'),{onCityClick:selectCity,onMovementClick:a=>TKCampaign.inspectMovement(a)});
  $('#title-btn').onclick=showHome;$('#settings-btn').onclick=showSettings;$('.brand').onclick=event=>{event.preventDefault();showHome();};
  $('#save-btn').onclick=showSave;$('#help-btn').onclick=showHelp;$('#new-btn').onclick=showNew;$('#citylist-btn').onclick=showCities;
  $('#map-expand').onclick=()=>{const expanded=document.body.classList.toggle('map-expanded');$('#map-expand').textContent=expanded?'恢复布局':'放大查看';$('#map-expand').setAttribute('aria-pressed',String(expanded));};
  $('#home-btn').onclick=()=>{const c=E.ownedCities(state)[0];if(c){selectCity(c.id);mapRenderer.focusCity?.(c.id);}};
  document.querySelectorAll('.simple-menu').forEach(menu=>{
    menu.addEventListener('toggle',()=>{if(menu.open)document.querySelectorAll('.simple-menu[open]').forEach(other=>{if(other!==menu)other.open=false;});});
    menu.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{menu.open=false;}));
  });
  window.addEventListener('click',event=>{document.querySelectorAll('.simple-menu[open]').forEach(menu=>{if(!menu.contains(event.target))menu.open=false;});});
  window.addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelectorAll('.simple-menu[open]').forEach(menu=>menu.open=false);});
  $('#load-input').onchange=async e=>{
    const file=e.target.files[0];if(!file)return;
    const generation=++importGeneration;
    try{
      const raw=await file.text();if(generation!==importGeneration)return;
      const candidate=E.migrateState(JSON.parse(raw));if(!candidate)throw new Error('invalid');
      TKCampaign.pause?.();state=candidate;hasCampaign=true;loadedRaw=null;preserveInvalidSave=false;
      selectedId=E.ownedCities(state)[0]?.id||state.cities[0].id;endingShown=null;$('#main-dialog').close();save();
      if(inGame){render();checkEnding();}else{TKStart.showHome();}
      toast('群雄割据存档已载入');
    }catch(_){if(generation===importGeneration)toast('无法载入：请选择有效的 0.3 或 0.4 剧本存档，旧版可在归档页面继续。');}
    finally{if(generation===importGeneration)e.target.value='';}
  };
  $('#battle-dialog').addEventListener('cancel',e=>e.preventDefault());
  $('#main-dialog').addEventListener('close',()=>{if(!$('#main-dialog').open&&!$('#battle-dialog').open)checkEnding();});
  const api={E,getState:()=>state,getSettings:()=>({...settings}),hasCampaign:()=>hasCampaign,isGameVisible:()=>inGame,getSelectedId:()=>selectedId,getMap:()=>mapRenderer,render,save,toast,dialog,canAct,cityCanAct,canMarch,esc,fmt,icon,selectCity,checkEnding,closeDialog:()=>$('#main-dialog').close(),setSelectedId:id=>{selectedId=id;},openCouncil:id=>TKCity.showCouncil(id),openTransfer:(id,ids=[],targetId)=>TKCampaign.showTransfer(id,ids,targetId),openArmy:(from,to)=>TKCampaign.showArmy(from,to),toggleMarch:showTargets};
  TKPeople.mount(api);TKCity.mount(api);TKCampaign.mount(api);TKSeasons.mount(api);
  globalThis.TKSuccession?.mount(api);globalThis.TKDiplomacy?.mount(api);
  TKStart.mount({...api,onContinue:enterGame,onStart:startCampaign,onSettings:showSettings,onHelp:showHelp});
  mapRenderer.setActive?.(false);render();save();TKStart.showHome();if(loadNotice)toast(loadNotice);
  window.addEventListener('beforeunload',()=>{save();mapRenderer?.destroy();});
})();
