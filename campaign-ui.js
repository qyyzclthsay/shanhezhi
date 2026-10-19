(function(root){
  'use strict';
  let api,ready=false,busy=false,battleView=null,timer,lastState,selectedArmy=null,notice='',noticeTalentCity=null,noticeDanger=false,armyFilter='front',serviceNotices=[];
  const $=s=>document.querySelector(s),clock={running:false,speed:1,elapsed:0,last:performance.now()};
  const TACTICS={assault:'全军冲阵',steady:'稳步推进',flank:'侧翼迂回'};
  const state=()=>api.getState(),city=id=>api.E.getCity(state(),id),faction=id=>api.E.getFaction(state(),id)||{name:'地方守军',leader:'守军',color:'#50555C'};
  const esc=v=>api.esc(v),fmt=n=>api.fmt(n),icon=n=>api.icon(n),sum=u=>Object.values(u).reduce((a,b)=>a+b,0);
  const ownGenerals=id=>api.E.cityGenerals(state(),id),canUse=c=>!!c&&c.owner===state().player&&api.canMarch(c)&&!busy;
  const progress=a=>Math.max(0,Math.min(1,a.progress??a.elapsedDays/a.travelDays));
  const eta=a=>api.E.armyEta(state(),a);
  const danger=a=>a.faction!==state().player&&a.kind==='attack'&&destination(a)?.owner===state().player;
  const armyNames=a=>a.generalIds.map(id=>state().generals.find(g=>g.id===id)?.name).filter(Boolean).join('、')||'地方统领';
  const destination=a=>city(a.withdrawalRoute?a.reservationCityId:a.destinationId||a.toId);
  const originName=a=>a.kind==='retreat'?'途中':city(a.originId||a.fromId)?.name;
  const kind=a=>a.releaseReturn?'归乡':a.kind==='attack'?'进攻':a.kind==='retreat'?'撤回':'增援';
  const isServiceAlert=a=>a.kind==='service_decline'||a.kind==='retirement';
  const needsAttention=a=>a.kind==='incoming'||a.kind==='battle'||a.kind==='succession'&&a.type==='pending'&&a.faction===state().player;
  function serviceSummary(alerts){
    const retired=alerts.filter(a=>a.kind==='retirement'),declined=alerts.filter(a=>a.kind==='service_decline');
    return [retired.length?`${retired.length} 位文武满 ${api.E.AGING.yearsPerPoint*10} 年退隐`:null,declined.length?`${declined.length} 位文武年限储备减少`:null].filter(Boolean).join('；');
  }
  function serviceMarkup(alerts){
    if(!alerts.length)return '';
    const person=a=>`<p><strong>${esc(a.generalName||state().generals.find(g=>g.id===a.generalId)?.name||'文武')}</strong> · ${esc(faction(a.faction).name)}<br>${esc(a.message||`年限储备 ${a.previousReserve} → ${a.serviceReserve}`)}${a.totalDays!=null?`<small> · 开局第 ${a.totalDays+1} 日</small>`:''}</p>`;
    const groups=[['retirement',`${api.E.AGING.yearsPerPoint*10} 年届满 · 退隐名单`],['service_decline',`${api.E.AGING.yearsPerPoint} 年届满 · 年限储备变化`]].map(([kind,label])=>{
      const list=alerts.filter(a=>a.kind===kind);if(!list.length)return '';
      const ours=list.filter(a=>a.faction===state().player),others=list.filter(a=>a.faction!==state().player);
      return `<article class="report-card"><div class="report-heading"><strong>${label}</strong><small>${list.length} 人</small></div><p><strong>我方 ${ours.length} 人</strong></p>${ours.map(person).join('')}${others.length?`<details class="personnel-others"><summary>他方 ${others.length} 人 · 展开完整名单</summary>${others.map(person).join('')}</details>`:''}</article>`;
    }).join('');
    return `<section class="report-list" aria-label="文武年限与退隐名单"><div class="section-caption"><span class="eyebrow">文武年限 · ${alerts.length} 条人事消息</span></div><p class="dialog-description">以下变化已生效，可前往人才查看能力与任职。</p>${groups}</section>`;
  }
  function rememberServiceAlerts(alerts){
    const keys=new Set(serviceNotices.map(a=>`${a.kind}:${a.generalId}:${a.totalDays}`));
    serviceNotices=[...alerts.filter(a=>!keys.has(`${a.kind}:${a.generalId}:${a.totalDays}`)),...serviceNotices];
  }
  function showServiceNotices(alerts=state().personnelNotices||serviceNotices){
    api.dialog(alerts.some(a=>a.kind==='retirement')?'文武退隐与年限纪事':'文武年限纪事','人事纪事 · 变化已记入名册',serviceMarkup(alerts),'<button class="secondary-button" data-close>返回天下</button>','medium');
    bindReportClose();
  }
  function captureMarkup(result){
    const captures=result.capturedGenerals||[],ours=captures.filter(g=>g.captor===state().player),lost=captures.filter(g=>g.faction===state().player&&g.captor!==state().player);
    const held=api.E.prisoners(state()).filter(g=>ours.some(p=>p.id===g.id));
    const card=(person,label)=>{const g=state().generals.find(g=>g.id===person.id)||person;return `<div class="battle-captive">${TKPeople.portrait(g)}<span><strong>${esc(person.name)}</strong><small>${label}</small></span></div>`;};
    return `<section class="capture-summary" aria-label="本战俘虏结果"><h4>本战我方俘获 ${ours.length} 人 · 我方被俘 ${lost.length} 人</h4>${ours.length?`<div class="battle-capture-list">${ours.map(g=>card(g,'敌将被俘')).join('')}</div>`:'<p>本战没有抓获敌将。</p>'}${lost.length?`<div class="battle-capture-list">${lost.map(g=>card(g,'被'+esc(faction(g.captor).name)+'关押')).join('')}</div>`:''}${result.escapedGenerals?.length?`<p>逃脱：${result.escapedGenerals.map(esc).join('、')}</p>`:''}${held.length?'<button class="primary-button" data-battle-prisoners>前往俘虏营 · 招降</button>':''}</section>`;
  }
  function bindCaptives(){document.querySelectorAll('[data-battle-prisoners]').forEach(b=>b.onclick=()=>{battleView?.destroy();battleView=null;$('#battle-dialog').close();TKPeople.showPrisoners();});}
  function battleReportsMarkup(list){return `<div class="report-list">${list.map(r=>`<article class="report-card ${r.battle.defenderFaction===state().player?'danger':''}"><div class="report-heading"><strong>${esc(city(r.battle.toId)?.name)}${r.result.unopposed?' · 进驻':'之战'}</strong><small>${r.totalDays!=null?`开局第${r.totalDays+1}日`:`第${r.turn}季`}</small></div><p>${esc(r.result.message)}</p>${r.result.unopposed?'<p>兵力无损，可委派驻将经营此城。</p>':captureMarkup(r.result)+'<button class="secondary-button" data-replay="'+r.id+'">回看战场 ↗</button>'}</article>`).join('')||'<p class="empty-note">尚未发生战斗。</p>'}</div>`;}
  function bindReplay(){document.querySelectorAll('[data-replay]').forEach(b=>b.onclick=()=>{const r=state().lastBattles.find(x=>x.id===b.dataset.replay);if(r)presentBattle(r.battle,r.result);});bindCaptives();}
  function bindReportClose(){document.querySelectorAll('#main-dialog [data-close]').forEach(b=>b.onclick=()=>{api.closeDialog();api.checkEnding();});}
  function projectDepartureNote(c){
    const p=c.project;if(!p)return '';
    const name=state().generals.find(g=>g.id===p.officerId)?.name||'项目执行人',label=p.kind==='develop'?({farm:'开垦农田',market:'兴建集市',wall:'加固城防'}[p.target]||'城建工程'):p.kind==='recruit'?'募集兵源':p.kind==='train'?'校场练兵':'派员寻访';
    return `<p class="help-note">${esc(name)}正在负责${esc(label)}（剩余 ${p.remainingDays} 日）；若将其派出，此项目会中止，预付金粮全额退还。</p>`;
  }
  function modalOpen(){return api.isGameVisible?.()===false||$('#main-dialog').open||$('#battle-dialog').open;}
  function pause(){clock.running=false;clock.elapsed=0;clock.last=performance.now();updateClock();}
  function applySettings(settings){clock.speed=[1,2,4].includes(settings.worldSpeed)?settings.worldSpeed:1;clock.elapsed=0;clock.last=performance.now();updateClock();}
  const successionPending=()=>api?.E.leadershipInfo?.(state()).status==='pending';
  function updateClock(){if(!api)return;const pending=successionPending();if(pending)clock.running=false;const suspended=busy||modalOpen()||document.hidden;$('#clock-toggle').textContent=clock.running?'Ⅱ 暂停天下':'▶ 运行天下';$('#clock-toggle').setAttribute('aria-label',clock.running?'暂停天下':'运行天下');$('#clock-toggle').classList.toggle('running',clock.running);$('#clock-toggle').disabled=state().status!=='playing'||busy||pending;$('#clock-speed').textContent=`${clock.speed}×`;$('#clock-label').textContent=pending?'待选继任者 · 天下已暂停':!clock.running?'已暂停 · 可自由部署':suspended?'面板开启 / 后台 · 已暂停计时':`${clock.speed} 倍速 · 每 ${2/clock.speed} 秒一日 · 季初暂停`;$('#clock-progress').style.width=`${Math.min(100,clock.elapsed/2000*100)}%`;$('#world-status').textContent=clock.running&&!suspended?'天下进行中':'天下暂歇';const summary=$('.clock-options summary');if(summary)summary.textContent=clock.running?'观察中 · 可暂停':'逐日观察';}
  function renderGlobal(){
    if(!ready)return;const s=state();if(s!==lastState){lastState=s;clock.running=false;clock.elapsed=0;selectedArmy=null;notice='';noticeTalentCity=null;noticeDanger=false;serviceNotices=s.personnelNotices||[];}
    const ours=s.generals.filter(g=>g.faction===s.player&&['serving','marching','prisoner'].includes(g.status));
    $('#realm-identity').innerHTML=`<span class="faction-badge" style="--faction-color:${faction(s.player).color}">${esc(faction(s.player).name)}</span><strong>${esc(faction(s.player).leader)}</strong>`;
    $('#officer-count').textContent=ours.length;$('#prisoner-count').textContent=api.E.prisoners(s).length;$('#report-count').textContent=s.lastBattles.filter(b=>b.battle.attackerFaction===s.player||b.battle.defenderFaction===s.player).length;
    ['prisoner-count','report-count'].forEach(id=>document.getElementById(id).hidden=Number(document.getElementById(id).textContent)===0);
    $('#map-count').textContent=`${s.cities.filter(c=>c.kind!=='pass').length} 城 · ${s.cities.filter(c=>c.kind==='pass').length} 关 · ${s.generals.length} 文武`;
    $('#map-legend').innerHTML=s.factions.filter(f=>api.E.ownedCities(s,f.id).length||s.armies.some(a=>a.faction===f.id)).map(f=>`<span class="legend-item"><i style="background:${f.color}"></i>${esc(f.leader)}</span>`).join('')+'<span class="legend-item"><i style="background:#50555C"></i>无主 · 空字为无驻军</span>';
    $('#end-turn').disabled=!api.canAct();$('#end-turn').innerHTML=successionPending()?'选择继任者':`${icon('arrow')}${api.E.calendarInfo(s).isPeriodStart?'推进一季':'继续本季'}`;$('#end-turn').setAttribute('title',`推进至下季首，剩余 ${api.E.calendarInfo(s).daysToNextPeriod} 日；中途中断后继续本季，不另算回合`);['new-btn','save-btn'].forEach(id=>document.getElementById(id).disabled=busy);
    const c=city(api.getSelectedId()),slots=c&&api.E.officerSlots(s,c.id);
    if(c)$('#selection-tip').textContent=`${c.name} · ${c.kind==='pass'?'雄关':c.tier==='major'?'大城':'城池'} · 驻将 ${slots.used}人${slots.reserved?` · ${slots.reserved}人在途`:''}`;
    const hostile=s.armies.filter(danger),ownArmies=s.armies.filter(a=>a.faction===s.player),banner=$('#situation-banner'),displayNotice=noticeDanger||noticeTalentCity?notice:'';banner.classList.toggle('danger',!!hostile.length||noticeDanger);banner.classList.toggle('quiet',!hostile.length&&!noticeDanger);banner.hidden=!hostile.length&&!ownArmies.length&&!noticeTalentCity;
    banner.innerHTML=`<div><strong>${hostile.length?`${hostile.length} 路敌军正在来袭`:ownArmies.length?`我军 ${ownArmies.length} 路在途`:'发现新人才'}</strong>${displayNotice?`<span>${esc(displayNotice)}</span>`:''}</div>${noticeTalentCity?'<button id="show-talent-notice" class="map-text-button">查看人才</button>':''}<button id="show-armies" class="map-text-button"${hostile.length||ownArmies.length?'':' hidden'}>查看军队</button>`;
    $('#show-armies').onclick=showArmies;if($('#show-talent-notice'))$('#show-talent-notice').onclick=()=>root.TKPeople?.showTalents(noticeTalentCity);if($('#show-service-notices'))$('#show-service-notices').onclick=()=>showServiceNotices();renderArmyRail();updateClock();
  }
  function armyMarkup(a,expanded=false){const isOwn=a.faction===state().player;return `<button class="march-card ${danger(a)?'incoming':''} ${selectedArmy===a.id?'selected':''}" data-army="${esc(a.id)}" style="--army-color:${faction(a.faction).color}"><span class="march-card-head"><b>${esc(faction(a.faction).leader)}${a.faction==='neutral'?'':'军'}</b><small>${isOwn?'我军':danger(a)?'来袭':'他军'} · ${kind(a)}</small></span><strong>${esc(originName(a))} <span>→</span> ${esc(destination(a)?.name)}</strong><span>${esc(armyNames(a))}${expanded?` · ${fmt(a.troops)} 兵`:''}</span><span class="march-meter"><i style="width:${progress(a)*100}%"></i></span><span class="march-card-foot"><b>${fmt(a.troops)} 兵</b><small>${a.waiting?'兵营已满，等待入城':eta(a)?`距抵达 ${eta(a)} 日`:'即将抵达'}</small></span></button>`;}
  function bindArmies(scope=document){scope.querySelectorAll('[data-army]').forEach(b=>b.onclick=()=>{const a=state().armies.find(x=>x.id===b.dataset.army);if(a)inspectMovement(a);});}
  function renderArmyRail(){const list=state().armies.filter(a=>a.faction===state().player||danger(a)).sort((a,b)=>Number(danger(b))-Number(danger(a))||eta(a)-eta(b));$('#army-count').textContent=list.length;$('#army-cards').hidden=!list.length;const rail=$('.army-rail');if(rail)rail.hidden=!list.length;$('#army-cards').innerHTML=list.slice(0,4).map(a=>armyMarkup(a)).join('');bindArmies($('#army-cards'));}
  function showArmies(){const all=state().armies;const list=all.filter(a=>armyFilter==='all'||a.faction===state().player||danger(a));api.dialog('行军情报','点击军队查看去向或召回',`<div class="dialog-tabs">${[['front','我方与来袭'],['all','全部军队']].map(([id,label])=>`<button data-army-filter="${id}" class="${id===armyFilter?'active':''}">${label}</button>`).join('')}</div><div class="march-grid">${list.map(a=>armyMarkup(a,true)).join('')||'<p class="empty-note">当前没有符合条件的在途军队。</p>'}</div>`,`<button class="secondary-button" data-close>返回沙盘</button>`,'wide');document.querySelectorAll('[data-army-filter]').forEach(b=>b.onclick=()=>{armyFilter=b.dataset.armyFilter;showArmies();});bindArmies($('#main-dialog'));}
  function inspectMovement(record){
    if(record.stackIds?.length>1){const list=state().armies.filter(a=>record.stackIds.includes(a.id));api.dialog('此处行军部队',list.length+'支部队 · 点击选择',`<div class="march-grid">${list.map(a=>armyMarkup(a,true)).join('')}</div>`,'<button class="secondary-button" data-close>返回地图</button>','medium');bindArmies($('#main-dialog'));return;}
    const a=state().armies.find(x=>x.id===record.id);
    if(!a){const r=state().lastBattles.find(r=>r.id===record.id||r.battle.movementId===record.id);if(r)presentBattle(r.battle,r.result,true);else api.toast('该次行军已结束，可查看战局军报。');return;}
    selectedArmy=a.id;api.getMap().setSelectedArmy?.(a.id);api.getMap().focusArmy?.(a.id);renderArmyRail();
    const gs=a.generalIds.map(id=>state().generals.find(g=>g.id===id)).filter(Boolean),own=a.faction===state().player;
    api.dialog(`${esc(faction(a.faction).leader)}${a.faction==='neutral'?'':'军'} · ${kind(a)}`,`${esc(originName(a))} → ${esc(destination(a)?.name)}`,`<div class="army-detail-route"><b>${esc(originName(a))}</b><span>当前路段 ${Math.round(progress(a)*100)}%</span><b>${esc(destination(a)?.name)}</b></div><div class="march-meter large"><i style="width:${progress(a)*100}%"></i></div>${a.marchRoute||a.withdrawalRoute?`<p class="march-route-note">${(a.marchRoute||a.withdrawalRoute).map(id=>esc(city(id)?.name)).join(' → ')}<br>当前路段：${esc(city(a.fromId)?.name)} ${a.routeEndProgress===0?'←':'→'} ${esc(city(a.toId)?.name)}${a.marchRoute?.slice(1,-1).some(id=>api.E.areAllied(state(),a.faction,city(id)?.owner))?' · 借道盟城，不占领驻扎。':''}</p>`:''}<div class="month-summary"><div><strong>${fmt(a.troops)}</strong><small>在途兵力</small></div><div><strong>${eta(a)}</strong><small>预计剩余天数</small></div><div><strong>${a.training}</strong><small>训练程度</small></div></div><div class="battle-commanders">${gs.map(g=>`${TKPeople.portrait(g)}<span>${esc(g.name)}</span>`).join('')}</div><p class="dialog-description">${gs.map(g=>esc(g.name)+' · '+TKTroops.info(g).name).join(' / ')}<br>${a.waiting?esc(a.waitingReason||'城内兵营已满，正在等待空余兵位'):'这支部队仍在行军，尚未结算目标处战斗。'}${danger(a)?'<br><strong>目标为我方据点，可提前调兵布防。</strong>':''}</p>`,`<button class="secondary-button" data-close>继续观察地图</button>${own&&a.kind!=='retreat'?'<button class="primary-button" id="recall-army">传令撤回</button>':''}`,'medium');
    if($('#recall-army'))$('#recall-army').onclick=()=>{const r=api.E.recallArmy(state(),a.id);if(!r.ok){api.toast(r.message);return;}api.save();api.render();api.closeDialog();api.toast(r.message);};
  }
  function showArmy(fromId,toId){
    const from=city(fromId),to=city(toId),plan=api.E.marchPlan(state(),fromId,toId);if(!canUse(from)||!plan){api.toast('请选择有可用进军路线的非盟友目标。');return;}
    if(from.troops<200){api.toast('至少出征100人，并保留100守军。');return;}
    const officers=ownGenerals(fromId),pool=officers.filter(g=>!api.E.busySearching(state(),g.id)).sort((a,b)=>api.E.officerCommand(state(),b).officialRank-api.E.officerCommand(state(),a).officialRank||b.leadership-a.leadership),empty=to.owner==='neutral'&&to.troops===0;
    const expedition=empty&&officers.length>1?pool.filter(g=>g.id!==faction(state().player).leaderId):pool;
    let picked=expedition.slice(0,Math.min(empty?1:3,api.E.armyCommand(state(),expedition.map(g=>g.id)).limit,officers.length>1?officers.length-1:1)).map(g=>g.id);
    const capacity=()=>picked.length?Math.min(from.troops-100,api.E.commandCapacity(state(),picked)):0;
    const recommended=()=>{let n=Math.min(capacity(),empty?500:Math.floor(from.troops*.65/100)*100);while(n>=100&&(api.E.marchPlan(state(),fromId,toId,n)?.cost.grain??Infinity)>faction(state().player).grain)n-=100;return Math.max(100,n);};
    api.dialog((empty?'进驻':'进攻')+esc(to.name),esc(from.name)+'出兵 · 约 '+plan.travelDays+' 日抵达',
      '<div class="attack-route compact-route"><div class="route-city"><small>出发</small><strong>'+esc(from.name)+'</strong><span>'+fmt(from.troops)+' 兵</span></div>'+icon('arrow')+'<div class="route-city enemy"><small>目标</small><strong>'+esc(to.name)+'</strong><span>'+fmt(to.troops)+' 守军</span></div></div><p class="march-route-note">'+plan.route.map(id=>esc(city(id).name)).join(' → ')+'</p>'+
      '<div class="unit-slider army-size-control"><label for="army-size">出征兵力<strong id="army-size-label"></strong></label><input type="range" id="army-size" min="100" max="'+Math.max(100,capacity())+'" value="'+recommended()+'" step="1"></div><div class="army-size-shortcuts"><button type="button" class="map-text-button" id="reset-army-size">推荐兵数</button><button type="button" class="map-text-button" id="max-army-size">按所选将领配满</button></div>'+
      '<div class="army-facts"><span>留守<strong id="army-left"></strong></span><span>耗粮<strong id="army-grain"></strong></span><span>统兵上限<strong id="army-capacity"></strong></span></div><div class="army-command-row"><label class="field-label">主将<select id="army-main" aria-label="出征主将"></select></label><span id="army-rank-label"></span></div><h3 class="formation-section-title">随军将领 <small id="army-picked-count"></small></h3><div class="army-picker fixed-troop-picker">'+officers.map(g=>TKPeople.card(g,{selectable:true,selected:picked.includes(g.id)})).join('')+'</div><p id="army-plan-summary" class="help-note"></p><p id="army-estimate" class="dialog-description"></p>'+projectDepartureNote(from),
      '<div class="dispatch-submit"><div><p class="dispatch-cost" id="army-launch-cost">出征不耗军令 · 消耗粮草</p><p class="dispatch-status" id="army-launch-status" role="status" aria-live="polite"></p></div><div class="dispatch-buttons"><button class="secondary-button" data-close>取消</button><button class="primary-button" id="launch-army">出征'+(empty?'进驻':'夺城')+'</button></div></div>','medium');
    const update=()=>{
      const slider=$('#army-size'),cap=capacity(),command=api.E.armyCommand(state(),picked);
      slider.max=String(Math.max(100,cap));slider.disabled=cap<100;slider.value=String(Math.max(100,Math.min(Number(slider.value),cap)));
      const n=cap<100?0:Number(slider.value),offer=api.E.dispatchOffer(state(),fromId,toId,n,{generalIds:picked});
      const problem=!picked.length?'请选择一位主将。':!offer.ok?offer.message:!api.canAct()?'天下正在推进，请稍候。':'';
      $('#army-main').innerHTML=picked.length?picked.map(id=>{const g=officers.find(g=>g.id===id);return '<option value="'+id+'">'+esc(g.name)+' · '+api.E.officerCommand(state(),g).officialRank+'阶</option>';}).join(''):'<option value="">请点选将领</option>';
      $('#army-main').disabled=!picked.length;$('#army-main').value=picked[0]||'';
      $('#army-rank-label').textContent=picked.length?'可编 '+command.limit+' 人 · 8阶解锁5人':'';
      $('#army-size-label').textContent=fmt(n);$('#army-left').textContent=fmt(from.troops-n);$('#army-grain').textContent=fmt(n?api.E.marchPlan(state(),fromId,toId,n)?.cost.grain||0:0);$('#army-capacity').textContent=fmt(picked.length?api.E.commandCapacity(state(),picked):0);$('#army-picked-count').textContent=picked.length+'/'+command.limit;
      $('#army-plan-summary').innerHTML=picked.length?TKTroops.formation(picked.map(id=>officers.find(g=>g.id===id)),n).map(c=>'<span>'+esc(c.general.name)+' '+TKTroops.badge(c.type)+' '+fmt(c.initial)+'人</span>').join('　'):'';
      const estimate=picked.length?api.E.estimateBattle(state(),fromId,toId,n,{generalIds:picked}):{};
      $('#army-estimate').textContent=empty?'当前无驻军，可派少量兵力进驻。':estimate.ratio?'战力预估：'+(estimate.ratio>1.2?'我军占优':estimate.ratio<.8?'敌军占优':'双方接近')+'。':'';
      $('#army-launch-status').textContent=problem||'编队就绪';$('#army-launch-status').classList.toggle('is-blocked',!!problem);$('#launch-army').disabled=!!problem;
      $('#max-army-size').disabled=$('#reset-army-size').disabled=!picked.length;
      $('#main-dialog').querySelectorAll('[data-pick]').forEach(b=>{const selected=picked.includes(b.dataset.pick);b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));const officer=officers.find(g=>g.id===b.dataset.pick);b.setAttribute('aria-label',officer.name+'，'+(selected?'已选中':'选择出战'));const label=b.querySelector('[data-command-position]');if(label){label.hidden=!selected;label.textContent=b.dataset.pick===picked[0]?'主将':'副将';}});
      return !problem;
    };
    $('#main-dialog').querySelectorAll('[data-pick]').forEach(b=>{
      const id=b.dataset.pick;b.disabled=api.E.busySearching(state(),id);b.classList.toggle('is-unavailable',b.disabled);
      if(b.disabled)b.innerHTML+='<span class="dispatch-officer-busy">寻访中</span>';
      b.onclick=()=>{if(picked.includes(id))picked=picked.filter(g=>g!==id);else if(!picked.length||picked.length<api.E.armyCommand(state(),picked).limit)picked.push(id);else{api.toast('当前主将可编 '+api.E.armyCommand(state(),picked).limit+' 人，可更换高官阶主将。');return;}update();};
    });
    $('#army-main').onchange=e=>{picked=[e.target.value,...picked.filter(id=>id!==e.target.value)];update();};
    $('#max-army-size').onclick=()=>{let n=capacity();while(n>=100&&(api.E.marchPlan(state(),fromId,toId,n)?.cost.grain??Infinity)>faction(state().player).grain)n-=50;$('#army-size').value=Math.max(100,n);update();};
    $('#army-size').oninput=update;$('#reset-army-size').onclick=()=>{$('#army-size').value=recommended();update();};update();
    $('#launch-army').onclick=()=>{if(!update())return;const r=api.E.dispatchArmy(state(),fromId,toId,Number($('#army-size').value),{generalIds:picked,tactic:'steady'});if(!r.ok){api.toast(r.message);return;}api.closeDialog();selectedArmy=r.army.id;api.getMap().setSelectedArmy?.(selectedArmy);api.save();api.render();api.toast(r.message);};
  }
  function showTransfer(fromId,preselected=[],targetId){
    const from=city(fromId),targets=api.E.reachableTargets(state(),fromId,'reinforce');if(!canUse(from)||!targets.length){api.toast('没有道路相连的己方据点。');return;}
    api.dialog('调兵移将',esc(from.name)+' · 通用兵源',`<label class="field-label">增援目标<select id="transfer-target">${targets.map(c=>`<option value="${c.id}"${c.id===targetId?' selected':''}>${esc(c.name)} · ${fmt(c.troops)}兵</option>`).join('')}</select></label><div class="checkbox-list">${ownGenerals(fromId).map(g=>`<label><input type="checkbox" name="transfer-officer" value="${g.id}"${preselected.includes(g.id)&&!api.E.busySearching(state(),g.id)?' checked':''}${api.E.busySearching(state(),g.id)?' disabled':''}>${esc(g.name)}${api.E.busySearching(state(),g.id)?' · 寻访中':''} ${TKTroops.badge(g)}</label>`).join('')}</div><label class="field-label">带队主将<select id="transfer-main" aria-label="调兵主将"></select></label><div class="unit-slider"><label for="transfer-total-input">增援兵力 <strong id="transfer-total"></strong></label><input id="transfer-total-input" type="range" min="0" max="${Math.max(0,from.troops-100)}" value="0" step="1"></div><p id="transfer-route" class="help-note"></p><p id="transfer-warning" class="danger-note" role="status"></p>`,`<button class="secondary-button" data-close>取消</button><button class="primary-button" id="send-transfer">即刻启程</button>`,'medium');
    let commander=preselected[0]||null;
    const selected=()=>{const ids=[...document.querySelectorAll('input[name="transfer-officer"]:checked')].map(e=>e.value);return ids.includes(commander)?[commander,...ids.filter(id=>id!==commander)]:ids;};
    const update=()=>{
      const ids=selected();commander=ids[0]||null;
      $('#transfer-main').innerHTML=ids.length?ids.map(id=>{const g=state().generals.find(g=>g.id===id),q=api.E.officerCommand(state(),g);return '<option value="'+id+'">'+esc(g.name)+' · '+q.officialRank+'阶 · 可编'+q.officers+'人</option>';}).join(''):'<option value="">辎重输送 · 最多800人</option>';
      $('#transfer-main').disabled=!ids.length;$('#transfer-main').value=commander||'';
      const slider=$('#transfer-total-input'),cap=Math.max(0,Math.min(from.troops-100,api.E.commandCapacity(state(),ids)));slider.max=String(cap);slider.value=String(Math.min(Number(slider.value),cap));
      const n=Number(slider.value),to=$('#transfer-target').value,plan=api.E.marchPlan(state(),fromId,to,n,'reinforce'),offer=api.E.dispatchOffer(state(),fromId,to,n,{generalIds:ids},'reinforce');
      $('#transfer-total').textContent=fmt(n);$('#transfer-route').textContent=plan?plan.route.map(id=>city(id).name).join(' → ')+' · '+plan.travelDays+'日 · '+fmt(plan.cost.grain)+'粮 · 不耗军令':'';$('#transfer-warning').textContent=offer.ok?'':offer.message;$('#send-transfer').disabled=!offer.ok;return offer.ok;
    };
    document.querySelectorAll('#main-dialog input, #main-dialog select').forEach(e=>{e.onchange=update;e.oninput=update;});
    $('#transfer-main').onchange=e=>{commander=e.target.value;update();};
    $('#transfer-total-input').oninput=update;update();$('#send-transfer').onclick=()=>{if(!update())return;const r=api.E.dispatchTransfer(state(),fromId,$('#transfer-target').value,Number($('#transfer-total-input').value),{generalIds:selected()});if(!r.ok){api.toast(r.message);return;}api.closeDialog();api.save();api.render();api.toast(r.message);};
  }
  function decideSiege(choice){
    const r=api.E.chooseSiege(state(),choice);if(!r.ok){api.toast(r.message);return;}
    battleView?.destroy();battleView=null;$('#battle-dialog').close();api.save();api.render();
    if(choice==='continue')presentFormation();else api.toast(r.message);
  }
  function presentSiegeDecision(){
    const b=api.E.pendingBattleInfo(state());if(!b||b.phase!=='siege')return false;pause();api.closeDialog();
    const previous=state().lastBattles.find(e=>e.battle.armyId===b.armyId),officers=b.defenderGenerals.map(g=>`<span>${TKPeople.portrait(g)}<b>${esc(g.name)}</b>${TKTroops.badge(g)}</span>`).join('');
    $('#battle-content').innerHTML=`<div class="dialog-header"><div><span class="eyebrow">已击败 ${b.wave-1} 队守军</span><h2>${esc(city(b.toId).name)} · 是否继续进攻</h2></div></div><div class="formation-body"><div class="siege-strength"><div><small>我军余部</small><strong>${fmt(b.attackers)} 兵</strong></div><div><small>下一队守军</small><strong>${fmt(b.defenders)} 兵</strong></div></div><p class="dialog-description">城内还剩 ${b.defenseTeamsRemaining} 队，共 ${fmt(b.cityDefenders)} 兵。继续沿用当前余部，撤回保留剩余兵力。</p><div class="siege-officers">${officers}</div>${previous?captureMarkup(previous.result):''}</div><div class="battle-controls"><button class="secondary-button" id="siege-withdraw">撤回部队</button><button class="primary-button" id="siege-continue">继续进攻 · 第 ${b.wave} 队</button></div>`;
    $('#siege-withdraw').onclick=()=>decideSiege('withdraw');$('#siege-continue').onclick=()=>decideSiege('continue');
    if(!$('#battle-dialog').open)$('#battle-dialog').showModal();return true;
  }
  function presentFormation(){
    const b=api.E.pendingBattleInfo(state());if(!b)return false;pause();api.closeDialog();
    if(b.phase==='siege')return presentSiegeDecision();
    const ours=b.attackerFaction===state().player?'attacker':'defender',enemy=ours==='attacker'?'defender':'attacker';let order=b[ours+'Generals'].map(g=>g.id),tactic='steady';
    const draw=()=>{const ownGs=order.map(id=>b[ours+'Generals'].find(g=>g.id===id)),left=TKTroops.formation(ownGs,b[ours==='attacker'?'attackers':'defenders']),right=TKTroops.formation(b[enemy+'Generals'],b[enemy==='attacker'?'attackers':'defenders']);
      const tile=(c,i,own)=>c?`<article class="formation-card"><div class="formation-face">${TKPeople.portrait(c.general)}${TKTroops.badge(c.type)}</div><div class="formation-person"><h3>${esc(c.general.name)}</h3><p>统 ${c.general.leadership} · 武 ${c.general.force} · 智 ${c.general.intellect}</p><strong>${fmt(c.initial)} <small>兵</small></strong>${own?`<div class="formation-move"><button data-move="${i}" data-step="-1" aria-label="${esc(c.general.name)}上移"${i===0?' disabled':''}>↑</button><button data-move="${i}" data-step="1" aria-label="${esc(c.general.name)}下移"${i===left.length-1?' disabled':''}>↓</button></div>`:''}</div></article>`:'<div class="formation-empty">空路 · 敌军可转援邻路</div>';
      $('#battle-content').innerHTML=`<div class="dialog-header"><div><span class="eyebrow">第 ${b.wave||1} 队交战 · 天下已暂停</span><h2>${esc(city(b.toId).name)} · 战前布阵</h2></div></div><div class="formation-body"><div class="formation-heading"><b>我方 · ${esc(b[ours+'FactionName'])}</b><b>敌方 · ${esc(b[enemy+'FactionName'])}</b></div><p class="formation-guide">每次交战一队，最多五人。${b.defenseTeamsRemaining>1?`城内另有 ${b.defenseTeamsRemaining-1} 队守军。`:"这是最后一队守军。"}用 ↑ ↓ 调整对位。</p><div class="formation-tactics" role="group" aria-label="作战方针">${Object.entries(TACTICS).map(([id,name])=>`<button data-formation-tactic="${id}" aria-pressed="${tactic===id}"><b>${name}</b><small>${id==='steady'?'承伤 −6%':id==='assault'?'伤害 +12%，承伤 +6%':'智力差影响伤害 −8%～+12%'}</small></button>`).join('')}</div><div class="formation-lines">${Array.from({length:Math.max(left.length,right.length)},(_,i)=>{const n=left[i]&&right[i]?Math.round(TKTroops.counter(left[i].type,right[i].type)*100):null;return `<div class="formation-line">${tile(left[i],i,true)}<div class="formation-match ${n>0?'favorable':n<0?'unfavorable':''}"><small>${i+1}路</small><strong>${n===null?'援':n===0?'均势':(n>0?'+':'')+n+'%'}</strong><span>对位</span></div>${tile(right[i],i,false)}</div>`;}).join('')}</div><details class="troop-rules"><summary>兵种克制与将领能力</summary>${TKTroops.table()}<p>统率影响全兵种攻防；枪、盾、骑偏武力；弩、斥候按武力与智力中较强项发挥。训练、士气、地形与城防共同生效，克制不等于必胜。政治用于内政，魅力用于招募与外交。</p></details></div><div class="battle-controls"><p>调整阵位不消耗军令。确认后全程交战，可4×／8×加速。</p><button id="begin-formation-battle" class="primary-button">确认布阵 · 开战</button></div>`;
      $('#battle-content').querySelectorAll('[data-move]').forEach(button=>button.onclick=()=>{const i=Number(button.dataset.move),j=i+Number(button.dataset.step);[order[i],order[j]]=[order[j],order[i]];draw();});
      $('#battle-content').querySelectorAll('[data-formation-tactic]').forEach(button=>button.onclick=()=>{tactic=button.dataset.formationTactic;draw();});
      $('#begin-formation-battle').onclick=()=>{const r=api.E.resolveBattle(state(),{generalIds:order,tactic});if(!r.ok){api.toast(r.message);return;}api.save();api.render();const entry=r.entry;presentBattle(entry.battle,entry.result,false,()=>{if(state().pendingBattle){presentFormation();return;}api.render();if(state().status!=='playing')api.checkEnding();});};
    };draw();if(!$('#battle-dialog').open)$('#battle-dialog').showModal();return true;
  }
  function advance(days=1,manual=false){
    if(successionPending()){pause();root.TKSuccession?.showCouncil();return;}
    if(api.isGameVisible?.()===false||busy||$('#battle-dialog').open||state().status!=='playing')return;if(manual)clock.running=false;busy=true;const oldBattles=new Set(state().lastBattles.map(b=>b.id)),oldElims=new Set((state().eliminations||[]).map(e=>e.id||e.faction));
    const oldArmies=new Set(state().armies.map(a=>a.id)),oldPeriod=api.E.calendarInfo(state()).period;
    let r={ok:true,alerts:[]},advanced=0;const collectedAlerts=[];
    while(advanced<days){
      r=api.E.advanceDays(state(),1,{interactive:true});advanced+=r.daysAdvanced||0;collectedAlerts.push(...(r.alerts||[]));
      if(!r.ok||r.alerts?.some(needsAttention)||api.E.calendarInfo(state()).period!==oldPeriod||!r.daysAdvanced||state().status!=='playing'||state().lastBattles.some(b=>!oldBattles.has(b.id)&&!b.result.unopposed&&(b.battle.attackerFaction===state().player||b.battle.defenderFaction===state().player)))break;
    }
    busy=false;if(!r.ok){clock.running=false;api.toast(r.message);return;}
    clock.elapsed=0;api.setSelectedId(api.getSelectedId());api.save();api.render();
    const newly=state().lastBattles.filter(b=>!oldBattles.has(b.id)),elims=(state().eliminations||[]).filter(e=>!oldElims.has(e.id||e.faction));
    const freshArmies=state().armies.filter(a=>!oldArmies.has(a.id)),cal=api.E.calendarInfo(state()),newSeason=cal.period!==oldPeriod;
    if(newSeason)clock.running=false;
    const alerts=collectedAlerts.filter(needsAttention),services=collectedAlerts.filter(isServiceAlert),incomingAlerts=alerts.filter(a=>a.kind==='incoming');
    const found=collectedAlerts.filter(a=>a.kind==='talent'&&a.faction===state().player&&a.outcome==='found');
    rememberServiceAlerts(services);noticeTalentCity=found[0]?.cityId||null;
    if(alerts.length){
      clock.running=false;const parts=[],incoming=state().armies.find(a=>incomingAlerts.some(alert=>alert.armyId===a.id));
      if(incomingAlerts.length)parts.push(incoming?`${armyNames(incoming)}正从${city(incoming.fromId)?.name}攻向${destination(incoming)?.name}，剩余 ${eta(incoming)} 日。已暂停，可先部署。`:(incomingAlerts[0].message||'敌军来袭，天下已暂停，可先部署。'));
      if(services.length)parts.push(`${serviceSummary(services)}。已暂停，请查看人事名单。`);
      if(!parts.length)parts.push(alerts.map(a=>a.message).filter(Boolean).join('；')||'天下出现新的要事，已暂停。');
      notice=parts.join(' ');noticeDanger=!!incomingAlerts.length;api.toast(notice);
    }
    else if(newSeason){const personnel=(state().personnelNotices||[]).filter(a=>a.faction===state().player&&(api.E.calendarInfo(a.totalDays).period===oldPeriod||a.totalDays===state().totalDays));notice=`${cal.season.name}季开始，金粮已结算。${found.length?'寻访发现 '+found.length+' 位人才，可在人事中礼聘。':''}${personnel.length?serviceSummary(personnel)+'，已记入军报。':''}`;noticeDanger=false;api.toast(notice);}
    else if(freshArmies.some(a=>a.faction===state().player)){const a=freshArmies.find(a=>a.faction===state().player);notice=`我军前往${destination(a)?.name}，还有 ${eta(a)} 日抵达。`;noticeDanger=false;}
    else {notice='';noticeDanger=false;}
    const ownBattles=newly.filter(b=>b.battle.attackerFaction===state().player||b.battle.defenderFaction===state().player);
    const combat=ownBattles.filter(b=>!b.result.unopposed);
    const aftermath=()=>{api.render();if(state().status!=='playing')api.checkEnding();};
    if(state().pendingBattle){presentFormation();}
    else if(combat.length){clock.running=false;let next=0;const playNext=()=>{const entry=combat[next++];if(entry)presentBattle(entry.battle,entry.result,false,playNext);else aftermath();};playNext();}
    else if(state().status!=='playing'){clock.running=false;api.checkEnding();}
    renderGlobal();
  }
  function showEliminations(entries,battles=[],services=[]){
 if(entries.every(e=>e.type==='submission')){api.dialog('诸侯归心','和平归顺 · 天下大势',`<div class="victory-display"><span class="victory-emblem">归</span><h3>${entries.map(e=>esc(faction(e.faction).name)).join('、')}举境归顺</h3><p>城关、部队、文武与府库并入接纳方，原有外交关系不继承。</p></div>${entries.map(e=>`<p>${esc(faction(e.byFaction).name)}接纳：${(e.submittedNames||[]).map(esc).join('、')||'所辖城关'}。第三方仍在押人物尚待救回。</p>`).join('')}`,'<button class="primary-button" data-close>继续征程</button>','medium');return;}
 const ours=entries.filter(e=>e.byFaction===state().player);
 const held=api.E.prisoners(state()).filter(g=>entries.some(e=>e.faction===g.faction));
 const spoils=held.length?`<section class="capture-summary"><h4>我方在押 ${held.length} 位文武</h4><div class="battle-capture-list">${held.map(g=>`<div class="battle-captive">${TKPeople.portrait(g)}<span><strong>${esc(g.name)}</strong><small>招降成功率 100%</small></span></div>`).join('')}</div><p>故主已灭亡，委派我方将领劝降即可，不需礼金。</p></section>`:'<p class="dialog-description">我方当前没有该势力的待招降俘虏；已招降人物可在将府查看。他方关押、死亡或退隐的人物不会转入我方。</p>';
 api.dialog(ours.length?'大捷 · 平定一方':'天下大势变更','势力灭亡 · 战果结算',
 `<div class="victory-display"><span class="victory-emblem">${ours.length?'捷':'变'}</span><h3>${entries.map(e=>esc(faction(e.faction).leader)).join('、')}势力灭亡</h3><p>${ours.length?'城关尽失，残部收俘。这一方诸侯已退出天下争衡。':'另一方诸侯退出了天下争衡。'}</p></div>${spoils}<div class="milestone-spoils">${entries.map(e=>`<article><strong>${esc(faction(e.faction).name)}</strong><p>终结者：${esc(faction(e.byFaction).leader)}</p><p>战时在押文武：${e.capturedNames?.length?e.capturedNames.map(esc).join('、'):'暂无'}</p></article>`).join('')}</div>${battles.length?battleReportsMarkup(battles):''}${serviceMarkup(services)}`,
 `${held.length?'<button class="primary-button" data-battle-prisoners>委派劝降 · 成功率100%</button>':''}<button class="secondary-button" data-close>继续进军</button>`,'medium');
 bindReplay();bindReportClose();
}
  function presentBattle(battle,result,replay=true,onReturn=null){
    battle={...battle,tactic:result.tactic||battle.tactic||'steady'};battleView?.destroy();
    const ours=state().player===battle.attackerFaction?'attacker':state().player===battle.defenderFaction?'defender':null;
    let finished=false,paused=false,speed=[1,4,8].includes(api.getSettings?.().battleSpeed)?api.getSettings().battleSpeed:1;
    api.closeDialog();
    $('#battle-content').innerHTML=`<div class="dialog-header"><div><span class="eyebrow">${replay?'战场回看':'两军交锋'} · ${esc(city(battle.fromId)?.name)} → ${esc(city(battle.toId)?.name)}</span><h2 tabindex="-1" autofocus>${esc(city(battle.toId)?.name)}之战</h2></div><div class="battle-brief">${TACTICS[battle.tactic]} · 将领率部交战</div></div><div class="battle-scroll-body"><div id="battle-cards"></div><div id="battle-result"></div></div><div class="battle-controls"><p id="battle-status">交战中，兵力实时减少。可用 4×、8× 加速。</p><button class="secondary-button" id="pause-battle">暂停</button><button class="secondary-button" id="speed-battle">${speed}× 速度</button><button class="primary-button" id="close-battle" disabled hidden>返回地图</button></div>`;
    if(!$('#battle-dialog').open)$('#battle-dialog').showModal();
    const complete=()=>{
      if(finished)return;finished=true;
      const title=ours?(ours===result.winner?'得胜凯旋':'整军再起'):(result.winner==='attacker'?'攻城告捷':'坚城未破');
      const spoils=result.loot?`<div class="battle-spoils"><strong>${ours==='defender'?'城库被敌军接收':'接收城库'}</strong><span>金钱 <b>${fmt(result.loot.gold)}</b></span><span>粮草 <b>${fmt(result.loot.grain)}</b></span></div>`:'';
      const message=result.loot?result.message.replace('接收城库：'+result.loot.gold+' 金、'+result.loot.grain+' 粮。',''):result.message;
      $('#battle-result').innerHTML=`<div class="result-banner"><h3>${title}</h3><p>${esc(message)}<br>攻方损失 ${fmt(result.attackerLosses)} · 守方损失 ${fmt(result.defenderLosses)}</p>${spoils}</div>${captureMarkup(result)}`;
      if(onReturn)document.querySelectorAll('[data-battle-prisoners]').forEach(b=>b.hidden=true);else bindCaptives();
      ['pause-battle','speed-battle'].forEach(id=>document.getElementById(id).hidden=true);
      $('#close-battle').hidden=false;$('#close-battle').disabled=false;$('#battle-status').textContent='交战结束；战果与俘虏已记入军报。';
      if(!replay&&state().pendingBattle?.armyId===battle.armyId){
        if(state().pendingBattle.phase==='siege'){
          $('#close-battle').hidden=true;
          $('#battle-status').textContent=`城内尚有 ${result.remainingDefenseTeams} 队、${fmt(result.remainingCityTroops)} 兵。继续使用余部进攻，或撤回。`;
          const controls=$('#battle-content .battle-controls');controls.insertAdjacentHTML('beforeend','<button class="secondary-button" id="siege-withdraw">撤回部队</button><button class="primary-button" id="siege-continue">继续进攻</button>');
          $('#siege-withdraw').onclick=()=>decideSiege('withdraw');$('#siege-continue').onclick=()=>decideSiege('continue');
        }else $('#close-battle').textContent='下一队迎战';
      }
      $('#battle-result').scrollIntoView?.({block:'start',behavior:'auto'});$('#close-battle').focus?.();
    };
    battleView=TKBattle.create($('#battle-cards'),battle,result,{onComplete:complete,playerFaction:state().player,factions:state().factions});battleView.setSpeed(speed);
    $('#pause-battle').onclick=()=>{if(finished)return;paused=!paused;paused?battleView.pause():battleView.resume();$('#pause-battle').textContent=paused?'继续':'暂停';};
    $('#speed-battle').onclick=()=>{if(finished)return;speed=speed===1?4:speed===4?8:1;battleView.setSpeed(speed);$('#speed-battle').textContent=`${speed}× 速度`;};
    $('#close-battle').onclick=()=>{if(!finished)return;battleView?.destroy();battleView=null;$('#battle-dialog').close();api.render();if(onReturn)onReturn();else api.checkEnding();};
  }
  function showReports(only=null,title='军报',services=state().personnelNotices||serviceNotices){
    const relevant=b=>b.battle.attackerFaction===state().player||b.battle.defenderFaction===state().player,list=only||state().lastBattles.filter(relevant),others=state().lastBattles.filter(b=>!relevant(b)),ownServices=services.filter(a=>a.faction===state().player),otherServices=services.filter(a=>a.faction!==state().player);
    const world=!only?`<details class="campaign-details" id="world-records"><summary>天下纪事 · 其他战斗与诸侯兴亡</summary>${others.length?battleReportsMarkup(others):''}${serviceMarkup(otherServices)}<div class="elimination-list">${(state().eliminations||[]).map(e=>`<button data-elimination="${esc(e.id||e.faction)}">${esc(faction(e.faction).leader)}${e.type==='submission'?'归顺':'覆灭'} <span>查看纪事 ↗</span></button>`).join('')}</div><div class="full-logs">${state().logs.slice(0,35).map(l=>`<div class="log-line"><time>${l.month!=null?`${l.month}月${l.day}日`:`第${l.turn}季`}</time><p>${esc(l.text)}</p></div>`).join('')}</div></details>`:'';
    api.dialog(title,only?'前线战果':'我方战事与人事消息',`${battleReportsMarkup(list)}${serviceMarkup(only?services:ownServices)}${world}`,`<button class="secondary-button" id="report-armies">在途军队（${state().armies.length}）</button><button class="primary-button" data-close>返回地图</button>`,'medium');
    $('#report-armies').onclick=()=>{armyFilter='all';showArmies();};bindReplay();document.querySelectorAll('[data-elimination]').forEach(b=>b.onclick=()=>{const e=state().eliminations.find(e=>(e.id||e.faction)===b.dataset.elimination);if(e)showEliminations([e]);});bindReportClose();
  }
  function mount(a){api=a;ready=true;lastState=state();applySettings(api.getSettings?.()||{});$('#end-turn').onclick=()=>{const c=api.E.calendarInfo(state());advance(c.daysToNextPeriod,true);};$('#reports-btn').onclick=()=>showReports();$('#army-all').onclick=showArmies;$('#zoom-in').onclick=()=>api.getMap().zoomIn();$('#zoom-out').onclick=()=>api.getMap().zoomOut();$('#zoom-reset').onclick=()=>api.getMap().resetView();$('#clock-toggle').onclick=()=>{if(api.isGameVisible?.()===false||successionPending())return;clock.running=!clock.running;clock.last=performance.now();noticeDanger=false;updateClock();};$('#clock-speed').onclick=()=>{clock.speed=clock.speed===1?2:clock.speed===2?4:1;updateClock();};timer=setInterval(()=>{const now=performance.now(),delta=Math.min(500,now-clock.last);clock.last=now;if(clock.running&&state().status==='playing'&&!busy&&!modalOpen()&&!document.hidden){clock.elapsed+=delta*clock.speed;if(clock.elapsed>=2000)advance(1);}if(state().status!=='playing')clock.running=false;updateClock();},150);window.addEventListener('beforeunload',()=>{clearInterval(timer);battleView?.destroy();});}
  root.TKCampaign={mount,pause,applySettings,renderGlobal,showArmy,showTransfer,showReports,showArmies,inspectMovement,presentBattle,presentFormation,showEliminations,get ready(){return ready;},get busy(){return busy;}};
})(globalThis);
