(function(root){
  'use strict';
  let api;
  const seasons = {
    spring:{name:'春',title:'春耕备战',months:'3—5 月',detail:'募兵所需粮草 −5%',note:'天气渐暖，整军募兵的粮食支出略减。'},
    summer:{name:'夏',title:'江河丰水',months:'6—8 月',detail:'河道行军时间 +10%',note:'河道涨水；向江河据点行军稍慢，出征时计入抵达时间。'},
    autumn:{name:'秋',title:'秋收蓄粮',months:'9—11 月',detail:'本城产粮 +10%',note:'收获时节，月结粮食收入略增，适合准备远征。'},
    winter:{name:'冬',title:'寒冬休整',months:'12—2 月',detail:'山道行军 +15% · 军粮消耗 +5%',note:'山道积雪，部队行军与日常粮草开销略有增加。'}
  };
  function render(){
    if(!api)return;
    const info=api.E.calendarInfo(api.getState()),entry=seasons[info.season.id]||seasons.summer;
    document.body.dataset.season=info.season.id;
    const term=info.term?`今日 · ${info.term.name}`:`距${info.nextTerm.name} ${info.nextTerm.inDays} 日`;
    document.getElementById('season-strip').innerHTML=`<strong class="season-current">${entry.name}季</strong><span class="season-remaining">距下一季 ${info.daysToNextPeriod} 日</span><span class="season-effect">${entry.detail}</span><button id="open-almanac" class="map-text-button" title="${api.esc(term)} · 一年四季规则">节令说明</button>`;
    document.getElementById('open-almanac').onclick=show;
  }
  function show(){
    const c=api.E.calendarInfo(api.getState());
    api.dialog('四时节令','一年 4 回合 · 365 日',`<p class="dialog-description">部署后点“推进一季”；遇到紧急军情会暂停，处理后继续本季。每月收支与内政自动结算，节气仅作提醒。</p><p class="season-next">当前${c.season.name}季 · 距下一季 ${c.daysToNextPeriod} 日</p><div class="season-grid">${Object.entries(seasons).map(([id,s])=>`<article class="season-rule ${id} ${id===c.season.id?'active':''}"><span>${s.name}</span><small>${s.months}</small><strong>${s.detail}</strong></article>`).join('')}</div><details class="campaign-details"><summary>推进与日历规则</summary><p class="dialog-description">每季三个月，遇敌军攻我方、我方交战、势力灭亡或我方文武年限变化时暂停。处理后继续到同一个下季首，不另算回合。自动运行也会在下季首暂停。月份按 28 / 30 / 31 日计算，不设闰年。</p><p class="dialog-description">${c.term?'今日节气：'+c.term.name:'下个节气：'+c.nextTerm.name+'，还有 '+c.nextTerm.inDays+' 日'}。24 节气使用游戏固定日期。季节效果已计入支出、行军时间与月度收支。</p></details>`,`<button class="primary-button" data-close>返回地图</button>`,'medium');
  }
  root.TKSeasons={mount(a){api=a;},render,show};
})(globalThis);
