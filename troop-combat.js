(function(root,factory){'use strict';const common=typeof module==='object'&&module.exports;const api=factory(common?require('./troops.js'):root.TKTroops);if(common)module.exports=api;root.TKTroopCombat=api;})(globalThis,function(T){
  'use strict';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),clone=x=>JSON.parse(JSON.stringify(x));
  const sum=rows=>rows.reduce((n,c)=>n+c.troops,0);
  function quality(g,type){const w=T.definitions[type].forceWeight,force=g.force??35,mind=g.intellect??35,skill=['crossbow','scout'].includes(type)?Math.max(force,mind)*.75+Math.min(force,mind)*.25:force*w+mind*(1-w);return {attack:.55+(g.leadership??35)*.006+skill*.006+Math.min(100,g.xp||0)*.0005,defense:.7+(g.leadership??35)*.006+skill*.002};}
  function terrainFactor(type,terrain){if(terrain==='plain')return type==='cavalry'?1.08:1;if(terrain==='mountain')return type==='cavalry'?.85:type==='scout'?1.08:type==='crossbow'?1.05:1;if(terrain==='river')return type==='cavalry'?.92:type==='crossbow'?1.06:1;return 1;}
  function tacticFactor(tactic,g,enemy){if(tactic==='assault')return 1.12;if(tactic==='flank')return 1+clamp(((g.intellect??35)-(enemy?.intellect??35))*.0025,-.08,.12);return 1;}
  function target(rows,index){if(rows[index]&&!rows[index].routed)return {index,support:false};const viable=rows.map((c,i)=>({c,i})).filter(x=>!x.c.routed);viable.sort((a,b)=>Math.abs(a.i-index)-Math.abs(b.i-index)||a.i-b.i);return viable.length?{index:viable[0].i,support:true}:null;}
  function sideRows(b,side){return T.formation(b[side+'Generals'],b[side==='attacker'?'attackers':'defenders']);}
  function factors(b,side,c,enemy,tactic){const q=quality(c.general,c.type),condition=(.8+(b[side+'Training']??25)*.004)*(.8+(b[side+'Morale']??75)*.003),terrain=terrainFactor(c.type,b.terrain),wall=side==='defender'?1+(b.wall||0)*.08:1;return {q,condition,terrain,wall,counter:1+T.counter(c.type,enemy?.type),tactic:tacticFactor(tactic,c.general,enemy?.general)};}
  function powers(b,tactic='steady'){
    const rows={attacker:sideRows(b,'attacker'),defender:sideRows(b,'defender')};
    const summarize=(side,tac)=>{const enemy=side==='attacker'?'defender':'attacker',total=sum(rows[side])||1,result={command:0,counter:0,terrain:0,condition:0,tactic:0};rows[side].forEach((c,i)=>{const other=rows[enemy][target(rows[enemy],i)?.index],f=factors(b,side,c,other,tac),w=c.initial/total;result.command+=w*f.q.attack;result.counter+=w*f.counter;result.terrain+=w*f.terrain;result.condition+=w*f.condition;result.tactic+=w*f.tactic;});return result;};
    const a=summarize('attacker',tactic),d=summarize('defender',b.defenderTactic||'steady'),wall=1+(b.wall||0)*.08;
    return {attack:b.attackers*a.command*a.counter*a.terrain*a.condition*a.tactic,defense:b.defenders*d.command*d.counter*d.terrain*d.condition*d.tactic*wall,attackCommand:a.command,defenseCommand:d.command,attackerCounter:a.counter,defenderCounter:d.counter,attackTerrain:a.terrain,defenseTerrain:d.terrain,attackTraining:a.condition,defenseTraining:d.condition,attackMorale:1,defenseMorale:1,strategy:a.tactic,defenseAbility:d.tactic,defenseWall:wall};
  }
  // Every replay frame comes from these simultaneous exchanges. No visual-only
  // casualty curve: ordering, individual abilities and counters change outcomes.
  function simulate(b,tactic='steady'){
    const rows={attacker:sideRows(b,'attacker'),defender:sideRows(b,'defender')},initial={attacker:b.attackers,defender:b.defenders};let seed=b.seed>>>0;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const frames=[],snapshot=events=>({attacker:rows.attacker.map(c=>({troops:c.troops,routed:c.routed})),defender:rows.defender.map(c=>({troops:c.troops,routed:c.routed})),events});
    frames.push(snapshot([]));let winner=b.defenders===0?'attacker':null;
    for(let round=1;round<=2048&&!winner;round++){
      const losses={attacker:rows.attacker.map(()=>0),defender:rows.defender.map(()=>0)},events=[];
      for(const side of ['attacker','defender']){const other=side==='attacker'?'defender':'attacker',tac=side==='attacker'?tactic:b.defenderTactic||'steady';
        rows[side].forEach((c,i)=>{if(c.routed)return;const aim=target(rows[other],i);if(!aim)return;const enemy=rows[other][aim.index],f=factors(b,side,c,enemy,tac),dq=quality(enemy.general,enemy.type),enemyTactic=other==='attacker'?tactic:b.defenderTactic||'steady';
          const wall=other==='defender'?1+(b.wall||0)*.08:1,guard=enemyTactic==='steady'?1.06:enemyTactic==='assault'?.94:1;
          const damage=Math.max(1,Math.round(Math.pow(c.troops,.9)*.16*(1+Math.max(0,round-40)*.035)*f.q.attack*f.condition*f.terrain*f.counter*f.tactic*(aim.support?.55:1)*(.96+random()*.08)/(dq.defense*wall*guard)));
          losses[other][aim.index]+=damage;events.push({side,from:i,to:aim.index,damage,support:aim.support,counter:Math.round((f.counter-1)*100)});
        });
      }
      for(const side of ['attacker','defender'])rows[side].forEach((c,i)=>{if(c.routed)return;c.troops=Math.max(0,c.troops-losses[side][i]);if(c.troops===0)c.routed=true;});
      frames.push(snapshot(events));
      const broken=side=>sum(rows[side])===0,ab=broken('attacker'),db=broken('defender');
      if(ab||db)winner=ab&&db?(sum(rows.attacker)/Math.max(1,initial.attacker)>sum(rows.defender)/Math.max(1,initial.defender)?'attacker':'defender'):db?'attacker':'defender';
    }
    // Positive minimum damage plus late-round pressure guarantees depletion.
    if(!winner)throw new Error('Combat did not reach depletion');
    return {version:'lanes-v2',winner,rounds:frames.length-1,initial:{attacker:rows.attacker.map(c=>({generalId:c.general.id,type:c.type,troops:c.initial})),defender:rows.defender.map(c=>({generalId:c.general.id,type:c.type,troops:c.initial}))},frames,attackersRemaining:sum(rows.attacker),defendersRemaining:sum(rows.defender)};
  }
  return {simulate,powers,quality,terrainFactor,commandProfile:T.commandProfile,formation:T.formation};
});
