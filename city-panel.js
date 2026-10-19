/* City administration and army preparation. Mutations belong to TKEngine. */
(function () {
  'use strict';
  let api = null;
  const recruitAmounts = new Map();
  const UNITS = {infantry:{name:'兵源',detail:'募得士卒加入通用兵源，出战兵种由带队人物决定。'},archer:{name:'兵源'},cavalry:{name:'兵源'}};
  const BUILDINGS = {
    farm: { name: '农田', action: '开垦农田', icon: 'leaf', gain: '每月基础产粮 +35' },
    market: { name: '集市', action: '兴建集市', icon: 'coin', gain: '每月基础税金 +20' },
    wall: { name: '城防', action: '加固城防', icon: 'shield', gain: '提高守城方防御优势' },
  };
  const JOBS = {
    commerce: { name: '兴商', icon: 'coin', stat: 'politics', note: '每月增加本城税金，政治高的文臣更善理财。' },
    farming: { name: '屯田', icon: 'leaf', stat: 'politics', note: '每月增加本城产粮，为募兵与远征积蓄军粮。' },
  };
  const $ = selector => document.querySelector(selector);
  const state = () => api.getState();
  const E = () => api.E;
  const esc = value => api.esc(value);
  const fmt = value => api.fmt(value);
  const icon = name => api.icon(name);
  const own = city => city?.owner === state().player;
  const currentCity = id => E().getCity(state(), id);
  const faction = id => state().factions.find(f => f.id === id);
  const purse = () => faction(state().player) || { gold: 0, grain: 0 };
  const residents = city => E().cityGenerals(state(), city.id);
  const role = g => ({ civil: '文臣', ruler: '君主', military: '武将', warrior: '武将' }[g.role] || '武将');
  const portrait = (g, size = 'small') => globalThis.TKPeople?.portrait(g, size) || '';
  const cost = (city, action, amount, options) => E().costs(state(), city.id, action, amount, options) || { gold: 0, grain: 0, actions: 0 };
  const priceLabel = value => [[value.actions, '令'], [value.gold, '金'], [value.grain, '粮']].filter(([amount]) => amount > 0).map(([amount, unit]) => `${fmt(amount)} ${unit}`).join(' · ') || '免费';
  const blocked = city => !own(city) || !api.canAct() || (city.occupiedUntil || 0) > state().totalDays;
  const disabled = condition => condition ? ' disabled' : '';
  const troopTotal = city => Number(city.troops) || Object.values(city.units || {}).reduce((a, n) => a + Number(n || 0), 0);
  const reservedTroops = city => E().reservedTroops(state(), city.id);
  const projectOfficers = city => E().availableProjectOfficers(state(), city.id);
  const projectDays = kind => E().RULES.projectDays?.[kind] || ({ develop: 30, recruit: 15, train: 15, search: 20 }[kind]);
  const projectName = p => p.kind === 'develop' ? BUILDINGS[p.target]?.action || '城池建设' : p.kind === 'recruit' ? `募集${UNITS[p.type]?.name || '部队'} ${fmt(p.amount)} 人` : p.kind === 'train' ? '校场练兵' : '出城寻访';
  function governor(city) { return state().generals.find(g => g.id === city.governorId && g.cityId === city.id); }
  function assignment(city, job) { return city.assignments?.[job] || city.jobs?.[job] || null; }
  function badge(id) {
    const f = faction(id), color = f?.color || '#50555C';
    return `<span class="faction-badge" style="--faction-color:${esc(color)}">${esc(f?.name || '无主')}</span>`;
  }
  function cityStateNote(city) {
    if (!own(city)) return '请选择我方城池。';
    if (state().status !== 'playing') return '本次征程已经结束，可开启新征程。';
    if (state().pendingBattle) return '军队已经出发，请先完成战斗。';
    if ((city.occupiedUntil || 0) > state().totalDays) return '新城整顿中，一日后恢复行动。';
    if (!api.canAct()) return '天下正在推进，请稍候。';
    return '';
  }
  function actionReason(city,kind,options={}) {
    const reason=cityStateNote(city);if(reason)return reason;
    const q=E().actionOffer(state(),city.id,kind,options);return q.ok?'':q.message;
  }
  function shortReason(reason) {
    if(/命令已用尽/.test(reason))return '本季军令用尽';
    if(/次数已用尽/.test(reason))return '本城次数用尽';
    if(/需要 .*金|金粮不足/.test(reason))return '金粮不足';
    if(/军粮不足/.test(reason))return '军粮不足';
    if(/最高等级/.test(reason))return '已达满级';
    if(/训练有素/.test(reason))return '训练已满';
    if(/尚无可操练/.test(reason))return '暂无驻军';
    if(/容纳|容量|兵额/.test(reason))return '驻军容量不足';
    if(/在职文武|可用驻将/.test(reason))return '暂无可用驻将';
    if(/整顿/.test(reason))return '新城整顿中';
    if(/项目/.test(reason))return '等待项目完工';
    if(/寻访/.test(reason))return '等待寻访返回';
    if(/推进/.test(reason))return '天下推进中';
    return reason;
  }
  function actionButton(attributes,label,reason,hint) {
    return `<button ${attributes} title="${esc(reason||hint)}"${disabled(!!reason)}>${label}<small>${esc(reason?shortReason(reason):hint)}</small></button>`;
  }
  function autoAssignReason(city) {
    const reason=cityStateNote(city);if(reason)return reason;
    const q=E().autoAssignOffer(state(),city.id);
    return !q.ok?q.message:!residents(city).length?'暂无驻将，请先调将或招贤。':!q.assigned?'暂无可补空缺，已有委派保持不变。':'';
  }
  function run(action, refresh) {
    let result;
    try { result = action(); } catch (error) { console.error(error); api.toast('操作未完成，请重新打开城池面板后重试。'); return false; }
    if (!result?.ok) { api.toast(result?.message || '当前无法执行此项操作'); return false; }
    api.save(); api.render(); if (refresh) refresh(); api.toast(result.message || '军令已执行。'); return true;
  }
  function projectCard(city, compact = false) {
    const p = city.project; if (!p) return '';
    const officer = state().generals.find(g => g.id === p.officerId), remaining = Math.max(0, p.remainingDays ?? p.finishDay - state().totalDays);
    const duration = Math.max(1, p.finishDay - p.startedDay), percent = Math.max(0, Math.min(100, (duration - remaining) / duration * 100));
    return `<section class="city-project"><div class="training-line"><div><strong>${esc(projectName(p))}</strong><small>${esc(officer?.name || '执行文武')}执行 · 剩余 ${remaining} 日</small></div><button data-city-cancel-project${disabled(!api.canAct())}>中止退款</button></div><div class="troop-track"><i style="width:${percent}%"></i></div><p class="counter-note">已预付 ${priceLabel(p.cost || {})}，完工才生效。中止全额退还。${compact ? '' : '执行人的长期差事与太守加成在完工后恢复。'}</p></section>`;
  }
  function bindManagement(scope, cityId, inCouncil = false) {
    const refresh = () => { render(currentCity(cityId)); if (inCouncil) showCouncil(cityId); };
    scope.querySelectorAll('[data-city-cancel-project]').forEach(button => button.onclick = () => run(() => E().cancelProject(state(), cityId), refresh));
    scope.querySelectorAll('[data-city-autoassign]').forEach(button => button.onclick = () => {if(autoAssignReason(currentCity(cityId)))return;run(() => E().autoAssign(state(), cityId), refresh);});
  }
  function officerSelect(city, id, stat) {
    const officers = projectOfficers(city).slice().sort((a, b) => b[stat] - a[stat]), labels = { force: '武力', politics: '政治', intellect: '智力' };
    return `<label class="field-label">负责将领（已按能力推荐）<select id="${id}"${disabled(!officers.length)}>${officers.length ? officers.map(g => `<option value="${esc(g.id)}">${esc(g.name)} · ${labels[stat]} ${g[stat]}</option>`).join('') : '<option value="">暂无可用驻将</option>'}</select></label>`;
  }
  function finishProjectStart(cityId, result) {
    if (!result?.ok) { api.toast(result?.message || '命令未能执行'); return; }
    api.save(); api.closeDialog(); api.render(); render(currentCity(cityId)); api.toast(result.message);
  }
  function bindOfficers(root) {
    root.querySelectorAll('[data-city-officer]').forEach(button => button.onclick = () => globalThis.TKPeople.showOfficer(button.dataset.cityOfficer));
  }
  function recruitEntryReason(city) {
    const reasons=Object.keys(UNITS).map(type=>actionReason(city,'recruit',{type,amount:100}));
    return reasons.every(Boolean)?reasons[0]:'';
  }
  function constructionReason(city) {
    const reasons=Object.keys(BUILDINGS).filter(kind=>city.kind!=='pass'||kind==='wall').map(target=>actionReason(city,'develop',{target}));
    return reasons.every(Boolean)?reasons.find(reason=>!/最高等级/.test(reason))||reasons[0]:'';
  }
  function transferReason(city,officerId) {
    const reason=cityStateNote(city);if(reason)return reason;
    const targets=E().reachableTargets(state(),city.id,'reinforce');
    if(!targets.length)return '暂无道路相通的己方城池。';
    const officers=residents(city).filter(g=>!E().busySearching(state(),g.id)&&(!officerId||g.id===officerId));
    const choices=officers.map(g=>({amount:0,options:{generalIds:[g.id]}}));
    if(!officerId)for(const type of Object.keys(UNITS))if(city.units[type])choices.push({amount:1,options:{generalIds:[],units:Object.fromEntries(Object.keys(UNITS).map(t=>[t,Number(t===type)]))}});
    if(!choices.length)return '暂无可调动的部队或将领。';
    const offers=targets.flatMap(to=>choices.map(q=>E().dispatchOffer(state(),city.id,to.id,q.amount,q.options,'reinforce')));
    return offers.some(q=>q.ok)?'':offers[0].message;
  }
  function marchReason(city) {
    if (cityStateNote(city)) return cityStateNote(city);
    if (!residents(city).length) return '需要一位驻将率领部队。';
    if (residents(city).every(g=>E().busySearching(state(),g.id))) return '驻将均在寻访，返回后可出征。';
    if (troopTotal(city) < 200) return '至少需 200 驻军，先募兵补充。';
    if (!api.canMarch(city)) return '天下正在推进，请稍候。';
    if (!E().reachableTargets(state(),city.id).length) return '暂无可通行的敌城，可在外交中结盟借道。';
    return '';
  }
  function showResidents(city) {
    const officers = residents(city);
    api.dialog(`${esc(city.name)} · 驻城文武`, `${officers.length} 位文武`, `<div class="mini-officer-list">${officers.map(g => `<button data-city-officer="${esc(g.id)}">${portrait(g)}<span><strong>${esc(g.name)}</strong><small>${role(g)} · 统率 ${fmt(g.leadership)} · 武力 ${fmt(g.force)}</small></span></button>`).join('')}</div>`, '<button class="secondary-button" data-close>返回沙盘</button>', 'medium');
    bindOfficers($('#main-dialog'));
  }
  function render(city) {
    if (!api || !city) return;
    const container = $('#city-panel'); if (!container) return;
    const owned = own(city), officers = residents(city), troops = troopTotal(city), reserved = reservedTroops(city);
    const header = `<div class="city-panel-header city-simple-header"><div class="city-overline"><span>${owned ? '我方城池' : '城池情报'}</span>${badge(city.owner)}</div><h2 class="city-name">${esc(city.name)}</h2></div>`;
    const income=E().cityIncomePreview(state(),city.id);
    const summary = `<div class="city-simple-facts"><div><span>驻军 / 容量</span><strong>${fmt(troops)}<small> / ${fmt(E().getTroopCapacity(state(), city))}</small></strong></div><div><span>训练 / 士气</span><strong>${fmt(city.training)}<small> / ${fmt(city.morale)}</small></strong></div></div>${owned && reserved ? `<p class="city-quiet-note">在途援军预留 ${fmt(reserved)} 人</p>` : ''}`;
    const allocations=E().cityTroopAssignments(state(),city.id),gov=governor(city),governorInfo=`<div class="city-governor-summary ${gov?'':'is-vacant'}">${gov?portrait(gov):''}<span><strong>太守 · ${gov?esc(gov.name):'未委任'}</strong><small>${gov?'政 '+gov.politics+' · 统筹税粮与城务':'委任太守可提高本城税粮收入'}</small></span></div>`;
    const roster=`<section class="city-visible-roster"><h3>守备将领 <span>${officers.length} 人</span></h3><div class="city-portrait-grid">${officers.map(g=>`<button data-city-officer="${esc(g.id)}" aria-label="${esc(g.name)}，统率${g.leadership}，武力${g.force}，智力${g.intellect}，政治${g.politics}，魅力${g.charisma}">${portrait(g)}<span><strong>${esc(g.name)}</strong><small>${g.role==='civil'?'智 '+g.intellect+' · 政 '+g.politics:'统 '+g.leadership+' · 武 '+g.force}</small><small class="officer-command"><span>第 ${allocations.find(a=>a.general.id===g.id)?.team||1} 队 · ${fmt(allocations.find(a=>a.general.id===g.id)?.initial||0)} 兵</span><span>可带 ${fmt(E().officerCommand(state(),g).capacity)}</span></small><em>${city.governorId===g.id?'太守':E().busySearching(state(),g.id)?'寻访中':g.id===city.project?.officerId?'旧工程中':Object.entries(JOBS).find(([job])=>assignment(city,job)===g.id)?.[1].name|| (city.governorId===g.id?'太守':'待命')}</em></span></button>`).join('')||'<p class="city-action-reason">没有驻将，可调将或招贤。</p>'}</div></section>`;
    let body;
    if (owned) {
      const recruitNote = recruitEntryReason(city), marchNote = marchReason(city), note = cityStateNote(city);
      body = `${summary}${note ? `<p class="occupation-note" role="status">${esc(note)}</p>` : ''}<div class="city-quick-actions city-primary-actions">${actionButton('data-city-main-action="recruit" data-city-recruit="infantry"','募兵',recruitNote,'1 令')}${actionButton('data-city-train','练兵',actionReason(city,'train'),'1 令')}${actionButton('class="primary-button" data-city-main-action="march" data-city-march','出征',marchNote,'不耗军令')}</div><div class="city-utility-actions">${actionButton('data-city-build-list','建设',constructionReason(city),'1 令')}${actionButton('data-city-transfer','调兵移将',transferReason(city),'不耗军令')}<button data-city-main-action="manage" data-city-council>内政分工<small>免费调整</small></button></div>${roster}<p class="city-income-note">每月 ${fmt(income.gold)} 金 · ${fmt(income.grain)} 粮，自动经营</p>${projectCard(city,true)}`;
    } else {
      const allied=E().areAllied(state(),state().player,city.owner),treaty=E().allianceBetween(state(),state().player,city.owner);
      const sources = allied?[]:E().ownedCities(state()).filter(c => E().marchPlan(state(),c.id,city.id));
      const source = sources.find(c => !marchReason(c)) || sources[0];
      body = `${summary}${governorInfo}<p class="city-management-status">${allied?'盟友城池 · 盟约剩余 '+(treaty.endDay-state().totalDays)+' 日，允许借道，不能进攻。':city.owner==='neutral'&&!troopTotal(city)?'无主空城，派小队即可进驻；仍须防备其他势力抢占。':esc(faction(city.owner)?.name || '地方守军')+'驻守。'}${allied?'在我方城池选择出征，可经此城攻打其他敌城。':sources.length ? '选择我方出发城，再确认出征。' : '暂无可通行路线，可先夺取沿途城池或结盟借道。'}</p>${sources.length ? `<label class="field-label city-enemy-source">出发城<select id="city-attack-source">${sources.map(c => `<option value="${esc(c.id)}"${source.id === c.id ? ' selected' : ''}>${esc(c.name)} · ${fmt(troopTotal(c))} 兵 / ${residents(c).length} 将</option>`).join('')}</select></label><button class="primary-button city-enemy-march" data-city-attack${disabled(!!marchReason(source))}>${city.owner==='neutral'&&!troopTotal(city)?'进驻此城':'出征此城'}</button><p class="city-action-reason" id="city-attack-reason">${esc(marchReason(source))}</p>` : ''}${roster}`;
    }
    const relation=!owned&&city.owner!=='neutral'?E().relationship(state(),state().player,city.owner):null;
    const diplomacy=relation?`<div class="city-diplomacy"><span>与我方关系 <strong class="relation-tag" data-relation="${relation.label}">${relation.label} ${relation.score>0?'+':''}${relation.score}</strong></span><button class="secondary-button" data-city-diplomacy="${city.owner}">结盟·关系</button></div>`:'';
    container.innerHTML = `${header}<div class="city-body city-simple-body">${diplomacy}${body}</div>`;
    bindManagement(container, city.id);
    bindOfficers(container);
    container.querySelector('[data-city-diplomacy]')?.addEventListener('click',()=>globalThis.TKDiplomacy?.show(city.owner));
    container.querySelector('[data-city-train]')?.addEventListener('click',()=>showTraining(city.id));
    container.querySelector('[data-city-build-list]')?.addEventListener('click',()=>showConstruction(city.id));
    container.querySelector('[data-city-talents]')?.addEventListener('click',()=>globalThis.TKPeople.showTalents(city.id));
    container.querySelector('[data-city-transfer]')?.addEventListener('click',()=>api.openTransfer(city.id));
    container.querySelector('[data-city-all-officers]')?.addEventListener('click', () => showResidents(currentCity(city.id)));
    container.querySelector('[data-city-recruit]')?.addEventListener('click', () => showRecruit(city.id));
    container.querySelector('[data-city-council]')?.addEventListener('click', () => api.openCouncil(city.id));
    container.querySelector('[data-city-march]')?.addEventListener('click', () => api.toggleMarch(city.id));
    const sourceSelect = container.querySelector('#city-attack-source'), attack = container.querySelector('[data-city-attack]');
    if (sourceSelect) {
      sourceSelect.onchange = () => { const reason = marchReason(currentCity(sourceSelect.value)); attack.disabled = !!reason; container.querySelector('#city-attack-reason').textContent = reason; };
      attack.onclick = () => api.openArmy(sourceSelect.value, city.id);
    }
  }

  function jobDescription(city, job, selectedId) {
    const g = residents(city).find(officer => officer.id === selectedId);
    if (g && city.project?.officerId === g.id) return `${g.name}正在执行临时项目，完工后恢复长期差事。`;
    if (!g) return job === 'search' ? `本城搜访进度 ${fmt(city.searchProgress || 0)} / 80` : '委任本城文武，下一次月末开始自动执行。';
    if (job === 'commerce' || job === 'farming') {
      const amount = Math.floor(g.politics * (g.role === 'civil' || g.role === 'ruler' ? 1.2 : 1) / 3);
      return `${g.name}每月基础${job === 'commerce' ? '税金' : '产粮'} +${amount}，再计太守加成。`;
    }
    if (job === 'recruitment') return `${g.name}每月最多招募 ${Math.min(300, Math.floor((100 + g.force * 2) / 50) * 50)} 人，受驻军目标、空余容量与府库限制；按实际人数扣金粮。`;
    if (job === 'training') return `${g.name}每月训练 +${Math.max(2, Math.floor(g.force / 18))}、士气 +2（均不超过 100）。`;
    return `${g.name}每月搜访 +${Math.max(15, Math.floor(g.intellect / 2))}；进度满 80 时发现一位在野人才。`;
  }

  function showCouncil(cityId) {
    const city=currentCity(cityId);if(!city||!own(city))return;
    const officers=residents(city),gov=governor(city),income=E().cityIncomePreview(state(),cityId);
    const options=(current)=>'<option value="">暂不委派</option>'+officers.slice().sort((a,b)=>b.politics-a.politics).map(g=>'<option value="'+esc(g.id)+'"'+(g.id===current?' selected':'')+'>'+esc(g.name)+' · 政治 '+g.politics+'</option>').join('');
    const jobRow=(key,label,current)=>'<div class="council-post"><label class="field-label">'+label+'<select '+(key==='governor'?'id="city-governor-select"':'data-city-job-select="'+key+'"')+' aria-label="选择'+label+'"'+disabled(blocked(city)||!officers.length)+'>'+options(current)+'</select></label><button class="secondary-button" data-post-save="'+key+'" disabled>未变更</button></div>';
    const autoNote=autoAssignReason(city);
    const donor=E().neighbors(state(),cityId).filter(c=>own(c)&&residents(c).length).sort((a,b)=>residents(b).length-residents(a).length)[0];
    api.dialog(esc(city.name)+' · 内政委派','免费委派 · 任命后持续经营',
      '<div class="city-council-simple"><div class="city-management-start"><h3>内政分工</h3><p>空缺会自动委派，已有分工按月运行。可在此调整人选。</p>'+(!autoNote?'<button class="secondary-button" data-city-autoassign>补齐空缺</button>':'')+'</div>'+
      (!officers.length?(donor?'<button class="secondary-button" data-city-incoming-source="'+esc(donor.id)+'">从'+esc(donor.name)+'调将</button>':'<p>暂无驻将，先调将或招贤。</p>'):'')+
      '<div class="city-income-summary"><span>每月税金 <strong>+'+fmt(income.gold)+'</strong></span><span>每月产粮 <strong>+'+fmt(income.grain)+'</strong></span></div>'+
      jobRow('governor','太守',gov?.id)+jobRow('commerce','兴商负责人',assignment(city,'commerce'))+jobRow('farming','屯田负责人',assignment(city,'farming'))+
      '</div>',
      '<button class="primary-button" data-close>完成</button>','medium');
    const modal=$('#main-dialog');bindManagement(modal,cityId,true);
    modal.querySelector('[data-city-incoming-source]')?.addEventListener('click',()=>api.openTransfer(donor.id,[],cityId));
    modal.querySelectorAll('[data-post-save]').forEach(b=>{
      const key=b.dataset.postSave,select=modal.querySelector(key==='governor'?'#city-governor-select':'[data-city-job-select="'+key+'"]');
      const refresh=()=>{
        const latest=currentCity(cityId),current=key==='governor'?latest.governorId:assignment(latest,key),same=(select.value||null)===(current||null);
        const reason=cityStateNote(latest)||(!residents(latest).length?'暂无驻将，请先调将或招贤。':same?'选择其他人选后可委派。':'');
        b.disabled=!!reason;b.title=reason||'免费确认本次委派';b.textContent=same?'未变更':select.value?'委派':'撤任';return !reason;
      };
      select.onchange=refresh;refresh();
      b.onclick=()=>{if(!refresh())return;run(()=>key==='governor'?E().setGovernor(state(),cityId,select.value||null):E().setAssignment(state(),cityId,key,select.value||null),()=>showCouncil(cityId));};
    });
  }
  function showConstruction(cityId) {
    const city=currentCity(cityId);if(!city||!own(city))return;
    const buildings=Object.entries(BUILDINGS).filter(([kind])=>city.kind!=='pass'||kind==='wall').map(([kind,b])=>{
      const price=cost(city,kind),reason=actionReason(city,'develop',{target:kind});
      return '<div class="city-building-option"><div><strong>'+b.name+' '+city[kind]+'/3</strong><p>'+b.gain+'</p><small>'+priceLabel(price)+(reason?' · '+esc(reason):' · 立即升级')+'</small></div><button class="primary-button" data-council-build="'+kind+'" aria-label="升级'+b.name+'"'+disabled(!!reason)+'>升级</button></div>';
    }).join('');
    api.dialog(esc(city.name)+' · 城池建设','每城每季1次 · 1令', '<div class="city-building-options">'+buildings+'</div>','<button class="secondary-button" data-close>返回沙盘</button>','medium');
    $('#main-dialog').querySelectorAll('[data-council-build]').forEach(b=>b.onclick=()=>{if(actionReason(currentCity(cityId),'develop',{target:b.dataset.councilBuild})){showConstruction(cityId);return;}finishProjectStart(cityId,E().develop(state(),cityId,b.dataset.councilBuild));});
  }
  function showBuild(cityId, kind) {
    const city = currentCity(cityId), building = BUILDINGS[kind]; if (!city || !own(city) || !building) return;
    const price = cost(city, kind), days = projectDays('develop');
    api.dialog(building.action, `${esc(city.name)} · 城建工程`, `<p class="dialog-description">${building.name} ${city[kind]}/3 → ${Math.min(3, city[kind] + 1)}/3；立即升级。${building.gain}。</p>${officerSelect(city, 'city-project-officer', 'politics')}<div class="recruit-price"><span>立即执行</span><strong>${priceLabel(price)}</strong></div><p class="danger-note" id="city-project-error" hidden></p>`, '<button class="secondary-button" data-close>稍后建设</button><button class="primary-button" id="city-project-confirm">确认升级</button>');
    const select = $('#city-project-officer'), button = $('#city-project-confirm');
    const refresh = () => { const latest = currentCity(cityId), error = latest.kind === 'pass' && kind !== 'wall' ? '关口只能加固城防。' : actionReason(latest, 'develop', {target:kind,officerId:select.value}); $('#city-project-error').textContent = error; $('#city-project-error').hidden = !error; button.disabled = !!error; return !error; };
    select.onchange = refresh; refresh();
    button.onclick = () => {if(refresh())finishProjectStart(cityId, E().develop(state(), cityId, kind, select.value));};
  }
  function showRecruit(cityId) {
    const type='infantry';
    const city = currentCity(cityId); if (!city || !own(city)) { api.toast('只能在我方城池募集部队。'); return; }
    const balance = purse(), limit = E().getTroopCapacity(state(),city), days = projectDays('recruit');
    let amount = recruitAmounts.get(`${cityId}:${type}`) || 1000;
    const reserved = reservedTroops(city);
    let maximum=Math.min(2000,Math.floor((limit-troopTotal(city)-reserved)/50)*50);
    while(maximum>=100){const q=cost(city,'recruit',maximum,{type});if(q.gold<=balance.gold&&q.grain<=balance.grain)break;maximum-=50;}
    maximum=Math.max(100,maximum);amount=Math.min(maximum,amount);
    api.dialog('募兵', `${esc(city.name)} · 本城每季最多2次`, `<p class="unit-feature" id="city-recruit-feature"></p><p class="dialog-description">府库 ${fmt(balance.gold)} 金 · 粮草 ${fmt(balance.grain)} · 当前驻军 ${fmt(troopTotal(city))}/${fmt(limit)}${reserved ? ` · 援军与募兵工程预留 ${fmt(reserved)} 人` : ''}</p>${officerSelect(city, 'city-recruit-officer', 'politics')}<label class="small-label">立即增加兵力</label><div class="recruit-number-control"><input type="range" id="city-recruit-range" aria-label="募集人数滑杆" min="100" max="${maximum}" step="50" value="${amount}"><input type="number" id="city-recruit-number" aria-label="募集人数" min="100" max="${maximum}" step="50" value="${amount}"><span>人</span></div><p class="income-note">上限随金粮与剩余容量变化，每次最多2000人。</p><div class="recruit-price"><span>立即执行 · 消耗1令</span><strong id="city-recruit-cost"></strong></div><p class="income-note" id="city-recruit-balance"></p><div class="help-note" id="city-recruit-effect"></div><p class="danger-note" id="city-recruit-error" hidden></p>`, '<button class="secondary-button" data-close>暂缓募兵</button><button class="primary-button" id="city-recruit-confirm">确认募兵</button>');
    const modal = $('#main-dialog'), select = modal.querySelector('#city-recruit-officer');
    const refresh = (syncNumber=true) => {
      const latest = currentCity(cityId), funds = purse(), price = cost(latest, 'recruit', amount, { type });
      const total = troopTotal(latest), nextTotal = total + amount, held = reservedTroops(latest);
      modal.querySelector('#city-recruit-feature').textContent = UNITS[type].detail;
      modal.querySelector('#city-recruit-cost').textContent = priceLabel(price);
      modal.querySelector('#city-recruit-balance').textContent = `执行后府库 ${fmt(funds.gold - price.gold)} 金 · 粮草 ${fmt(funds.grain - price.grain)}；驻军 ${fmt(total)} → ${fmt(nextTotal)} 人。`;
      const nextTraining = Math.round((total * latest.training + amount * 5) / nextTotal), nextMorale = Math.round((total * latest.morale + amount * 70) / nextTotal);
      modal.querySelector('#city-recruit-effect').textContent = `新兵即刻入城：训练 ${latest.training} → ${nextTraining}，士气 ${latest.morale} → ${nextMorale}。每城每季最多募兵两次，每次最多2000人。`;
      const error = nextTotal + held > E().getTroopCapacity(state(),latest) ? '驻军、在途援军与募兵工程已占用容量，请先调兵再募集。' : actionReason(latest, 'recruit', {officerId:select.value,type,amount});
      modal.querySelector('#city-recruit-error').textContent = error; modal.querySelector('#city-recruit-error').hidden = !error;
      modal.querySelector('#city-recruit-confirm').disabled = !!error;
      modal.querySelector('#city-recruit-range').value=amount;if(syncNumber)modal.querySelector('#city-recruit-number').value=amount;
      recruitAmounts.set(`${cityId}:${type}`, amount);
      return !error;
    };
    select.onchange = refresh;
    const normalize=value=>Math.max(100,Math.min(maximum,Math.round((Number(value)||100)/50)*50));
    const numberInput=modal.querySelector('#city-recruit-number');
    modal.querySelector('#city-recruit-range').oninput=e=>{amount=normalize(e.target.value);refresh();};
    numberInput.oninput=()=>{amount=normalize(numberInput.value);refresh(false);};
    numberInput.onchange=()=>{amount=normalize(numberInput.value);refresh();};
    modal.querySelector('#city-recruit-confirm').onclick = () => {amount=normalize(numberInput.value);if(refresh())finishProjectStart(cityId, E().recruitTroops(state(), cityId, type, amount, select.value));};
    refresh();
  }
  function showTraining(cityId) {
    const city = currentCity(cityId); if (!city || !own(city)) { api.toast('只能在我方城池操练军队。'); return; }
    const price = cost(city, 'train'), days = projectDays('train');
    api.dialog('校场点兵', `${esc(city.name)} · 本城每季最多1次`, `<p class="dialog-description">驻军 ${fmt(troopTotal(city))} 人 · 训练 ${fmt(city.training)}/100 · 士气 ${fmt(city.morale)}/100。立即提升训练。</p>${officerSelect(city, 'city-training-officer', 'force')}<div class="help-note" id="city-training-gain"></div><p class="income-note">训练增量为 12 + ⌊教官武力 / 20⌋，士气 +4，均以 100 为上限；对当前驻军即时生效。</p><div class="recruit-price"><span>立即执行</span><strong>${priceLabel(price)}</strong></div><p class="danger-note" id="city-training-error" hidden></p>`, '<button class="secondary-button" data-close>稍后操练</button><button class="primary-button" id="city-training-confirm">确认练兵</button>');
    const select = $('#city-training-officer'), button = $('#city-training-confirm');
    const refresh = () => {
      const latest = currentCity(cityId), chosen = residents(latest).find(g => g.id === select.value), gain = Math.min(100 - latest.training, 12 + Math.floor((chosen?.force || 0) / 20));
      $('#city-training-gain').textContent = `${chosen?.name || '请选择教官'}督训：训练 +${gain}、士气 +${Math.min(4, 100 - latest.morale)}。`;
      const error = actionReason(latest, 'train', {officerId:select.value});
      $('#city-training-error').textContent = error; $('#city-training-error').hidden = !error; button.disabled = !!error;
      return !error;
    };
    select.onchange = refresh; refresh();
    button.onclick = () => {if(refresh())finishProjectStart(cityId, E().trainTroops(state(), cityId, select.value));};
  }
  function showSearch(cityId) { globalThis.TKPeople.showTalents(cityId); }
  globalThis.TKCity = {
    get ready() { return !!api; },
    mount(nextApi) { api = nextApi; },
    render, showCouncil, showRecruit, showTraining, showBuild, showSearch, transferReason,
  };
})();
