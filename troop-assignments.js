(function (root, factory) {
  'use strict';
  const assignments = factory();
  if (typeof module === 'object' && module.exports) module.exports = assignments;
  root.TKTroopAssignments = assignments;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Fixed command specialties are a game adaptation of biographies, novel
  // imagery and existing roles, not historical claims of exclusive troop use.
  // Crossbow also represents the game's single ranged branch; scout includes
  // reconnaissance, light raiding and tactical feints. See qa/troop-research.md.
  const rows = `
caocao|cavalry|以机动统军和集中突击的统帅定位编为骑兵。
xiahou|spear|以刚烈前锋与近阵作战定位编为枪兵。
xiahouyuan|crossbow|结合演义射艺形象，担任可配合快速推进的远攻将领。
caoren|shield|取守樊城、稳固军心的守将形象，编为盾兵。
dianwei|shield|取近身护卫与坚守营门的形象，编为重装盾兵。
xunyu|crossbow|以军政筹划和秩序协同定位，指挥纪律性远攻部队。
chengyu|shield|以持重守备与危局支撑定位，指挥盾阵。
yujin|spear|以治军严整、阵列齐整的定位编为枪兵。
yuejin|spear|以先登攻坚的先锋定位编为枪兵。
lvbu|cavalry|以善弓马、飞将突阵的形象编为骑兵。
zhangliao|cavalry|以果断突击和追击破阵的定位编为骑兵。
gaoshun|shield|以陷阵部队的精甲与整肃步军形象编为盾兵。
chengong|scout|以察敌、伏击和侧翼谋划定位编为斥候。
diaochan|scout|依连环周旋的演义形象，编为侦察与扰敌部队。
liubei|shield|以凝聚部众、稳住主阵的统帅定位编为盾兵。
guanyu|cavalry|取策马突阵的勇将形象，编为骑兵。
zhangfei|spear|结合长矛与正面威慑的演义形象，编为枪兵。
jianyong|scout|以交涉、察访和通晓人情的定位编为斥候。
sunce|cavalry|取亲率骑从、快速突击的勇将形象，编为骑兵。
zhouyu|crossbow|以统筹江防、协同远攻的儒将定位编为弩兵。
chengpu|spear|结合持矛突围与久经战阵的宿将形象，编为枪兵。
huanggai|shield|取披甲攻坚与坚毅老将的形象，编为盾兵。
zhangzhao|shield|以法度、秩序和稳固后方的定位编为盾兵。
zhuzhi|spear|以整军安民、稳步进取的步军定位编为枪兵。
lufan|crossbow|以军需组织和战阵协同定位，指挥远攻部队。
yuanshao|spear|以河北大军的正面阵列定位编为枪兵。
yanliang|cavalry|以河北先锋、正面冲击的勇将形象编为骑兵。
wenchou|cavalry|以河北骁骑、追击冲锋的形象编为骑兵。
zhanghe|spear|以识地形、善列阵的巧变统军定位编为枪兵。
tianfeng|crossbow|以预判战局与长策协同的谋臣定位编为弩兵。
jushou|shield|以统军持重、稳固要冲的定位编为盾兵。
xuyou|scout|取察敌粮道、寻隙献策的形象，编为斥候。
yuanshu|shield|以淮南据点和主阵守备的玩法定位编为盾兵。
jiling|spear|结合三尖兵刃与正面重兵的演义形象，编为枪兵。
gongsunzan|cavalry|取幽州突骑与白马义从形象，编为骑兵。
zhaoyun|cavalry|本传记载为刘备主骑，结合突围护卫形象编为骑兵。
tianyu|scout|以边地侦察、应变与轻兵防袭的定位编为斥候。
mateng|cavalry|依西凉军与骑战统军的整体形象编为骑兵。
machao|cavalry|依关陇骑战与骁勇冲阵的形象编为骑兵。
pangde|cavalry|取西军先锋与骑战勇烈的形象，编为骑兵。
hansui|scout|依熟悉西凉地势、周旋机变的定位编为轻装斥候。
lijue|cavalry|依凉州军出身与机动强攻的形象编为骑兵。
guosi|cavalry|依西凉兵锋与突击定位编为骑兵。
jiaxu|scout|以审敌、设伏与奇袭筹划的谋臣定位编为斥候。
zhangji|cavalry|依凉州宿将与边郡机动部队的定位编为骑兵。
liubiao|shield|以荆州经营和城防主阵的定位编为盾兵。
caimao|crossbow|把荆襄江防协同映射为本作的远攻兵种。
huangzu|crossbow|把据江设防和远射阻击映射为弩兵。
kuaiyue|scout|以察势筹略、联络地方的定位编为斥候。
huangzhong|crossbow|依演义神射老将形象，归入本作唯一远攻兵种。
liuzhang|shield|以蜀地守成和城防主阵的玩法定位编为盾兵。
zhangren|spear|依蜀地险道设防、扼守要冲的形象编为枪兵。
yanyan|shield|取巴郡守土、坚定老将的形象，编为盾兵。
huangquan|crossbow|以审察山川与组织江防的定位编为弩兵。
zhanglu|shield|以汉中山关自守和凝聚部众的定位编为盾兵。
yanpu|scout|以审势进退、熟悉山道的辅谋定位编为斥候。
liuyao|spear|依江东驻防和阻击来军的玩法定位编为枪兵。
taishici|crossbow|本传有善射记载，将射艺归入本作唯一远攻兵种。
wanglang|crossbow|以文臣筹划和城防远攻的玩法定位编为弩兵。
taoqian|shield|以徐州守土和稳固主阵的玩法定位编为盾兵。
mizhu|shield|以物资保障和稳固后阵的玩法定位编为盾兵。
chengui|scout|以观察局势、地方周旋的谋臣定位编为斥候。
chendeng|crossbow|以军政协同和据城应敌的定位编为弩兵。
kongrong|crossbow|以文臣筹划和据城远攻的玩法定位编为弩兵。
xuchu|shield|取虎士宿卫和近身护主的形象，编为重装盾兵。
guojia|scout|以洞察敌势、谋划奇袭的谋臣定位编为斥候。
ganning|scout|以轻军袭营、快速穿插的形象编为斥候。
xuhuang|spear|以治军严整、长驱破阵的步军定位编为枪兵。
lusu|shield|以统筹江防、稳固战线的儒将定位编为盾兵。
zhugeliang|crossbow|本传有改良连弩记载，结合严整治军定位编为弩兵。
jiangwei|spear|以统军韬略和正面步阵兼备的定位编为枪兵。
xushu|scout|以识阵、察敌与游侠机变的形象编为斥候。
fazheng|scout|以察地形、择战机和奇策突袭的定位编为斥候。
weiyan|spear|以勇烈精兵、攻取要冲的定位编为枪兵。
pangtong|scout|以谋划侧击、出奇制胜的谋臣定位编为斥候。
sunshangxiang|crossbow|按现有武艺与轻军应变的定位，编为轻装远攻部队。
zhurong|scout|依演义中山地与投掷兵刃形象，编为轻装斥候。
huangyueying|crossbow|以现有巧思与筹划的人物定位，编为远攻弩兵。
daqiao|shield|按礼贤安众的文臣玩法定位，指挥守备盾阵。
xiaoqiao|crossbow|按谋思协同的文臣玩法定位，指挥远攻部队。
sunquan|shield|以统合将士、坐镇江东的统帅定位编为盾兵。
wuanguo|spear|依演义重兵刃勇将形象，编为正面近战枪兵。
zhouxin|spear|以会稽守境与领兵迎敌的定位编为枪兵。
luxun|crossbow|以审敌、整军和协同打击的儒将定位编为弩兵。`.trim().split('\n');

  const assignments = Object.freeze(Object.fromEntries(rows.map(row => {
    const [id, type, reason] = row.split('|');
    return [id, Object.freeze({type, reason})];
  })));
  const common = Object.freeze({military:'spear', civil:'scout'});
  const sources = Object.freeze([
    {id:'rotk14-deploy',title:'三国志14 官方指南：出阵的步骤',url:'https://www.gamecity.com.tw/manual/sangokushi14/sc/5100.html'},
    {id:'rotk14-tactics',title:'三国志14 官方指南：作战的基本',url:'https://www.gamecity.com.tw/manual/sangokushi14/7100.html'},
    {id:'sgz07',title:'三国志卷七：吕布传及高顺相关记载',url:'https://zh.wikisource.org/wiki/三國志/卷07'},
    {id:'sgz08',title:'三国志卷八：公孙瓒等传',url:'https://zh.wikisource.org/wiki/三國志/卷08'},
    {id:'sgz09',title:'三国志卷九：诸夏侯曹传',url:'https://zh.wikisource.org/wiki/三國志/卷09'},
    {id:'sgz17',title:'三国志卷十七：张乐于张徐传',url:'https://zh.wikisource.org/wiki/三國志/卷17'},
    {id:'sgz18',title:'三国志卷十八：许褚、典韦等传',url:'https://zh.wikisource.org/wiki/三國志/卷18'},
    {id:'sgz35',title:'三国志卷三十五：诸葛亮传',url:'https://zh.wikisource.org/wiki/三國志/卷35'},
    {id:'sgz36',title:'三国志卷三十六：关张马黄赵传',url:'https://zh.wikisource.org/wiki/三國志/卷36'},
    {id:'sgz49',title:'三国志卷四十九：刘繇、太史慈等传',url:'https://zh.wikisource.org/wiki/三國志/卷49'},
    {id:'sgz55',title:'三国志卷五十五：程普、黄盖、甘宁等传',url:'https://zh.wikisource.org/wiki/三國志/卷55'},
    {id:'sgyy53',title:'三国演义第五十三回：关羽、黄忠交锋',url:'https://zh.wikisource.org/wiki/三國演義/第053回'},
    {id:'sgyy56',title:'三国演义第五十六回：铜雀台比射',url:'https://zh.wikisource.org/wiki/三國演義/第056回'},
    {id:'sgyy90',title:'三国演义第九十回：祝融夫人',url:'https://zh.wikisource.org/wiki/三國演義/第090回'}
  ].map(source => Object.freeze(source)));

  return Object.freeze({revision:'fixed-troops-20261015',assignments,common,sources});
});
