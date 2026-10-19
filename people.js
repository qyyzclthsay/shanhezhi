(function () {
  'use strict';
  let api = null;
  let rosterFilter = { city: 'all', mode: 'own', role: 'all' };
  let talentCity = null;
  let talentJournal = { state: null, period: null, entries: [] };
  const ROLE_LABELS = { ruler: '君主', civil: '文臣', military: '武将', warrior: '武将' };
  const RARITY_LABELS = { legend: '传奇', renowned: '名将', common: '良才' };
  const TALENT_PRICES = { legend: 240, renowned: 160, common: 100 };
  const CIVIL_IDS = new Set(['zhugeliang','guojia','luxun','chengong','xunyu','pangtong','lusu','zhangzhao','jiaxu']);
  const RULER_IDS = new Set(['liubei','caocao','sunquan','yuanshao']);
  const esc = value => api?.esc ? api.esc(value) : String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = value => api?.fmt ? api.fmt(value) : Math.round(Number(value) || 0).toLocaleString('zh-CN');
  const stateNow = () => api?.getState();
  const scope = () => document.getElementById('dialog-content') || document;
  const cityById = (state, id) => state?.cities?.find(c => c.id === id) || null;
  const officerById = (state, id) => state?.generals?.find(g => g.id === id) || null;
  const ownedCities = state => state?.cities?.filter(c => c.owner === state.player) || [];
  const factionName = (state, id) => state?.factions?.find(f => f.id === id)?.name || (id === 'free' || id === 'neutral' || !id ? '在野' : id);
  const role = g => ROLE_LABELS[g?.role] ? g.role : RULER_IDS.has(g?.id) ? 'ruler' : CIVIL_IDS.has(g?.id) ? 'civil' : 'military';
  const rarity = g => RARITY_LABELS[g?.rarity] ? g.rarity : 'common';
  const rarityLabel = g => g?.commonKind?(g.commonKind==='civil'?'普通文臣':'普通武将'):rarity(g)==='renowned'&&role(g)==='civil'?'名臣':RARITY_LABELS[rarity(g)];
  const ended = g => ['dead','retired'].includes(g?.status);
  const serving = g => !g?.status || ['serving','active','employed'].includes(g.status);
  const isFree = g => !ended(g) && (['free','unaffiliated','unrecruited'].includes(g?.status) || !g?.status && (!g?.faction || g.faction === 'neutral'));
  const isPrisoner = g => ['prisoner','captured'].includes(g?.status);
  const inOwnRoster = (state,g) => g.faction===state.player && ['serving','marching','prisoner'].includes(g.status);
  function leadershipIdentity(state,g) {
    const factions=state?.factions||[],f=factions.find(f=>f.id===g.faction);
    const gone=f&&(f.leadershipStatus==='eliminated'||state.eliminations?.some(e=>e.faction===f.id));
    if(f&&!gone&&!ended(g)){
      if(f.leaderId===g.id&&['serving','marching','prisoner'].includes(g.status))return {kind:'current',label:'当前君主'};
      if(f.regentId===g.id&&['serving','marching'].includes(g.status))return {kind:'regent',label:'代政'};
    }
    const former=role(g)==='ruler'||factions.some(f=>f.leaderId===g.id)||state?.successionEvents?.some(e=>e.type==='succession'&&e.previousLeaderId===g.id);
    return former?{kind:'former',label:'原君主'}:null;
  }
  function roleDisplay(state,g,markup=false) {
    const identity=leadershipIdentity(state,g),base=ROLE_LABELS[role(g)];
    if(!identity)return base;
    const label=markup?`<span data-leadership="${identity.kind}">${identity.label}</span>`:identity.label;
    // Office is a live label, never a change to the profession used by rules
    // and the existing role filter. A former ruler must not read as incumbent.
    return role(g)==='ruler'?(identity.kind==='regent'?'原君主 · '+label:label):base+' · '+label;
  }
  const ownServing = (state, cityId) => (state?.generals || []).filter(g => g.faction === state.player && serving(g) && (!cityId || cityId === 'all' || officerCityId(state,g) === cityId));
  const cityReady = (state,city) => !!city && city.owner===state.player && api.canAct() && (city.occupiedUntil||0)<=state.totalDays;
  function officerCityId(state, g) {
    return g?.cityId || g?.location || state?.cities?.find(c => c.generalId === g?.id || c.governorId === g?.id || c.generalIds?.includes(g?.id))?.id || null;
  }
  const discovered = (state,g) => !isFree(g) || g.revealedTo?.includes(state.player);
  const visibleCityId = (state,g) => discovered(state,g)?officerCityId(state,g):null;
  function ownCity(state, preferred) {
    const requested = cityById(state, preferred || talentCity || api?.getSelectedId());
    return requested?.owner === state.player ? requested : ownedCities(state)[0] || null;
  }
  function normalizeGeneral(entry, state) {
    if (typeof entry === 'string') return officerById(state, entry);
    if (entry?.general) return entry.general;
    return officerById(state, entry?.generalId || entry?.gid || entry?.id) || entry || null;
  }
  function talentsAt(state, cityId) {
    if (!api?.E?.availableTalents || !cityId) return [];
    return (api.E.availableTalents(state, cityId) || []).map(g => normalizeGeneral(g,state)).filter(g => g?.id && isFree(g));
  }
  function allPrisoners(state) {
    return (api?.E?.prisoners ? api.E.prisoners(state) : (state?.generals || []).filter(g => isPrisoner(g) && (g.captorFaction === state.player || g.captor === state.player))).map(entry => ({entry,g:normalizeGeneral(entry,state)})).filter(item=>item.g?.id);
  }
  function statusLabel(state,g) {
    if(g.status==='dead')return '已故';
    if(g.status==='retired')return '已退隐';
    if(g.status==='marching')return '随军出征';
    if (isPrisoner(g)) return '在押';
    if (isFree(g)) return '在野';
    return g.faction === state.player ? '我方效力' : factionName(state,g.faction);
  }
  function locationLabel(state,g) {
    const city = cityById(state,officerCityId(state,g));
    if(g.status==='dead')return `已故 · ${g.deathReason||'征战殒命'}`;
    if(g.status==='retired')return '已退隐 · 生涯留档';
    if(g.status==='marching'){const a=state.armies.find(a=>a.id===g.armyId||a.generalIds.includes(g.id));return a?`行军中 → ${cityById(state,a.destinationId||a.toId)?.name||'前线'}`:'行军中';}
    if (isPrisoner(g)) return (city ? city.name + ' · ' : '') + '在押俘虏';
    if (isFree(g)) return !discovered(state,g)?'在野 · 尚未寻获':city?.owner===state.player?city.name+' · 已寻获，可礼聘':(city?.name||'他处')+' · 已寻获';
    if (!city) return '尚未驻城';
    if(api.E.busySearching(state,g.id))return city.name+' · 寻访中';
    if(city.project?.officerId===g.id)return city.name+' · '+({search:'寻访',develop:'建设',recruit:'募兵',train:'训练'}[city.project.kind]||'项目')+'中';
    const governor = city.governorId === g.id;
    const job=Object.entries(city.assignments||{}).find(([,id])=>id===g.id)?.[0];
    const duty={commerce:'经商',farming:'农政',training:'练兵',search:'寻访',recruitment:'募兵'}[job];
    return city.name + ' · ' + (governor?'太守':duty|| (city.generalId === g.id?'主将':'待委任'));
  }
  function portrait(g,size) {
    const live=officerById(stateNow(),g?.id)||g;
    const art = globalThis.TKPortraits?.render(g || {}, {size:size || 'small',isRuler:!!live&&leadershipIdentity(stateNow(),live)?.kind==='current',isGovernor:!!live&&live.status==='serving'&&cityById(stateNow(),live.cityId)?.governorId===live.id}) || `<span>${esc(g?.name || '将领')}</span>`;
    return `<div class="portrait ${rarity(g)}"><span class="portrait-art">${art}</span>${globalThis.TKTroops?.badge(g)||''}</div>`;
  }
  function commandLabel(g){const q=api?.E?.officerCommand?.(stateNow(),g);return q?'<small class="officer-command">携兵 '+fmt(q.capacity)+' · '+q.officialRank+'阶</small>':'';}
  const statUses='<dl class="people-stat-uses"><dt>统率</dt><dd>决定携兵基础与全兵种攻防；武将武力、文臣智力的85%可托住有效统兵值。</dd><dt>武力</dt><dd>枪、盾、骑主要战力，影响训练效果；不增加税粮或说服力。</dd><dt>智力</dt><dd>影响迂回方针；弩、斥候取武智较强项为主。文臣智力参与携兵。</dd><dt>政治</dt><dd>决定寻访发现概率、经商和屯田产出、太守税粮加成。</dd><dt>魅力</dt><dd>决定邀请、招降和外交说服；礼聘厚礼能提高邀请概率。招降另看忠诚与双方实力。</dd></dl>';
  function stats(g,compact=false) {
    return `<div class="officer-stats">${[['leadership','统率'],['force','武力'],['intellect','智力'],['politics','政治'],['charisma','魅力']].map(([key,label])=>`<span title="${label}">${compact?label[0]:label}<strong${Number.isFinite(g?.baseStats?.[key])?` title="初始 ${fmt(g.baseStats[key])} · 当前 ${fmt(g[key])}"`:''}>${fmt(g?.[key])}</strong></span>`).join('')}</div>`;
  }
  function card(g,opts) {
    opts=opts||{};
    if (!g) return '';
    const state=stateNow();
    const selectable=opts.selectable && !ended(g),selected=selectable && opts.selected;
    const selection=selectable ? `data-pick="${esc(g.id)}" aria-pressed="${selected?'true':'false'}"` : `data-officer="${esc(g.id)}"`;
    if(!selectable)return `<button type="button" class="officer-card people-card ${rarity(g)}" data-status="${esc(g.status)}" data-role="${esc(role(g))}" ${selection} aria-label="${esc(g.name)}，${roleDisplay(state,g)}，${esc(locationLabel(state,g))}，${esc(opts.action||'查看详情')}">${portrait(g)}<span class="people-card-copy"><strong>${esc(g.name)}</strong><span class="people-card-role">${roleDisplay(state,g,true)} · ${rarityLabel(g)}</span><small>${esc(opts.location||locationLabel(state,g))}</small></span><span class="people-card-action">${esc(opts.action||'查看')} ›</span>${stats(g)}${commandLabel(g)}</button>`;
    return `<button type="button" class="officer-card ${rarity(g)}${selected?' selected':''}" data-status="${esc(g.status)}" data-role="${esc(role(g))}" ${selection} aria-label="${esc(g.name)}，${roleDisplay(state,g)}，${rarityLabel(g)}${selectable?selected?'，已选中':'，选择出战':'，查看详情'}">${portrait(g)}<div class="officer-card-body"><h3>${esc(g.name)}</h3><span class="officer-position" data-command-position hidden></span>${stats(g,true)}${commandLabel(g)}</div><div class="officer-location">${esc(locationLabel(state,g))}${serving(g)?' · 忠诚 '+fmt(g.loyalty):''}</div></button>`;
  }
  function bindCards(target) {
    (target || document).querySelectorAll('[data-officer]').forEach(button => {
      button.onclick = () => showOfficer(button.dataset.officer);
    });
  }
  function backButton(label) { return `<button type="button" class="secondary-button" data-people-back>${label || '返回将府'}</button>`; }
  function applyAction(action, reopen) {
    if(!api.canAct()){api.toast('当前无法执行操作，请等待天下推进结束。');return false;}
    const result=action();
    if(!result?.ok){api.toast(result?.message || '当前无法执行这项操作。');return false;}
    api.save();
    api.render();
    if(reopen)reopen(result);
    api.toast(result.message || '已完成。');
    return true;
  }
  function bindOne(selector,handler) { const element=scope().querySelector(selector);if(element)element.onclick=handler; }
  function serviceDate(day) {
    if(!Number.isInteger(day)||day<0)return '尚未入仕';
    const date=globalThis.TKCalendar?.fromTotalDays(day) || api.E.calendarInfo(day);
    return `${date.year} 年 ${date.month} 月 ${date.day} 日`;
  }
  function serviceRecord(g,state) {
    const info=api.E.serviceInfo?.(state,g);
    if(!info)return '<div class="service-reserve"><strong>生涯记录</strong><small>年限资料暂不可用。</small></div>';
    const entered=Number.isInteger(info.serviceStartDay),dead=g.status==='dead',retired=info.retired||g.status==='retired';
    const points=retired?0:info.serviceReserve,multiplier=Math.round(info.statMultiplier*100),years=info.yearsPerPoint,careerYears=years*10;
    let note,facts=`<span>首次入仕：${entered?esc(serviceDate(info.serviceStartDay)):'尚未入仕'}</span>`;
    if(dead){
      facts+=`<span>生涯终止：${Number.isInteger(g.deathDay)?esc(serviceDate(g.deathDay)):'已故'}</span>`;
      note='已故，生涯与能力记录停留在离世时，不再任职、出征或延揽。';
    }else if(retired){
      facts+=`<span>退隐日期：${esc(serviceDate(g.retirementDay??info.retirementDay))}</span>`;
      note='年限已尽，退隐记录保留在名录中，不再任职、出征或延揽。';
    }else if(!info.enabled){
      note='本征程未启用年限衰退，当前能力不会随年限下降。';
    }else if(!entered){
      facts+=`<span>下次减点：入仕满 ${years} 年</span><span>退隐：首次入仕满 ${careerYears} 年</span>`;
      note=`首次入仕前不计时；礼聘入仕后，才开始计算 ${careerYears} 年生涯。`;
    }else{
      facts+=`<span>下次减点：${esc(serviceDate(info.nextDeclineDay))}</span><span>退隐日期：${esc(serviceDate(info.retirementDay))}</span>`;
      note=`首次入仕后每满 ${years} 年减 1 点，满 ${careerYears} 年、年限为 0 时退隐。转投、被俘和再次入仕不重置计时。`;
    }
    const historical=info.preservedTerminal?`<small>沿用原规则终局记录${info.enabled?`：当时每 ${years} 年减 1 点`:'：当时未启用年限衰退'}，生涯不会因规则更新而重启。</small>`:'';
    return `<div class="service-reserve"><strong>${dead?'生涯留档':retired?'已经退隐':'剩余年限'} · ${fmt(points)} / 10</strong><div class="detail-facts">${facts}<span>${dead?'离世时':retired?'退隐时':'当前'}能力系数：${fmt(multiplier)}%</span></div><small>${note}</small>${historical}<small>每下降 1 点，基础五维各线性减少初始值的 ${api.E.AGING.declinePerPoint*100}%；上方五维已计入衰退，不按上次结果重复相乘。</small></div>`;
  }
  function officerDetail(g,state) {
    const city=cityById(state,officerCityId(state,g));
    const background=api.E.characterBackground?.(g),history=background?.history;
    const backgroundHtml=background?`<p class="people-rule">当前：${esc(statusLabel(state,g))} · 开局：${background.openingStatus==='free'?'在野':esc(api.E.DATA?.factions?.find(f=>f.id===background.openingFactionId)?.name||factionName(state,background.openingFactionId))+'在职'}<br>${esc(background.availabilityLabel)}</p><details class="people-fold" data-officer-background><summary>历史关联 · ${esc(history.label)}</summary><p>${esc(history.note)}</p><p class="people-rule">关联标签介绍生涯背景，不代表当前归属，也不限制任何势力寻访礼聘。</p>${history.sources?.length?`<p class="people-rule">资料：${history.sources.map(source=>`<a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.title)}</a>`).join(' · ')}</p>`:''}</details>`:'';
    return `<div class="officer-detail people-profile">${portrait(g,'large')}<div><div class="people-profile-meta">${roleDisplay(state,g,true)} · ${rarityLabel(g)}</div><h3>${esc(g.name)}</h3><p class="people-profile-status">${esc(locationLabel(state,g))} · 年限 ${g.serviceReserve??10}/10</p>${commandLabel(g)}<p>${esc(g.trait || '以才干立身，以功业留名。')}</p></div></div><p class="people-rule troop-person-reason">固定兵种：${globalThis.TKTroops?.info(g).name||''} · ${esc(globalThis.TKTroops?.info(g).reason||'')}</p>${backgroundHtml}<details class="people-fold" data-officer-abilities open><summary>能力与战绩</summary>${stats(g)}<div class="detail-facts"><span>忠诚 ${fmt(g.loyalty)}</span><span>经验 ${fmt(g.xp)}</span>${ended(g)?'':`<span>守城连败 ${g.personalLosses||0} · 下次守城战败被俘 ${Math.round(api.E.captureChance(state,{...g,personalLosses:(g.personalLosses||0)+1})*100)}%</span>`}${g.origin&&discovered(state,g)?`<span>籍贯 ${esc(cityById(state,g.origin)?.name || g.origin)}</span>`:''}</div>${statUses}<p class="people-rule">每40经验自动升1官阶，8阶可编5将；携兵每40经验+100，最多增加500。当前个人携兵最高 ${fmt(api.E.officerCommand(state,g).maximum)} 人。</p></details><details class="people-fold" data-officer-career><summary>${g.status==='dead'?'生涯留档':g.status==='retired'?'退隐记录':'服役年限与退隐日期'}</summary>${serviceRecord(g,state)}</details>`;
  }
  function showRoster(cityId,mode,roleFilter) {
    if(!api)return;
    const state=stateNow();
    rosterFilter={city:['retired','free'].includes(mode)?'all':cityId || 'all',mode:mode || 'own',role:roleFilter || 'all'};
    const own=ownedCities(state),catalog=['world','free'].includes(rosterFilter.mode);
    if(rosterFilter.mode==='own' && rosterFilter.city!=='all' && !own.some(c=>c.id===rosterFilter.city))rosterFilter.city='all';
    const retired=state.generals.filter(g=>g.faction===state.player&&g.status==='retired');
    const free=state.generals.filter(isFree);
    const list=(rosterFilter.mode==='retired'?retired:rosterFilter.mode==='free'?free:rosterFilter.mode==='own'?(rosterFilter.city==='all'?state.generals.filter(g=>inOwnRoster(state,g)):ownServing(state,rosterFilter.city)):(state.generals||[]).filter(g=>rosterFilter.city==='all'||visibleCityId(state,g)===rosterFilter.city)).filter(g=>rosterFilter.role==='all'||role(g)===rosterFilter.role||(rosterFilter.role==='military'&&role(g)==='warrior'));
    list.sort((a,b)=>({legend:0,renowned:1,common:2}[rarity(a)]-{legend:0,renowned:1,common:2}[rarity(b)])||Number(b.force+b.intellect)-Number(a.force+a.intellect));
    const cities=rosterFilter.mode==='own'?own:state.cities;
    const body=`<div class="people-panel"><div class="dialog-toolbar"><div class="dialog-tabs people-roster-tabs"><button type="button" data-roster-mode="own" class="${rosterFilter.mode==='own'?'active':''}">我方人物 · ${state.generals.filter(g=>inOwnRoster(state,g)).length}</button><button type="button" data-roster-mode="world" class="${catalog?'active':''}">天下名录 · ${state.generals.length}</button><button type="button" data-roster-mode="retired" class="${rosterFilter.mode==='retired'?'active':''}">退隐名册 · ${retired.length}</button></div></div><div class="dialog-toolbar people-roster-filters">${['retired','free'].includes(rosterFilter.mode)?'':`<label class="field-label">驻城<select data-roster-city><option value="all">全部城池</option>${cities.map(c=>`<option value="${esc(c.id)}"${c.id===rosterFilter.city?' selected':''}>${esc(c.name)}</option>`).join('')}</select></label>`}<label class="field-label">身份<select data-roster-role><option value="all">全部身份</option>${[['ruler','君主'],['military','武将'],['civil','文臣']].map(([id,label])=>`<option value="${id}"${rosterFilter.role===id?' selected':''}>${label}</option>`).join('')}</select></label></div><p class="dialog-description">${catalog?'仅查看，任职敌臣不能礼聘。此处是人物图鉴，不是招募候选名单。':rosterFilter.mode==='retired'?'退隐后不再任职、出征或礼聘；点击查看生涯。':'头像与当前五维如下；选择人物可安排委任或调任。'}</p><div class="officer-grid people-list">${list.map(g=>card(g,{action:'查看'})).join('')}</div>${list.length?'':`<p class="empty-note">${rosterFilter.mode==='retired'?'暂无符合条件的退隐人物。':'没有符合条件的人物。'}</p>`}</div>`;
    api.dialog(rosterFilter.mode==='own'?'我方人物':rosterFilter.mode==='retired'?'退隐名册':rosterFilter.mode==='free'?'在野图鉴':'天下名录',catalog?'人物图鉴 · 仅供查看':'文武名册',body,`${catalog?'':'<button type="button" class="secondary-button" data-people-talents>前往人才</button>'}<button type="button" class="primary-button" data-close>返回天下</button>`,'wide');
    const container=scope();
    container.querySelectorAll('[data-officer]').forEach(button=>button.onclick=()=>showOfficer(button.dataset.officer,catalog?'catalog':undefined));
    container.querySelectorAll('[data-roster-mode]').forEach(button=>button.onclick=()=>showRoster('all',button.dataset.rosterMode,rosterFilter.role));
    const cityFilter=container.querySelector('[data-roster-city]');
    if(cityFilter)cityFilter.onchange=event=>showRoster(event.target.value,rosterFilter.mode,rosterFilter.role);
    container.querySelector('[data-roster-role]').onchange=event=>showRoster(rosterFilter.city,rosterFilter.mode,event.target.value);
    bindOne('[data-people-talents]',()=>showTalents(rosterFilter.city==='all'?null:rosterFilter.city));
  }
  function showOfficer(gid,returnTo) {
    if(!api)return;
    const state=stateNow(),g=officerById(state,gid);
    if(!g){api.toast('未找到这位将领。');return;}
    const city=cityById(state,officerCityId(state,g));
    const own=g.faction===state.player&&serving(g);
    let actions='';
    if(returnTo==='catalog'){
      actions='<p class="people-rule">仅查看人物资料；任职敌臣不能礼聘。</p>';
    }else if(own&&city){
      const governor=city.governorId===g.id,busy=city.project?.officerId===g.id;
      const moveReason=globalThis.TKCity?.transferReason(city,g.id)||(!cityReady(state,city)?'本城暂不可调动':api.E.busySearching(state,g.id)?'寻访期间不可调动':''),governorReason=governor?'已是本城太守':!cityReady(state,city)?'本城暂不可任命':'';
      actions=`${busy?'<p class="income-note">正在负责临时项目；调离会中止项目并退还预付金粮。</p>':''}<button type="button" class="primary-button" data-people-council>${busy?'查看当前项目':'安排委任'}</button><button type="button" class="secondary-button" data-people-transfer${moveReason?' disabled':''}>调任他城</button>${moveReason?`<p class="income-note">${esc(moveReason)}</p>`:''}<details class="people-fold people-inline-fold"><summary>更多任命</summary><button type="button" class="secondary-button" data-people-governor${governorReason?' disabled':''}>${governor?'现任太守':'任命太守'}</button>${governorReason&&!governor?`<p class="income-note">${esc(governorReason)}</p>`:''}</details>`;
    }else if(allPrisoners(state).some(item=>item.g.id===g.id)){
      actions='<button type="button" class="primary-button" data-people-prison>前往俘虏营劝降</button>';
    }else if(isFree(g)){
      const local=ownedCities(state).find(c=>talentsAt(state,c.id).some(t=>t.id===g.id));
      actions=local?`<button type="button" class="primary-button" data-people-hire="${esc(local.id)}">延揽此人 · ${fmt(api.E.costs(state,local.id,'hire',g.id).gold)} 金</button>`:'<p class="people-rule">尚未在我方城池寻获。可从任一己城花 1 令、20 金与20粮寻访，等待8—15日后可能发现人才，再派使者邀请；不能指定只找此人，不必等到历史登场年份。</p><button type="button" class="primary-button" data-people-find>安排寻访</button>';
    }
    api.dialog(esc(g.name),'人物志 · '+roleDisplay(state,g),officerDetail(g,state)+(actions?`<div class="detail-actions">${actions}</div>`:''),backButton(returnTo==='prison'?'返回俘虏营':returnTo?.type==='talents'?'返回人才':returnTo==='catalog'?'返回天下名录':undefined),'medium');
    bindOne('[data-people-back]',()=>returnTo==='prison'?showPrisoners():returnTo?.type==='talents'?showTalents(returnTo.cityId):showRoster(rosterFilter.city,rosterFilter.mode,rosterFilter.role));
    bindOne('[data-people-governor]',()=>applyAction(()=>api.E.setGovernor(stateNow(),city.id,g.id),()=>showOfficer(g.id)));
    bindOne('[data-people-council]',()=>api.openCouncil(city.id));
    bindOne('[data-people-transfer]',()=>api.openTransfer(city.id,[g.id]));
    bindOne('[data-people-prison]',()=>showPrisoners());
    bindOne('[data-people-find]',()=>showTalents());
    bindOne('[data-people-hire]',event=>showHire(g.id,event.currentTarget.dataset.peopleHire));
  }
  function journalEntries(state) {
    const period=api.E.calendarInfo(state).period;
    if(state.recruitment)return state.recruitment.results.filter(r=>r.owner===state.player&&r.generalId&&api.E.calendarInfo(r.day).period===period).filter((r,i,all)=>all.findIndex(e=>e.generalId===r.generalId)===i).map(r=>({cityId:r.cityId,gid:r.generalId,type:r.outcome==='joined'?'hired':r.outcome==='declined'?'declined':'found',message:r.message}));
    if(talentJournal.state!==state||talentJournal.period!==period)talentJournal={state,period,entries:[]};
    return talentJournal.entries;
  }
  function rememberTalent(state,cityId,gid,type,message) {
    const entries=journalEntries(state),entry={cityId,gid,type,message};
    const old=entries.findIndex(item=>item.gid===gid);
    if(old>=0)entries.splice(old,1);
    entries.unshift(entry);
  }
  function hiringProblem(state,city,g,price) {
    const offer=api.E.hireOffer(state,city.id,g.id);if(!offer.ok)return offer.message;
    const slots=api.E.officerSlots(state,city.id);
    if(!cityReady(state,city))return '本城暂不可礼聘';
    if(slots.used+slots.reserved>=slots.limit)return '驻将已满';
    if(api.E.getFaction(state,state.player).gold<price)return '金钱不足';
    return '';
  }
  function talentCard(g,state,city,entry) {
    const hired=entry?.type==='hired',price=hired?0:api.E.costs(state,city.id,'hire',g.id).gold;
    const problem=hired?'':hiringProblem(state,city,g,price);
    return `<article class="people-talent-card ${rarity(g)}${g.commonKind?'':' is-named-talent'}" ${hired?'data-talent-joined':'data-talent-candidate'}="${esc(g.id)}">${entry?`<div class="people-result-heading">${hired?'加盟成功':entry?.type==='declined'?'邀请未成':'寻访发现'} · ${esc(g.name)}</div>`:''}${g.commonKind?'':`<span class="talent-gold-mark" data-named-talent="${esc(g.id)}">✦ ${hired?'名士来投':role(g)==='civil'?'名臣':'名将'}</span>`}<div class="people-talent-profile">${portrait(g)}<div><h3>${esc(g.name)}</h3><p>${roleDisplay(state,g)} · ${rarityLabel(g)}</p>${!hired&&api.E.recruitmentAffinity(state,g,state.player)==='home'?'<span class="talent-affinity">本势力优先 · 邀请 +25</span>':''}<small>${hired?'已加入我方 · 驻守'+esc(city.name):'在野 · 已发现，可礼聘'}</small></div></div>${stats(g)}${entry?`<p class="people-result-message">${esc(entry.message)}</p>`:''}<div class="people-talent-actions"><button type="button" class="secondary-button" data-officer="${esc(g.id)}">人物详情</button>${hired?'<strong class="people-joined-label">已加盟</strong>':`<button type="button" class="secondary-button" data-ignore-talent="${esc(g.id)}">忽略</button><button type="button" class="primary-button" data-hire-now="${esc(g.id)}"${problem?' disabled':''}>${problem?esc(problem)+' · ':''}派使者邀请</button>`}</div></article>`;
  }
  function hireNow(gid,cityId,envoyId,gift='normal') {
    const state=stateNow(),city=cityById(state,cityId),g=officerById(state,gid);
    if(!city||!g){api.toast('此人才或城池已不再可用。');return;}
    if(!isFree(g)||!talentsAt(state,cityId).some(t=>t.id===gid)){
      showTalents(cityId);api.toast(ended(g)?`${g.name}${g.status==='retired'?'已退隐':'已故'}，无法礼聘。`:'此人已不在本城可礼聘名单中。');return;
    }
    applyAction(()=>api.E.hireTalent(stateNow(),cityId,gid,envoyId,gift),result=>{
      rememberTalent(stateNow(),cityId,gid,result.success?'hired':'declined',result.message||`${g.name}已加盟，驻守${city.name}。`);
      showTalents(cityId);
    });
  }
  function searchNow(cityId,envoyId) {
    const before=new Set(talentsAt(stateNow(),cityId).map(g=>g.id));
    applyAction(()=>api.E.searchTalent(stateNow(),cityId,envoyId),result=>{
      const state=stateNow(),g=normalizeGeneral(result.general||result.generalId,state)||talentsAt(state,cityId).find(g=>!before.has(g.id));
      if(g?.id)rememberTalent(state,cityId,g.id,'found',result.message||`已发现${g.name}，可邀请入仕。`);
      showTalents(cityId,envoyId);
    });
  }
  function showTalents(cityId,envoyId) {
    if(!api)return;
    const state=stateNow(),cities=ownedCities(state);let city=ownCity(state,cityId);
    if(!cityId&&city&&!talentsAt(state,city.id).length)city=cities.find(c=>talentsAt(state,c.id).length)||city;
    if(!city){api.dialog('人才','本城可招募 0 人 · 招贤','<p class="empty-note">须拥有城池，方可寻访人才。</p>','<button type="button" class="primary-button" data-close>返回天下</button>');return;}
    talentCity=city.id;
    const mission=state.recruitment?.missions.find(m=>m.cityId===city.id);
    const locals=api.E.availableProjectOfficers(state,city.id).slice().sort((a,b)=>api.E.searchChance(state,b.id)-api.E.searchChance(state,a.id)||b.politics-a.politics);
    if(mission){const current=officerById(state,mission.officerId);if(current&&!locals.some(g=>g.id===current.id))locals.unshift(current);}
    const env=mission?officerById(state,mission.officerId):locals.find(g=>g.id===envoyId)||locals[0],available=talentsAt(state,city.id),price=api.E.costs(state,city.id,'search').gold;
    const offer=api.E.actionOffer(state,city.id,'search',{officerId:env?.id});
    const receipts=(state.recruitment?.results||[]).filter(r=>r.owner===state.player&&r.cityId===city.id).slice(0,3);
    const unavailableNote=mission?officerById(state,mission.officerId).name+'正在寻访，剩余 '+Math.max(0,mission.finishDay-state.totalDays)+' 日。':!offer.ok?offer.message:!cityReady(state,city)?'当前暂不可寻访，请等待天下推进结束。':'';
    const unavailable=!!unavailableNote;
    const entries=journalEntries(state).filter(item=>item.cityId===city.id&&item.type==='hired');
    const visibleReceipts=receipts.filter(r=>!api.E.isTalentIgnored(state,r.generalId,state.player)&&!entries.some(entry=>entry.gid===r.generalId)&&!(r.outcome==='found'&&available.some(g=>g.id===r.generalId)));
    const ignored=state.generals.filter(g=>isFree(g)&&api.E.isTalentIgnored(state,g.id,state.player));
    const results=entries.map(entry=>{const g=officerById(state,entry.gid);return g?talentCard(g,state,city,entry):'';}).join('');
    const body=`<div class="people-panel people-recruitment">
      <div class="dialog-toolbar"><label class="field-label">所在城池<select data-talent-city>${cities.map(c=>{const count=talentsAt(state,c.id).length;return `<option value="${esc(c.id)}"${c.id===city.id?' selected':''}>${esc(c.name)}${count?' · 待登用 '+count+' 人':''}</option>`;}).join('')}</select></label><strong class="people-section-label">待登用 ${available.length} 人</strong></div>
      ${available.length?`<p class="income-note">已发现人才会保留，可稍后登用。</p><div class="officer-grid people-list" data-awaiting-talents>${available.map(g=>talentCard(g,state,city)).join('')}</div>`:'<p class="empty-note">本城暂无待登用人才。</p>'}
      ${visibleReceipts.length?`<div class="talent-receipts" aria-live="polite">${visibleReceipts.map(r=>`<p${r.generalId&&!officerById(state,r.generalId)?.commonKind&&['found','joined'].includes(r.outcome)?' class="talent-named-receipt"':''}>${r.generalId&&!officerById(state,r.generalId)?.commonKind&&['found','joined'].includes(r.outcome)?'<span class="talent-gold-mark">✦ 名士</span> ':''}${esc(r.message)}</p>`).join('')}</div>`:''}
      ${results?`<section class="people-talent-results" data-talent-results aria-live="polite"><h3>本季已登用</h3><div class="officer-grid people-list">${results}</div></section>`:''}
      <section class="people-search-section"><h3>寻访人才</h3>
      ${mission?`<p class="alliance-result" role="status">${esc(officerById(state,mission.officerId).name)}寻访中 · 剩 ${Math.max(0,mission.finishDay-state.totalDays)} 日</p>`:''}
      <div class="people-search"><p>1 令 · ${fmt(price)} 金 · 20 粮 · 8—15 日</p>
      <label class="field-label">派遣将领<select data-talent-envoy${mission||!locals.length?' disabled':''}><option value="">${locals.length?'自动推荐 · '+esc(locals[0].name):'暂无驻将'}</option>${locals.map(g=>`<option value="${esc(g.id)}"${env?.id===g.id?' selected':''}>${esc(g.name)} · 政治 ${fmt(g.politics)} · 发现率 ${api.E.searchChance(state,g.id)}%</option>`).join('')}</select></label>
      <button type="button" class="primary-button" data-talent-search${unavailable?' disabled':''}>${mission?'寻访进行中':'派出寻访 · 1 令'}</button>
      ${unavailableNote&&!mission?`<p class="income-note">${esc(unavailableNote)}</p>`:''}</div>
      <details class="people-recruit-rules"><summary>招募规则</summary><p class="people-rule">每城每季可寻访一次，政治影响发现率。本势力具名人才优先，开局两年受保护；连续找到两位普通人才后，下次成功寻访必出具名人才（仍有候选时）。</p><p class="people-rule">登用由使者魅力与礼金影响成功率，成功才付礼金，每人每季可邀请一次。寻访中的将领暂时不能出征或出使。</p></details></section>
      ${ignored.length?`<details class="people-ignored-list"><summary>已忽略 ${ignored.length} 人 · 可恢复</summary>${ignored.map(g=>`<button class="secondary-button" data-restore-talent="${esc(g.id)}">恢复 ${esc(g.name)}</button>`).join('')}</details>`:''}</div>`;
    api.dialog('人才','寻访与登用',body,'<button type="button" class="primary-button" data-close>返回天下</button>','wide');
    scope().querySelector('[data-talent-city]').onchange=event=>showTalents(event.target.value);
    scope().querySelectorAll('[data-officer]').forEach(button=>button.onclick=()=>{
      const g=officerById(stateNow(),button.dataset.officer);
      if(g&&isFree(g))showHire(g.id,city.id);else showOfficer(button.dataset.officer,{type:'talents',cityId:city.id});
    });
    scope().querySelectorAll('[data-hire-now]').forEach(button=>button.onclick=()=>showHire(button.dataset.hireNow,city.id));
    scope().querySelectorAll('[data-ignore-talent]').forEach(b=>b.onclick=()=>applyAction(()=>api.E.ignoreTalent(stateNow(),b.dataset.ignoreTalent),()=>showTalents(city.id)));
    scope().querySelectorAll('[data-restore-talent]').forEach(b=>b.onclick=()=>applyAction(()=>api.E.ignoreTalent(stateNow(),b.dataset.restoreTalent,true),()=>showTalents(city.id)));
    scope().querySelector('[data-talent-envoy]').onchange=e=>showTalents(city.id,e.target.value);
    bindOne('[data-talent-search]',()=>{const selected=scope().querySelector('[data-talent-envoy]').value||undefined;if(!cityReady(stateNow(),cityById(stateNow(),city.id))||!api.E.actionOffer(stateNow(),city.id,'search',{officerId:selected}).ok){showTalents(city.id,selected);return;}searchNow(city.id,selected);});
  }
  function showHire(gid,cityId) {
    const state=stateNow(),city=ownCity(state,cityId),g=officerById(state,gid);
    if(!city||!g){api.toast('此人才或城池已不再可用。');return;}
    if(!isFree(g)){showOfficer(g.id,{type:'talents',cityId:city.id});api.toast(ended(g)?`${g.name}${g.status==='retired'?'已退隐':'已故'}，无法礼聘。`:'此人已不在野，无法礼聘。');return;}
    if(!talentsAt(state,city.id).some(t=>t.id===g.id)){showTalents(city.id);api.toast('此人尚未被本城寻获，或已被其他势力延揽。');return;}
    const price=api.E.costs(state,city.id,'hire',g.id).gold;
    const envoys=api.E.availableProjectOfficers(state,city.id).sort((a,b)=>Number(b.charisma)-Number(a.charisma));
    const slots=api.E.officerSlots(state,city.id);
    const full=slots.used+slots.reserved>=slots.limit;
    const body=officerDetail(g,state)+`<p class="dialog-description">招募后驻守${esc(city.name)}。</p><section class="people-hire-envoy"><h3>邀请使者</h3><label class="field-label">使者<select data-hire-envoy aria-label="邀请使者"><option value="">本城魅力最高者</option>${envoys.map(env=>`<option value="${esc(env.id)}">${esc(env.name)} · 魅力 ${fmt(env.charisma)}</option>`).join('')}</select></label><p class="people-rule">魅力影响接受概率；本属优先，外属较难。厚礼双倍礼金，概率+12点。成功才付礼金，失败下季再试。<strong data-hire-chance></strong></p><label class="field-label people-hire-gift">礼聘诚意<select data-hire-gift><option value="normal">常礼 · 基础费用</option><option value="generous">厚礼 · 双倍费用，概率+12</option></select></label></section>`;
    api.dialog('延揽'+esc(g.name),'贤才待聘 · 明主待贤',body,`<button type="button" class="secondary-button" data-people-back>返回人才</button><button type="button" class="primary-button" data-talent-hire${full||!cityReady(state,city)?' disabled':''}>${full?'驻将已满 · ':''}礼聘入城 · ${fmt(price)} 金</button>`,'medium');
    bindOne('[data-people-back]',()=>showTalents(city.id));
    const refreshPrice=()=>{const current=stateNow(),envoy=scope().querySelector('[data-hire-envoy]').value||undefined,q=api.E.hireOffer(current,city.id,g.id,envoy,scope().querySelector('[data-hire-gift]').value),button=scope().querySelector('[data-talent-hire]'),reason=!q.ok?q.message:!cityReady(current,cityById(current,city.id))?'本城暂不可礼聘':'';scope().querySelector('[data-hire-chance]').textContent=reason||' 接受概率 '+q.chance+'%'+(q.affinity==='home'?' · 本势力优先':q.affinity==='other'?' · 更倾向其他势力':'');button.textContent=reason||'邀请 · '+q.chance+'% · 成功付'+fmt(q.cost.gold)+'金';button.disabled=!!reason;return !reason;};scope().querySelector('[data-hire-envoy]').onchange=refreshPrice;scope().querySelector('[data-hire-gift]').onchange=refreshPrice;refreshPrice();
    bindOne('[data-talent-hire]',()=>{if(!refreshPrice()){api.toast(scope().querySelector('[data-hire-chance]').textContent);return;}const envoy=scope().querySelector('[data-hire-envoy]').value||undefined;hireNow(g.id,city.id,envoy,scope().querySelector('[data-hire-gift]').value);});
  }

  function chanceFor(state,gid,envoyId) {
    const value=api.E.persuasionChance(state,gid,envoyId||undefined);
    const number=Number(value?.chance??value?.probability??value)||0;
    return Math.round(Math.max(0,Math.min(100,number<=1?number*100:number))*10)/10;
  }
  function persuasionProfile(state,g,envoy) {
    return envoy?`${portrait(envoy)}<span><strong>${esc(envoy.name)}</strong><small>魅力 ${fmt(envoy.charisma)} · 当前成功率 ${chanceFor(state,g.id,envoy.id)}%</small><small>${esc(api.E.persuasionOffer(state,g.id,envoy.id).reason)}</small></span>`:'<span>暂无可委派使者。需有驻守己城、未执行旧项目的我方将领。</span>';
  }
  function persuasionBlock(state,g,envoy) {
    if(!envoy)return '暂无可委派使者，无法劝降。';
    const quote=api.E.persuasionOffer(state,g.id,envoy.id);if(!quote.chance)return quote.reason;
    if(g.lastPrisonerDecisionPeriod===api.E.calendarInfo(state).period)return '本季已处置，下季再试';
    const slot=api.E.officerSlots(state,g.cityId);
    if(slot.used+slot.reserved>=slot.limit)return '驻将已满，请先调将腾出名额';
    if(!api.canAct())return '当前无法处置俘虏';
    return '';
  }
  function showPrisoners(result) {
    if(!api)return;
    const state=stateNow(),list=allPrisoners(state),ourCaptives=state.generals.filter(g=>g.status==='prisoner'&&g.faction===state.player&&g.captor!==state.player);
    const period=api.E.calendarInfo(state).period,envoys=api.E.persuasionEnvoys(state),defaultEnvoy=envoys[0];
    const body=`<div class="people-panel">${result?.message?`<p class="people-prison-result" data-prison-result role="status">${esc(result.message)}</p>`:''}<p class="dialog-description">${list.length?'委派一位将领劝降，魅力影响成功率。不消耗金粮或军令，每位俘虏每季可处置一次。':'当前没有可以处置的俘虏。'}</p>${list.map(({g})=>{
      const cooldown=g.lastPrisonerDecisionPeriod===period;
      const block=persuasionBlock(state,g,defaultEnvoy);
      return `<div class="prisoner-row people-prisoner" data-prisoner="${esc(g.id)}">${portrait(g)}<div class="people-prisoner-copy"><h3>${esc(g.name)}</h3><p>${esc(cityById(state,g.cityId)?.name||'军营')}在押 · 原属${esc(factionName(state,g.faction))}</p><label class="field-label people-envoy-label">劝降使者<select data-prison-envoy="${esc(g.id)}"${envoys.length?'':' disabled'}>${envoys.length?envoys.map((env,i)=>`<option value="${esc(env.id)}"${i===0?' selected':''}>${esc(env.name)} · 魅力 ${fmt(env.charisma)}</option>`).join(''):'<option value="">暂无可委派使者</option>'}</select></label><div class="people-envoy-preview" data-prison-envoy-profile="${esc(g.id)}" aria-live="polite">${persuasionProfile(state,g,defaultEnvoy)}</div><small class="people-prison-status" data-prison-status="${esc(g.id)}">${esc(block||'不消耗金粮或军令')}</small></div><div class="prisoner-actions"><button type="button" class="primary-button" data-prison-persuade="${esc(g.id)}"${block?' disabled':''}>${defaultEnvoy?`派${esc(defaultEnvoy.name)}劝降 · ${chanceFor(state,g.id,defaultEnvoy.id)}%`:'暂无使者可劝降'}</button><details class="people-fold people-prison-options"><summary>其他处置</summary><button type="button" class="secondary-button" data-prison-detail="${esc(g.id)}">人物详情</button><button type="button" class="secondary-button" data-prison-release="${esc(g.id)}"${cooldown||!api.canAct()?' disabled':''}>释放</button><button type="button" class="danger-button" data-prison-execute="${esc(g.id)}"${cooldown||!api.canAct()?' disabled':''}>斩首…</button></details></div></div>`;
    }).join('')}${list.length?'':'<p class="empty-note">营中暂无俘虏。</p>'}${ourCaptives.length?`<h3 class="prison-section-title">我方被俘 · ${ourCaptives.length} 人</h3><div class="captive-warning">${ourCaptives.map(g=>`<div>${portrait(g)}<span><strong>${esc(g.name)}</strong><small>关押于${esc(cityById(state,g.cityId)?.name||'敌城')} · 攻下此城可救回</small></span></div>`).join('')}</div>`:''}<details class="people-fold" data-prison-rules><summary>俘虏规则</summary><p class="people-rule">同一人物每季可处置一次；劝降必须委派使者，不消耗金粮或军令。成功率由使者魅力、双方国力和被俘者忠诚共同决定；故主越弱、我方越强，越容易招降。失败每次增加3个百分点，最多增加9；普通最高70%，君主最高35%。原势力灭亡后为 100%，仍需委派使者。<br>现任君主守城连败被俘率为 3% → 8% → 15% → 25%，之后不再提高；其他文武守城连败为 30% → 70% → 100%；主动进攻失败不判定被俘，灭国时收俘另行处理。胜一场清零，休整或进驻空城不清零。攻占城池会接管俘虏，并救出被关押的我方人物。敌我规则相同。</p></details></div>`;
    api.dialog('俘虏营','我方羁押 · '+list.length+' 人',body,backButton(),'wide');
    scope().querySelectorAll('[data-prison-envoy]').forEach(select=>select.onchange=()=>{
      const current=stateNow(),gid=select.dataset.prisonEnvoy,g=officerById(current,gid),envoy=api.E.persuasionEnvoys(current).find(env=>env.id===select.value);
      if(!g)return;
      const block=persuasionBlock(current,g,envoy),button=scope().querySelector(`[data-prison-persuade="${gid}"]`);
      scope().querySelector(`[data-prison-envoy-profile="${gid}"]`).innerHTML=persuasionProfile(current,g,envoy);
      scope().querySelector(`[data-prison-status="${gid}"]`).textContent=block||'不消耗金粮或军令';
      button.disabled=!!block;button.textContent=envoy?`派${envoy.name}劝降 · ${chanceFor(current,gid,envoy.id)}%`:'暂无使者可劝降';
    });
    scope().querySelectorAll('[data-prison-persuade]').forEach(button=>button.onclick=()=>{
      const gid=button.dataset.prisonPersuade,envoyId=scope().querySelector(`[data-prison-envoy="${gid}"]`)?.value;
      applyAction(()=>api.E.persuadePrisoner(stateNow(),gid,envoyId),showPrisoners);
    });
    scope().querySelectorAll('[data-prison-release]').forEach(button=>button.onclick=()=>applyAction(()=>api.E.releasePrisoner(stateNow(),button.dataset.prisonRelease),showPrisoners));
    scope().querySelectorAll('[data-prison-detail]').forEach(button=>button.onclick=()=>showOfficer(button.dataset.prisonDetail,'prison'));
    scope().querySelectorAll('[data-prison-execute]').forEach(button=>button.onclick=()=>showExecution(button.dataset.prisonExecute));
    bindOne('[data-people-back]',()=>showRoster());
  }
  function showExecution(id){const g=officerById(stateNow(),id);if(!g)return;api.dialog(`处决${esc(g.name)}`,'军法处置',`${officerDetail(g,stateNow())}<p class="danger-note">此命令会永久结束${esc(g.name)}在本次征程中的生命，无法再招降、释放或复活。</p>`,`<button class="secondary-button" data-execute-cancel>继续关押</button><button class="danger-button" data-execute-confirm>确认斩首</button>`,'medium');bindOne('[data-execute-cancel]',showPrisoners);bindOne('[data-execute-confirm]',()=>applyAction(()=>api.E.executePrisoner(stateNow(),id),showPrisoners));}
  function mount(nextApi) {
    api=nextApi;
    if(!api?.E||typeof api.getState!=='function')throw new Error('TKPeople.mount requires engine and state access.');
    const buttons=[['officers-btn',()=>showRoster()],['talents-btn',()=>showTalents()],['prisoners-btn',()=>showPrisoners()]];
    buttons.forEach(([id,handler])=>{const button=document.getElementById(id);if(button)button.onclick=handler;});
  }
  globalThis.TKPeople={mount,showRoster,showTalents,showPrisoners,showOfficer,card,portrait,bindCards};
})();
