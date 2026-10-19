(function(root,factory){'use strict';const common=typeof module==='object'&&module.exports;const scenario=common?require('./scenario.js'):root.TKScenario,calendar=common?require('./calendar.js'):root.TKCalendar,combat=common?require('./troop-combat.js'):root.TKTroopCombat;const engine=factory(scenario,calendar,combat);if(common)module.exports=engine;root.TKEngine=engine;})(typeof globalThis!=='undefined'?globalThis:this,function(scenario,calendar,combat){'use strict';
  const RULES = Object.freeze({
    actionsPerTurn: 6, maxSeasonCommands:10, cityActionLimits:{recruit:2,train:1,develop:1,search:1}, recruitAmount: 300, recruitGold: 120, recruitGrain: 150,
    projectDays: {develop:30,recruit:15,train:15,search:20},
    developBase: 120, developPerLevel: 60, maxLevel: 3, maxTroops: 12000, maxCommandTroops: 12000,
    minAttack: 100, minGarrison: 100, expeditionBase: 20, expeditionPerTroop: 0.08,
    transferBase: 10, transferPerTroop: 0.04,
    baseGoldIncome: 100, marketIncome: 65, baseGrainIncome: 180, farmIncome: 110,
    upkeepPerTroops: 100, wallDefense: 0.10, startingGold: 420, startingGrain: 620,
    enemyGraceTurns: 0, aiActionsPerTurn: 2, maxLogs: 100,
    maxArmyGenerals: 5, militiaCapacity: 800, trainGold: 100, trainGrain: 80,
    searchGold: 20, persuadeGold: 0, moveGeneralGrain: 10, periodDays: null, recruitLimitPerPeriod: 4000, recruitLimitPerProject: 2000, releasedHireDelay: 30,
    troopCosts: { infantry: { gold: 40, grain: 50 }, archer: { gold: 50, grain: 50 }, cavalry: { gold: 70, grain: 65 } },
    hireGold: { legend: 240, renowned: 160, common: 100 }
  });
  if(!scenario)throw new Error('请先加载 scenario.js');
  if(!calendar)throw new Error('请先加载 calendar.js');
  const calendarInfo = s => calendar.calendarInfo(s);
  const monthIndex = s => calendar.monthIndex(s);
  const winterGrain = (s,amount) => Math.ceil(amount*(calendarInfo(s).season.id==='winter'?1.05:1));
  const DATA=scenario.DATA||scenario;
  const {cities,edges,generals,factions}=DATA;
  const factionIds=factions.map(f=>f.id),cityIds=cities.map(c=>c.id),generalIds=generals.map(g=>g.id);
  const ROSTER_REVISION='roster-84-v5',EIGHTY_THREE_ROSTER_REVISION='roster-83-v4',PREVIOUS_ROSTER_REVISION='roster-75-v1',EIGHTY_ROSTER_REVISION='roster-80-v2',EIGHTY_ONE_ROSTER_REVISION='roster-81-v3';
  const MAP_REVISION=DATA.mapRevision,ADDED_CITY_IDS=DATA.addedCityIds,legacyCityIds=cityIds.filter(id=>!ADDED_CITY_IDS.includes(id));
  const SUPPORT_GENERAL_IDS=['wuanguo','zhouxin'];
  const FIRST_ADDED_GENERAL_IDS=['jiangwei','xushu','fazheng','weiyan','pangtong'];
  const ADDED_GENERAL_IDS=['sunshangxiang','zhurong','huangyueying','daqiao','xiaoqiao'];
  const eightyThreeGeneralIds=generalIds.filter(id=>id!=='luxun');
  const eightyOneGeneralIds=eightyThreeGeneralIds.filter(id=>!SUPPORT_GENERAL_IDS.includes(id));
  const eightyGeneralIds=eightyOneGeneralIds.filter(id=>id!=='sunquan');
  const previousGeneralIds=eightyGeneralIds.filter(id=>!ADDED_GENERAL_IDS.includes(id));
  const legacyGeneralIds=previousGeneralIds.filter(id=>!FIRST_ADDED_GENERAL_IDS.includes(id));
  // Legacy storage bins are retained to load campaigns without losing a soldier.
  // They are a single fungible reserve now; battle types belong to officers.
  const TYPES=['infantry','archer','cavalry'],JOBS=['commerce','farming','training','search','recruitment'];
  const COMMAND_SYSTEM='season-commands-v1',PAID_ACTIONS=['recruit','train','develop','search'],ACTIVE_JOBS=['commerce','farming'];
  const STATS=['leadership','force','intellect','politics','charisma'];
  const AGING=Object.freeze({enabled:true,yearsPerPoint:10,daysPerPoint:3650,declinePerPoint:.02});
  const PREVIOUS_AGING=Object.freeze({enabled:true,yearsPerPoint:3,daysPerPoint:1095,declinePerPoint:.02});
  const clone = x => JSON.parse(JSON.stringify(x));
  const fail = message => ({ok:false,message});
  const integer = (x,min,max) => Number.isInteger(x)&&x>=min&&x<=max;
  const record = x => !!x&&typeof x==='object'&&!Array.isArray(x);
  const shortText = (x,max=700) => typeof x==='string'&&x.length<=max;
  const sameAging = (value,rule) => record(value)&&Object.keys(value).length===Object.keys(rule).length&&Object.keys(rule).every(k=>value[k]===rule[k]);
  const clamp = (x,min,max) => Math.max(min,Math.min(max,x));
  const unitCount = u => TYPES.reduce((n,k)=>n+(u[k]||0),0);
  const emptyUnits = () => ({infantry:0,archer:0,cavalry:0});
  const getCity = (s,id) => s.cities.find(c=>c.id===id)||null;
  const getFaction = (s,id) => s.factions.find(f=>f.id===id)||null;
  const getGeneral = (s,id) => s.generals.find(g=>g.id===id)||null;
  const actingPlayers=new WeakMap();
  const DIPLOMACY=Object.freeze({version:3,treatyDays:730,cooldownDays:1825,maxAllies:4});
  const ALLIANCE_GIFTS=Object.freeze([
    Object.freeze({id:'none',name:'基本礼',multiplier:1,bonus:0}),
    Object.freeze({id:'modest',name:'加礼',multiplier:1.6,bonus:12}),
    Object.freeze({id:'generous',name:'厚礼',multiplier:2.4,bonus:24})
  ]);
  const diplomaticPair=(a,b)=>[a,b].sort().join('|');
  const diplomacyDate=day=>{const d=calendar.fromTotalDays(day);return `${d.year}年${d.month}月${d.day}日`;};
  const nextSeasonDay=day=>day+calendarInfo(day).daysToNextPeriod;
  const busySearching=(s,id)=>(s.recruitment?.missions||[]).some(m=>m.officerId===id);
  function relationship(s,a,b) {
    const entry=s.diplomacy?.relations?.find(r=>diplomaticPair(r.a,r.b)===diplomaticPair(a,b)),score=entry?.score||0;
    return {score,label:score>=60?'至交':score>=20?'友善':score<=-60?'死敌':score<=-20?'敌视':'中立',modifier:Math.round(score*.25),reason:entry?.reason||'尚无往来',lastGiftDay:entry?.lastGiftDay??null};
  }
  function changeRelationship(s,a,b,delta,reason) {
    if(a===b||!factionIds.includes(a)||!factionIds.includes(b))return;
    if(!s.diplomacy)activateDiplomacy(s);s.diplomacy.relations??=[];
    let r=s.diplomacy.relations.find(r=>diplomaticPair(r.a,r.b)===diplomaticPair(a,b));
    if(!r){r={a,b,score:0,reason:'尚无往来',day:s.totalDays,lastGiftDay:null};s.diplomacy.relations.push(r);}
    r.score=clamp(r.score+delta,-100,100);r.reason=reason;r.day=s.totalDays;return r;
  }
  function factionStrength(s,id) {
    const f=getFaction(s,id),own=ownedCities(s,id),officers=s.generals.filter(g=>g.faction===id&&['serving','marching'].includes(g.status));
    const forces=[...own,...s.armies.filter(a=>a.faction===id)],troops=forces.reduce((n,a)=>n+a.troops,0);
    const military=Math.round(forces.reduce((n,a)=>n+a.troops*(.6+a.training*.004+a.morale*.003),0)/10);
    const territory=own.reduce((n,c)=>n+(c.kind==='pass'?100:c.tier==='major'?350:250)+25*(c.market+c.farm+c.wall),0);
    const talent=Math.round(officers.reduce((n,g)=>n+(g.leadership+g.force+g.intellect+g.politics+g.charisma)/20,0));
    const income=f?incomePreview(s,id):{gold:0,grain:0},economy=Math.round(Math.min(500,(f?.gold||0)/20+(f?.grain||0)/40)+(income.gold+income.grain)*.3);
    const score=military+territory+talent+economy;
    return {score,military,territory,talent,economy,troops,cities:own.filter(c=>c.kind!=='pass').length,label:score>=3200?'鼎盛':score>=1800?'强盛':score>=900?'稳健':'弱小'};
  }
  function allianceGift(s,target,giftId='none') {
    const tier=ALLIANCE_GIFTS.find(g=>g.id===giftId);if(!tier||!getFaction(s,target))return null;
    const power=factionStrength(s,target),ours=factionStrength(s,s.player),ratio=power.score/Math.max(1,ours.score);
    const base=Math.ceil(clamp((60+power.score*.10)*clamp(Math.pow(ratio,.35),.8,1.8),80,1200)/10)*10;
    const gold=Math.ceil(base*tier.multiplier/10)*10;return {...tier,gold,grain:gold*2,base,power,ratio};
  }
  // Limited pacts abstract documented cooperation; dates are gameplay durations.
  const OPENING_ALLIANCES=Object.freeze([
    {a:'wei',b:'shu',days:365,note:'玩法设定：曹操与刘备开局互保一年。'},
    {a:'qun',b:'liubiao',days:365,note:'袁绍南连刘表，按史载关系设置。'},
    {a:'yuanshu',b:'wu',days:365,note:'孙策此时依附袁术，独立势力玩法中简化为盟约。'},
    {a:'yuanshu',b:'gongsunzan',days:365,note:'袁术北连公孙瓒，按史载关系设置。'},
    {a:'shu',b:'taoqian',days:365,note:'刘备援徐州、屯小沛，按援助关系设置。'},
    {a:'shu',b:'gongsunzan',days:183,note:'刘备曾依公孙瓒，开局保留两季旧交。'},
    {a:'shu',b:'kongrong',days:365,note:'刘备曾救孔融，按救援交情设置互不侵犯。'},
    {a:'liuyao',b:'wanglang',days:183,note:'玩法互保：江东小势力前两季共同缓冲，并非史载正式盟约。'}
  ]);
  function allianceBetween(s,a,b) {return a!==b&&(s.diplomacy?.treaties||[]).find(t=>[t.a,t.b].includes(a)&&[t.a,t.b].includes(b)&&t.endDay>s.totalDays&&!isFactionEliminated(s,a)&&!isFactionEliminated(s,b))||null;}
  const areAllied=(s,a,b)=>!!allianceBetween(s,a,b);
  const canPass=(s,f,owner)=>owner===f||areAllied(s,f,owner);
  function activateDiplomacy(s,opening=false) {
    s.diplomacy={version:DIPLOMACY.version,treaties:opening?OPENING_ALLIANCES.map(t=>({...t,startDay:0,endDay:t.days,origin:'opening',warned:false})):[],attempts:[],relations:[],submissionAttempts:[],submissions:[],relationPeriod:period(s)};
    if(opening)for(const t of s.diplomacy.treaties)changeRelationship(s,t.a,t.b,35,'开局合作');
  }
  function allies(s,id=s.player) {return (s.diplomacy?.treaties||[]).filter(t=>[t.a,t.b].includes(id)&&allianceBetween(s,t.a,t.b)).map(t=>({...t,factionId:t.a===id?t.b:t.a,remainingDays:t.endDay-s.totalDays}));}
  function allianceEnvoys(s,id=s.player) {return s.generals.filter(g=>g.faction===id&&g.status==='serving'&&!busySearching(s,g.id)&&!s.cities.some(c=>c.project?.officerId===g.id)).sort((a,b)=>b.charisma-a.charisma);}
  function allianceOffer(s,target,envoyId,giftId='none') {
    const from=s.player,f=getFaction(s,target),sender=getFaction(s,from),g=getGeneral(s,envoyId),existing=allianceBetween(s,from,target),gift=allianceGift(s,target,giftId),relation=relationship(s,from,target);
    const attempt=s.diplomacy?.attempts.find(a=>diplomaticPair(a.from,a.to)===diplomaticPair(from,target));
    const cooldownUntil=attempt?(attempt.accepted?attempt.day+DIPLOMACY.cooldownDays:nextSeasonDay(attempt.day)):0,nextAttemptDay=Math.max(s.totalDays,cooldownUntil,existing?.endDay||0);
    let reason=liveError(s)||(!f||target===from||isFactionEliminated(s,target)?'请选择仍存续的其他势力。':'');
    if(!reason&&!gift)reason='请选择有效的出使礼物。';
    if(!reason&&(!g||!allianceEnvoys(s).some(e=>e.id===g.id)))reason='请委派一位在城文武出使。';
    if(!reason&&cooldownUntil>s.totalDays)reason=(attempt.accepted?'成功结盟后的五年冷却中，':'本季已谈过，')+diplomacyDate(nextAttemptDay)+'可再议。';
    if(!reason&&existing)reason='盟约生效中，不可提前续盟；'+diplomacyDate(nextAttemptDay)+'后可再议。';
    if(!reason&&(allies(s,from).length>=DIPLOMACY.maxAllies||allies(s,target).length>=DIPLOMACY.maxAllies))reason='双方各最多保有'+DIPLOMACY.maxAllies+'位盟友。';
    if(!reason&&commandStatus(s).remaining<1)reason='出使需要 1 道军令。';
    if(!reason&&(sender.gold<gift.gold||sender.grain<gift.grain))reason='府库或粮草不足，请减少礼物。';
    if(!reason&&(f.gold+gift.gold>999999999||f.grain+gift.grain>999999999))reason='对方府库已满，无法接收这份礼物。';
    const fighting=s.armies.some(a=>a.kind==='attack'&&((a.faction===from&&getCity(s,destination(a))?.owner===target)||(a.faction===target&&getCity(s,destination(a))?.owner===from)));
    const strengthPenalty=Math.round(clamp(((gift?.ratio||1)-1)*10,0,20));
    const chance=Math.round(clamp(20+(g?.charisma||0)*.5+(gift?.bonus||0)+relation.modifier-strengthPenalty-(fighting?20:0),5,90));
    return {ok:!reason,message:reason,chance,days:DIPLOMACY.treatyDays,cost:1,gift,relation,strengthPenalty,warPenalty:fighting?20:0,nextAttemptDay,cooldownUntil};
  }
  function proposeAlliance(s,target,envoyId,giftId='none') {
    const quote=allianceOffer(s,target,envoyId,giftId);if(!quote.ok)return fail(quote.message);
    if(!s.diplomacy)activateDiplomacy(s);
    const from=s.player,f=getFaction(s,from),other=getFaction(s,target),envoy=getGeneral(s,envoyId);
    f.commands.spent++;syncActions(s);s.diplomacy.attempts=s.diplomacy.attempts.filter(a=>diplomaticPair(a.from,a.to)!==diplomaticPair(from,target));
    const accepted=random(s)*100<quote.chance;
    s.diplomacy.attempts.push({from,to:target,day:s.totalDays,accepted});changeRelationship(s,from,target,accepted?12:-8,accepted?'缔结盟约 +12':'谈盟未果 −8');
    if(accepted){
      f.gold-=quote.gift.gold;f.grain-=quote.gift.grain;other.gold+=quote.gift.gold;other.grain+=quote.gift.grain;
      s.diplomacy.treaties=s.diplomacy.treaties.filter(t=>diplomaticPair(t.a,t.b)!==diplomaticPair(from,target));
      s.diplomacy.treaties.push({a:from,b:target,startDay:s.totalDays,endDay:s.totalDays+DIPLOMACY.treatyDays,origin:'negotiated',note:envoy.name+'出使缔结两年盟约。',warned:false});
    }
    const delivery=quote.gift.gold?`已交付${quote.gift.gold}金、${quote.gift.grain}粮。`:'未赠金粮。';
    const nextAttemptDay=accepted?s.totalDays+DIPLOMACY.cooldownDays:nextSeasonDay(s.totalDays);
    const message=envoy.name+'出使'+other.name+'，'+(accepted?'结盟成功：两年内互不侵犯、允许借道。'+delivery+'关系 +12。':'对方未同意，礼物未交付，关系 −8。')+'本次消耗1令；'+diplomacyDate(nextAttemptDay)+'可再次谈盟。';addLog(s,message);
    if(accepted)recheckExpeditions(s);
    return {ok:true,accepted,message,chance:quote.chance,gift:quote.gift,nextAttemptDay};
  }
  function goodwillOffer(s,target,envoyId) {
    const gift=allianceGift(s,target),envoy=allianceEnvoys(s).find(g=>g.id===envoyId),relation=relationship(s,s.player,target);
    let message=liveError(s)||(!gift||target===s.player||isFactionEliminated(s,target)?'请选择仍存续的其他势力。':!envoy?'请选择在城且空闲的使者。':'');
    if(!message&&relation.lastGiftDay!==null&&period(s)===calendarInfo(relation.lastGiftDay).period)message='本季已经修好，下季可再来。';
    const cost={gold:gift?Math.ceil(gift.base*.5/10)*10:0,grain:gift?Math.ceil(gift.base*.5/10)*20:0};
    if(!message&&commandStatus(s).remaining<1)message='修好需要 1 道军令。';
    if(!message&&!canPay(getFaction(s,s.player),cost))message='修好所需金粮不足。';
    if(!message&&(getFaction(s,target).gold+cost.gold>999999999||getFaction(s,target).grain+cost.grain>999999999))message='对方府库已满。';
    const tribute=gift?.ratio>1.4;return {ok:!message,message,cost,tribute,gain:tribute?18:12,label:tribute?'纳贡修好':'赠礼修好'};
  }
  function sendGoodwill(s,target,envoyId) {
    const q=goodwillOffer(s,target,envoyId);if(!q.ok)return fail(q.message);
    const f=getFaction(s,s.player),other=getFaction(s,target);pay(s,f,q.cost);other.gold+=q.cost.gold;other.grain+=q.cost.grain;f.commands.spent++;syncActions(s);
    const r=changeRelationship(s,s.player,target,q.gain,q.label+' +'+q.gain);r.lastGiftDay=s.totalDays;
    const message='向'+other.name+q.label+'，交付 '+q.cost.gold+' 金、'+q.cost.grain+' 粮，关系 +'+q.gain+'；消耗 1 令。本季不能重复修好。';addLog(s,message);return {ok:true,message};
  }
  function submissionOffer(s,target,envoyId) {
    const from=s.player,f=getFaction(s,target),ours=factionStrength(s,from),theirs=factionStrength(s,target),relation=relationship(s,from,target),envoy=allianceEnvoys(s).find(g=>g.id===envoyId),pact=allianceBetween(s,from,target),pair=diplomaticPair(from,target);
    const attempt=s.diplomacy?.submissionAttempts?.find(a=>diplomaticPair(a.from,a.to)===pair),ratio=ours.score/Math.max(1,theirs.score);
    let message=liveError(s)||(!f||target===from||target===realPlayer(s)||isFactionEliminated(s,target)?'归顺对象须为存续的其他 AI 势力。':!envoy?'请选择在城且空闲的使者。':'');
    if(!message&&(theirs.cities!==1||ownedCities(s,target).length>2))message='对方须只剩 1 城、至多另有 1 关。';
    if(!message&&ours.cities<3)message='我方至少拥有 3 座城池才可接纳归顺。';
    if(!message&&relation.score<20)message='关系达到友善才可劝归顺。';
    if(!message&&(!pact||s.totalDays-pact.startDay<183))message='须连续结盟至少半年（183日）。';
    if(!message&&ratio<2)message='我方综合实力须至少为对方的 2 倍。';
    if(!message&&s.diplomacy.submissions.some(a=>a.from===from&&calendarInfo(a.day).period===period(s)))message='本季已接纳一方归顺，下季再议。';
    if(!message&&attempt&&calendarInfo(attempt.day).period===period(s))message='本季已向对方劝归顺，下季可再议。';
    if(!message&&commandStatus(s).remaining<1)message='劝归顺需要 1 道军令。';
    if(!message&&(getFaction(s,from).gold+f.gold>999999999||getFaction(s,from).grain+f.grain>999999999))message='我方府库无法容纳对方资源。';
    const threatened=s.armies.some(a=>a.kind==='attack'&&a.faction!==target&&getCity(s,destination(a))?.owner===target),shortage=(f?.grain||0)<incomePreview(s,target).upkeep;
    const chance=Math.round(clamp(5+(envoy?.charisma||0)*.35+relation.score*.25+Math.min(20,Math.max(0,ratio-2)*10)+(threatened?15:0)+(shortage?10:0),5,85));
    return {ok:!message,message,chance,ratio,threatened,shortage,relation};
  }
  function proposeSubmission(s,target,envoyId) {
    const q=submissionOffer(s,target,envoyId);if(!q.ok)return fail(q.message);const from=s.player,f=getFaction(s,from),other=getFaction(s,target);f.commands.spent++;syncActions(s);
    s.diplomacy.submissionAttempts=s.diplomacy.submissionAttempts.filter(a=>diplomaticPair(a.from,a.to)!==diplomaticPair(from,target));s.diplomacy.submissionAttempts.push({from,to:target,day:s.totalDays});
    const accepted=random(s)*100<q.chance;
    if(!accepted){changeRelationship(s,from,target,-8,'劝归顺遭拒 −8');const message=other.name+'拒绝归顺，关系 −8，消耗 1 令；下季可再议。';addLog(s,message);return {ok:true,accepted,message};}
    const joined=s.generals.filter(g=>g.faction===target&&!['dead','retired'].includes(g.status));
    f.gold+=other.gold;f.grain+=other.grain;other.gold=0;other.grain=0;
    for(const c of ownedCities(s,target)){c.owner=from;if(c.project)c.project.owner=from;}
    for(const g of joined)g.faction=from;
    for(const a of s.armies)if(a.faction===target)a.faction=from;
    for(const m of s.recruitment?.missions||[])if(m.owner===target)m.owner=from;
    for(const g of s.generals.filter(g=>g.status==='prisoner')){
      if(g.captor===target)g.captor=from;
      if(g.captor===from&&g.faction===from){Object.assign(g,{captor:null,capturedDay:null,capturedTurn:null});const c=getCity(s,g.cityId);
        if(cityGenerals(s,c.id).length<getOfficerCapacity(s,c))g.status='serving';else{const a=createArmy(s,c.id,c.id,from,'reinforce',emptyUnits(),[g],50,70,'steady',1);a.waiting=true;a.elapsedDays=1;a.progress=1;}}
    }
    s.diplomacy.treaties=s.diplomacy.treaties.filter(t=>t.a!==target&&t.b!==target);s.diplomacy.submissions.push({from,to:target,day:s.totalDays});
    const event={id:identifier(s,'submission'),type:'submission',faction:target,byFaction:from,day:s.day,totalDays:s.totalDays,year:s.year,month:s.month,capturedNames:[],capturedGenerals:[],submittedNames:joined.map(g=>g.name)};s.eliminations.push(event);
    s.cities.forEach(c=>normalizeCity(s,c));recheckExpeditions(s);checkStatus(s);syncActions(s);
    const message=other.name+'举境归顺！城关、兵力、府库及 '+joined.length+' 位文武并入我方。原有外交不继承；仍被第三方关押的文武尚待救回。';addLog(s,message);return {ok:true,accepted,message,event};
  }
  function tickDiplomacy(s,alerts,events) {
    if(!s.diplomacy)return;
    if(s.diplomacy.relationPeriod!==period(s)){
      for(const r of s.diplomacy.relations||[]){if(areAllied(s,r.a,r.b))changeRelationship(s,r.a,r.b,3,'守约一季 +3');else if(r.score<0&&!s.armies.some(a=>a.kind==='attack'&&[r.a,r.b].includes(a.faction)&&[r.a,r.b].includes(getCity(s,destination(a))?.owner)))changeRelationship(s,r.a,r.b,Math.min(2,-r.score),'平静一季，敌意缓和');}
      s.diplomacy.relationPeriod=period(s);
    }
    for(const t of s.diplomacy.treaties){
      const relevant=[t.a,t.b].includes(s.player),names=getFaction(s,t.a).name+'与'+getFaction(s,t.b).name;
      if(isFactionEliminated(s,t.a)||isFactionEliminated(s,t.b))continue;
      let message='',type='';
      if(t.endDay<=s.totalDays){message=names+'盟约到期，互不侵犯与借道许可结束。';type='expired';}
      else if(!t.warned&&t.endDay-s.totalDays<=14){t.warned=true;message=names+'盟约将在14日内到期，请留意借道军队；再次谈盟须满足五年冷却。';type='expiring';}
      if(message){addLog(s,message);events.push(message);if(relevant)alerts.push({kind:'diplomacy',type,faction:s.player,message});}
    }
    s.diplomacy.treaties=s.diplomacy.treaties.filter(t=>t.endDay>s.totalDays&&!isFactionEliminated(s,t.a)&&!isFactionEliminated(s,t.b));
    recheckExpeditions(s);
  }
  // Weighted paths traverse only our own or allied cities. The final node may
  // be an enemy; neutral garrisons are never silently crossed.
  function marchRoutes(s,from,f=s.player) {
    const routes=new Map();if(!getCity(s,from))return routes;
    const queue=[{id:from,path:[from],days:0}],friendly=new Set([f,...allies(s,f).map(t=>t.factionId)]);
    while(queue.length){queue.sort((a,b)=>a.days-b.days);const item=queue.shift();if(routes.has(item.id))continue;routes.set(item.id,item.path);
      if(item.id!==from&&!friendly.has(getCity(s,item.id).owner))continue;
      for(const c of neighbors(s,item.id))if(!routes.has(c.id))queue.push({id:c.id,path:item.path.concat(c.id),days:item.days+travelTime(s,item.id,c.id)});
    }return routes;
  }
  function marchRoute(s,from,to,f=s.player) {return from===to?null:marchRoutes(s,from,f).get(to)||null;}
  function marchPlan(s,from,to,amount=0,kind='attack') {
    const c=getCity(s,to);if(!c||kind==='attack'&&(c.owner===s.player||areAllied(s,s.player,c.owner))||kind!=='attack'&&c.owner!==s.player)return null;
    const route=marchRoute(s,from,to);if(!route)return null;
    const base=costs(s,from,kind==='attack'?'attack':'transfer',amount),travelDays=route.slice(1).reduce((n,id,i)=>n+travelTime(s,route[i],id),0);
    return {route,travelDays,cost:{...base,grain:Math.ceil(base.grain*(1+.35*(route.length-2)))},borrowed:route.slice(1,-1).filter(id=>getCity(s,id).owner!==s.player)};
  }
  function reachableTargets(s,from,kind='attack') {const routes=marchRoutes(s,from),friendly=new Set([s.player,...allies(s).map(t=>t.factionId)]);return s.cities.filter(c=>c.id!==from&&routes.has(c.id)&&(kind==='attack'?!friendly.has(c.owner):c.owner===s.player));}
  function armyEta(s,a) {const route=a.marchRoute||a.withdrawalRoute;const remaining=a.marchRoute?route.slice(a.routeIndex+1):route;return Math.max(0,a.travelDays-a.elapsedDays)+(remaining?.slice(1).reduce((n,id,i)=>n+travelTime(s,remaining[i],id),0)||0);}
  function withdrawExpedition(s,a,reason) {
    const position=a.routeStartProgress+(a.routeEndProgress-a.routeStartProgress)*a.progress;
    a.withdrawalRoute=a.marchRoute?a.marchRoute.slice(0,a.routeIndex+1).reverse():[a.fromId];
    a.kind='retreat';a.reservationCityId=a.withdrawalRoute.at(-1);a.destinationId=a.fromId;a.routeStartProgress=position;a.routeEndProgress=0;a.travelDays=Math.max(1,Math.ceil(a.travelDays*a.progress));a.elapsedDays=0;a.progress=0;a.departDay=s.totalDays;a.waiting=false;
    delete a.marchRoute;delete a.routeIndex;
    addLog(s,reason+'，部队沿已行路线安全撤回'+getCity(s,a.reservationCityId).name+'。');
  }
  function recheckExpeditions(s) {
    for(const a of s.armies.filter(a=>a.kind!=='retreat')){
      if(a.kind==='attack'&&areAllied(s,a.faction,getCity(s,destination(a))?.owner))withdrawExpedition(s,a,'目标现为盟友');
      else if(a.marchRoute&&a.marchRoute.slice(Math.max(1,a.routeIndex),-1).some(id=>!canPass(s,a.faction,getCity(s,id).owner)))withdrawExpedition(s,a,'借道路线已失效');
    }
  }
  const LEADERSHIP_STATUSES=['normal','regency','pending','vacant','eliminated'];
  const LEADERSHIP_REASONS=['captured','dead','retired','defected','unavailable'];
  const realPlayer = s => actingPlayers.get(s)||s.player;
  function leadershipInfo(s,factionId=s.player) {
    const f=getFaction(s,factionId);if(!f)return {status:'eliminated',leader:null,regent:null,reason:null,candidates:[]};
    const leader=getGeneral(s,f.leaderId),gone=s.eliminations.some(e=>e.faction===f.id)||isFactionEliminated(s,f.id);
    const reason=!leader?'unavailable':leader.status==='dead'?'dead':leader.status==='retired'?'retired':leader.faction!==f.id?'defected':leader.status==='prisoner'?'captured':!['serving','marching'].includes(leader.status)?'unavailable':null;
    const heir=({sunce:'sunquan',mateng:'machao'})[f.leaderId];
    const candidates=gone?[]:s.generals.filter(g=>g.faction===f.id&&['serving','marching'].includes(g.status)).map(g=>({general:g,recommended:false,score:g.leadership+g.politics+g.charisma})).sort((a,b)=>Number(b.general.id===heir)-Number(a.general.id===heir)||b.score-a.score||a.general.id.localeCompare(b.general.id));
    if(candidates.length)candidates[0].recommended=true;
    const status=gone?'eliminated':reason==='captured'?'regency':!reason?'normal':candidates.length?'pending':'vacant';
    return {status,leader,regent:status==='regency'?getGeneral(s,f.regentId):null,reason,candidates};
  }
  function leadershipEvent(s,f,type,previousLeaderId,reason,message) {
    const event={id:identifier(s,'leadership'),faction:f.id,type,previousLeaderId,leaderId:f.leaderId,regentId:f.regentId,reason,totalDays:s.totalDays,message,
      previousLeaderName:getGeneral(s,previousLeaderId)?.name||null,leaderName:getGeneral(s,f.leaderId)?.name||null,regentName:getGeneral(s,f.regentId)?.name||null,factionName:f.name};
    s.successionEvents.push(event);s.successionEvents=s.successionEvents.slice(-200);addLog(s,message);return event;
  }
  function installSuccessor(s,f,g,reason) {
    const previousLeaderId=f.leaderId,previous=getGeneral(s,previousLeaderId);
    Object.assign(f,{leaderId:g.id,leader:g.name,name:g.name,flag:g.name.charAt(0),regentId:null,successionPending:null,leadershipStatus:'normal'});
    return leadershipEvent(s,f,'succession',previousLeaderId,reason,(previous?.name||'前任君主')+'离任，'+g.name+'继承君位，势力改称'+f.name+'。');
  }
  function syncLeadership(s) {
    if(s.leadershipVersion!==1||s.status!=='playing'||actingPlayers.has(s))return [];
    const events=[];
    for(const f of s.factions){
      const info=leadershipInfo(s,f.id),before=f.leadershipStatus;
      if(info.status==='eliminated'){Object.assign(f,{leadershipStatus:'eliminated',regentId:null,successionPending:null});continue;}
      if(info.status==='normal'){
        const restored=before==='regency';Object.assign(f,{leadershipStatus:'normal',regentId:null,successionPending:null});
        if(restored)events.push(leadershipEvent(s,f,'restored',f.leaderId,null,info.leader.name+'脱离囚禁，恢复亲政。'));
      }else if(info.status==='regency'){
        const regent=info.candidates[0]?.general||null,changed=before!=='regency'||f.regentId!==(regent?.id||null);
        Object.assign(f,{leadershipStatus:'regency',regentId:regent?.id||null,successionPending:null});
        if(changed)events.push(leadershipEvent(s,f,'regency',f.leaderId,'captured',info.leader.name+'被俘，'+(regent?regent.name+'代行政务，君位保留。':'由军府暂代政务，君位保留。')));
      }else{
        const changed=before!==info.status||f.successionPending?.previousLeaderId!==f.leaderId||f.successionPending?.reason!==info.reason;
        f.regentId=null;if(!f.successionPending||f.successionPending.previousLeaderId!==f.leaderId||f.successionPending.reason!==info.reason)f.successionPending={previousLeaderId:f.leaderId,reason:info.reason,totalDays:s.totalDays};
        if(info.candidates.length&&f.id!==realPlayer(s)){events.push(installSuccessor(s,f,info.candidates[0].general,info.reason));continue;}
        f.leadershipStatus=info.status;
        if(changed)events.push(leadershipEvent(s,f,info.status,f.leaderId,info.reason,(info.leader?.name||'君主')+'已'+({dead:'死亡',retired:'退隐',defected:'离开本势力',unavailable:'离任'})[info.reason]+'，'+(info.candidates.length?'请从本势力在职文武中选择继承人。':'暂无合资格继承人，由军府暂代；招揽文武后再议继位。')));
      }
    }
    return events;
  }
  function chooseSuccessor(s,generalId) {
    const error=liveError(s);if(error)return fail(error);const f=getFaction(s,realPlayer(s)),info=leadershipInfo(s,f.id);
    if(info.status!=='pending')return fail('当前没有需要决定的君位继承。');const candidate=info.candidates.find(c=>c.general.id===generalId);
    if(!candidate)return fail('请选择本势力仍在任或行军中的文武继承君位。');
    const event=installSuccessor(s,f,candidate.general,info.reason);return {ok:true,message:event.message,general:clone(candidate.general),leadershipEvents:[clone(event)]};
  }
  function activateLeadership(s) {
    s.leadershipVersion=1;s.successionEvents=[];for(const f of s.factions)Object.assign(f,{regentId:null,successionPending:null,leadershipStatus:'normal'});syncLeadership(s);
  }
  function serviceInfo(s,gOrId) {
    const g=typeof gOrId==='string'?getGeneral(s,gOrId):gOrId;if(!g)return null;
    const rule=g.agingAtEnd||s.aging||AGING,enabled=rule.enabled===true,start=g.serviceStartDay??null;
    const yearsPerPoint=rule.yearsPerPoint??AGING.yearsPerPoint,daysPerPoint=rule.daysPerPoint??AGING.daysPerPoint;
    const endedDay=g.status==='dead'?g.deathDay:g.status==='retired'?g.retirementDay:null;
    const end=Number.isInteger(endedDay)?Math.min(s.totalDays,endedDay):s.totalDays;
    const servedDays=start===null?0:Math.max(0,end-start),loss=enabled?Math.min(10,Math.floor(servedDays/daysPerPoint)):0;
    const retired=g.status==='retired'||enabled&&g.status!=='dead'&&start!==null&&loss===10;
    return {enabled,serviceReserve:10-loss,serviceStartDay:start,servedDays,yearsPerPoint,daysPerPoint,
      retirementDay:start===null?null:start+daysPerPoint*10,statMultiplier:(100-loss*2)/100,retired,
      nextDeclineDay:!enabled||start===null||g.status==='dead'||retired?null:start+(loss+1)*daysPerPoint,
      ...(g.agingAtEnd?{preservedTerminal:true}:{})};
  }
  function effectiveStats(s,gOrId) {
    const g=typeof gOrId==='string'?getGeneral(s,gOrId):gOrId;if(!g)return null;
    const percent=Math.round(serviceInfo(s,g).statMultiplier*100),base=g.baseStats||g;
    return Object.fromEntries(STATS.map(k=>[k,Math.max(1,Math.round(base[k]*percent/100))]));
  }
  function refreshAging(s) {
    if(!s.aging?.enabled)return [];
    const alerts=[],retiring=new Set();
    for(const g of s.generals){
      const before=g.serviceReserve,info=serviceInfo(s,g);Object.assign(g,effectiveStats(s,g));g.serviceReserve=info.serviceReserve;
      if(g.status==='dead'||g.status==='retired')continue;
      let kind,message;
      if(info.retired){
        kind='retirement';message=g.name+'服役满'+info.yearsPerPoint*10+'年，年限归零，退隐归田。';retiring.add(g.id);
        Object.assign(g,{status:'retired',retirementDay:info.retirementDay,cityId:null,armyId:null,captor:null,capturedDay:null,capturedTurn:null,lastPrisonerDecisionPeriod:null});
      }else if(before>info.serviceReserve){kind='service_decline';message=g.name+'服役年限降至 '+info.serviceReserve+'/10，五维为基础能力的 '+Math.round(info.statMultiplier*100)+'%。';}
      if(kind)alerts.push({kind,generalId:g.id,generalName:g.name,faction:g.faction,previousReserve:before,serviceReserve:g.serviceReserve,totalDays:s.totalDays,message});
    }
    if(retiring.size){
      s.armies.forEach(a=>a.generalIds=a.generalIds.filter(id=>!retiring.has(id)));
      // Soldiers continue their existing march. A pure officer transport whose
      // last passenger retires ends here, without leaving an empty ghost army.
      s.armies=s.armies.filter(a=>a.troops||a.generalIds.length);
      s.cities.forEach(c=>normalizeCity(s,c));syncActions(s);
    }
    for(const kind of ['service_decline','retirement']){
      const group=alerts.filter(a=>a.kind===kind);if(!group.length)continue;
      addLog(s,group.map(a=>a.generalName).join('、')+(kind==='retirement'?'服役满'+(s.aging.yearsPerPoint*10)+'年，退隐归田。':'服役年限下降，五维按基础能力线性衰减。'));
    }
    if(alerts.length){s.personnelNotices=[...alerts,...(s.personnelNotices||[])].slice(0,120);}
    if(retiring.size)checkStatus(s);
    return alerts;
  }
  const ownedCities = (s,f=s.player) => s.cities.filter(c=>c.owner===f);
  const neighbors = (s,id) => edges.filter(e=>e.includes(id)).map(e=>getCity(s,e[0]===id?e[1]:e[0]));
  const cityGenerals = (s,id) => s.generals.filter(g=>g.cityId===id&&g.status==='serving'&&g.faction===getCity(s,id)?.owner);
  const prisoners = (s,f=s.player) => s.generals.filter(g=>g.status==='prisoner'&&(f==='all'||g.captor===f));
  const availableTalents = (s,id) => s.generals.filter(g=>g.status==='free'&&g.cityId===id&&g.revealedTo.includes(s.player)&&!isTalentIgnored(s,g.id,s.player)&&!(g.releasedBy===s.player&&g.hireBlockedUntil>s.totalDays));
  const availableGenerals = s => s.generals.filter(g=>g.status==='serving'&&g.faction===s.player&&!s.cities.some(c=>c.generalId===g.id));
  function random(s) { s.rng=(Math.imul(1664525,s.rng)+1013904223)>>>0;return s.rng/4294967296; }
  function addLog(s,text) {s.logs.unshift({turn:s.turn,year:s.year,month:s.month,day:s.day,totalDays:s.totalDays,text});s.logs.length=Math.min(s.logs.length,RULES.maxLogs);}
  function identifier(s,prefix) {s.sequence++;return prefix+'-'+s.turn+'-'+s.sequence;}
  function movement(s,from,to,faction,kind,units,ids,outcome) {
    const m={id:identifier(s,'move'),fromId:from,toId:to,faction,kind,troops:unitCount(units),units:clone(units),generalIds:ids.slice(),turn:s.turn,outcome:outcome||'completed'};
    s.movements.push(m);s.movements=s.movements.slice(-60);return m;
  }
  function mix(amount) { const infantry=Math.floor(amount*.6),archer=Math.floor(amount*.25);return {infantry,archer,cavalry:amount-infantry-archer}; }
  function validUnits(u,max=RULES.maxTroops) {return record(u)&&TYPES.every(k=>integer(u[k],0,max))&&unitCount(u)<=max;}
  function portion(units,amount) {
    const total=unitCount(units),out=emptyUnits();if(!total||!amount)return out;
    const remainders=[];
    TYPES.forEach(k=>{const exact=units[k]*amount/total;out[k]=Math.floor(exact);remainders.push({k,value:exact-out[k]});});
    remainders.sort((a,b)=>b.value-a.value);
    for(let n=amount-unitCount(out),i=0;n>0;n--,i++)out[remainders[i%TYPES.length].k]++;
    return out;
  }
  function addUnits(city,units) {delete city.defenseTeams;TYPES.forEach(k=>{city.units[k]+=units[k];});city.troops=unitCount(city.units);}
  function subtractUnits(city,units) {delete city.defenseTeams;TYPES.forEach(k=>{city.units[k]-=units[k];});city.troops=unitCount(city.units);}
  function replaceUnits(city,units) {delete city.defenseTeams;city.units=clone(units);city.troops=unitCount(units);}
  function getTroopCapacity(s,c) {const city=typeof c==='string'?getCity(s,c):c;return city?(city.kind==='pass'?4000:city.tier==='major'?12000:8000):0;}
  function mergeArmy(city,units,training,morale) {
    const before=city.troops,n=unitCount(units);const accepted=portion(units,Math.min(n,Math.max(0,getTroopCapacity(null,city)-before)));
    const actual=unitCount(accepted);if(!actual)return n;
    city.training=Math.round((city.training*before+training*actual)/(before+actual));
    city.morale=Math.round((city.morale*before+morale*actual)/(before+actual));addUnits(city,accepted);return n-actual;
  }
  function normalizeCity(s,city) {
    const roster=cityGenerals(s,city.id),ids=roster.map(g=>g.id);
    if(city.defenseTeams&&!validDefenseTeams(city,ids))delete city.defenseTeams;
    if(!ids.includes(city.generalId))city.generalId=roster.slice().sort((a,b)=>(b.leadership+b.force*.2)-(a.leadership+a.force*.2))[0]?.id||null;
    if(!ids.includes(city.governorId))city.governorId=null;
    JOBS.forEach(job=>{if(!ids.includes(city.assignments[job]))city.assignments[job]=null;});
    if(city.project&&(city.project.owner!==city.owner||!ids.includes(city.project.officerId)))abortProject(s,city,'负责将领离任或城池易主');
    fillAdministration(s,city);
  }
  function fillAdministration(s,city) {
    if(city.owner==='neutral'||city.occupiedUntil>s.totalDays)return;
    const roster=cityGenerals(s,city.id).filter(g=>g.id!==city.project?.officerId&&!busySearching(s,g.id)).sort((a,b)=>b.politics-a.politics);
    if(!city.governorId)city.governorId=roster[0]?.id||null;
    const used=new Set(ACTIVE_JOBS.map(job=>city.assignments[job]).filter(Boolean));
    for(const job of ACTIVE_JOBS)if(!city.assignments[job]){const g=roster.find(g=>!used.has(g.id));if(g){city.assignments[job]=g.id;used.add(g.id);}}
  }
  function selectedGenerals(s,city,ids) {
    const roster=cityGenerals(s,city.id);
    if(ids!==undefined) {
      if(!Array.isArray(ids)||ids.length>5||new Set(ids).size!==ids.length||!ids.every(id=>roster.some(g=>g.id===id)))return null;
      return ids.map(id=>getGeneral(s,id));
    }
    return roster.slice().sort((a,b)=>{
      if(a.id===city.generalId)return -1;if(b.id===city.generalId)return 1;
      return (b.leadership+b.force*.3)-(a.leadership+a.force*.3);
    }).slice(0,5);
  }
  function commandCapacity(s,ids) {
    if(!Array.isArray(ids)||!ids.length)return RULES.militiaCapacity;
    if(ids.length>5||new Set(ids).size!==ids.length)return 0;
    const gs=ids.map(id=>getGeneral(s,id));if(gs.some(g=>!g||!['serving','marching'].includes(g.status)))return 0;
    return Math.min(RULES.maxCommandTroops,gs.reduce((n,g)=>n+officerCommand(s,g).capacity,0));
  }

  function officerCommand(s,g){return combat.commandProfile(typeof g==='string'?getGeneral(s,g):g);}
  function armyCommand(s,ids){const g=ids?.length?getGeneral(s,ids[0]):null,q=g?officerCommand(s,g):null;return {commanderId:g?.id||null,rank:q?.officialRank||0,limit:q?.officers||1};}
  function validDefenseTeams(city,ids){
    const teams=city.defenseTeams;if(!Array.isArray(teams)||!teams.length||teams.length>Math.max(1,ids.length))return false;
    if(!teams.every(t=>record(t)&&Array.isArray(t.generalIds)&&t.generalIds.length<=5&&validUnits(t.units)))return false;
    const assigned=teams.flatMap(t=>t.generalIds);
    return assigned.length===ids.length&&new Set(assigned).size===assigned.length&&assigned.every(id=>ids.includes(id))&&TYPES.every(k=>teams.reduce((n,t)=>n+t.units[k],0)===city.units[k]);
  }
  function cityDefenseTeams(s,city){
    const roster=cityGenerals(s,city.id);
    if(validDefenseTeams(city,roster.map(g=>g.id)))return clone(city.defenseTeams);
    const ordered=roster.slice().sort((a,b)=>a.id===city.generalId?-1:b.id===city.generalId?1:(b.leadership+b.force*.3)-(a.leadership+a.force*.3));
    const groups=[];for(let i=0;i<ordered.length;i+=5)groups.push(ordered.slice(i,i+5));if(!groups.length)groups.push([]);
    const weights=groups.map(gs=>gs.reduce((n,g)=>n+officerCommand(s,g).capacity,0)||1);
    let weight=weights.reduce((a,b)=>a+b,0),remaining=clone(city.units);
    return groups.map((gs,i)=>{const amount=i===groups.length-1?unitCount(remaining):Math.floor(unitCount(remaining)*weights[i]/weight),units=portion(remaining,amount);TYPES.forEach(k=>remaining[k]-=units[k]);weight-=weights[i];return {generalIds:gs.map(g=>g.id),units};});
  }
  function cityTroopAssignments(s,id){const c=getCity(s,id);return c?cityDefenseTeams(s,c).flatMap((t,i)=>combat.formation(t.generalIds.map(id=>getGeneral(s,id)),unitCount(t.units)).map(row=>({...row,team:i+1}))):[];}
  const BALANCE_REVISION='balance-v14';
  const OLD_COMMON={military:{leadership:60,force:65,intellect:35,politics:30,charisma:45},civil:{leadership:30,force:25,intellect:60,politics:65,charisma:55}};
  function upgradeBalance(s){
    if(s.balanceRevision===BALANCE_REVISION)return;
    activateRecruitment(s);
    for(const c of s.cities)c.officerCapacity=null;
    for(const g of s.generals){
      if(['dead','retired'].includes(g.status))continue;
      const b={...(g.baseStats||g)};
      if(g.commonKind)for(const k of STATS)b[k]=DATA.commonTemplates[g.commonKind][k];
      else if(g.role==='civil'){b.intellect=Math.max(62,b.intellect);b.politics=Math.max(55,b.politics);}
      else if(g.role==='military'){b.force=Math.max(62,b.force);b.leadership=Math.max(50,b.leadership);}
      else {b.leadership=Math.max(50,b.leadership);b.charisma=Math.max(60,b.charisma);}
      g.baseStats=Object.fromEntries(STATS.map(k=>[k,b[k]]));Object.assign(g,effectiveStats(s,g));
    }
    for(const f of s.factions){
      const known=s.generals.filter(g=>g.commonKind&&g.faction===f.id).map(g=>g.id);
      s.recruitment.commonJoined[f.id]=[...new Set([...(s.recruitment.commonJoined[f.id]||[]),...known])];
      s.recruitment.commonCreated[f.id]=Math.max(s.recruitment.commonCreated[f.id]||0,known.length);
    }
    s.balanceRevision=BALANCE_REVISION;s.personnelNotices??=[];
  }
  const period = s => calendarInfo(s).period;
  // AI retains an independent 1/11/21 assessment cadence. A player season is
  // deliberately not reused as an AI decision identifier.
  const aiDecisionPeriod = s => (s.year-194)*36+(s.month-6)*3+Math.min(2,Math.floor((s.day-1)/10));
  const destination = a => a.destinationId || a.toId;
  const reservedDestination = a => a.reservationCityId || destination(a);
  function getOfficerCapacity(s,c) {const city=typeof c==='string'?getCity(s,c):c;return city?Infinity:0;}
  function officerSlots(s,id) {
    const c=getCity(s,id);if(!c)return {used:0,reserved:0,limit:0};
    return {used:cityGenerals(s,id).length,reserved:s.armies.filter(a=>a.faction===c.owner&&reservedDestination(a)===id).reduce((n,a)=>n+a.generalIds.length,0),limit:getOfficerCapacity(s,c)};
  }
  function hasOfficerSlot(s,id,n=1) {const slot=officerSlots(s,id);return slot.used+slot.reserved+n<=slot.limit;}
  function reservedTroops(s,id) {const c=getCity(s,id);return s.armies.filter(a=>a.faction===c?.owner&&reservedDestination(a)===id).reduce((n,a)=>n+a.troops,0)+(c?.project?.kind==='recruit'&&c.project.owner===c.owner?c.project.amount:0);}
  function commandTotal(s,f) {return Math.min(RULES.maxSeasonCommands,RULES.actionsPerTurn+Math.floor(Math.max(0,ownedCities(s,f).filter(c=>c.kind!=='pass').length-1)/3));}
  function commandStatus(s,f=s.player) {const command=getFaction(s,f)?.commands;return command?{remaining:command.total-command.spent,total:command.total,spent:command.spent}:{remaining:0,total:0,spent:0};}
  function syncActions(s) {s.actions=commandStatus(s).remaining;s.cities.forEach(c=>c.ordersRemaining=0);}
  function cityOrders(s,id) {return getCity(s,id)?.owner===s.player?commandStatus(s).remaining:0;}
  function refreshCommands(s) {
    const current=period(s);for(const f of s.factions)if(f.commands?.period!==current)f.commands={period:current,total:commandTotal(s,f.id),spent:0};
    for(const c of s.cities)if(c.commandPeriod!==current){c.commandPeriod=current;c.periodActions={recruit:0,train:0,develop:0,search:0};}
    syncActions(s);
  }
  function liveError(s) {return !s||s.status!=='playing'?'本局已经结束，请开启新征程。':s.pendingBattle?(s.pendingBattle.phase==='siege'?'请先决定继续攻城或撤回。':'两军已接战，请先完成战前布阵。'):null;}
  function cityError(s,c,orders=false) {
    if(!c||c.owner!==s.player)return '请选择我方城池。';
    if(c.occupiedUntil>s.totalDays)return '新占城池正在整顿，请等至次日。';
    return null;
  }
  function actionAvailability(s,id,kind) {
    const c=getCity(s,id),error=liveError(s)||cityError(s,c,true);if(error)return fail(error);
    if(PAID_ACTIONS.includes(kind)&&commandStatus(s).remaining<1)return fail('本季命令已用尽，请推进至下一季。');
    if(PAID_ACTIONS.includes(kind)&&c.periodActions[kind]>=RULES.cityActionLimits[kind])return fail('本城本季'+({recruit:'募兵',train:'训练',develop:'建设',search:'寻访'})[kind]+'次数已用尽。');
    if(['recruit','train','develop','search'].includes(kind)&&c.project)return fail('本城已有进行中的项目，请待完工或取消。');
    if(kind==='search'&&s.recruitment?.missions.some(m=>m.cityId===id))return fail('本城寻访尚未结束，请等待使者返回。');
    if(['recruit','train','develop','search'].includes(kind)&&!availableProjectOfficers(s,id).length)return fail('本城需要一名在职文武负责项目。');
    return {ok:true,message:'可执行'};
  }
  function consumeOrder(s,c,kind) {if(!PAID_ACTIONS.includes(kind))return;getFaction(s,c.owner).commands.spent++;c.periodActions[kind]++;syncActions(s);}
  function officer(s,c,id,stat) {const pool=cityGenerals(s,c.id).filter(g=>!busySearching(s,g.id));return id?pool.find(g=>g.id===id)||null:pool.sort((a,b)=>b[stat]-a[stat])[0]||null;}
  function pay(s,f,cost,c) {f.gold-=cost.gold||0;f.grain-=cost.grain||0;if(c&&(cost.actions||0)>0)consumeOrder(s,c);}
  function canPay(f,cost) {return !!f&&f.gold>=(cost.gold||0)&&f.grain>=(cost.grain||0);}
  function costs(s,id,action,amount=300,options={}) {
    const c=getCity(s,id);
    if(action==='recruit'||TYPES.includes(action)){const price=RULES.troopCosts[s.troopSystem==='officer-types-v1'?'infantry':options.type||(TYPES.includes(action)?action:'infantry')];return price?{gold:Math.ceil(price.gold*amount/100),grain:winterGrain(s,price.grain*amount/100*(calendarInfo(s).season.id==='spring'?.95:1)),actions:1,amount}:null;}
    if(action==='attack')return {gold:0,grain:winterGrain(s,Math.floor(amount*RULES.expeditionPerTroop)+RULES.expeditionBase),actions:0};
    if(action==='transfer')return {gold:0,grain:winterGrain(s,Math.floor(amount*RULES.transferPerTroop)+RULES.transferBase),actions:0};
    if(action==='moveGenerals')return {gold:0,grain:winterGrain(s,10),actions:0};
    if(c&&['farm','market','wall'].includes(action))return {gold:120+c[action]*60,grain:0,actions:1};
    if(action==='train')return {gold:100,grain:winterGrain(s,80),actions:1};
    if(action==='search')return s.recruitment?{gold:20,grain:20,actions:1}:{gold:80,grain:0,actions:1};
    if(action==='persuade')return {gold:0,grain:0,actions:0};
    if(action==='hire'){const g=getGeneral(s,options.generalId||amount),envoy=c?officer(s,c,options.envoyId,'charisma'):null;return g?{gold:Math.ceil(RULES.hireGold[g.rarity]*(1-Math.min(.1,(envoy?.charisma||0)/1000))),grain:0,actions:0}:null;}
    if(['assign','governor','assignment'].includes(action))return {gold:0,grain:0,actions:0};
    return null;
  }
  function freshGeneral(g) {return {...clone(g),baseStats:Object.fromEntries(STATS.map(k=>[k,g[k]])),xp:g.xp||0,status:g.status||'serving',loyalty:g.loyalty??80,captor:null,capturedTurn:null,capturedDay:null,armyId:null,serviceReserve:10,serviceStartDay:g.status==='free'?null:0,retirementDay:null,
    personalLosses:0,persuadeAttempts:0,lastPrisonerDecisionPeriod:null,deathDay:null,deathReason:null,releasedBy:null,hireBlockedUntil:0,revealedTo:clone(g.revealedTo||[]),discoverable:g.status==='free'};}
  function addRoster(s) {
    // Only called after validating a complete, explicitly supported old roster.
    // Existing records are authoritative, including deaths and retirements.
    const existing=new Set(s.generals.map(g=>g.id));
    for(const base of generals.filter(g=>!existing.has(g.id))){
      const g=freshGeneral(base);
      // Earlier expansions offered Sun Quan as a recruit. Do not rewrite an
      // ongoing campaign's talent pool just because the new opening changed.
      if(g.id==='sunquan')Object.assign(g,{faction:'neutral',status:'free',cityId:'wujun',loyalty:0,revealedTo:[],discoverable:true,serviceStartDay:null});
      if(SUPPORT_GENERAL_IDS.includes(g.id)){
        const homes=ownedCities(s,g.faction),home=homes.find(c=>c.id===g.cityId&&hasOfficerSlot(s,c.id))||homes.find(c=>hasOfficerSlot(s,c.id));
        if(home)Object.assign(g,{cityId:home.id,serviceStartDay:s.totalDays});
        else Object.assign(g,{faction:'neutral',status:'free',cityId:homes[0]?.id||g.cityId,loyalty:0,revealedTo:[],discoverable:true,serviceStartDay:null});
      }
      s.generals.push(g);
    }
    s.rosterRevision=ROSTER_REVISION;
  }
  function upgradeRatings(s) {
    if(s.ratingsRevision===DATA.ratingsRevision)return;
    for(const g of s.generals){
      const base=generals.find(x=>x.id===g.id);if(!base||['dead','retired'].includes(g.status))continue;
      g.baseStats=Object.fromEntries(STATS.map(k=>[k,base[k]]));Object.assign(g,effectiveStats(s,g));
    }
    s.ratingsRevision=DATA.ratingsRevision;
  }
  function freshCity(c) {return {...clone(c),farm:c.farm??1,market:c.market??1,wall:c.wall??1,officerCapacity:null,occupiedUntil:0,
    units:clone(c.units||mix(c.troops??600)),troops:c.troops??600,training:c.training??25,morale:c.morale??75,terrain:c.terrain||'plain',generalId:c.generalId||null,governorId:null,
    assignments:{commerce:null,farming:null,training:null,search:null,recruitment:null},recruitment:{type:'infantry',target:Math.min(1500,getTroopCapacity(null,c))},project:null,searchProgress:0,ordersRemaining:0,periodActions:{recruit:false,train:false,develop:false}};}
  function addMap(s) {
    for(const base of cities.filter(c=>ADDED_CITY_IDS.includes(c.id))){
      const c=freshCity(base);c.commandPeriod=period(s);c.periodActions=Object.fromEntries(PAID_ACTIONS.map(k=>[k,0]));
      // Completed campaigns stay completed; their new territory is unstaffed.
      if(s.status==='won')c.owner=s.player;
      s.cities.push(c);
    }
    s.mapRevision=MAP_REVISION;
  }
  function characterBackground(gOrId) {
    const id=typeof gOrId==='string'?gOrId:gOrId?.id,entry=DATA.characterBackgrounds?.[id];
    return entry?clone(entry):null;
  }
  function rosterOverview() {
    const free=generals.filter(g=>g.status==='free');
    return {total:generals.length,serving:generals.length-free.length,free:free.length,freeIds:free.map(g=>g.id),mode:'all-available-194'};
  }
  function factionTalentGuide(factionId) {
    if(!factionIds.includes(factionId))return [];
    return generals.filter(g=>g.status==='free'&&DATA.recruitPreferences[g.id]===factionId).map(characterBackground);
  }
  const OPENING_SUPPORT={strong:{gold:1600,grain:4000,troops:1800},medium:{gold:1000,grain:2600,troops:1000},basic:{gold:0,grain:0,troops:0}};
  function openingProfile(factionId) {
    const f=factions.find(f=>f.id===factionId);if(!f)return null;
    const own=cities.filter(c=>c.owner===factionId),capital=own.find(c=>c.id===f.capital)||own[0];if(!capital)return null;
    const officers=generals.filter(g=>g.faction===factionId&&(g.status||'serving')==='serving');
    const tier=own.length>=3?'basic':officers.length<=2?'strong':'medium',bonus=OPENING_SUPPORT[tier];
    const baseTroops=c=>c.units?unitCount(c.units):c.troops??600;
    const troopsAdded=Math.min(bonus.troops,Math.max(0,getTroopCapacity(null,capital)-baseTroops(capital)));
    let talent=null;
    if(tier==='strong'){
      // The one-time support scout keeps the previously balanced 75-person
      // pool. New roster additions remain fully available to normal searches,
      // without silently replacing scarce-officer factions' opening commanders.
      const free=generals.filter(g=>g.status==='free'&&g.faction==='neutral'&&previousGeneralIds.includes(g.id));
      const military=g=>g.leadership>=75&&g.force>=75,warriors=free.filter(military);
      const pool=!officers.some(military)&&warriors.length?warriors:free;
      const distance=g=>{const c=cities.find(c=>c.id===g.cityId);return c?Math.hypot(c.x-capital.x,c.y-capital.y):Infinity;};
      talent=pool.slice().sort((a,b)=>distance(a)-distance(b)||a.id.localeCompare(b.id))[0]||null;
    }
    const support={tier,gold:bonus.gold,grain:bonus.grain,troops:troopsAdded,talentId:talent?.id||null,talentName:talent?.name||null};
    return {factionId,capitalId:capital.id,cityCount:own.filter(c=>c.kind!=='pass').length,passCount:own.filter(c=>c.kind==='pass').length,territoryCount:own.length,officerCount:officers.length,
      difficulty:{strong:'较难',medium:'适中',basic:'稳健'}[tier],
      difficultyDetail:tier==='strong'?'在职文武较少；额外金粮与援兵，并提前发现一位可礼聘的在野人才。':tier==='medium'?'据点较少；额外金粮与援兵，便于经营和扩张。':'已有多处据点，以原有兵粮与收入起步。',
      gold:(f.gold??640)+bonus.gold,grain:(f.grain??1200)+bonus.grain,troops:own.reduce((n,c)=>n+baseTroops(c),0)+troopsAdded,capitalTroops:baseTroops(capital)+troopsAdded,support};
  }
  function createGame(factionId='shu',seed=42) {
    if(!factionIds.includes(factionId))factionId=factionIds[0];
    const s={version:4,rosterRevision:ROSTER_REVISION,ratingsRevision:DATA.ratingsRevision,mapRevision:MAP_REVISION,turnSystem:'seasons-v1',administrationSystem:'assignments-v1',commandSystem:COMMAND_SYSTEM,scenarioId:DATA.id||'194-06',turn:1,year:194,month:6,day:1,totalDays:0,aging:clone(AGING),player:factionId,actions:0,rng:Number.isFinite(seed)?Number(seed)>>>0:42,sequence:0,
      factions:factions.map(f=>({...clone(f),gold:f.gold??640,grain:f.grain??1200,aiMonth:0,aiDecisions:0,aiPeriod:-1,lastDefeatedBy:null})),
      cities:cities.map(freshCity),
      generals:generals.map(freshGeneral),
      armies:[],logs:[],status:'playing',pendingBattle:null,troopSystem:'officer-types-v1',movements:[],lastBattles:[],monthReports:[],eliminations:[]};
    s.cities.forEach(c=>{c.troops=unitCount(c.units);const gs=cityGenerals(s,c.id);c.governorId=gs.slice().sort((a,b)=>b.politics-a.politics)[0]?.id||null;normalizeCity(s,c);});
    refreshCommands(s);addLog(s,'兴平元年六月，董卓既亡，群雄各据州郡。每季共享命令，内政即刻见效，軍队沿道路真实行军。');
    // Only this fresh-game path applies support. Loading, importing and the AI
    // never call it, so this record is informational, not a refill trigger.
    const profile=openingProfile(factionId),support=profile.support,capital=getCity(s,profile.capitalId),player=getFaction(s,factionId);
    player.gold=profile.gold;player.grain=profile.grain;const reinforcements=emptyUnits();reinforcements.infantry=support.troops;addUnits(capital,reinforcements);
    if(support.talentId){const g=getGeneral(s,support.talentId);g.cityId=capital.id;if(!g.revealedTo.includes(factionId))g.revealedTo.push(factionId);}
    s.openingSupport={version:'opening-v1',tier:support.tier,gold:support.gold,grain:support.grain,troops:support.troops,capitalId:capital.id,talentId:support.talentId};
    if(support.gold||support.grain||support.troops||support.talentId)addLog(s,'开局扶持：金 +'+support.gold+'，粮 +'+support.grain+'，'+capital.name+'兵源 +'+support.troops+'。'+(support.talentId?'已在'+capital.name+'访得'+support.talentName+'，仍需正常礼聘。':''));
    // Small AI realms also get a one-time buffer, without a free named hire.
    for(const other of s.factions.filter(f=>f.id!==factionId)){const p=openingProfile(other.id);if(p.support.tier==='basic')continue;const c=getCity(s,p.capitalId),u=emptyUnits();other.gold+=Math.round(p.support.gold*.65);other.grain+=Math.round(p.support.grain*.65);u.infantry=Math.min(Math.round(p.support.troops*.65),getTroopCapacity(s,c)-c.troops);addUnits(c,u);}
    activateLeadership(s);activateDiplomacy(s,true);activateRecruitment(s);upgradeBalance(s);return s;
  }
  function availableProjectOfficers(s,id) {const c=getCity(s,id);return !c||c.project?[]:cityGenerals(s,id).filter(g=>!busySearching(s,g.id));}
  function activeOfficer(s,c,id) {return c.project?.officerId===id?null:getGeneral(s,id);}
  function abortProject(s,c,reason) {
    const p=c.project;if(!p)return null;const f=getFaction(s,p.owner);if(f){f.gold+=p.cost.gold||0;f.grain+=p.cost.grain||0;}c.project=null;
    const message=c.name+'的'+({develop:'建设',recruit:'募兵',train:'训练',search:'寻访'})[p.kind]+'项目中止（'+reason+'），预付金粮已退还原势力。';addLog(s,message);return {ok:true,message,project:clone(p),refunded:clone(p.cost)};
  }
  function cancelProject(s,id) {const c=getCity(s,id),error=liveError(s)||(!c||c.owner!==s.player?'请选择我方城池。':null);if(error)return fail(error);return c.project?abortProject(s,c,'主动取消'):fail('本城没有进行中的项目。');}
  // A read-only quote shared by the city controls and the executing command.
  function actionOffer(s,id,kind,options={}) {
    const c=getCity(s,id),error=liveError(s)||cityError(s,c,true);if(error)return fail(error);
    const {officerId,target,type='infantry',amount=300}=options;
    if(!PAID_ACTIONS.includes(kind))return fail('未知的城务命令。');
    if(kind==='develop'){
      if(!['farm','market','wall'].includes(target))return fail('未知的发展项目。');
      if(c[target]>=3)return fail('这项建设已经达到最高等级。');
    }
    if(kind==='recruit'){
      if(!TYPES.includes(type)||!integer(amount,100,2000)||amount%50)return fail('每次募兵 100—2000 人，以 50 人为步长自由调整。');
      if(c.troops+reservedTroops(s,c.id)+amount>getTroopCapacity(s,c))return fail('本城无法容纳这批新兵，请先调兵。');
    }
    if(kind==='train'){
      if(!c.troops)return fail('本城尚无可操练的部队。');
      if(c.training>=100)return fail('部队已经训练有素。');
    }
    if(kind==='search'&&!canSearchTalent(s,s.player))return fail('可寻访人才均已探明，可查看已发现人才。');
    const available=actionAvailability(s,id,kind);if(!available.ok)return available;
    const stat=['develop','search','recruit'].includes(kind)?'politics':'force';
    const pool=availableProjectOfficers(s,id),g=officerId?pool.find(g=>g.id===officerId):pool.sort((a,b)=>kind==='search'?searchChance(s,b.id)-searchChance(s,a.id):b[stat]-a[stat])[0];
    if(!g)return fail('请选择本城在职文武执行命令。');
    const cost=costs(s,id,kind==='develop'?target:kind,amount,{type});
    const f=getFaction(s,s.player);if(!canPay(f,cost))return fail('需要 '+cost.gold+' 金和 '+cost.grain+' 粮。');
    return {ok:true,cost,officerId:g.id};
  }
  function prepareAction(s,id,kind,options) {
    const q=actionOffer(s,id,kind,options);if(!q.ok)return q;
    pay(s,getFaction(s,s.player),q.cost);consumeOrder(s,getCity(s,id),kind);return {...q,general:getGeneral(s,q.officerId)};
  }
  function develop(s,id,kind,officerId) {
    const ready=prepareAction(s,id,'develop',{officerId,target:kind});if(!ready.ok)return ready;
    const c=getCity(s,id);
    c[kind]++;const message=c.name+'的'+({farm:'农田',market:'市集',wall:'城防'})[kind]+'提升至 '+c[kind]+' 级。';addLog(s,message);return {ok:true,message,kind:'develop',target:kind,level:c[kind],officerId:ready.general.id};
  }
  function recruitTroops(s,id,type='infantry',amount=300,officerId) {
    const ready=prepareAction(s,id,'recruit',{officerId,type,amount});if(!ready.ok)return ready;
    const c=getCity(s,id);
    const units=emptyUnits();units[type]=amount;mergeArmy(c,units,5,70);const message=c.name+'募得 '+amount+' 名新兵，已编入驻军。';addLog(s,message);return {ok:true,message,kind:'recruit',amount,type,officerId:ready.general.id};
  }
  function recruit(s,id) {return recruitTroops(s,id,'infantry',300);}
  function assignGeneral(s,id,gid) {
    const c=getCity(s,id),error=liveError(s)||cityError(s,c,true);if(error)return fail(error);
    if(!cityGenerals(s,id).some(g=>g.id===gid))return fail('主将必须是在本城任职的将领，请先调动。');
    if(c.generalId===gid)return fail('这名将领已是本城主将。');
    c.generalId=gid;consumeOrder(s,c);const message=getGeneral(s,gid).name+'出任'+c.name+'主将。';addLog(s,message);return {ok:true,message};
  }
  function setGovernor(s,id,gid) {
    const c=getCity(s,id),error=liveError(s)||cityError(s,c,gid!==null);if(error)return fail(error);
    if(gid!==null&&!cityGenerals(s,id).some(g=>g.id===gid))return fail('太守必须在本城任职。');
    if(c.governorId===gid)return fail('太守任命没有变化。');
    c.governorId=gid;if(gid!==null)consumeOrder(s,c);
    const message=c.name+(gid?'由'+getGeneral(s,gid).name+'担任太守。':'太守暂缺。');addLog(s,message);return {ok:true,message};
  }
  function setAssignment(s,id,job,gid) {
    const c=getCity(s,id),error=liveError(s)||cityError(s,c,gid!==null);if(error)return fail(error);
    if(!JOBS.includes(job))return fail('未知的内政岗位。');
    if(gid!==null&&!ACTIVE_JOBS.includes(job))return fail('长期委任仅保留经商与屯田；募兵、训练、寻访请使用本季命令。');
    if(gid!==null&&!cityGenerals(s,id).some(g=>g.id===gid))return fail('请委任本城的在职文武官员。');
    if(c.assignments[job]===gid)return fail('这项委任没有变化。');
    if(gid!==null)JOBS.forEach(j=>{if(c.assignments[j]===gid)c.assignments[j]=null;});
    c.assignments[job]=gid;if(gid!==null)consumeOrder(s,c);
    const labels={commerce:'经商',farming:'农政',training:'练兵',search:'寻访',recruitment:'募兵'};
    const message=c.name+labels[job]+(gid?'交由'+getGeneral(s,gid).name+'负责，每月自动执行。':'岗位已撤任。');addLog(s,message);return {ok:true,message};
  }
  function setRecruitment(s,id,config) {
    const c=getCity(s,id),error=liveError(s)||cityError(s,c);if(error)return fail(error);
    if(!record(config)||!TYPES.includes(config.type)||!integer(config.target,0,getTroopCapacity(s,c)))return fail('请选择兵种与不超过本城容量的驻兵目标。');
    return fail('自动募兵已停用，请使用本季募兵命令。');
  }
  function autoAssignOffer(s,id) {
    const error=liveError(s);if(error)return fail(error);if(id&&cityError(s,getCity(s,id)))return fail(cityError(s,getCity(s,id)));
    const targets=id?[getCity(s,id)]:ownedCities(s).filter(c=>c.occupiedUntil<=s.totalDays),changed=[],posts=[];
    for(const c of targets){
      const before=posts.length,roster=cityGenerals(s,c.id).filter(g=>g.id!==c.project?.officerId);
      if(!c.governorId&&roster.length)posts.push({cityId:c.id,job:'governor',officerId:roster.slice().sort((a,b)=>b.politics-a.politics)[0].id});
      const used=new Set(ACTIVE_JOBS.map(job=>c.assignments[job]).filter(Boolean));
      for(const job of ACTIVE_JOBS){
        if(c.assignments[job])continue;const stat=job==='recruitment'||job==='training'?'force':job==='search'?'intellect':'politics';
        const g=roster.filter(g=>!used.has(g.id)).sort((a,b)=>b[stat]-a[stat])[0];if(!g)continue;posts.push({cityId:c.id,job,officerId:g.id});used.add(g.id);
      }
      if(posts.length>before)changed.push(c.id);
    }
    return {ok:true,assigned:posts.length,cities:changed,posts};
  }
  function autoAssign(s,id) {
    const q=autoAssignOffer(s,id);if(!q.ok)return q;
    for(const p of q.posts){const c=getCity(s,p.cityId);if(p.job==='governor')c.governorId=p.officerId;else c.assignments[p.job]=p.officerId;}
    const {assigned,cities:changed}=q;
    const message=assigned?'已在 '+changed.length+' 座城补齐 '+assigned+' 项委任，保留原有分工。':'现有分工已保留，暂无可补的空缺。';if(assigned)addLog(s,message);return {ok:true,message,assigned,cities:changed};
  }
  function trainTroops(s,id,trainerId) {
    const ready=prepareAction(s,id,'train',{officerId:trainerId});if(!ready.ok)return ready;
    const c=getCity(s,id);
    const g=ready.general,gain=Math.min(100-c.training,12+Math.floor(g.force/20));c.training+=gain;c.morale=Math.min(100,c.morale+4);g.xp+=2;
    const message=g.name+'操练'+c.name+'驻军，训练度 +'+gain+'。';addLog(s,message);return {ok:true,message,kind:'train',gain,officerId:g.id};
  }
  const COMMON_LIMIT=256,COMMON_FACTION_LIMIT=8;
  const commonId=id=>typeof id==='string'&&/^common_(military|civil)_(00[1-9]|0[1-9]\d|1[01]\d|12[0-8])$/.test(id);
  const isTalentIgnored=(s,id,f)=>!!s.recruitment?.ignored?.some(x=>x.owner===f&&x.generalId===id);
  function commonRecruitmentStatus(s,f=s.player){
    const joined=new Set([...(s.recruitment?.commonJoined?.[f]||[]),...s.generals.filter(g=>g.commonKind&&g.faction===f).map(g=>g.id)]);
    const created=s.recruitment?.commonCreated?.[f]||0;
    return {joined:joined.size,created,limit:COMMON_FACTION_LIMIT,remaining:Math.max(0,COMMON_FACTION_LIMIT-joined.size)};
  }
  function rememberCommon(s,g,f){if(!g.commonKind)return;activateRecruitment(s);const ids=s.recruitment.commonJoined[f]||[];s.recruitment.commonJoined[f]=[...new Set([...ids,g.id])];}
  function preferredFaction(g){return DATA.recruitPreferences[g.id]||null;}
  function recruitmentAffinity(s,g,faction){const preferred=preferredFaction(g);return !preferred||isFactionEliminated(s,preferred)?'open':preferred===faction?'home':'other';}
  function talentAwaitingInvitation(s,g){
    const host=getCity(s,g.cityId)?.owner;
    // A discovered visitor stays in their host city until hired, dismissed, or
    // the city changes hands. Another search must never teleport that visitor.
    return factionIds.includes(host)&&g.revealedTo.includes(host)&&!isTalentIgnored(s,g.id,host);
  }
  function searchPool(s,faction){return s.generals.filter(g=>g.status==='free'&&!g.revealedTo.includes(faction)&&!talentAwaitingInvitation(s,g)&&!isTalentIgnored(s,g.id,faction)&&!(g.releasedBy===faction&&g.hireBlockedUntil>s.totalDays)&&(!g.commonKind||commonRecruitmentStatus(s,faction).remaining>0)&&(recruitmentAffinity(s,g,faction)!=='other'||s.totalDays>=730));}
  function canGenerateCommon(s,faction){const q=commonRecruitmentStatus(s,faction);return q.remaining>0&&q.created<COMMON_FACTION_LIMIT&&s.generals.filter(g=>commonId(g.id)).length<COMMON_LIMIT;}
  function canSearchTalent(s,faction){return searchPool(s,faction).length>0||canGenerateCommon(s,faction);}
  function ignoreTalent(s,gid,restore=false){
    const error=liveError(s),g=getGeneral(s,gid);if(error)return fail(error);
    if(!g||g.status!=='free'||!g.revealedTo.includes(s.player))return fail('只能忽略已发现的在野人才。');
    activateRecruitment(s);s.recruitment.ignored=s.recruitment.ignored.filter(x=>!(x.owner===s.player&&x.generalId===gid));
    if(!restore)s.recruitment.ignored.push({owner:s.player,generalId:gid});
    return {ok:true,message:g.name+(restore?'已重新列入可邀请名单。':'已忽略，可在人才的已忽略名单恢复。')};
  }
  function discoverTalent(s,c,faction){
    activateRecruitment(s);
    const pool=searchPool(s,faction),named=pool.filter(g=>!g.commonKind),home=named.filter(g=>recruitmentAffinity(s,g,faction)==='home'),commons=pool.filter(g=>g.commonKind),canCommon=commons.length||canGenerateCommon(s,faction);
    const streak=s.recruitment.commonStreak[faction]||0,firstHome=home.length&&!s.recruitment.homeFound[faction];let choice;
    if(named.length&&(firstHome||!canCommon||streak>=2||random(s)<(home.length?.6:.4))){
      const other=named.filter(g=>!home.includes(g)),candidates=home.length&&(firstHome||!other.length||random(s)<.95)?home:other.length?other:home;
      choice=candidates[Math.floor(random(s)*candidates.length)];s.recruitment.commonStreak[faction]=0;
      if(recruitmentAffinity(s,choice,faction)==='home')s.recruitment.homeFound[faction]=true;
    }else if(canCommon){
      if(commons.length)choice=commons[Math.floor(random(s)*commons.length)];
      else{
        let kind=random(s)<.5?'military':'civil';const next=k=>Array.from({length:128},(_,i)=>'common_'+k+'_'+String(i+1).padStart(3,'0')).find(id=>!getGeneral(s,id));let id=next(kind);if(!id){kind=kind==='military'?'civil':'military';id=next(kind);}
        const template=DATA.commonTemplates[kind];choice=freshGeneral({id,...template,name:template.name+'·'+Number(id.slice(-3)),commonKind:kind,faction:'neutral',cityId:c.id,rarity:'common',status:'free',loyalty:0,revealedTo:[],availableYear:194});s.generals.push(choice);s.recruitment.commonCreated[faction]=(s.recruitment.commonCreated[faction]||0)+1;
      }
      s.recruitment.commonStreak[faction]=Math.min(3,streak+1);
    }
    if(choice){choice.cityId=c.id;if(!choice.revealedTo.includes(faction))choice.revealedTo.push(faction);}
    return choice||null;
  }
  function progressSearch(s,c,amount,faction) {
    if(!canSearchTalent(s,faction))return {found:false,general:null,progress:c.searchProgress};
    c.searchProgress+=amount;
    if(c.searchProgress<80)return {found:false,general:null,progress:c.searchProgress};
    const choice=discoverTalent(s,c,faction);c.searchProgress-=80;
    return {found:true,general:clone(choice),progress:c.searchProgress};
  }
  function activateRecruitment(s) {if(!s.recruitment)s.recruitment={version:1,missions:[],attempts:[],results:[]};if(!s.recruitment.commonStreak)s.recruitment.commonStreak={};for(const key of ['commonJoined','commonCreated','homeFound'])s.recruitment[key]??={};s.recruitment.ignored??=[];}
  function searchChance(s,officerId) {const g=getGeneral(s,officerId);return g?Math.round(clamp(25+g.politics*.7,35,90)):0;}
  function talentResult(s,result) {activateRecruitment(s);const entry={id:identifier(s,'talent'),day:s.totalDays,...result};s.recruitment.results.unshift(entry);s.recruitment.results=s.recruitment.results.slice(0,60);addLog(s,entry.message);return entry;}
  function searchTalent(s,id,officerId) {
    const ready=prepareAction(s,id,'search',{officerId});if(!ready.ok)return ready;
    const c=getCity(s,id);
    activateRecruitment(s);const days=8+Math.floor(random(s)*8),mission={id:identifier(s,'search'),owner:s.player,cityId:c.id,officerId:ready.general.id,startedDay:s.totalDays,finishDay:s.totalDays+days,chance:searchChance(s,ready.general.id)};s.recruitment.missions.push(mission);
    const message=ready.general.name+'在'+c.name+'寻访人才，预计 '+days+' 日，发现概率 '+mission.chance+'%；已付 1 令、20 金、20 粮。';addLog(s,message);return {ok:true,message,pending:true,mission:clone(mission),officerId:ready.general.id};
  }
  function processRecruitment(s) {
    const results=[];if(!s.recruitment)return results;
    for(const m of s.recruitment.missions.slice()){
      const c=getCity(s,m.cityId),envoy=getGeneral(s,m.officerId),cancelled=c.owner!==m.owner||envoy.status!=='serving'||envoy.cityId!==m.cityId||envoy.faction!==m.owner;
      if(!cancelled&&m.finishDay>s.totalDays)continue;
      s.recruitment.missions=s.recruitment.missions.filter(x=>x.id!==m.id);
      let found=null;
      if(!cancelled&&canSearchTalent(s,m.owner)&&random(s)*100<m.chance){found=discoverTalent(s,c,m.owner);envoy.xp++;}
      const message=cancelled?c.name+'寻访中止：使者离任或城池易主，已用路费不退。':found?envoy.name+'在'+c.name+'寻获'+found.name+'，可派使者邀请入仕。':envoy.name+'在'+c.name+'此次寻访未获人才，下季可再访。';
      results.push(talentResult(s,{owner:m.owner,cityId:c.id,officerId:envoy.id,kind:'search',outcome:cancelled?'cancelled':found?'found':'missed',generalId:found?.id||null,message}));
    }return results;
  }
  function processProjects(s) {
    const results=[];
    for(const c of s.cities){
      const p=c.project;if(!p)continue;const g=getGeneral(s,p.officerId);
      if(c.owner!==p.owner||!g||g.status!=='serving'||g.cityId!==c.id||g.faction!==p.owner){const r=abortProject(s,c,'负责将领离任或城池易主');results.push({cityId:c.id,kind:p.kind,cancelled:true,message:r.message});continue;}
      p.remainingDays=Math.max(0,p.finishDay-s.totalDays);if(p.remainingDays)continue;c.project=null;
      const result={cityId:c.id,kind:p.kind,officerId:g.id,owner:p.owner,projectId:p.id};
      if(p.kind==='develop'){c[p.target]=Math.min(3,c[p.target]+1);result.message=c.name+'的'+({farm:'农田',market:'市集',wall:'城防'})[p.target]+'建设完成，提升至 '+c[p.target]+' 级。';}
      if(p.kind==='recruit'){
        const amount=Math.max(0,Math.min(p.amount,getTroopCapacity(s,c)-c.troops-reservedTroops(s,c.id))),u=emptyUnits();u[p.type]=amount;mergeArmy(c,u,5,70);result.amount=amount;
        if(amount<p.amount){const f=getFaction(s,p.owner),ratio=(p.amount-amount)/p.amount;f.gold+=Math.floor(p.cost.gold*ratio);f.grain+=Math.floor(p.cost.grain*ratio);}
        result.message=c.name+'募兵项目完成，'+amount+' 名新兵入营。';
      }
      if(p.kind==='train'){result.gain=Math.min(100-c.training,12+Math.floor(g.force/20));c.training+=result.gain;c.morale=Math.min(100,c.morale+4);g.xp+=2;result.message=g.name+'完成'+c.name+'的训练项目，训练度 +'+result.gain+'。';}
      if(p.kind==='search'){const found=progressSearch(s,c,40+Math.floor(g.intellect/2),p.owner);Object.assign(result,found);g.xp++;result.message=found.found?'在'+c.name+'访得'+found.general.name+'，可前往礼聘。':c.name+'寻访项目完成，访贤进度 '+found.progress+'/80。';}
      addLog(s,result.message);results.push(result);
    }
    return results;
  }
  function hireOffer(s,id,gid,envoyId,gift='normal') {
    const c=getCity(s,id),error=liveError(s)||cityError(s,c,true);if(error)return fail(error);
    if(!hasOfficerSlot(s,c.id))return fail('本城文武名额已满，含在途预留席位。');
    const g=availableTalents(s,id).find(g=>g.id===gid);if(!g)return fail('这名人才未在本城被发现，或已经出仕。');
    if(g.commonKind&&!commonRecruitmentStatus(s).remaining)return fail('本势力累计招入普通文武已满8人，仍可招募具名人才。');
    if(!['normal','generous'].includes(gift))return fail('未知礼聘档位。');
    const envoy=officer(s,c,envoyId,'charisma');if(envoyId&&!envoy)return fail('使者须在本城任职，且没有执行寻访。');
    if(!envoy&&cityGenerals(s,c.id).length)return fail('本城文武正在寻访，请待其返回再邀请。');
    const attempt=s.recruitment?.attempts.find(a=>a.owner===s.player&&a.generalId===gid);if(attempt&&calendarInfo(attempt.day).period===period(s))return fail('本季已经邀请此人，下季可再试。');
    const f=getFaction(s,s.player),cost=costs(s,id,'hire',gid,{envoyId});if(gift==='generous')cost.gold*=2;if(!canPay(f,cost))return fail('礼聘需要 '+cost.gold+' 金。');
    const affinity=recruitmentAffinity(s,g,s.player),bonus=g.commonKind?5:affinity==='home'?25:affinity==='other'?-35:0;
    const chance=Math.round(clamp(30+(envoy?.charisma??40)*.6-({legend:15,renowned:5,common:0})[g.rarity]+bonus+(gift==='generous'?12:0),10,95));
    return {ok:true,chance,cost,affinity,envoyId:envoy?.id||null,envoyName:envoy?.name||'军府代办'};
  }
  function hireTalent(s,id,gid,envoyId,gift='normal') {
    const q=hireOffer(s,id,gid,envoyId,gift);if(!q.ok)return q;activateRecruitment(s);
    const c=getCity(s,id),g=getGeneral(s,gid),envoy=getGeneral(s,q.envoyId),f=getFaction(s,s.player),success=random(s)*100<q.chance;
    s.recruitment.attempts=s.recruitment.attempts.filter(a=>!(a.owner===s.player&&a.generalId===gid));s.recruitment.attempts.push({owner:s.player,generalId:gid,day:s.totalDays});
    if(success){rememberCommon(s,g,s.player);pay(s,f,q.cost,c);Object.assign(g,{faction:s.player,status:'serving',loyalty:Math.min(95,75+Math.floor((envoy?.charisma||0)/5)),captor:null,capturedTurn:null,serviceStartDay:g.serviceStartDay??s.totalDays});normalizeCity(s,c);}
    const message=q.envoyName+'邀请'+g.name+'（成功率 '+q.chance+'%），'+(success?'对方接受，驻守'+c.name+'；已付 '+q.cost.gold+' 金。':'对方婉拒，礼金未交付，下季可再试。');
    talentResult(s,{owner:s.player,cityId:id,officerId:q.envoyId,kind:'hire',outcome:success?'joined':'declined',generalId:gid,message});
    return {ok:true,success,message,chance:q.chance,general:clone(g),leadershipEvents:syncLeadership(s)};
  }

  function captureChance(s,gid) {const g=typeof gid==='string'?getGeneral(s,gid):gid;if(!g)return 0;const rates=getFaction(s,g.faction)?.leaderId===g.id?[.03,.08,.15,.25]:[.3,.7,1];return rates[Math.min(rates.length-1,Math.max(0,(g.personalLosses||0)-1))];}
  function isFactionEliminated(s,id) {return factionIds.includes(id)&&!ownedCities(s,id).length&&!s.armies.some(a=>a.faction===id);}
  function persuasionEnvoys(s) {
    return s.generals.filter(g=>g.faction===s.player&&g.status==='serving'&&g.armyId===null&&getCity(s,g.cityId)?.owner===s.player&&!busySearching(s,g.id)&&!s.cities.some(c=>c.project?.officerId===g.id)).sort((a,b)=>b.charisma-a.charisma||a.id.localeCompare(b.id));
  }
  function persuasionOffer(s,gid,envoyId){
    const g=getGeneral(s,gid),envoys=persuasionEnvoys(s),envoy=envoyId===undefined?envoys[0]:envoys.find(x=>x.id===envoyId);
    if(g?.status!=='prisoner'||g.captor!==s.player||!envoy)return {chance:0,reason:'需要在押人物和可用使者'};
    if(g.commonKind&&!commonRecruitmentStatus(s).remaining)return {chance:0,reason:'本势力普通文武招入名额已满8人'};
    if(isFactionEliminated(s,g.faction))return {chance:1,reason:'故主已灭亡 · 委派后必定归顺'};
    const ours=factionStrength(s,s.player).score,theirs=factionStrength(s,g.faction).score,ratio=ours/Math.max(1,theirs),strength=Math.round(clamp(Math.log2(Math.max(.125,ratio))*10,-20,20)),loyalty=Math.round((g.loyalty??80)*.28),ruler=getFaction(s,g.faction)?.leaderId===gid?18:0,patience=Math.min(9,(g.persuadeAttempts||0)*3),charisma=envoy.charisma*.48;
    const chance=Math.round(clamp(8+charisma+strength+patience-loyalty-ruler,5,ruler?35:70))/100;
    return {chance,ratio,strength,loyalty,ruler,patience,reason:'魅力 '+Math.round(charisma)+' · 实力差 '+(strength>=0?'+':'')+strength+' · 忠诚 −'+loyalty+(ruler?' · 君主 −18':'')+(patience?' · 劝说 +'+patience:'')};
  }
  function persuasionChance(s,gid,envoyId){return persuasionOffer(s,gid,envoyId).chance;}
  function prisonerError(s,g,decision=true) {
    if(!g||g.status!=='prisoner'||g.captor!==s.player)return '此人不在我方俘虏名册中。';
    if(decision&&g.lastPrisonerDecisionPeriod===period(s))return '本季已对此俘虏作出决定，下季可再次处理。';
    return null;
  }
  function persuadePrisoner(s,gid,envoyId) {
    const g=getGeneral(s,gid),error=liveError(s)||prisonerError(s,g);if(error)return fail(error);
    const envoy=persuasionEnvoys(s).find(o=>o.id===envoyId);if(!envoy)return fail('请选择驻扎我方城池、且未执行旧项目的在职文武担任使者。');
    if(!hasOfficerSlot(s,g.cityId))return fail('关押地文武名额已满，请先调将腾出席位。');
    const quote=persuasionOffer(s,gid,envoy.id);if(!quote.chance)return fail(quote.reason);const chance=quote.chance;g.persuadeAttempts++;g.lastPrisonerDecisionPeriod=period(s);
    const success=random(s)<chance;
    if(success){rememberCommon(s,g,s.player);Object.assign(g,{faction:s.player,status:'serving',captor:null,capturedTurn:null,capturedDay:null,loyalty:65,serviceStartDay:g.serviceStartDay??s.totalDays});normalizeCity(s,getCity(s,g.cityId));}
    const message=envoy.name+'出使劝说'+g.name+'（成功率 '+Math.round(chance*1000)/10+'%），'+(success?'对方接受归顺，加入本城将领名册。':'对方拒绝归顺，下季可再次劝降。');addLog(s,message);return {ok:true,message,success,chance,general:clone(g),envoyId:envoy.id,envoyName:envoy.name,leadershipEvents:syncLeadership(s)};
  }
  function releasePrisoner(s,gid) {
    const g=getGeneral(s,gid),error=liveError(s)||prisonerError(s,g);if(error)return fail(error);
    const from=g.cityId,faction=g.faction,route=returnRoute(s,from,faction);changeRelationship(s,s.player,faction,10,'释放文武 +10');
    Object.assign(g,{captor:null,capturedTurn:null,capturedDay:null,armyId:null,lastPrisonerDecisionPeriod:period(s),releasedBy:s.player,hireBlockedUntil:s.totalDays+30,revealedTo:[]});
    let army=null;
    if(route&&route.length>1){army=createArmy(s,from,route[1],faction,'retreat',emptyUnits(),[g],50,70);army.returnRoute=route.slice(1);army.reservationCityId=route[route.length-1];army.releaseReturn=true;}
    else freeOfficer(g,from);
    const message='已释放'+g.name+(army?'，其沿道路返回原势力，途中不能再次礼聘。':'，原势力已无归处，其成为在野人才；我方 30 日内不能礼聘。');addLog(s,message);return {ok:true,message,army:army?clone(army):null,leadershipEvents:syncLeadership(s)};
  }
  function returnRoute(s,from,faction,excludeArmy) {
    const homes=ownedCities(s,faction),destinations=homes.length?homes.map(c=>c.id):s.armies.filter(a=>a.id!==excludeArmy&&a.faction===faction&&!a.releaseReturn).map(destination);
    if(!destinations.length)return null;
    const queue=[[from]],seen=new Set([from]);while(queue.length){const route=queue.shift(),last=route[route.length-1];if(destinations.includes(last))return route;
      for(const c of neighbors(s,last))if(!seen.has(c.id)){seen.add(c.id);queue.push(route.concat(c.id));}}
    return null;
  }
  function executePrisoner(s,gid) {
    const g=getGeneral(s,gid),error=liveError(s)||prisonerError(s,g);if(error)return fail(error);
    changeRelationship(s,s.player,g.faction,-35,'处决文武 −35 · 敌意加深');Object.assign(g,{status:'dead',captor:null,cityId:null,armyId:null,deathDay:s.totalDays,deathReason:'由'+getFaction(s,s.player).name+'处决',lastPrisonerDecisionPeriod:period(s)});
    const message=g.name+'已被处决，无法再出仕或领兵。';addLog(s,message);return {ok:true,message,general:clone(g),leadershipEvents:syncLeadership(s)};
  }
  function validateSelection(s,from,amount,options) {
    const units=options.units===undefined?portion(from.units,amount):options.units;
    if(!validUnits(units)||unitCount(units)!==amount||TYPES.some(k=>units[k]>from.units[k]))return {error:'所选兵种数量与出兵人数不符，或超过驻军。'};
    let gs=selectedGenerals(s,from,options.generalIds);if(!gs)return {error:'每支军队最多 5 名本城在职将领，不能重复选择。'};
    if(options.generalIds===undefined)gs=gs.filter(g=>!busySearching(s,g.id)).slice(0,armyCommand(s,gs.filter(g=>!busySearching(s,g.id)).map(g=>g.id)).limit);
    const searching=gs.filter(g=>busySearching(s,g.id));
    if(searching.length)return {error:searching.map(g=>g.name).join('、')+'正在寻访，返回后才能调动或出征。'};
    return {units:clone(units),generals:gs};
  }
  function travelTime(s,fromId,toId) {
    const from=getCity(s,fromId),to=getCity(s,toId);if(!from||!to)return 0;
    const base=clamp(Math.ceil(Math.hypot(from.x-to.x,from.y-to.y)/12)+(to.terrain==='mountain'?6:to.terrain==='river'?4:0),12,36);
    const season=calendarInfo(s).season.id,mountain=from.terrain==='mountain'||to.terrain==='mountain',river=!mountain&&(from.terrain==='river'||to.terrain==='river');
    return Math.ceil(base*(season==='summer'&&river?1.10:season==='winter'&&mountain?1.15:1));
  }
  function createArmy(s,fromId,toId,faction,kind,units,gs,training,morale,tactic='steady',days) {
    const a={id:identifier(s,'army'),faction,kind,fromId,toId,destinationId:toId,units:clone(units),troops:unitCount(units),generalIds:gs.map(g=>typeof g==='string'?g:g.id),tactic,training,morale,
      elapsedDays:0,travelDays:days||travelTime(s,fromId,toId),progress:0,departDay:s.totalDays,departureSeason:calendarInfo(s).season.id,status:'marching',routeStartProgress:0,routeEndProgress:1};
    s.armies.push(a);a.generalIds.forEach(id=>{const g=getGeneral(s,id);Object.assign(g,{status:'marching',cityId:null,armyId:a.id,captor:null});});
    return a;
  }
  // Read-only preflight shared by the form and the actual dispatch.
  function dispatchOffer(s,fromId,toId,amount,options={},kind='attack') {
    if(!record(options))return fail('行军配置无效。');
    if(!['attack','reinforce'].includes(kind))return fail('未知的行军任务。');
    const from=getCity(s,fromId),to=getCity(s,toId),error=liveError(s)||cityError(s,from);if(error)return fail(error);
    if(kind==='attack'&&to&&areAllied(s,s.player,to.owner))return fail('盟约期间不能进攻盟友，可借道进攻其他势力。');
    const plan=marchPlan(s,fromId,toId,amount,kind);
    if(!plan)return fail('没有可用路线；沿途须为我方或盟友领地，调兵只能以我方城池为终点。');
    if(!integer(amount,kind==='attack'?100:0,RULES.maxCommandTroops)||from.troops-amount<100)return fail('兵力无效，出征至少 100 人，出发城必须留守 100 人。');
    const selection=validateSelection(s,from,amount,{...options,generalIds:options.generalIds===undefined&&kind!=='attack'?[]:options.generalIds});if(selection.error)return fail(selection.error);
    if(!amount&&!selection.generals.length)return fail('请选择部队或调动将领。');
    if(kind==='attack'&&!selection.generals.length)return fail('请指定一名主将带队。');
    const command=armyCommand(s,selection.generals.map(g=>g.id));
    if((kind==='attack'||amount>0)&&selection.generals.length>command.limit)return fail('主将官阶 '+command.rank+' 阶，可编 '+command.limit+' 人；请更换主将或减少副将。');
    if(!['steady','assault','flank'].includes(options.tactic||'steady'))return fail('未知的作战方针。');
    if(amount>commandCapacity(s,selection.generals.map(g=>g.id)))return fail('所选将领统率不足，请减少兵力或增派将领。');
    const arriving=s.armies.filter(a=>a.faction===s.player&&reservedDestination(a)===toId).reduce((n,a)=>n+a.generalIds.length,0);
    const local=to.owner===s.player?cityGenerals(s,toId).length:0;
    if(local+arriving+selection.generals.length>getOfficerCapacity(s,to))return fail('目标城文武名额不足，含在途预留 '+local+'+'+arriving+'/'+getOfficerCapacity(s,to)+' 席。');
    if(kind!=='attack'&&amount&&to.troops+reservedTroops(s,toId)+amount>getTroopCapacity(s,to))return fail('计入在途援军及募兵工程容量不足：目标最多容纳 '+getTroopCapacity(s,to)+' 人。');
    const f=getFaction(s,s.player),cost=plan.cost;if(!canPay(f,cost))return fail('军粮不足，行军需要 '+cost.grain+' 粮。');
    return {ok:true,from,to,selection,plan,cost};
  }
  function dispatch(s,fromId,toId,amount,options,kind) {
    const offer=dispatchOffer(s,fromId,toId,amount,options,kind);if(!offer.ok)return offer;
    const {from,to,selection,plan,cost}=offer,f=getFaction(s,s.player);
    pay(s,f,cost);subtractUnits(from,selection.units);
    if(kind==='attack')changeRelationship(s,s.player,to.owner,-20,'出兵进攻 −20');
    const army=createArmy(s,fromId,plan.route[1],s.player,kind,selection.units,selection.generals,from.training,from.morale,options.tactic||'steady');
    Object.assign(army,{originId:fromId,destinationId:toId,reservationCityId:toId,marchRoute:plan.route,routeIndex:0});normalizeCity(s,from);
    const message=from.name+'派出 '+amount+' 兵、'+selection.generals.length+' 将前往'+to.name+'，预计 '+plan.travelDays+' 日抵达。'+(plan.borrowed.length?'借道：'+plan.borrowed.map(id=>getCity(s,id).name).join('、')+'。':'');addLog(s,message);return {ok:true,message,army:clone(army),amount};
  }
  function dispatchArmy(s,from,to,amount,options={}) {return dispatch(s,from,to,amount,options,'attack');}
  function dispatchTransfer(s,from,to,amount,options={}) {return dispatch(s,from,to,amount,options,'reinforce');}
  function transfer(s,from,to,amount,options={}) {return dispatchTransfer(s,from,to,amount,options);}
  function moveGenerals(s,from,to,ids) {return dispatchTransfer(s,from,to,0,{generalIds:ids});}
  function prepareBattle(s,from,to,amount,options={}) {return dispatchArmy(s,from,to,amount,options);}
  function pendingBattleInfo(s){
    const pending=s.pendingBattle;if(!pending)return null;
    const a=s.armies.find(x=>x.id===pending.armyId),to=a&&getCity(s,a.toId);if(!a||!to)return null;
    const source={...getCity(s,a.fromId),owner:a.faction,training:a.training,morale:a.morale};
    const b=snapshotBattle(s,source,to,a.units,a.generalIds.map(id=>getGeneral(s,id)));
    return {...b,seed:pending.seed,id:pending.id,armyId:a.id,tactic:a.tactic,wave:(a.siegeWins||0)+1,phase:pending.phase||'formation'};
  }
  function resolveBattle(s,options={}){
    if(s?.pendingBattle?.phase==='siege')return fail('本队已获胜，请选择继续攻城或撤回。');
    const b=s&&pendingBattleInfo(s);if(!b)return fail('当前没有等待布阵的战斗。');
    const side=b.attackerFaction===s.player?'attacker':'defender',original=b[side+'Generals'].map(g=>g.id),ids=options.generalIds||original;
    if(!Array.isArray(ids)||ids.length!==original.length||new Set(ids).size!==ids.length||!ids.every(id=>original.includes(id)))return fail('只能调整本次出战将领的阵位，不能增减或重复将领。');
    const tactic=options.tactic||'steady';if(!['steady','assault','flank'].includes(tactic))return fail('未知的作战方针。');
    b[side+'Generals']=ids.map(id=>b[side+'Generals'].find(g=>g.id===id));b[side+'General']=b[side+'Generals'][0]||null;
    if(side==='defender')b.defenderTactic=tactic;else b.tactic=tactic;
    const a=s.armies.find(x=>x.id===b.armyId),to=getCity(s,b.toId);s.pendingBattle=null;
    const entry=arriveBattle(s,a,to,b,true);return {ok:true,message:entry.result.message,entry};
  }
  function chooseSiege(s,choice){
    const pending=s?.pendingBattle,a=pending&&s.armies.find(a=>a.id===pending.armyId);
    if(pending?.phase!=='siege'||!a||a.faction!==s.player)return fail('当前没有待决定的攻城部队。');
    if(!['continue','withdraw'].includes(choice))return fail('请选择继续攻城或撤回。');
    if(choice==='withdraw'){s.pendingBattle=null;withdrawExpedition(s,a,'停止攻城');return {ok:true,message:'部队携剩余兵力撤回，城池仍属敌方。'};}
    delete pending.phase;return {ok:true,message:'接战下一队守军。'};
  }
  function recallArmy(s,id) {
    const error=liveError(s);if(error)return fail(error);const a=s.armies.find(a=>a.id===id&&a.faction===s.player);
    if(!a)return fail('没有找到我方在途军队。');if(a.kind==='retreat')return fail('这支军队已在返回途中。');
    const home=getCity(s,a.originId||a.fromId);if(home.owner!==s.player)return fail('出发地已失守，无法召回。');
    if(!hasOfficerSlot(s,home.id,a.generalIds.length)||a.troops&&home.troops+reservedTroops(s,home.id)+a.troops>getTroopCapacity(s,home))return fail('出发地无法容纳返回部队，请先调兵腾出位置。');
    withdrawExpedition(s,a,'已传令召回');
    const message='已召回部队，仍需约 '+armyEta(s,a)+' 日返回'+home.name+'。';return {ok:true,message,army:clone(a)};
  }
  function snapshotBattle(s,from,to,units,gs) {
    const snapshot=g=>({...clone(g),wasRuler:getFaction(s,g.faction)?.leaderId===g.id});
    const teams=cityDefenseTeams(s,to),front=teams.find(t=>unitCount(t.units)>0)||teams[0],ags=gs.map(snapshot),dgs=front.generalIds.map(id=>snapshot(getGeneral(s,id))),defenders=unitCount(front.units);
    return {id:'preview',fromId:from.id,toId:to.id,attackerFaction:from.owner,defenderFaction:to.owner,attackerFactionName:getFaction(s,from.owner)?.name||'地方守军',defenderFactionName:getFaction(s,to.owner)?.name||'地方守军',
      attackers:unitCount(units),defenders,attackerUnits:clone(units),defenderUnits:clone(front.units),cityDefenders:to.troops,defenseReserveTroops:to.troops-defenders,defenseTeamsRemaining:teams.filter(t=>unitCount(t.units)>0).length,
      attackerGenerals:ags,defenderGenerals:dgs,attackerGeneral:ags[0]||null,defenderGeneral:dgs[0]||null,
      defenderOfficerIds:front.generalIds.slice(),attackerTraining:from.training,defenderTraining:to.training,
      attackerMorale:from.morale,defenderMorale:to.morale,terrain:to.terrain,wall:to.wall,seed:s.rng,defenderTactic:'steady'};
  }
  function powers(b,tactic='steady') {return combat.powers(b,tactic);}
  function estimateBattle(s,fromId,toId,amount,options={}) {
    if(!record(options))return {chance:0,ratio:0};
    const from=getCity(s,fromId),to=getCity(s,toId);
    if(!from||!to||!integer(amount,1,from.troops))return {chance:0,ratio:0};
    const selection=validateSelection(s,from,amount,options);if(selection.error)return {chance:0,ratio:0};
    const b=snapshotBattle(s,from,to,selection.units,selection.generals),p=powers(b,options.tactic||'steady'),ratio=p.attack/Math.max(1,p.defense);
    const factors=to.troops?[
      {id:'troops',ratio:b.attackers/b.defenders},
      {id:'command',ratio:p.attackCommand/p.defenseCommand},
      {id:'counter',ratio:p.attackerCounter/p.defenderCounter},
      {id:'condition',ratio:p.attackTraining*p.attackMorale/(p.defenseTraining*p.defenseMorale)},
      {id:'position',ratio:p.attackTerrain/(p.defenseTerrain*p.defenseWall)},
      {id:'tactic',ratio:p.strategy/p.defenseAbility}
    ]:[];
    return {chance:clamp(1/(1+Math.exp(-6*(ratio-1))),.02,.98),ratio,capacity:commandCapacity(s,selection.generals.map(g=>g.id)),modifiers:p,factors};
  }
  function calculateBattle(b,tactic) {
    const simulation=combat.simulate(b,tactic),won=simulation.winner==='attacker';
    const attackerLosses=b.attackers-simulation.attackersRemaining,defenderLosses=b.defenders-simulation.defendersRemaining;
    return {ok:true,winner:simulation.winner,captured:won,unopposed:b.defenders===0,attackerLosses,defenderLosses,
      attackersRemaining:simulation.attackersRemaining,defendersRemaining:simulation.defendersRemaining,
      attackerSurvivors:portion(b.attackerUnits,simulation.attackersRemaining),defenderSurvivors:portion(b.defenderUnits,simulation.defendersRemaining),
      tactic,fromId:b.fromId,toId:b.toId,capturedGeneral:null,capturedGenerals:[],escapedGenerals:[],modifiers:powers(b,tactic),simulation};
  }

  function freeOfficer(g,cityId) {Object.assign(g,{status:'free',faction:'neutral',cityId,armyId:null,captor:null,capturedTurn:null,capturedDay:null,revealedTo:[]});}
  function captureGeneral(s,g,captor,city,result) {
    Object.assign(g,{status:'prisoner',captor,cityId:city.id,armyId:null,capturedTurn:s.turn,capturedDay:s.totalDays,persuadeAttempts:0,lastPrisonerDecisionPeriod:null});
    (result.capturedGenerals??=[]).push({id:g.id,name:g.name,faction:g.faction,captor,personalLosses:g.personalLosses});
    if(result.escapedGenerals)result.escapedGenerals=result.escapedGenerals.filter(name=>name!==g.name);
  }
  function loseOfficers(s,gs,captor,city,result,r,defending=true) {
    // Unaffiliated garrisons can repel an army, but have no faction prison.
    const escaped=[];gs.forEach(g=>{if(defending)g.personalLosses++;g.xp+=3;if(defending&&random(r)<captureChance(s,g)&&factionIds.includes(captor))captureGeneral(s,g,captor,city,result);else{escaped.push(g);result.escapedGenerals.push(g.name);}});return escaped;
  }
  function routeRetreat(s,from,faction,units,gs,training,morale,result,preferredId) {
    if(!unitCount(units)&&!gs.length)return;
    const choices=neighbors(s,from.id).filter(c=>c.owner===faction).sort((a,b)=>(a.id===preferredId?-1:0)-(b.id===preferredId?-1:0)||cityGenerals(s,a.id).length-cityGenerals(s,b.id).length);
    const home=choices[0];
    if(!home){
      // Officers keep their allegiance while seeking a distant surviving army
      // or city. If there is no refuge at all, the victor takes them prisoner.
      const route=returnRoute(s,from.id,faction);
      if(route&&route.length>1){for(let i=0;i<gs.length;i+=5){const a=createArmy(s,from.id,route[1],faction,'retreat',emptyUnits(),gs.slice(i,i+5),training,morale);a.returnRoute=route.slice(1);a.reservationCityId=route[route.length-1];a.releaseReturn=true;}}
      else if(route&&route.length===1&&gs.length){for(let i=0;i<gs.length;i+=5){const a=createArmy(s,from.id,from.id,faction,'retreat',emptyUnits(),gs.slice(i,i+5),training,morale,'steady',1);a.releaseReturn=true;}}
      else if(factionIds.includes(from.owner)&&from.owner!==faction)gs.forEach(g=>captureGeneral(s,g,from.owner,from,result));
      else gs.forEach(g=>freeOfficer(g,from.id));
      result.dispersedTroops=(result.dispersedTroops||0)+unitCount(units);return;
    }
    const batches=[];for(let i=0;i<gs.length;i+=5)batches.push(gs.slice(i,i+5));if(!batches.length)batches.push([]);
    let left=clone(units);batches.forEach((batch,i)=>{const u=i===batches.length-1?clone(left):portion(left,Math.floor(unitCount(left)/(batches.length-i)));TYPES.forEach(k=>left[k]-=u[k]);createArmy(s,from.id,home.id,faction,'retreat',u,batch,training,Math.max(20,morale-12));});
    normalizeCity(s,from);
  }
  function checkStatus(s,byFaction=null,battleResult=null) {
    for(const f of s.factions)if(!ownedCities(s,f.id).length&&!s.armies.some(a=>a.faction===f.id)&&!s.eliminations.some(e=>e.faction===f.id)){
      const victor=byFaction||f.lastDefeatedBy||null,captured={capturedGenerals:[]};
      for(const g of s.generals.filter(g=>g.faction===f.id&&['serving','marching'].includes(g.status))){
        const local=getCity(s,g.cityId),prison=local?.owner===victor?local:ownedCities(s,victor)[0];
        if(prison&&victor!==f.id&&factionIds.includes(victor))captureGeneral(s,g,victor,prison,captured);
      }
      if(captured.capturedGenerals.length){s.cities.forEach(c=>normalizeCity(s,c));if(battleResult)(battleResult.capturedGenerals??=[]).push(...captured.capturedGenerals);}
      const e={id:identifier(s,'elimination'),faction:f.id,byFaction:victor,day:s.day,totalDays:s.totalDays,year:s.year,month:s.month,capturedNames:s.generals.filter(g=>g.faction===f.id&&g.status==='prisoner').map(g=>g.name),capturedGenerals:clone(captured.capturedGenerals)};
      s.eliminations.push(e);addLog(s,f.name+'势力覆灭。');
    }
    if(!ownedCities(s).length&&!s.armies.some(a=>a.faction===s.player)){s.status='lost';addLog(s,'我方据点与在途军队全部失去，征程结束。');}
    else if(ownedCities(s).length===s.cities.length&&!s.armies.some(a=>a.faction!==s.player)){s.status='won';addLog(s,'四十六城、八雄关尽归一统！');}
    syncLeadership(s);
  }
  function settleFriendly(s,a,c) {
    const room=Math.max(0,getTroopCapacity(s,c)-c.troops),accepted=portion(a.units,Math.min(room,a.troops));mergeArmy(c,accepted,a.training,a.morale);TYPES.forEach(k=>a.units[k]-=accepted[k]);a.troops=unitCount(a.units);
    const available=Math.max(0,getOfficerCapacity(s,c)-cityGenerals(s,c.id).length),admit=a.generalIds.splice(0,available);
    admit.forEach(id=>Object.assign(getGeneral(s,id),{status:'serving',cityId:c.id,armyId:null}));normalizeCity(s,c);
    if(a.troops||a.generalIds.length){a.waiting=true;a.progress=1;a.elapsedDays=a.travelDays;if(!a.waitingNotified){addLog(s,c.name+'容量已满，剩余部队驻营候入，可腾出位置或召回。');a.waitingNotified=true;}return false;}
    s.armies=s.armies.filter(other=>other.id!==a.id);movement(s,a.fromId,c.id,a.faction,a.kind,accepted,admit,'arrived');addLog(s,'部队抵达'+c.name+'，'+unitCount(accepted)+' 人入城。');return true;
  }
  function queueBattle(s,a,phase){random(s);s.pendingBattle={armyId:a.id,id:identifier(s,'battle'),seed:s.rng,day:s.totalDays};if(phase)s.pendingBattle.phase=phase;}
  function captureCityStores(s,c,victor){
    const defender=getFaction(s,c.owner),recipient=getFaction(s,victor);
    if(!defender||!recipient||defender.id===recipient.id)return null;
    // The shared treasury represents stores across owned cities. Transfer the
    // captured city's capacity-weighted share, never mint a repeatable reward.
    const totalCapacity=ownedCities(s,c.owner).reduce((n,city)=>n+getTroopCapacity(s,city),0),share=getTroopCapacity(s,c)/totalCapacity;
    const loot={gold:0,grain:0,fromFaction:c.owner};
    for(const resource of ['gold','grain']){
      loot[resource]=Math.min(Math.floor(defender[resource]*share),9999999-recipient[resource]);
      defender[resource]-=loot[resource];recipient[resource]+=loot[resource];
    }
    return loot;
  }
  function arriveBattle(s,a,to,prepared=null,interactive=false) {
    const from=getCity(s,a.fromId),snapshotSource={...from,owner:a.faction,training:a.training,morale:a.morale};
    const teams=cityDefenseTeams(s,to),frontIndex=Math.max(0,teams.findIndex(t=>unitCount(t.units)>0));
    const b=prepared||snapshotBattle(s,snapshotSource,to,a.units,a.generalIds.map(id=>getGeneral(s,id)));if(!prepared){random(s);b.seed=s.rng;b.id=identifier(s,'battle');b.armyId=a.id;b.tactic=a.tactic;}b.wave=(a.siegeWins||0)+1;
    const result=calculateBattle(b,b.tactic||a.tactic),r={rng:(b.seed^0x9e3779b9)>>>0};
    const attackers=a.generalIds.map(id=>getGeneral(s,id)),frontDefenders=b.defenderOfficerIds.map(id=>getGeneral(s,id)),oldCaptives=s.generals.filter(g=>g.status==='prisoner'&&g.cityId===to.id);
    const reserve=clone(to.units);TYPES.forEach(k=>reserve[k]-=b.defenderUnits[k]);
    if(result.captured&&unitCount(reserve)>0){
      // A won engagement removes only this team. Reserves retain their soldiers.
      result.captured=false;result.siegeContinues=true;
      const prison=ownedCities(s,a.faction).find(c=>c.id===(a.originId||a.fromId))||ownedCities(s,a.faction)[0];
      const escaped=loseOfficers(s,frontDefenders,prison?a.faction:null,prison||to,result,r);
      routeRetreat(s,to,b.defenderFaction,emptyUnits(),escaped,b.defenderTraining,b.defenderMorale,result);
      teams.splice(frontIndex,1);replaceUnits(to,reserve);to.defenseTeams=teams;
      a.units=clone(result.attackerSurvivors);a.troops=unitCount(a.units);a.training=Math.min(100,a.training+2);a.morale=Math.min(100,a.morale+5);a.siegeWins=(a.siegeWins||0)+1;
      attackers.forEach(g=>{g.personalLosses=0;g.xp+=8;});
      result.remainingDefenseTeams=teams.filter(t=>unitCount(t.units)>0).length;result.remainingCityTroops=to.troops;
      result.message='击败'+to.name+'第 '+b.wave+' 队守军，城内尚有 '+result.remainingDefenseTeams+' 队、'+to.troops+' 兵。';
      if(interactive&&a.faction===s.player)queueBattle(s,a,'siege');
      else{
        const next=snapshotBattle(s,{...snapshotSource,training:a.training,morale:a.morale},to,a.units,attackers),p=powers(next,a.tactic);
        if(p.attack>=p.defense*.85){if(interactive&&to.owner===s.player)queueBattle(s,a);}
        else{withdrawExpedition(s,a,'连战兵力不足，停止攻城');result.siegeContinues=false;result.message+='来敌停止进攻，携余部撤回。';}
      }
    }else if(result.captured){
      s.armies=s.armies.filter(other=>other.id!==a.id);
      const defenders=cityGenerals(s,to.id).slice();
      const escaped=loseOfficers(s,defenders,a.faction,to,result,r);
      result.loot=captureCityStores(s,to,a.faction);
      to.owner=a.faction;replaceUnits(to,result.attackerSurvivors);to.training=Math.min(100,a.training+2);to.morale=Math.min(100,a.morale+5);to.wall=Math.max(0,to.wall-1);to.occupiedUntil=s.totalDays+1;
      s.generals.filter(g=>g.status==='free'&&g.cityId===to.id&&g.revealedTo.length).forEach(g=>{if(!g.revealedTo.includes(a.faction))g.revealedTo.push(a.faction);});
      if(to.troops>getTroopCapacity(s,to)){
        const admitted=portion(to.units,getTroopCapacity(s,to)),overflow=clone(to.units);TYPES.forEach(k=>overflow[k]-=admitted[k]);replaceUnits(to,admitted);
        const waiting=createArmy(s,to.id,to.id,a.faction,'reinforce',overflow,[],a.training,a.morale,'steady',1);waiting.progress=1;waiting.elapsedDays=1;waiting.waiting=true;
      }
      to.generalId=null;to.governorId=null;JOBS.forEach(j=>to.assignments[j]=null);
      const defeatedFaction=getFaction(s,b.defenderFaction);if(defeatedFaction)defeatedFaction.lastDefeatedBy=a.faction;
      attackers.forEach(g=>{if(!result.unopposed){g.personalLosses=0;g.xp+=8;}Object.assign(g,{status:'serving',cityId:to.id,armyId:null});});
      // Attack reservations prevent more officers than the captured city can house.
      if(attackers.length>getOfficerCapacity(s,to)){
        const extra=attackers.slice(getOfficerCapacity(s,to));const waiting=createArmy(s,to.id,to.id,a.faction,'reinforce',emptyUnits(),extra,a.training,a.morale,'steady',1);waiting.progress=1;waiting.elapsedDays=1;waiting.waiting=true;
      }
      oldCaptives.forEach(g=>{
        if(g.faction===a.faction){g.captor=null;g.capturedDay=null;g.capturedTurn=null;
          if(cityGenerals(s,to.id).length<getOfficerCapacity(s,to))Object.assign(g,{status:'serving',armyId:null});
          else{const waiting=createArmy(s,to.id,to.id,a.faction,'reinforce',emptyUnits(),[g],50,70,'steady',1);waiting.progress=1;waiting.elapsedDays=1;waiting.waiting=true;}
        }else{g.captor=a.faction;g.capturedDay=s.totalDays;g.capturedTurn=s.turn;g.lastPrisonerDecisionPeriod=null;}
      });
      routeRetreat(s,to,b.defenderFaction,result.defenderSurvivors,escaped,b.defenderTraining,b.defenderMorale,result);
      result.message=getFaction(s,a.faction).name+(result.unopposed?'进驻'+to.name+'，城内无驻军，兵力无损。':'攻克'+to.name+'，损失 '+result.attackerLosses+' 人。');
      if(result.loot)result.message+='接收城库：'+result.loot.gold+' 金、'+result.loot.grain+' 粮。';
    }else{
      s.armies=s.armies.filter(other=>other.id!==a.id);
      const defeatedFaction=getFaction(s,a.faction);if(defeatedFaction)defeatedFaction.lastDefeatedBy=to.owner;
      frontDefenders.forEach(g=>{g.personalLosses=0;g.xp+=8;});const escaped=loseOfficers(s,attackers,to.owner,to,result,r,false);
      const remaining=clone(reserve);TYPES.forEach(k=>remaining[k]+=result.defenderSurvivors[k]);teams[frontIndex].units=clone(result.defenderSurvivors);
      // A simultaneous wipe has no surviving front team to face the next army.
      if(!result.defendersRemaining&&unitCount(reserve)>0){routeRetreat(s,to,to.owner,emptyUnits(),frontDefenders,b.defenderTraining,b.defenderMorale,result);teams.splice(frontIndex,1);}
      replaceUnits(to,remaining);to.defenseTeams=teams;to.training=Math.min(100,to.training+2);to.morale=Math.min(100,to.morale+4);
      if(a.marchRoute?.length>2&&(unitCount(result.attackerSurvivors)||escaped.length)){
        const back=a.marchRoute.slice(0,-1).reverse(),returning=createArmy(s,to.id,back[0],a.faction,'retreat',result.attackerSurvivors,escaped,b.attackerTraining,Math.max(20,b.attackerMorale-12));
        returning.withdrawalRoute=back;returning.reservationCityId=back.at(-1);
      }else routeRetreat(s,to,a.faction,result.attackerSurvivors,escaped,b.attackerTraining,b.attackerMorale,result,a.fromId);
      result.message=to.name+'守军击退来敌，进攻方损失 '+result.attackerLosses+' 人。';
    }
    normalizeCity(s,to);normalizeCity(s,from);syncActions(s);
    checkStatus(s,result.captured?a.faction:to.owner,result);
    result.capturedGeneral=result.capturedGenerals[0]?.name||null;
    if(result.capturedGenerals.length)result.message+='俘获 '+result.capturedGenerals.map(g=>g.name).join('、')+'。';
    addLog(s,result.message);const entry={id:b.id,turn:s.turn,day:s.day,totalDays:s.totalDays,battle:clone(b),result:clone(result)};s.lastBattles.unshift(entry);s.lastBattles=s.lastBattles.slice(0,12);
    movement(s,a.fromId,to.id,a.faction,'attack',b.attackerUnits,a.generalIds,result.winner==='attacker'?'victory':'defeat');return entry;
  }
  function arriveArmy(s,a,interactive=false) {
    const to=getCity(s,a.routeEndProgress===0?a.fromId:a.toId);
    if(a.withdrawalRoute?.length>1){
      a.withdrawalRoute.shift();Object.assign(a,{fromId:to.id,toId:a.withdrawalRoute[0],destinationId:a.withdrawalRoute[0],elapsedDays:0,travelDays:travelTime(s,to.id,a.withdrawalRoute[0]),progress:0,departDay:s.totalDays,routeStartProgress:0,routeEndProgress:1});return null;
    }
    if(a.marchRoute&&a.routeIndex<a.marchRoute.length-2){
      if(!canPass(s,a.faction,to.owner)){withdrawExpedition(s,a,to.name+'不再允许通行');return null;}
      a.routeIndex++;const next=a.marchRoute[a.routeIndex+1];Object.assign(a,{fromId:to.id,toId:next,elapsedDays:0,travelDays:travelTime(s,to.id,next),progress:0,departDay:s.totalDays,routeStartProgress:0,routeEndProgress:1});return null;
    }
    if(a.kind==='attack'&&areAllied(s,a.faction,to.owner)){withdrawExpedition(s,a,'目标现为盟友');return null;}
    if(a.releaseReturn&&to.owner!==a.faction){
      const route=returnRoute(s,to.id,a.faction,a.id);
      if(route?.length===1){a.waiting=true;return null;}
      s.armies=s.armies.filter(other=>other.id!==a.id);
      if(route&&route.length>1){const next=createArmy(s,to.id,route[1],a.faction,'retreat',a.units,a.generalIds,a.training,a.morale);next.returnRoute=route.slice(1);next.reservationCityId=route[route.length-1];next.releaseReturn=true;}
      else{const result={capturedGenerals:[]};a.generalIds.forEach(id=>{const g=getGeneral(s,id);if(factionIds.includes(to.owner))captureGeneral(s,g,to.owner,to,result);else freeOfficer(g,to.id);});addLog(s,'归乡将领已无原势力据点可投，'+(result.capturedGenerals.length?'被'+to.name+'守军收俘：'+result.capturedGenerals.map(g=>g.name).join('、')+'。':'暂留'+to.name+'。'));checkStatus(s,to.owner);}
      return null;
    }
    if(to.owner===a.faction){settleFriendly(s,a,to);return null;}
    if(a.kind==='attack'&&a.troops>0){
      to.defenseTeams=cityDefenseTeams(s,to);
      if(interactive&&to.troops>0&&(a.faction===s.player||to.owner===s.player)){
        queueBattle(s,a);return null;
      }
      return arriveBattle(s,a,to,null,interactive);
    }
    // A reinforcement whose destination fell retreats along a real adjacent road.
    s.armies=s.armies.filter(other=>other.id!==a.id);const result={};routeRetreat(s,to,a.faction,a.units,a.generalIds.map(id=>getGeneral(s,id)),a.training,a.morale,result,a.fromId);addLog(s,to.name+'已易主，在途部队转入撤退。');checkStatus(s,to.owner);return null;
  }
  function jobPower(g,stat) {return g?g[stat]*(g.role==='civil'||g.role==='ruler'?1.2:1):0;}
  function cityIncome(s,c) {
    const governor=activeOfficer(s,c,c.governorId),commerce=activeOfficer(s,c,c.assignments.commerce),farmer=activeOfficer(s,c,c.assignments.farming);
    const governance=1+(governor?Math.min(.20,governor.politics/500):0),occupation=c.occupiedUntil>s.totalDays?.5:1;
    return {gold:Math.floor((RULES.baseGoldIncome+c.market*RULES.marketIncome+Math.floor(jobPower(commerce,'politics')/2))*governance*occupation),
      grain:Math.floor((RULES.baseGrainIncome+c.farm*RULES.farmIncome+Math.floor(jobPower(farmer,'politics')/2))*governance*occupation*(calendarInfo(s).season.id==='autumn'?1.10:1))};
  }
  function incomePreview(s,factionId=s.player) {
    const own=ownedCities(s,factionId),income=own.reduce((sum,c)=>{const inc=cityIncome(s,c);sum.gold+=inc.gold;sum.grain+=inc.grain;return sum;},{gold:0,grain:0});
    const upkeep=winterGrain(s,(own.reduce((n,c)=>n+c.troops,0)+s.armies.filter(a=>a.faction===factionId).reduce((n,a)=>n+a.troops,0))/100);return {...income,upkeep,netGrain:income.grain-upkeep};
  }
  function cityIncomePreview(s,cityId) {const city=getCity(s,cityId);return city?cityIncome(s,city):{gold:0,grain:0};}
  // Monthly income still uses commerce and farming; military and search orders
  // run only through the shared seasonal command APIs.
  function monthlyJobs() {}

  function friendlyPath(s,from,to,faction) {
    const queue=[[from]],seen=new Set([from]);while(queue.length){const path=queue.shift(),last=path[path.length-1];if(last===to)return path;
      for(const next of neighbors(s,last))if(next.owner===faction&&!seen.has(next.id)){seen.add(next.id);queue.push(path.concat(next.id));}}
    return null;
  }
  function asFaction(s,id,fn) {
    const player=s.player,nested=actingPlayers.has(s);if(!nested)actingPlayers.set(s,player);let result;
    try{s.player=id;return result=fn();}finally{s.player=player;if(!nested){actingPlayers.delete(s);const changed=syncLeadership(s);if(result?.ok&&changed.length)result.leadershipEvents=[...(result.leadershipEvents||[]),...changed];}syncActions(s);}
  }
  const AI_PROFILES=Object.freeze({
    aggressive:{id:'aggressive',label:'进取',description:'主动扩张，善于集中兵力；较少结盟。',attackRatio:.98,reserveRatio:.22,training:58,allianceTarget:1,maxExpeditions:2,attackCooldown:45},
    balanced:{id:'balanced',label:'均衡',description:'整军后出击，按威胁选择结盟与扩张。',attackRatio:1.12,reserveRatio:.28,training:64,allianceTarget:2,maxExpeditions:2,attackCooldown:75},
    defensive:{id:'defensive',label:'守成',description:'重视守备和外交，也会夺取空城与薄弱据点。',attackRatio:1.30,reserveRatio:.38,training:72,allianceTarget:2,maxExpeditions:1,attackCooldown:110}
  });
  const AI_TEMPERAMENT={wei:'aggressive',wu:'aggressive',qun:'aggressive',lvbu:'aggressive',lijue:'aggressive',shu:'balanced',yuanshu:'balanced',gongsunzan:'balanced',mateng:'balanced',liuyao:'balanced',liubiao:'defensive',liuzhang:'defensive',zhanglu:'defensive',taoqian:'defensive',kongrong:'defensive',wanglang:'defensive'};
  function aiPersonality(s,id){return {...AI_PROFILES[AI_TEMPERAMENT[id]||'balanced']};}
  function aiDiplomacy(s,f,own,profile) {
    if(commandStatus(s).remaining<1||s.diplomacy.attempts.some(a=>a.from===f.id&&calendarInfo(a.day).period===period(s)))return null;
    const envoy=allianceEnvoys(s)[0];if(!envoy)return null;
    const ours=factionStrength(s,f.id),contacts=[...new Set(own.flatMap(c=>neighbors(s,c.id).map(n=>n.owner)))].filter(id=>id!==f.id&&id!=='neutral'&&!isFactionEliminated(s,id));
    const threatened=s.armies.some(a=>a.kind==='attack'&&a.faction!==f.id&&!areAllied(s,f.id,a.faction)&&getCity(s,destination(a))?.owner===f.id);
    const danger=contacts.some(id=>!areAllied(s,f.id,id)&&relationship(s,f.id,id).score<20&&factionStrength(s,id).score>ours.score*1.3);
    if(profile.id==='aggressive'&&!threatened&&!danger)return null;
    if(allies(s).length>=profile.allianceTarget)return null;
    const targets=s.factions.filter(other=>other.id!==f.id&&other.id!==realPlayer(s)&&!isFactionEliminated(s,other.id)&&!areAllied(s,f.id,other.id)&&relationship(s,f.id,other.id).score>-20&&diplomaticPair(f.id,other.id)!==diplomaticPair('wei','qun'));
    const candidates=[];
    for(const other of targets){
      const power=factionStrength(s,other.id),shared=ownedCities(s,other.id).some(c=>neighbors(s,c.id).some(n=>contacts.includes(n.owner)&&n.owner!==other.id&&!areAllied(s,f.id,n.owner)));
      if(!contacts.includes(other.id)&&!shared)continue;
      for(const gift of ALLIANCE_GIFTS){const q=allianceOffer(s,other.id,envoy.id,gift.id);
        if(q.ok&&q.chance>=50&&f.gold-q.gift.gold>=100&&f.grain-q.gift.grain>=400){candidates.push({id:other.id,gift:gift.id,score:q.chance+(shared?15:0)+(power.score>ours.score?8:0)+relationship(s,f.id,other.id).score*.3-q.gift.gold*.015});break;}}
    }
    candidates.sort((a,b)=>b.score-a.score);
    if(candidates.length){const best=candidates[0],r=proposeAlliance(s,best.id,envoy.id,best.gift);if(r.ok){addLog(s,f.name+'出使'+getFaction(s,best.id).name+(r.accepted?'，缔结两年盟约。':'，谈盟未果。'));return r;}}
    // Gifts can reach the player, but never impose an alliance without consent.
    const friend=contacts.filter(id=>relationship(s,f.id,id).score>=0&&relationship(s,f.id,id).score<20&&factionStrength(s,id).score>=ours.score).sort((a,b)=>factionStrength(s,b).score-factionStrength(s,a).score)[0];
    if(friend&&(danger||threatened)){const q=goodwillOffer(s,friend,envoy.id);if(q.ok&&f.gold-q.cost.gold>=150&&f.grain-q.cost.grain>=500){const r=sendGoodwill(s,friend,envoy.id);if(r.ok)addLog(s,f.name+'向'+getFaction(s,friend).name+'赠礼修好。');return r;}}
    return null;
  }
  function enemyDecision(s,f,events) {
    const month=monthIndex(s);if(f.aiMonth!==month){f.aiMonth=month;f.aiDecisions=0;}
    if(f.aiPeriod===aiDecisionPeriod(s)||f.aiDecisions>=2)return null;f.aiPeriod=aiDecisionPeriod(s);
    if(!ownedCities(s,f.id).length)return null;
    const result=asFaction(s,f.id,()=>{
      const own=ownedCities(s).filter(c=>c.occupiedUntil<=s.totalDays),profile=aiPersonality(s,f.id);
      own.forEach(c=>normalizeCity(s,c));
      const targets=new Map(own.map(c=>[c.id,reachableTargets(s,c.id).filter(t=>relationship(s,f.id,t.owner).score<20)]));
      const fronts=own.filter(c=>neighbors(s,c.id).some(n=>n.owner!==f.id&&!areAllied(s,f.id,n.owner)&&relationship(s,f.id,n.owner).score<20));
      const threatened=own.filter(c=>s.armies.some(a=>a.faction!==f.id&&!areAllied(s,a.faction,f.id)&&a.kind==='attack'&&destination(a)===c.id));
      const choices=[];
      const diplomat=allianceEnvoys(s)[0];if(diplomat&&own.filter(c=>c.kind!=='pass').length>=3){const candidate=allies(s).find(t=>t.factionId!==realPlayer(s)&&submissionOffer(s,t.factionId,diplomat.id).ok&&submissionOffer(s,t.factionId,diplomat.id).chance>=65);if(candidate)return proposeSubmission(s,candidate.factionId,diplomat.id);}
      if(profile.id==='defensive'||threatened.length){const diplomacy=aiDiplomacy(s,f,own,profile);if(diplomacy?.ok)return diplomacy;}
      const expeditionCount=s.armies.filter(a=>a.faction===f.id&&a.kind==='attack').length;
      const readyToAttack=f.aiAttackDay==null||s.totalDays-f.aiAttackDay>=profile.attackCooldown;
      for(const from of readyToAttack&&expeditionCount<profile.maxExpeditions?own:[])for(const to of targets.get(from.id)){
        if(relationship(s,f.id,to.owner).score>=20)continue;
        if(s.armies.some(a=>a.faction===f.id&&destination(a)===to.id))continue;
        if(s.armies.some(a=>a.faction!==f.id&&!areAllied(s,a.faction,f.id)&&a.kind==='attack'&&destination(a)===from.id))continue;
        const roster=cityGenerals(s,from.id).filter(g=>!busySearching(s,g.id)&&g.id!==from.project?.officerId);
        // Keep a civil/secondary officer at home, rather than locking the best
        // commander away for the whole campaign. Attacking defeats cannot capture.
        const keeper=roster.length>1?roster.slice().sort((a,b)=>Number(b.role==='civil')-Number(a.role==='civil')||(a.leadership+a.force*.3)-(b.leadership+b.force*.3))[0]:null;
        const pool=roster.filter(g=>g.id!==keeper?.id).sort((a,b)=>officerCommand(s,b).officialRank-officerCommand(s,a).officialRank||(b.leadership+b.force*.3)-(a.leadership+a.force*.3));
        const empty=to.owner==='neutral'&&to.troops===0;
        if(empty&&s.armies.some(a=>a.faction!==f.id&&a.kind==='attack'&&destination(a)===to.id))continue;
        const ids=pool.slice(0,empty?1:armyCommand(s,pool.map(g=>g.id)).limit).map(g=>g.id);
        if(!ids.length)continue;
        const reserve=Math.max(profile.id==='aggressive'?350:500,Math.ceil(from.troops*profile.reserveRatio));
        let amount=Math.min(commandCapacity(s,ids),Math.max(0,from.troops-reserve),empty?600:Infinity);if(amount<300)continue;
        let march=marchPlan(s,from.id,to.id,amount);if(!march)continue;
        while(amount>=300&&march.cost.grain>Math.max(0,f.grain-100)){amount-=100;march=marchPlan(s,from.id,to.id,amount);}if(amount<300)continue;
        const tactics=['steady','assault','flank'].map(tactic=>({tactic,ratio:estimateBattle(s,from.id,to.id,amount,{generalIds:ids,tactic}).ratio})).sort((a,b)=>b.ratio-a.ratio),tactic=tactics[0].tactic;
        const defenseTeams=cityDefenseTeams(s,to).filter(t=>unitCount(t.units)>0).length;
        const score=tactics[0].ratio/(1+Math.max(0,defenseTeams-1)*.24);
        const hostility=relationship(s,f.id,to.owner).score;
        const threshold=to.owner==='neutral'?1.04:profile.attackRatio-(hostility<=-60?.12:hostility<=-20?.06:0);
        if(score>=threshold)choices.push({from,to,amount,ids,tactic,score:Math.min(score,3)+(empty?.35:0)+(hostility<=-60?.6:hostility<=-20?.25:0)-march.travelDays*.015-(to.owner===realPlayer(s)&&s.totalDays<183?.35:0)});
      }
      choices.sort((a,b)=>b.score-a.score);
      for(const x of choices){const r=dispatchArmy(s,x.from.id,x.to.id,x.amount,{generalIds:x.ids,tactic:x.tactic});if(r.ok){f.aiAttackDay=s.totalDays;return r;}}
      const captive=prisoners(s).find(g=>s.totalDays-g.capturedDay>=10&&g.lastPrisonerDecisionPeriod!==period(s)&&hasOfficerSlot(s,g.cityId));
      const envoy=persuasionEnvoys(s)[0];
      if(captive&&envoy){if(s.totalDays-captive.capturedDay>=30&&captive.persuadeAttempts>=2&&random(s)<.06)return executePrisoner(s,captive.id);return persuadePrisoner(s,captive.id,envoy.id);}
      if(profile.id!=='defensive'){const diplomacy=aiDiplomacy(s,f,own,profile);if(diplomacy?.ok)return diplomacy;}
      const target=threatened.slice().sort((a,b)=>a.troops-b.troops)[0]||fronts.slice().sort((a,b)=>b.troops-a.troops)[0]||own.find(c=>targets.get(c.id).length);
      if(target)for(const rear of own.filter(c=>c.id!==target.id&&!threatened.includes(c)&&(!fronts.includes(c)||threatened.includes(target)||c.troops>target.troops*1.6)).sort((a,b)=>b.troops-a.troops)){
        const path=friendlyPath(s,rear.id,target.id,f.id);if(!path||path.length<2||s.armies.some(a=>a.faction===f.id&&a.kind==='reinforce'&&destination(a)===target.id))continue;
        const roster=cityGenerals(s,rear.id),pool=roster.filter(g=>(g.id!==rear.governorId||roster.length===1&&!fronts.includes(rear))&&!busySearching(s,g.id)).sort((a,b)=>officerCommand(s,b).officialRank-officerCommand(s,a).officialRank||b.force-a.force);
        const ids=pool.slice(0,armyCommand(s,pool.map(g=>g.id)).limit).map(g=>g.id);
        const amount=Math.min(commandCapacity(s,ids),Math.max(0,rear.troops-(fronts.includes(rear)?800:300)),Math.max(0,getTroopCapacity(s,target)-target.troops-reservedTroops(s,target.id)));
        if(!ids.length||amount<300&&cityGenerals(s,target.id).length>=2)continue;const r=dispatchTransfer(s,rear.id,target.id,amount>=150?amount:0,{generalIds:ids});if(r.ok)return r;
      }
      const trainer=own.filter(c=>c.training<profile.training&&c.troops>=900&&actionAvailability(s,c.id,'train').ok).sort((a,b)=>Number(fronts.includes(b))-Number(fronts.includes(a))||b.troops-a.troops)[0];
      if(trainer){const r=trainTroops(s,trainer.id);if(r.ok)return r;}
      const recruitCity=fronts.slice().sort((a,b)=>a.troops-b.troops).find(c=>c.troops<Math.floor(getTroopCapacity(s,c)*.8)&&actionAvailability(s,c.id,'recruit').ok);
      if(recruitCity){
        const room=getTroopCapacity(s,recruitCity)-recruitCity.troops-reservedTroops(s,recruitCity.id),amount=Math.floor(Math.min(1500,room,Math.max(0,f.gold-150)/.45,Math.max(0,f.grain-500)/.65)/50)*50;
        for(let n=amount;n>=100;n-=50){const r=recruitTroops(s,recruitCity.id,'infantry',n);if(r.ok)return r;}
      }
      for(const c of own){const talent=availableTalents(s,c.id)[0];if(talent){const r=hireTalent(s,c.id,talent.id);if(r.ok)return r;}
        const idle=cityGenerals(s,c.id).filter(g=>!Object.values(c.assignments).includes(g.id)).sort((a,b)=>b.politics-a.politics);
        if(idle.length){const job=!c.assignments.commerce?'commerce':!c.assignments.farming?'farming':null;if(job){const r=setAssignment(s,c.id,job,idle[0].id);if(r.ok)return r;}}
      }
      if(canSearchTalent(s,f.id))for(const c of own.filter(c=>hasOfficerSlot(s,c.id)&&actionAvailability(s,c.id,'search').ok)){const r=searchTalent(s,c.id);if(r.ok)return r;}
      for(const c of own.filter(c=>c.market<3)){const r=develop(s,c.id,'market');if(r.ok)return r;}
      return null;
    });
    if(result?.ok){f.aiDecisions++;events.push(result.message);}return result;
  }
  function monthlyEconomy(s,events) {
    s.cities.forEach(c=>normalizeCity(s,c));
    const income=incomePreview(s),ownEvents=[];
    for(const f of s.factions){const inc=incomePreview(s,f.id),enough=f.grain+inc.grain>=inc.upkeep;f.gold=Math.min(9999999,f.gold+inc.gold);f.grain=Math.min(9999999,Math.max(0,f.grain+inc.netGrain));
      ownedCities(s,f.id).forEach(c=>c.morale=clamp(c.morale+(enough?3:-8),20,100));s.armies.filter(a=>a.faction===f.id).forEach(a=>a.morale=clamp(a.morale+(enough?3:-8),20,100));
      const jobs=[];monthlyJobs(s,f,jobs);jobs.forEach(text=>{addLog(s,text);events.push(text);if(f.id===s.player)ownEvents.push(text);});}
    const summary='月结：税金 +'+income.gold+'，产粮 +'+income.grain+'，驻军与行军军粮 -'+income.upkeep+'。';addLog(s,summary);events.push(summary);
    const report={id:identifier(s,'report'),turn:s.turn,day:s.day,totalDays:s.totalDays,year:s.year,month:s.month,faction:s.player,income,events:ownEvents,summary};s.monthReports.unshift(report);s.monthReports=s.monthReports.slice(0,24);return report;
  }
  function advanceDays(s,days=1,options={}) {
    if(s?.pendingBattle)return {ok:true,daysAdvanced:0,alerts:[{kind:'battle',faction:s.player}],battles:[],events:[],message:'两军已接战，请先完成布阵。'};
    const error=liveError(s);if(error)return fail(error);if(!integer(days,1,360))return fail('一次可推进 1 至 360 日。');
    const seenLeadership=new Set((s.successionEvents||[]).map(e=>e.id)),events=[],reports=[],alerts=refreshAging(s),battles=[],projectResults=[];let daysAdvanced=0;
    events.push(...alerts.map(a=>a.message));
    // Resolve other armies that arrived on the same day before advancing the calendar.
    for(const a of s.armies.slice().filter(a=>a.progress>=1)){
      if(!s.armies.includes(a))continue;const battle=arriveArmy(s,a,!!options.interactive);
      if(battle){battles.push(battle);events.push(battle.result.message);}
      if(s.pendingBattle)break;
    }
    if(s.pendingBattle)return {ok:true,daysAdvanced:0,alerts:[{kind:'battle',faction:s.player}],battles,events,message:'两军已接战，请先完成布阵。'};
    const collectLeadership=()=>{syncLeadership(s);for(const e of s.successionEvents||[])if(!seenLeadership.has(e.id)){seenLeadership.add(e.id);alerts.push({kind:'succession',...clone(e)});events.push(e.message);}};
    collectLeadership();
    if(leadershipInfo(s).status==='pending'&&!alerts.some(a=>a.kind==='succession'&&a.faction===s.player&&a.type==='pending'))alerts.push({kind:'succession',type:'pending',faction:s.player,totalDays:s.totalDays,reason:leadershipInfo(s).reason,message:'请先决定本势力的君位继承，再推进时间。'});
    const relevantAlert=a=>a.kind==='incoming'||a.kind==='battle'||a.kind==='succession'&&a.type==='pending'&&a.faction===s.player;
    while(daysAdvanced<days&&s.status==='playing'&&!alerts.some(relevantAlert)){
      if([1,11,21].includes(s.day)){
        const manpower=id=>s.generals.filter(g=>g.faction===id&&['serving','marching'].includes(g.status)).length;
        const order=s.factions.slice().sort((a,b)=>ownedCities(s,a.id).length-ownedCities(s,b.id).length||manpower(a.id)-manpower(b.id));
        for(const f of order)if(f.id!==s.player){const r=enemyDecision(s,f,events);if(r?.army?.kind==='attack'&&getCity(s,destination(r.army)).owner===s.player)alerts.push({kind:'incoming',armyId:r.army.id,fromId:r.army.fromId,toId:destination(r.army),faction:f.id,eta:armyEta(s,r.army),message:r.message});collectLeadership();if(leadershipInfo(s).status==='pending')break;}
      }
      if(alerts.some(relevantAlert))break;
      s.totalDays++;daysAdvanced++;Object.assign(s,calendar.fromTotalDays(s.totalDays));s.turn=period(s)+1;refreshCommands(s);
      s.cities.forEach(c=>fillAdministration(s,c));
      tickDiplomacy(s,alerts,events);
      const ageEvents=refreshAging(s);alerts.push(...ageEvents);events.push(...ageEvents.map(a=>a.message));
      const projects=processProjects(s);projectResults.push(...projects);events.push(...projects.map(p=>p.message));
      const talentResults=processRecruitment(s);events.push(...talentResults.map(r=>r.message));alerts.push(...talentResults.map(r=>({...r,kind:'talent',faction:r.owner})));
      if(calendarInfo(s).isMonthStart)reports.push(monthlyEconomy(s,events));
      const moving=s.armies.slice();
      moving.forEach(a=>{a.elapsedDays=Math.min(a.travelDays,a.elapsedDays+1);a.progress=a.elapsedDays/a.travelDays;});
      for(const a of moving){if(!s.armies.includes(a)||a.progress<1)continue;const battle=arriveArmy(s,a,!!options.interactive);if(battle){battles.push(battle);events.push(battle.result.message);}if(s.pendingBattle){alerts.push({kind:'battle',faction:s.player});break;}}
      checkStatus(s);
      collectLeadership();
      if(alerts.some(relevantAlert)||battles.some(b=>!b.result.unopposed&&(b.battle.attackerFaction===s.player||b.battle.defenderFaction===s.player)))break;
    }
    const message=leadershipInfo(s).status==='pending'?'君位待定，时间暂停，请选择继承人。':alerts.some(a=>a.kind==='incoming')?'敌军已经出发，时间暂停，可部署援军。':alerts.some(a=>a.kind==='retirement'&&relevantAlert(a))?'有人服役满'+s.aging.yearsPerPoint*10+'年退隐，时间暂停，请查看人物与军情。':alerts.some(a=>a.kind==='service_decline'&&relevantAlert(a))?'人物服役年限下降，时间暂停，请查看能力变化。':'推进 '+daysAdvanced+' 日。';
    return {ok:true,message,daysAdvanced,alerts,reports,battles,events,projectResults};
  }
  function endTurn(s) {return advanceDays(s,calendarInfo(s).daysToNextPeriod);}
  function validDiplomacy(s) {
    const d=s.diplomacy;if(d===undefined)return true;
    if(!record(d)||![1,2,DIPLOMACY.version].includes(d.version)||!Array.isArray(d.treaties)||d.treaties.length>120||!Array.isArray(d.attempts)||d.attempts.length>(d.version===1?240:120))return false;
    const pairs=new Set();
    for(const t of d.treaties){
      if(!record(t)||!factionIds.includes(t.a)||!factionIds.includes(t.b)||t.a===t.b||!integer(t.startDay,0,s.totalDays)||!integer(t.endDay,t.startDay+1,t.startDay+(d.version===1?365:DIPLOMACY.treatyDays))||!['opening','negotiated'].includes(t.origin)||typeof t.warned!=='boolean'||!shortText(t.note,200))return false;
      const key=[t.a,t.b].sort().join('|');if(pairs.has(key))return false;pairs.add(key);
    }
    const attempts=new Set();for(const a of d.attempts){
      if(!record(a)||!factionIds.includes(a.from)||!factionIds.includes(a.to)||a.from===a.to||!(d.version===1?integer(a.period,0,period(s)):integer(a.day,0,s.totalDays)))return false;
      if(d.version===3&&typeof a.accepted!=='boolean')return false;
      const key=d.version===1?[a.from,a.to,a.period].join('|'):diplomaticPair(a.from,a.to);if(attempts.has(key))return false;attempts.add(key);
    }
    if(d.version===3){
      if(!Array.isArray(d.relations)||d.relations.length>120||!Array.isArray(d.submissionAttempts)||d.submissionAttempts.length>120||!Array.isArray(d.submissions)||d.submissions.length>16||!integer(d.relationPeriod,0,period(s)))return false;
      const seen=new Set();for(const r of d.relations){if(!record(r)||!factionIds.includes(r.a)||!factionIds.includes(r.b)||r.a===r.b||!integer(r.score,-100,100)||!shortText(r.reason,100)||!integer(r.day,0,s.totalDays)||r.lastGiftDay!==null&&!integer(r.lastGiftDay,0,s.totalDays))return false;const key=diplomaticPair(r.a,r.b);if(seen.has(key))return false;seen.add(key);}
      for(const list of [d.submissionAttempts,d.submissions]){const seen=new Set();for(const a of list){if(!record(a)||!factionIds.includes(a.from)||!factionIds.includes(a.to)||a.from===a.to||!integer(a.day,0,s.totalDays))return false;const key=diplomaticPair(a.from,a.to);if(seen.has(key))return false;seen.add(key);}}
    }return true;
  }
  function upgradeDiplomacy(s) {
    if(!s.diplomacy){activateDiplomacy(s);return;}
    if(s.diplomacy.version===DIPLOMACY.version)return;
    const oldVersion=s.diplomacy.version,latest=new Map(),remember=(from,to,day,accepted)=>{const key=diplomaticPair(from,to);if(!latest.has(key)||latest.get(key).day<=day)latest.set(key,{from,to,day,accepted});};
    // v1 recorded a season, not a day. Use the latest possible day in that
    // season, unless a successful treaty supplies the exact negotiation date.
    for(const a of s.diplomacy.attempts){
      const success=s.diplomacy.treaties.find(t=>t.origin==='negotiated'&&diplomaticPair(t.a,t.b)===diplomaticPair(a.from,a.to)&&(oldVersion===1?calendarInfo(t.startDay).period===a.period:t.startDay===a.day));
      const nextMonth=5+((a.period||0)+1)*3,end=calendar.dateToTotalDays(194+Math.floor(nextMonth/12),nextMonth%12+1,1)-1;
      remember(a.from,a.to,success?success.startDay:oldVersion===1?Math.min(s.totalDays,end):a.day,!!success);
    }
    for(const t of s.diplomacy.treaties)if(t.origin==='negotiated')remember(t.a,t.b,t.startDay,true);
    s.diplomacy.version=DIPLOMACY.version;s.diplomacy.attempts=[...latest.values()];
    const oldLength=s.diplomacy.treaties.length;
    s.diplomacy.treaties=s.diplomacy.treaties.filter(t=>!(t.origin==='opening'&&diplomaticPair(t.a,t.b)===diplomaticPair('wei','qun')));
    Object.assign(s.diplomacy,{relations:[],submissionAttempts:[],submissions:[],relationPeriod:period(s)});for(const t of s.diplomacy.treaties)changeRelationship(s,t.a,t.b,35,'既有盟约');
    if(s.diplomacy.treaties.length!==oldLength){addLog(s,'已取消曹操—袁绍的预设开局盟约。');recheckExpeditions(s);}
  }
  function validRecruitment(s) {
    const r=s.recruitment;if(r===undefined)return true;const liveIds=Array.isArray(s.generals)?s.generals.map(g=>g?.id):[];
    if(!record(r)||r.version!==1||!Array.isArray(r.missions)||r.missions.length>340||!Array.isArray(r.attempts)||r.attempts.length>5440||!Array.isArray(r.results)||r.results.length>60)return false;
    if(r.commonStreak!==undefined&&(!record(r.commonStreak)||!Object.entries(r.commonStreak).every(([id,n])=>factionIds.includes(id)&&integer(n,0,3))))return false;
    for(const key of ['commonJoined','commonCreated','homeFound'])if(r[key]!==undefined&&!record(r[key]))return false;
    if(r.commonJoined&&!Object.entries(r.commonJoined).every(([f,ids])=>factionIds.includes(f)&&Array.isArray(ids)&&ids.length<=256&&new Set(ids).size===ids.length&&ids.every(id=>commonId(id)&&liveIds.includes(id))))return false;
    if(r.commonCreated&&!Object.entries(r.commonCreated).every(([f,n])=>factionIds.includes(f)&&integer(n,0,256)))return false;
    if(r.homeFound&&!Object.entries(r.homeFound).every(([f,b])=>factionIds.includes(f)&&typeof b==='boolean'))return false;
    if(r.ignored!==undefined&&(!Array.isArray(r.ignored)||r.ignored.length>5440||new Set(r.ignored.map(x=>x.owner+'|'+x.generalId)).size!==r.ignored.length||!r.ignored.every(x=>record(x)&&factionIds.includes(x.owner)&&liveIds.includes(x.generalId))))return false;
    const ids=new Set(),officers=new Set(),cities=new Set();for(const m of r.missions){
      if(!record(m)||!shortText(m.id,100)||!factionIds.includes(m.owner)||!cityIds.includes(m.cityId)||!liveIds.includes(m.officerId)||!integer(m.startedDay,0,s.totalDays)||!integer(m.finishDay,m.startedDay+8,m.startedDay+15)||m.finishDay<=s.totalDays||!integer(m.chance,35,90)||ids.has(m.id)||officers.has(m.officerId)||cities.has(m.cityId))return false;
      ids.add(m.id);officers.add(m.officerId);cities.add(m.cityId);
    }
    const pairs=new Set();for(const a of r.attempts){const key=a.owner+'|'+a.generalId;if(!record(a)||!factionIds.includes(a.owner)||!liveIds.includes(a.generalId)||!integer(a.day,0,s.totalDays)||pairs.has(key))return false;pairs.add(key);}
    const receipts=new Set();for(const e of r.results){if(!record(e)||!shortText(e.id,100)||receipts.has(e.id)||!factionIds.includes(e.owner)||!cityIds.includes(e.cityId)||e.officerId!==null&&!liveIds.includes(e.officerId)||!['search','hire'].includes(e.kind)||!['found','missed','cancelled','joined','declined'].includes(e.outcome)||e.generalId!==null&&!liveIds.includes(e.generalId)||!shortText(e.message)||!integer(e.day,0,s.totalDays))return false;receipts.add(e.id);}return true;
  }
  function validateState(s,legacy=false,oldAging=false,oldTurns=false,oldAdministration=false,oldRoster=false,oldCommands=false,oldThreeYearAging=false,oldLeadership=false,oldMap=false) {
    try{
      if(!record(s)||s.version!==(legacy?3:4)||!factionIds.includes(s.player)||!integer(s.totalDays,0,1000000)||!integer(s.rng,0,4294967295)||!integer(s.sequence,0,1000000000)||!['playing','won','lost'].includes(s.status))return false;
      if(!validDiplomacy(s)||!validRecruitment(s))return false;
      if(s.balanceRevision!==undefined&&!['balance-v13',BALANCE_REVISION].includes(s.balanceRevision))return false;
      if(s.personnelNotices!==undefined&&(!Array.isArray(s.personnelNotices)||s.personnelNotices.length>120||!s.personnelNotices.every(a=>record(a)&&['service_decline','retirement'].includes(a.kind)&&s.generals.some(g=>g.id===a.generalId)&&integer(a.totalDays,0,s.totalDays)&&shortText(a.message))))return false;
      let rosterIds=legacy?legacyGeneralIds:oldRoster?(s.rosterRevision===undefined?legacyGeneralIds:s.rosterRevision===PREVIOUS_ROSTER_REVISION?previousGeneralIds:s.rosterRevision===EIGHTY_ROSTER_REVISION?eightyGeneralIds:s.rosterRevision===EIGHTY_ONE_ROSTER_REVISION?eightyOneGeneralIds:s.rosterRevision===EIGHTY_THREE_ROSTER_REVISION?eightyThreeGeneralIds:null):generalIds;
      if(!rosterIds||legacy&&s.rosterRevision!==undefined||!legacy&&!oldRoster&&s.rosterRevision!==ROSTER_REVISION)return false;
      if(s.ratingsRevision!==undefined&&s.ratingsRevision!==DATA.ratingsRevision)return false;
      if(!legacy&&!oldRoster){
        if(!Array.isArray(s.generals))return false;
        const added=s.generals.filter(g=>!generalIds.includes(g?.id));if(added.length>COMMON_LIMIT)return false;
        for(const g of added){
          const template=DATA.commonTemplates[g.commonKind];
          if(!commonId(g.id)||!template||!g.id.startsWith('common_'+g.commonKind+'_')||g.role!==template.role||g.rarity!=='common'||g.name!==template.name+'·'+Number(g.id.slice(-3))||![template,OLD_COMMON[g.commonKind]].some(t=>STATS.every(k=>g.baseStats?.[k]===t[k])))return false;
        }
        if(s.generals.some(g=>generalIds.includes(g.id)&&g.commonKind!==undefined))return false;
        rosterIds=rosterIds.concat(added.map(g=>g.id));
      }
      if(legacy||oldMap?s.mapRevision!==undefined:s.mapRevision!==MAP_REVISION)return false;
      const expected=legacy?{year:194+Math.floor((5+Math.floor(s.totalDays/30))/12),month:(5+Math.floor(s.totalDays/30))%12+1,day:s.totalDays%30+1}:calendar.fromTotalDays(s.totalDays);
      const monthCount=legacy?Math.floor(s.totalDays/30):monthIndex(s),aiCount=legacy?Math.floor(s.totalDays/10):aiDecisionPeriod(s),periodCount=legacy||oldTurns?aiCount:period(s);
      if(!legacy&&(oldTurns?s.turnSystem!==undefined:s.turnSystem!=='seasons-v1'))return false;
      if(!legacy&&(oldAdministration?s.administrationSystem!==undefined:s.administrationSystem!=='assignments-v1'))return false;
      if(legacy||oldCommands?s.commandSystem!==undefined:s.commandSystem!==COMMAND_SYSTEM)return false;
      if(s.year!==expected.year||s.month!==expected.month||s.day!==expected.day||s.turn!==(legacy||oldTurns?monthCount:period(s))+1)return false;
      if(!legacy&&(oldAging?![{},PREVIOUS_AGING,AGING].some(rule=>sameAging(s.aging,{...rule,enabled:false})):!sameAging(s.aging,oldThreeYearAging?PREVIOUS_AGING:AGING)))return false;
      for(const [rows,ids] of [[s.cities,legacy||oldMap?legacyCityIds:cityIds],[s.generals,rosterIds],[s.factions,factionIds]])if(!Array.isArray(rows)||rows.length!==ids.length||new Set(rows.map(x=>x?.id)).size!==ids.length||!rows.every(x=>record(x)&&ids.includes(x.id)))return false;
      if(legacy||oldLeadership){
        if(s.leadershipVersion!==undefined||s.successionEvents!==undefined||s.factions.some(f=>['regentId','successionPending','leadershipStatus'].some(k=>f[k]!==undefined)))return false;
      }else{
        if(s.leadershipVersion!==1||!Array.isArray(s.successionEvents)||s.successionEvents.length>200||new Set(s.successionEvents.map(e=>e?.id)).size!==s.successionEvents.length)return false;
        const knownId=id=>id===null||rosterIds.includes(id);
        for(const e of s.successionEvents){
          if(!record(e)||!shortText(e.id,100)||!e.id||!factionIds.includes(e.faction)||!['regency','restored','succession','vacant','pending'].includes(e.type)||!knownId(e.previousLeaderId)||!knownId(e.leaderId)||!knownId(e.regentId)||!(e.reason===null||LEADERSHIP_REASONS.includes(e.reason))||!integer(e.totalDays,0,s.totalDays)||!shortText(e.message))return false;
          for(const key of ['previousLeaderName','leaderName','regentName','factionName'])if(e[key]!==undefined&&e[key]!==null&&!shortText(e[key],30))return false;
        }
        for(const f of s.factions){
          if(!rosterIds.includes(f.leaderId)||!shortText(f.leader,30)||!f.leader||!shortText(f.name,30)||!f.name||!shortText(f.flag,4)||!f.flag||!LEADERSHIP_STATUSES.includes(f.leadershipStatus)||!knownId(f.regentId))return false;
          if(f.regentId!==null){const g=getGeneral(s,f.regentId);if(f.leadershipStatus!=='regency'||g.faction!==f.id||!['serving','marching'].includes(g.status))return false;}
          if(['pending','vacant'].includes(f.leadershipStatus)){
            const p=f.successionPending;if(!record(p)||Object.keys(p).length!==3||p.previousLeaderId!==f.leaderId||!LEADERSHIP_REASONS.filter(r=>r!=='captured').includes(p.reason)||!integer(p.totalDays,0,s.totalDays)||f.regentId!==null)return false;
          }else if(f.successionPending!==null)return false;
        }
      }
      if(!s.factions.every(f=>integer(f.gold,0,999999999)&&integer(f.grain,0,999999999)&&integer(f.aiDecisions,0,2)&&integer(f.aiPeriod,-1,aiCount)&&integer(f.aiMonth,0,monthCount)))return false;
      if(!(legacy||oldCommands)&&!s.factions.every(f=>record(f.commands)&&f.commands.period===period(s)&&integer(f.commands.total,6,10)&&integer(f.commands.spent,0,f.commands.total)))return false;
      if((legacy||oldCommands)&&s.factions.some(f=>f.commands!==undefined))return false;
      if(s.openingSupport!==undefined){
        // Historical receipts are independent of current balance amounts;
        // loading this metadata never grants resources or discovers a talent.
        const p=s.openingSupport;
        if(!record(p)||p.version!=='opening-v1'||!['strong','medium','basic'].includes(p.tier)||!integer(p.gold,0,999999999)||!integer(p.grain,0,999999999)||!integer(p.troops,0,6000)||!cityIds.includes(p.capitalId)||p.talentId!==null&&!generalIds.includes(p.talentId))return false;
      }
      if(!Array.isArray(s.armies)||s.armies.length>500||new Set(s.armies.map(a=>a?.id)).size!==s.armies.length)return false;
      const marchingIds=[];
      for(const a of s.armies){
        if(!record(a)||!shortText(a.id,100)||!factionIds.concat('neutral').includes(a.faction)||!cityIds.includes(a.fromId)||!cityIds.includes(a.toId)||!cityIds.includes(destination(a))||!['attack','reinforce','retreat'].includes(a.kind)||a.status!=='marching'||!validUnits(a.units,legacy?4000:RULES.maxCommandTroops)||a.troops!==unitCount(a.units)||!integer(a.travelDays,1,60)||!integer(a.elapsedDays,0,a.travelDays)||a.progress!==a.elapsedDays/a.travelDays||!integer(a.departDay,0,s.totalDays)||!['steady','assault','flank'].includes(a.tactic)||!['training','morale'].every(k=>integer(a[k],0,100)))return false;
        if(!Number.isFinite(a.routeStartProgress)||a.routeStartProgress<0||a.routeStartProgress>1||![0,1].includes(a.routeEndProgress)||!Array.isArray(a.generalIds)||a.generalIds.length>5||new Set(a.generalIds).size!==a.generalIds.length||!a.generalIds.every(id=>rosterIds.includes(id)))return false;
        if(a.reservationCityId!==undefined&&!cityIds.includes(a.reservationCityId)||a.returnRoute!==undefined&&(!Array.isArray(a.returnRoute)||!a.returnRoute.every(id=>cityIds.includes(id))))return false;
        if(a.fromId!==a.toId&&!neighbors(s,a.fromId).some(c=>c.id===a.toId))return false;
        const validRoute=route=>Array.isArray(route)&&route.length>=1&&route.length<=cityIds.length&&new Set(route).size===route.length&&route.every((id,i)=>cityIds.includes(id)&&(!i||neighbors(s,route[i-1]).some(c=>c.id===id)));
        if(a.originId!==undefined&&!cityIds.includes(a.originId))return false;
        if(a.marchRoute!==undefined){const r=a.marchRoute;if(a.kind==='retreat'||!validRoute(r)||r.length<2||!integer(a.routeIndex,0,r.length-2)||r[a.routeIndex]!==a.fromId||r[a.routeIndex+1]!==a.toId||r[0]!==a.originId||r.at(-1)!==destination(a)||r.at(-1)!==a.reservationCityId||a.routeStartProgress!==0||a.routeEndProgress!==1)return false;}
        else if(a.routeIndex!==undefined)return false;
        if(a.withdrawalRoute!==undefined&&(!validRoute(a.withdrawalRoute)||a.kind!=='retreat'||a.withdrawalRoute[0]!==destination(a)||a.withdrawalRoute.at(-1)!==a.reservationCityId||a.marchRoute!==undefined))return false;
        for(const id of a.generalIds){const g=getGeneral(s,id);if(g.status!=='marching'||g.armyId!==a.id||g.faction!==a.faction||g.cityId!==null)return false;marchingIds.push(id);}
      }
      if(new Set(marchingIds).size!==marchingIds.length)return false;
      for(const c of s.cities){
        if(!factionIds.concat('neutral').includes(c.owner)||!validUnits(c.units,legacy?4000:RULES.maxTroops)||c.troops!==unitCount(c.units)||!['training','morale'].every(k=>integer(c[k],0,100))||!['farm','market','wall'].every(k=>integer(c[k],0,3))||!integer(c.ordersRemaining,0,3)||!integer(c.occupiedUntil,0,s.totalDays+1)||!(s.balanceRevision===BALANCE_REVISION?c.officerCapacity===null:integer(c.officerCapacity,1,20))||!record(c.periodActions)||!record(c.assignments)||!integer(c.searchProgress,0,10000))return false;
        if(legacy||oldCommands){if(!['recruit','train','develop'].every(k=>typeof c.periodActions[k]==='boolean')||c.commandPeriod!==undefined)return false;}
        else if(c.commandPeriod!==period(s)||!PAID_ACTIONS.every(k=>integer(c.periodActions[k],0,RULES.cityActionLimits[k])))return false;
        if(c.officerCapacity!==null&&![cities.find(base=>base.id===c.id).officerCapacity,c.kind==='pass'?8:c.tier==='major'?20:15].includes(c.officerCapacity))return false;
        const jobNames=legacy||oldAdministration?JOBS.filter(k=>k!=='recruitment'):JOBS;
        const ids=cityGenerals(s,c.id).map(g=>g.id),jobs=jobNames.map(k=>c.assignments[k]).filter(Boolean);if(c.officerCapacity!==null&&ids.length>c.officerCapacity||new Set(jobs).size!==jobs.length||!jobNames.every(k=>c.assignments[k]===null||ids.includes(c.assignments[k]))||c.generalId!==null&&!ids.includes(c.generalId)||c.governorId!==null&&!ids.includes(c.governorId))return false;
        if(legacy||oldAdministration){if(c.project!==undefined&&c.project!==null)return false;}
        else{
          if(c.ordersRemaining!==0||oldCommands&&Object.values(c.periodActions).some(Boolean)||!record(c.recruitment)||!TYPES.includes(c.recruitment.type)||!integer(c.recruitment.target,0,getTroopCapacity(s,c)))return false;
          const p=c.project;if(p!==null){
            if(!record(p)||!shortText(p.id,100)||p.cityId!==c.id||p.owner!==c.owner||!factionIds.includes(p.owner)||!Object.keys(RULES.projectDays).includes(p.kind)||!ids.includes(p.officerId)||!integer(p.startedDay,0,s.totalDays)||p.finishDay!==p.startedDay+RULES.projectDays[p.kind]||p.remainingDays!==p.finishDay-s.totalDays||!integer(p.remainingDays,1,RULES.projectDays[p.kind])||!record(p.cost)||p.cost.actions!==0)return false;
            if(p.kind==='develop'&&(!['farm','market','wall'].includes(p.target)||c[p.target]>=3)||p.kind==='recruit'&&(!TYPES.includes(p.type)||!integer(p.amount,100,500)||p.amount%100))return false;
            const quote=p.kind==='search'?{gold:80,grain:0}:costs({...s,troopSystem:undefined,totalDays:p.startedDay},c.id,p.kind==='develop'?p.target:p.kind,p.amount,{type:p.type});
            if(!quote||p.cost.gold!==quote.gold||p.cost.grain!==quote.grain)return false;
          }
        }
      }
      for(const g of s.generals){
        if(!factionIds.concat('neutral').includes(g.faction))return false;
        if(!(legacy||oldAging?['serving','free','prisoner','marching','dead']:['serving','free','prisoner','marching','dead','retired']).includes(g.status)||!(legacy?['force','intellect','politics','charisma']:STATS).every(k=>integer(g[k],0,120))||!integer(g.xp,0,10000000)||!integer(g.personalLosses,0,1000000)||!integer(g.persuadeAttempts,0,1000000)||!integer(g.loyalty,0,100)||!Array.isArray(g.revealedTo)||!g.revealedTo.every(id=>factionIds.includes(id))||!['civil','military','ruler'].includes(g.role)||!['legend','renowned','common'].includes(g.rarity)||!['assault','steady','flank','defense'].includes(g.ability)||!shortText(g.name,30)||!shortText(g.trait,150))return false;
        if(!legacy&&(!integer(g.serviceReserve,0,10)||g.serviceStartDay!==null&&!integer(g.serviceStartDay,0,s.totalDays)))return false;
        if(g.baseStats!==undefined&&(!record(g.baseStats)||!STATS.every(k=>integer(g.baseStats[k],0,120))))return false;
        if(g.agingAtEnd!==undefined&&(legacy||oldAging||oldThreeYearAging||!['dead','retired'].includes(g.status)||!(sameAging(g.agingAtEnd,PREVIOUS_AGING)||g.status==='dead'&&sameAging(g.agingAtEnd,{enabled:false}))))return false;
        if(legacy&&g.serviceStartDay!==undefined&&g.serviceStartDay!==null&&!integer(g.serviceStartDay,0,s.totalDays))return false;
        if(!legacy&&!oldAging){
          if(!record(g.baseStats)||g.status!=='free'&&g.serviceStartDay===null||g.status==='dead'&&g.serviceStartDay>g.deathDay)return false;
          const info=serviceInfo(s,g),stats=effectiveStats(s,g);
          if(g.serviceReserve!==info.serviceReserve||!STATS.every(k=>g[k]===stats[k]))return false;
          if(g.status==='retired'?(g.serviceReserve!==0||!integer(g.retirementDay,0,s.totalDays)||g.retirementDay!==info.retirementDay||g.cityId!==null||g.armyId!==null||g.captor!==null||g.capturedDay!==null||g.capturedTurn!==null):(g.retirementDay!==null||g.status!=='dead'&&info.retired))return false;
        }
        const c=getCity(s,g.cityId);
        if(g.status==='serving'&&(!c||c.owner!==g.faction||g.armyId!==null||g.captor!==null))return false;
        if(g.status==='marching'&&(!marchingIds.includes(g.id)||g.cityId!==null||g.captor!==null))return false;
        if(g.status==='free'&&(!c||g.faction!=='neutral'||g.armyId!==null||g.captor!==null))return false;
        if(g.status==='prisoner'&&(!c||!legacy&&c.owner!==g.captor||g.faction===g.captor||!factionIds.includes(g.faction)||!factionIds.includes(g.captor)||g.armyId!==null||!integer(g.capturedDay,0,s.totalDays)))return false;
        if(g.status==='dead'&&(g.cityId!==null||g.armyId!==null||!integer(g.deathDay,0,s.totalDays)||!shortText(g.deathReason,120)))return false;
        if(g.lastPrisonerDecisionPeriod!==null&&!integer(g.lastPrisonerDecisionPeriod,0,periodCount))return false;
      }
      if(s.actions!==(legacy||oldAdministration?ownedCities(s).reduce((n,c)=>n+c.ordersRemaining,0):oldCommands?0:commandStatus(s).remaining))return false;
      if(s.troopSystem!==undefined&&s.troopSystem!=='officer-types-v1')return false;
      if(s.pendingBattle!==null){
        const p=s.pendingBattle,a=s.armies.find(a=>a.id===p?.armyId),to=a&&getCity(s,a.toId);
        if(!record(p)||Object.keys(p).some(k=>!['armyId','id','seed','day','phase'].includes(k))||p.phase!==undefined&&p.phase!=='siege'||!shortText(p.id,100)||!p.id||!integer(p.seed,0,4294967295)||p.day!==s.totalDays||s.status!=='playing'||!a||a.progress!==1||a.kind!=='attack'||a.troops<1||!to||to.troops<1||to.owner===a.faction||areAllied(s,a.faction,to.owner)||a.faction!==s.player&&to.owner!==s.player||p.phase==='siege'&&a.faction!==s.player||a.marchRoute&&a.routeIndex!==a.marchRoute.length-2)return false;
      }
      if(!Array.isArray(s.logs)||s.logs.length>100||!s.logs.every(l=>{
        if(!record(l)||!integer(l.turn,1,s.turn)||!shortText(l.text))return false;if(l.totalDays===undefined)return true;if(!integer(l.totalDays,0,s.totalDays))return false;
        const d=legacy?{day:l.totalDays%30+1,month:(5+Math.floor(l.totalDays/30))%12+1,year:194+Math.floor((5+Math.floor(l.totalDays/30))/12)}:calendar.fromTotalDays(l.totalDays);
        return l.day===d.day&&l.month===d.month&&l.year===d.year;
      }))return false;
      if(!Array.isArray(s.movements)||s.movements.length>60||!Array.isArray(s.lastBattles)||s.lastBattles.length>12||!Array.isArray(s.monthReports)||s.monthReports.length>24||!Array.isArray(s.eliminations)||new Set(s.eliminations.map(e=>e.faction)).size!==s.eliminations.length)return false;
      if(!s.eliminations.every(e=>record(e)&&factionIds.includes(e.faction)&&integer(e.totalDays,0,s.totalDays)))return false;
      const own=ownedCities(s).length,armies=s.armies.filter(a=>a.faction===s.player).length;if(s.status==='lost'&&(own||armies)||s.status==='won'&&(own!==s.cities.length||s.armies.some(a=>a.faction!==s.player)))return false;
      return true;
    }catch(_){return false;}
  }
  function activateAging(s) {
    s.aging=clone(AGING);
    for(const g of s.generals){
      const original=generals.find(base=>base.id===g.id);
      g.baseStats=g.baseStats||Object.fromEntries(STATS.map(k=>[k,g[k]]));
      // Old releases or routs may have discarded allegiance. An initially
      // serving officer, or an officer with a service history, still started at 0.
      if(g.serviceStartDay===undefined||g.serviceStartDay===null&&g.status!=='free')g.serviceStartDay=g.status==='free'&&original.status==='free'&&!g.releasedBy&&!g.personalLosses&&!g.xp?null:0;
      if(g.serviceStartDay===null&&g.status==='free'&&(original.status==='serving'||g.releasedBy||g.personalLosses||g.xp))g.serviceStartDay=0;
      g.serviceReserve=g.serviceReserve??10;g.retirementDay=g.retirementDay??null;
      // Before aging existed, death fixed the original ratings with no decline.
      if(g.status==='dead'){g.agingAtEnd={enabled:false};g.serviceReserve=10;}
    }
    refreshAging(s);
  }
  function upgradeAging(s) {
    // The source was validated with its original formula. Terminal records keep
    // that formula permanently; only living officers use the slower new clock.
    for(const g of s.generals)if(['dead','retired'].includes(g.status))g.agingAtEnd=clone(PREVIOUS_AGING);
    s.aging=clone(AGING);
    for(const g of s.generals)if(!g.agingAtEnd){Object.assign(g,effectiveStats(s,g));g.serviceReserve=serviceInfo(s,g).serviceReserve;}
  }
  function activateSeasonTurns(s) {
    const convertTurn=n=>Math.floor((n-1)/3)+1;
    s.turnSystem='seasons-v1';s.turn=period(s)+1;
    for(const g of s.generals){
      if(g.lastPrisonerDecisionPeriod!==null)g.lastPrisonerDecisionPeriod=Math.floor(g.lastPrisonerDecisionPeriod/9);
      if(Number.isInteger(g.capturedTurn))g.capturedTurn=convertTurn(g.capturedTurn);
    }
    for(const entries of [s.logs,s.movements,s.lastBattles,s.monthReports,s.eliminations])for(const entry of entries){
      if(Number.isInteger(entry.turn))entry.turn=Number.isInteger(entry.totalDays)?period({totalDays:entry.totalDays})+1:convertTurn(entry.turn);
    }
  }
  function activateAdministration(s) {
    s.administrationSystem='assignments-v1';
    s.cities.forEach(c=>{c.ordersRemaining=0;c.periodActions={recruit:false,train:false,develop:false};c.assignments.recruitment=c.assignments.recruitment??null;c.recruitment=c.recruitment||{type:'infantry',target:Math.min(1500,getTroopCapacity(s,c))};c.project=null;});syncActions(s);
  }
  function activateCommands(s,previousCounts) {
    s.commandSystem=COMMAND_SYSTEM;refreshCommands(s);
    for(const c of s.cities){
      const counts=previousCounts?.[c.id];if(counts)PAID_ACTIONS.forEach(kind=>c.periodActions[kind]=Math.min(RULES.cityActionLimits[kind],Number(counts[kind]||0)));
      // Keep already-paid legacy projects and their exact remaining duration.
      if(c.project)c.periodActions[c.project.kind]=Math.max(1,c.periodActions[c.project.kind]);
      for(const job of JOBS.filter(job=>!ACTIVE_JOBS.includes(job)))c.assignments[job]=null;
    }
    for(const f of s.factions)f.commands.spent=Math.min(f.commands.total,ownedCities(s,f.id).reduce((sum,c)=>sum+PAID_ACTIONS.reduce((n,kind)=>n+Number(previousCounts?.[c.id]?.[kind]||0),0),0));
    syncActions(s);addLog(s,'已采用四季共享命令：募兵、训练、建设立即生效，寻访等待8—15日；经商与屯田继续按月结算。旧付费项目仍按原日程完成，不再扣令。');
  }
  function migrateState(input) {
    if(input?.version===4){
      const oldAging=input.aging?.enabled===false,oldThreeYearAging=sameAging(input.aging,PREVIOUS_AGING),oldTurns=input.turnSystem===undefined,oldAdministration=input.administrationSystem===undefined,oldRoster=input.rosterRevision!==ROSTER_REVISION,oldCommands=input.commandSystem===undefined,oldLeadership=input.leadershipVersion===undefined,oldMap=input.mapRevision===undefined;if(!validateState(input,false,oldAging,oldTurns,oldAdministration,oldRoster,oldCommands,oldThreeYearAging,oldLeadership,oldMap))return null;
      const previousCounts=Object.fromEntries(input.cities.map(c=>[c.id,c.periodActions]));
      const saved=clone(input);saved.factions.forEach(f=>f.color=factions.find(base=>base.id===f.id).color);
      if(oldTurns)activateSeasonTurns(saved);
      if(oldAdministration)activateAdministration(saved);
      if(oldAging)activateAging(saved);
      if(oldThreeYearAging)upgradeAging(saved);
      if(oldRoster)addRoster(saved);
      upgradeRatings(saved);
      if(oldCommands)activateCommands(saved,previousCounts);
      if(oldMap)addMap(saved);
      if(oldLeadership)activateLeadership(saved);else syncLeadership(saved);
      upgradeDiplomacy(saved);
      activateRecruitment(saved);saved.troopSystem='officer-types-v1';upgradeBalance(saved);
      return validateState(saved)?saved:null;
    }
    if(!validateState(input,true))return null;
    const s=clone(input),oldDay=s.totalDays;
    const oldDate = n => {const mi=5+Math.floor(n/30),month=mi%12+1;return {year:194+Math.floor(mi/12),month,day:Math.min(n%30+1,calendar.MONTH_DAYS[month-1])};};
    const mappedDay = n => {const d=oldDate(n);return calendar.dateToTotalDays(d.year,d.month,d.day);};
    s.totalDays=calendar.dateToTotalDays(s.year,s.month,Math.min(s.day,calendar.MONTH_DAYS[s.month-1]));
    Object.assign(s,calendar.fromTotalDays(s.totalDays),{version:4,aging:clone(AGING)});s.turn=monthIndex(s)+1;
    // Calendar dates of historical events are mapped. Active countdowns retain
    // their remaining real days, and march progress/duration are never recomputed.
    const relativeDay = n => Math.max(0,s.totalDays+n-oldDay);
    s.cities.forEach(c=>{c.occupiedUntil=c.occupiedUntil?relativeDay(c.occupiedUntil):0;});
    s.armies.forEach(a=>{a.departDay=relativeDay(a.departDay);a.departureSeason=calendarInfo(a.departDay).season.id;});
    s.factions.forEach(f=>{f.color=factions.find(base=>base.id===f.id).color;});
    s.generals.forEach(g=>{
      const base=generals.find(base=>base.id===g.id);g.leadership=base.leadership;g.availableYear=194;g.trait=base.trait;
      if(Number.isInteger(g.serviceStartDay))g.serviceStartDay=mappedDay(g.serviceStartDay);
      if(g.capturedDay!==null)g.capturedDay=relativeDay(g.capturedDay);
      if(g.deathDay!==null)g.deathDay=mappedDay(g.deathDay);
      if(g.hireBlockedUntil)g.hireBlockedUntil=relativeDay(g.hireBlockedUntil);
    });
    for(const entries of [s.logs,s.lastBattles,s.monthReports,s.eliminations])entries.forEach(entry=>{
      if(Number.isInteger(entry.totalDays)){const d=calendar.fromTotalDays(mappedDay(entry.totalDays));Object.assign(entry,d);if(entry.turn!==undefined)entry.turn=monthIndex(d)+1;}
      if(entry.battle)for(const group of ['attackerGenerals','defenderGenerals'])entry.battle[group]?.forEach(g=>{g.leadership=generals.find(base=>base.id===g.id)?.leadership??45;});
    });
    // v3 could retain a previous captor after a city changed hands. Recover the
    // present city's custody without deleting an officer or exceeding its slots.
    for(const g of s.generals.filter(g=>g.status==='prisoner')){
      const c=getCity(s,g.cityId);if(c.owner===g.captor)continue;
      if(c.owner===g.faction){
        Object.assign(g,{captor:null,capturedDay:null,capturedTurn:null});
        if(cityGenerals(s,c.id).length<getOfficerCapacity(s,c))g.status='serving';
        else{const a=createArmy(s,c.id,c.id,c.owner,'reinforce',emptyUnits(),[g],50,70,'steady',1);a.progress=1;a.elapsedDays=1;a.waiting=true;}
      }else if(factionIds.includes(c.owner))g.captor=c.owner;
    }
    activateAdministration(s);s.cities.forEach(c=>normalizeCity(s,c));syncActions(s);activateSeasonTurns(s);activateAging(s);
    addRoster(s);upgradeRatings(s);
    activateCommands(s,Object.fromEntries(input.cities.map(c=>[c.id,c.periodActions])));
    addMap(s);
    activateLeadership(s);
    upgradeDiplomacy(s);
    activateRecruitment(s);s.troopSystem='officer-types-v1';upgradeBalance(s);
    return validateState(s)?s:null;
  }
  return {aiPersonality,BALANCE_REVISION,armyCommand,officerCommand,cityTroopAssignments,commonRecruitmentStatus,ignoreTalent,isTalentIgnored,persuasionOffer,DATA,scenario:DATA,RULES,AGING,ROSTER_REVISION,MAP_REVISION,DIPLOMACY,ALLIANCE_GIFTS,OPENING_ALLIANCES,areAllied,allianceBetween,allies,allianceEnvoys,allianceOffer,proposeAlliance,marchRoute,marchPlan,reachableTargets,armyEta,leadershipInfo,chooseSuccessor,syncLeadership,serviceInfo,effectiveStats,refreshAging,characterBackground,rosterOverview,factionTalentGuide,recruitmentAffinity,openingProfile,createGame,getCity,getFaction,ownedCities,neighbors,cityGenerals,availableGenerals,commandCapacity,
    calendarInfo,aiDecisionPeriod,commandStatus,getTroopCapacity,getOfficerCapacity,officerSlots,reservedTroops,availableProjectOfficers,cityOrders,actionAvailability,actionOffer,develop,recruit,recruitTroops,assignGeneral,setGovernor,setAssignment,setRecruitment,autoAssign,autoAssignOffer,cancelProject,trainTroops,searchTalent,searchChance,busySearching,availableTalents,hireTalent,hireOffer,relationship,factionStrength,allianceGift,goodwillOffer,sendGoodwill,submissionOffer,proposeSubmission,
    prisoners,captureChance,isFactionEliminated,persuasionEnvoys,persuasionChance,persuadePrisoner,releasePrisoner,executePrisoner,transfer,moveGenerals,prepareBattle,resolveBattle,pendingBattleInfo,chooseSiege,estimateBattle,
    dispatchOffer,dispatchArmy,dispatchTransfer,recallArmy,travelTime,advanceDays,incomePreview,cityIncomePreview,endTurn,validateState,migrateState,costs};
});
