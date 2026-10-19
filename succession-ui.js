(function(root){
  'use strict';
  let api=null,session=null,seen=new Set(),pendingShown=null,wasVisible=false,committing=false;
  const state=()=>api.getState(),node=id=>document.getElementById(id),esc=value=>api.esc(value),fmt=value=>api.fmt(value);
  const visible=()=>api.isGameVisible?.()!==false&&api.hasCampaign?.()!==false;
  const busy=()=>!!root.TKCampaign?.busy;
  const pause=()=>root.TKCampaign?.pause?.();
  const eventKey=e=>e.id||`${e.faction}:${e.type}:${e.totalDays}:${e.leaderId||''}:${e.regentId||''}`;
  const events=()=>state().successionEvents||[];
  const remember=()=>events().forEach(e=>seen.add(eventKey(e)));
  function sync(){
    const current=state(),showing=visible();
    if(current!==session){session=current;seen=new Set(events().map(eventKey));pendingShown=null;wasVisible=false;}
    if(showing&&!wasVisible)pendingShown=null;
    wasVisible=showing;
  }
  function portrait(g){
    if(!g)return '<span class="succession-seal" aria-hidden="true">府</span>';
    return root.TKPeople?.portrait?.(g)||`<span class="portrait">${root.TKPortraits?.render?.(g)||`<span>${esc(g.name)}</span>`}</span>`;
  }
  function pendingKey(info){
    const latest=events().filter(e=>e.faction===state().player&&e.type==='pending').at(-1);
    return `${state().player}:${info.leader?.id||''}:${info.reason||''}:${latest?eventKey(latest):''}`;
  }
  function description(info){
    if(info.status==='regency')return `${info.leader?.name||'原君主'}被俘，由${info.regent?.name||'军府'}暂代政务；救回后自动复位。`;
    if(info.status==='pending')return `${info.leader?.name||'原君主'}${info.leader?.status==='retired'?'已退隐':info.leader?.status==='dead'?'已故':'已离任'}，请选择继任者。`;
    if(info.status==='vacant')return '暂时没有合资格继任者，由军府暂代。招募我方文武后再择新主。';
    if(info.status==='eliminated')return '本方势力已经灭亡，传承记录留存。';
    return `${info.leader?.name||'君主'}统领本方；被俘由他人代政，离世或退隐后另立继任者。`;
  }
  function person(g,label){return `<div class="succession-person">${portrait(g)}<span><small>${esc(label)}</small><strong>${esc(g?.name||'军府暂代')}</strong></span></div>`;}
  function history(){
    const records=events().slice().reverse();
    return `<details class="succession-history"><summary>传承纪事 · ${records.length} 条</summary>${records.length?`<ol>${records.map(e=>{
      const date=api.E.calendarInfo(e.totalDays),f=api.E.getFaction(state(),e.faction);
      return `<li><small>${date.year}年${date.month}月${date.day}日 · ${esc(e.factionName||f?.name||e.faction)}</small><p>${esc(e.message||'传承变更已记入本纪。')}</p></li>`;
    }).join('')}</ol>`:'<p>尚无传承变更。</p>'}</details>`;
  }
  function render(){
    if(!api)return;sync();const host=node('leadership-status');if(!host)return;
    const info=api.E.leadershipInfo(state());
    if(info.status==='pending'&&visible())pause();
    host.hidden=false;host.setAttribute('data-status',info.status);
    const who=info.status==='regency'?`${person(info.leader,'君主被俘')}<span class="succession-arrow" aria-hidden="true">→</span>${person(info.regent,'暂代政务')}`:person(info.status==='vacant'?null:info.leader,info.status==='pending'?'待定继任':info.status==='vacant'?'君位空缺':info.status==='eliminated'?'传承留档':'君主');
    const hint=info.status==='normal'?'':`<small class="succession-strip-note">${esc(description(info))}</small>`;
    host.innerHTML=`<div class="succession-strip">${who}${hint}<button type="button" class="${info.status==='pending'?'primary-button':'secondary-button'}" data-succession-council>${info.status==='pending'?'选择继任者':'查看传承'}</button></div>`;
    host.querySelector('[data-succession-council]').onclick=showCouncil;
  }
  function openCouncil(selectedId=null){
    if(!api||node('battle-dialog')?.open)return false;sync();
    const expected=state(),info=api.E.leadershipInfo(expected),pending=info.status==='pending',candidates=info.candidates||[],selected=candidates.find(c=>c.general.id===selectedId)?.general;
    if(pending){pause();pendingShown=pendingKey(info);}remember();
    const selection=pending?`<section class="succession-selection"><p class="succession-note">选择一位已加入本方的文武继位。确认后立即生效，不消耗金粮或军令。</p><div class="succession-candidates">${candidates.map(({general:g,recommended})=>`<button type="button" class="succession-candidate${g.id===selected?.id?' selected':''}" data-successor="${esc(g.id)}" aria-pressed="${g.id===selected?.id}">${portrait(g)}<span><strong>${esc(g.name)}</strong>${recommended?'<em>推荐</em>':''}<small>统 ${fmt(g.leadership)} · 政 ${fmt(g.politics)} · 魅 ${fmt(g.charisma)}</small></span><b>${g.id===selected?.id?'已选择':'选择'}</b></button>`).join('')||'<p>暂无可选人物。招募我方文武后再择新主。</p>'}</div></section>`:'';
    const office=`<div class="succession-office">${person(info.leader,pending||info.status==='vacant'?'前任君主':'君主')}${info.status==='regency'?person(info.regent,'暂代政务'):''}</div>`;
    const footer=`<button type="button" class="secondary-button" data-close>${pending?'稍后决定':'返回天下'}</button>${pending?`<button type="button" class="primary-button" data-confirm-successor${!selected?' disabled':''}>${selected?`确认由${esc(selected.name)}继位`:'先选择继任者'}</button>`:''}`;
    api.dialog(pending?'择立新主':'君主与传承',pending?'天下已暂停 · 等候决断':'本方传承',`${office}<p class="succession-description">${esc(description(info))}</p>${selection}${history()}`,footer,pending?'wide':'medium');
    node('dialog-content').querySelectorAll('[data-successor]').forEach(button=>button.onclick=()=>openCouncil(button.dataset.successor));
    const confirm=node('dialog-content').querySelector('[data-confirm-successor]');
    if(confirm)confirm.onclick=()=>{
      if(!selected)return;
      if(state()!==expected){api.toast('征程已变更，请重新选择继任者。');showCouncil();return;}
      if(busy()||!visible()||state().status!=='playing')return;
      const current=api.E.leadershipInfo(state());
      if(current.status!=='pending'||!current.candidates.some(c=>c.general.id===selected.id)){api.toast('此人当前无法继位，请重新选择。');showCouncil();return;}
      committing=true;
      try{
        const result=api.E.chooseSuccessor(state(),selected.id);
        if(!result?.ok){api.toast(result?.message||'当前无法继位。');return;}
        remember();api.save();api.render();
        const next=api.E.leadershipInfo(state()).leader||selected;
        api.dialog('新主继位','传承已定',`<div class="succession-celebration">${portrait(next)}<span class="succession-kicker">众望所归</span><h3>${esc(next.name)}继位</h3><p>${esc(result.message||'新任君主已统领本方，征程继续。')}</p><small>不消耗金粮或军令，人物年限与原有军队保持原状。</small></div>`,`<button type="button" class="primary-button" data-close>继续征程</button>`,'medium');
      }finally{committing=false;}
    };
    if(pending)(selected?confirm:node('dialog-content').querySelector('[data-successor]'))?.focus?.();
    return true;
  }
  function showCouncil(){return openCouncil();}
  function maybeShow(){
    if(!api)return false;sync();
    if(committing||!visible()||busy()||document.hidden||node('main-dialog')?.open||node('battle-dialog')?.open||state().status!=='playing')return false;
    const info=api.E.leadershipInfo(state());
    if(info.status==='pending'){
      pause();if(pendingShown!==pendingKey(info))return openCouncil();
      return false;
    }
    const fresh=events().filter(e=>!seen.has(eventKey(e))&&['regency','restored','succession','vacant'].includes(e.type));
    if(!fresh.length)return false;
    pause();remember();
    api.dialog('传承消息','天下传承已更新',`<div class="succession-messages">${fresh.map(e=>`<p>${esc(e.message||'传承变更已记入本纪。')}</p>`).join('')}</div><p class="succession-note">完整记录可从君主旁的“查看传承”再次查看。</p>`,`<button type="button" class="secondary-button" data-succession-history>查看传承</button><button type="button" class="primary-button" data-close>知晓</button>`,'medium');
    node('dialog-content').querySelector('[data-succession-history]').onclick=showCouncil;return true;
  }
  function mount(nextApi){api=nextApi;session=state();seen=new Set(events().map(eventKey));pendingShown=null;wasVisible=visible();render();}
  root.TKSuccession={mount,render,maybeShow,showCouncil};
})(globalThis);
