(function (root, factory) {
  'use strict';
  const scenario = factory(typeof module === 'object' && module.exports ? require('./officer-ratings.js') : root.TKOfficerRatings);
  if (typeof module === 'object' && module.exports) module.exports = scenario;
  root.TKScenario = scenario;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (ratings) {
  'use strict';
  // Original compact scenario. The date and broad political situation follow the
  // official ROTK XIV scenario reference; coordinates approximate real geography.
  // This is neither an extraction of that game's map nor a historical census.
  const projection = { originX:80, originY:76, originLongitude:102, originLatitude:40, scaleX:70, scaleY:64 };
  const factionRows = [
    ['wei','曹操','caocao','曹','#557fa2','chenliu','陈留、许昌连成腹地，虎牢屏护西线；人才充足，仍须防范吕布与袁术。'],
    ['shu','刘备','liubei','刘','#4e8b68','xiaopei','小沛立足，兄弟同心；在徐州争衡中寻求一席之地。'],
    ['wu','孙策','sunce','孙','#bf6650','lujiang','以程普、黄盖等旧部立足江淮，孙权提前加入辅佐；周瑜、张昭须寻访礼聘，再向江东开拓。'],
    ['qun','袁绍','yuanshao','袁','#a07bab','ye','邺、南皮支撑河北，西通晋阳、南临中原；先稳腹地，再择路进取。'],
    ['lvbu','吕布','lvbu','吕','#b56383','puyang','据濮阳突起，以强将与骑兵切入中原腹地。'],
    ['yuanshu','袁术','yuanshu','术','#bc9847','shouchun','据寿春经营淮南，可向广陵开拓；守住中原与江东之间的水陆通道。'],
    ['gongsunzan','公孙瓒','gongsunzan','公','#8498aa','ji','白马义从驰骋幽州，与袁绍争夺河北。'],
    ['mateng','马腾','mateng','马','#b98455','wuwei','西凉铁骑，疆域辽阔；自天水向关中进取。'],
    ['lijue','李傕','lijue','李','#967b68','changan','控制关中与关隘，东出有险，西向有敌。'],
    ['liubiao','刘表','liubiao','表','#61938c','xiangyang','荆襄水网纵横，扼南北要冲，宜先固内政。'],
    ['liuzhang','刘璋','liuzhang','璋','#7a9960','chengdu','益州沃野，山关环护；以成都为根本经营西南。'],
    ['zhanglu','张鲁','zhanglu','鲁','#a19469','hanzhong','汉中自守，秦岭环护；可先经营上庸，再向关中或蜀道进取。'],
    ['liuyao','刘繇','liuyao','繇','#6c91a0','jianye','据建业扼大江，与孙策争夺江东门户。'],
    ['wanglang','王朗','wanglang','王','#b1857c','kuaiji','会稽文教之地，东南经营尚待展开。'],
    ['taoqian','陶谦','taoqian','陶','#8d9779','xiapi','徐州人口富庶，地处诸强交界，守土需善用人才。'],
    ['kongrong','孔融','kongrong','孔','#9d8eaf','beihai','北海孤城，士望深厚；先育人才，再求外援。']
  ];
  const factionColors = {wei:'#306DAD',shu:'#B99120',wu:'#C74F35',qun:'#8A54A4',lvbu:'#B93F74',yuanshu:'#24835B',gongsunzan:'#60859D',mateng:'#C3782F',lijue:'#80513D',liubiao:'#158E8B',liuzhang:'#62516F',zhanglu:'#344D6C',liuyao:'#288CAB',wanglang:'#A96150',taoqian:'#846E5C',kongrong:'#685AB5'};
  const factions = factionRows.map(([id,name,leaderId,flag,_color,capital,description]) => ({ id,name,leader:name,leaderId,flag,color:factionColors[id],capital,description,gold:1000,grain:2800 }));
  // id | name | longitude | latitude | owner | troops | terrain | region | tier | description
  const cityRows = `
ji|蓟|116.40|39.90|gongsunzan|1500|plain|幽州|major|幽州治所，可西取晋阳、南下河北。
jinyang|晋阳|112.55|37.87|neutral|550|mountain|并州|city|太原盆地重镇，南下须穿行太行山口。
nanpi|南皮|116.70|38.05|qun|1100|plain|冀州|city|冀州东部粮区，可接应幽州与青州。
ye|邺|114.63|36.33|qun|1900|plain|冀州|major|河北腹地，地广粮丰，袁氏经营的根本。
beihai|北海|118.48|36.70|kongrong|1000|plain|青州|city|青州东部文教之地，面海而背接中原。
puyang|濮阳|115.03|35.76|lvbu|1650|river|兖州|city|黄河南侧要地，可威胁陈留与河北渡口。
chenliu|陈留|114.57|34.75|wei|1850|plain|兖州|major|中原交通枢纽，四面道路也是四面战线。
xiaopei|小沛|116.95|34.73|shu|1200|plain|徐州|city|徐州西北门户，靠近中原诸军争衡之地。
xiapi|下邳|117.95|34.31|taoqian|1550|river|徐州|major|泗水流域重城，联通小沛、寿春与青州。
xuchang|许昌|113.85|34.05|wei|1000|plain|豫州|city|颍川腹地，与陈留互为支援；本剧本提前安排为曹军经营之地。
luoyang|洛阳|112.45|34.62|neutral|600|plain|司隶|major|故都历经兵火，东西两侧关口仍具战略价值。
changan|长安|108.94|34.34|lijue|1900|plain|关中|major|关中重心，东临潼关，南接汉中山道。
tianshui|天水|105.72|34.58|mateng|1200|mountain|雍凉|city|陇右要地，连接西凉、关中与汉中。
wuwei|武威|102.64|37.93|mateng|1500|plain|雍凉|city|河西走廊东端，养马之地，远征须重补给。
hanzhong|汉中|107.02|33.07|zhanglu|1350|mountain|汉中|city|秦岭与巴山之间的盆地，攻守皆系山间隘口。
chengdu|成都|104.06|30.67|liuzhang|1750|plain|益州|major|蜀地沃野，内政经营的坚实后方。
jiangzhou|江州|106.55|29.57|liuzhang|1100|river|益州|city|两江交汇，沿江东出永安、西援成都。
yongan|永安|109.46|31.02|neutral|500|river|巴东|city|三峡西口，荆州与益州之间的水陆门户。
wan|宛|112.53|32.99|neutral|500|plain|荆州|city|南阳盆地重城，西通关中、南进荆襄，也可接应上庸。
xiangyang|襄阳|112.14|32.04|liubiao|1650|river|荆州|major|汉水要津，荆州北门，军政人才汇聚之处。
jiangling|江陵|112.19|30.35|liubiao|1300|river|荆州|city|江汉平原粮仓，沿江可联结三峡与江夏。
jiangxia|江夏|114.31|30.52|liubiao|1200|river|荆州|city|长江中游水军重镇，守荆州东面门户。
changsha|长沙|112.98|28.20|neutral|480|river|荆南|city|湘水流域中心，北援江陵、江夏，向东可通柴桑。
shouchun|寿春|116.79|32.57|yuanshu|1550|river|扬州|major|淮南中心，田地丰饶，兼顾中原与江东。
lujiang|庐江|116.56|30.62|wu|1450|river|扬州|city|长江北岸据点，孙策经营江东的起点。
jianye|建业|118.78|32.06|liuyao|1400|river|扬州|major|大江下游门户，山川形胜可控江东。
wujun|吴|120.62|31.30|neutral|500|river|江东|city|太湖东侧重镇，河网密布，利于商业。
kuaiji|会稽|120.58|30.00|wanglang|1000|river|江东|city|钱塘江南的东南大郡，农商与文教并重。
chaisang|柴桑|116.00|29.71|wu|1000|river|扬州|city|长江与湖区交接；本剧本安排为孙策沿江开拓的第二据点。
hulao|虎牢|113.15|34.82|wei|650|mountain|司隶|pass|洛阳东面门户，本剧本由曹军驻守，屏护陈留西侧。
tongguan|潼关|110.24|34.54|lijue|700|mountain|关中|pass|黄河与山岭间的狭口，关中东面的坚固屏障。
jiange|剑阁|105.57|32.19|liuzhang|650|mountain|益州|pass|蜀道险关，守一线可屏护成都平原。
jibei|济北|116.45|36.29|neutral|0|plain|兖州|city|本剧本的无主据点，可从小沛、濮阳或北海进驻，作为青兖之间的缓冲。
langya|琅琊|118.35|35.08|neutral|0|plain|徐州|city|北海与下邳之间的东部据点，本剧本无主，可先经营再参与徐州争衡。
guangling|广陵|119.43|32.39|neutral|0|river|扬州|city|江淮之间的水陆据点，本剧本无主，为下邳、建业提供扩张空间。
shangyong|上庸|110.32|32.80|neutral|0|mountain|汉中|city|汉中、巴东与南阳之间的山城，本剧本无主，为汉中势力提供另一条经营路线。`.trim().split('\n');
  const addedCityIds=['jibei','langya','guangling','shangyong'];
  const offsets = { jiange:[-8,10] };
  const cities = cityRows.map(row => {
    const [id,name,lon,lat,owner,troops,terrain,region,tier,description] = row.split('|');
    const [dx,dy] = offsets[id] || [0,0];
    return { id,name,longitude:+lon,latitude:+lat,x:Math.round(80+(+lon-102)*70)+dx,y:Math.round(76+(40-+lat)*64)+dy,
      owner,troops:+troops,generalId:null,kind:tier==='pass'?'pass':'city',tier,officerCapacity:tier==='major'?12:tier==='pass'?4:8,
      terrain,region,description,farm:tier==='pass'?0:tier==='major'?2:1,market:tier==='pass'?0:tier==='major'?2:1,wall:tier==='pass'?3:tier==='major'?2:1 };
  });
  // More substantial armies for all factions, including AI. Solo-city realms
  // have a shared defensive floor; player-only support is still applied later.
  cities.forEach(c=>{
    if(c.owner==='neutral'){if(addedCityIds.includes(c.id))c.farm=c.market=c.wall=0;return;}
    const solo=cities.filter(other=>other.owner===c.owner).length===1;
    c.troops=Math.max(solo?2200:0,Math.round(c.troops*1.8/50)*50);
  });
  // Keep the regional junctions and three defining passes. Removed intermediate
  // settlements become direct roads; coordinates still determine travel time.
  const edges = (`ji-jinyang ji-nanpi jinyang-ye jinyang-luoyang nanpi-ye nanpi-beihai nanpi-puyang ye-puyang puyang-chenliu puyang-xiaopei chenliu-xiaopei chenliu-xuchang chenliu-hulao xiaopei-xiapi xiapi-shouchun xuchang-shouchun xuchang-luoyang xuchang-wan luoyang-hulao luoyang-tongguan tongguan-changan changan-tianshui changan-wan changan-hanzhong tianshui-wuwei tianshui-hanzhong hanzhong-jiange jiange-chengdu chengdu-jiangzhou jiangzhou-yongan yongan-jiangling wan-xiangyang xiangyang-jiangling xiangyang-jiangxia jiangling-jiangxia jiangling-changsha jiangxia-chaisang jiangxia-lujiang jiangxia-changsha shouchun-lujiang shouchun-jianye lujiang-jianye lujiang-chaisang jianye-wujun wujun-kuaiji chaisang-kuaiji chaisang-changsha xiaopei-jibei puyang-jibei beihai-jibei beihai-langya xiapi-langya xiapi-guangling jianye-guangling shouchun-guangling hanzhong-shangyong yongan-shangyong shangyong-wan`).split(/\s+/).map(e=>e.split('-'));
  // Five abilities use the audited base table; roles and traits remain our game design.
  // id | name | allegiance | location | role | rarity | trait | ability
  const generalRows = `
caocao|曹操|wei|chenliu|ruler|legend|雄才：统筹军政，擅长稳步推进。|steady
xiahou|夏侯惇|wei|chenliu|military|renowned|刚烈：亲临前阵，奋勇破敌。|assault
xiahouyuan|夏侯渊|wei|chenliu|military|renowned|疾行：善率轻军寻机突击。|flank
caoren|曹仁|wei|chenliu|military|renowned|坚壁：擅长固守要害。|defense
dianwei|典韦|neutral|chenliu|military|legend|恶来：重甲双戟，近阵骁勇。|assault
xunyu|荀彧|wei|chenliu|civil|legend|王佐：善于治政与识人。|steady
chengyu|程昱|wei|xuchang|civil|renowned|持重：临危审势，善守根本。|defense
yujin|于禁|wei|xuchang|military|renowned|治军：军纪严明，阵势齐整。|steady
yuejin|乐进|wei|hulao|military|renowned|先登：身先士卒攻取坚城。|assault
lvbu|吕布|lvbu|puyang|ruler|legend|飞将：锋芒无双，擅长骑军突击。|assault
zhangliao|张辽|lvbu|puyang|military|legend|突阵：轻骑穿插，直取薄弱处。|flank
gaoshun|高顺|lvbu|puyang|military|renowned|陷阵：步军精锐，攻坚沉着。|assault
chengong|陈宫|lvbu|puyang|civil|renowned|谋断：洞察敌势，策划侧击。|flank
diaochan|貂蝉|lvbu|puyang|civil|renowned|连环：以魅力周旋于诸军之间。|steady
liubei|刘备|shu|xiaopei|ruler|legend|仁望：善于招揽与团结人才。|steady
guanyu|关羽|shu|xiaopei|military|legend|武圣：长刀破阵，勇冠三军。|assault
zhangfei|张飞|shu|xiaopei|military|legend|燕吼：重装先驱，临阵威慑。|assault
jianyong|简雍|shu|xiaopei|civil|common|善谈：通晓人情，适合访贤。|steady
sunce|孙策|wu|lujiang|ruler|legend|小霸王：善率精锐快速破局。|assault
zhouyu|周瑜|neutral|lujiang|civil|legend|雅量：统筹水陆，精于谋略。|flank
chengpu|程普|wu|lujiang|military|renowned|宿将：熟悉江东战阵。|steady
huanggai|黄盖|wu|chaisang|military|renowned|老将：坚毅善战，敢当重任。|assault
zhangzhao|张昭|neutral|wujun|civil|renowned|治世：长于内政与法度。|defense
zhuzhi|朱治|wu|chaisang|military|common|安民：治军与经营兼备。|steady
lufan|吕范|wu|chaisang|civil|common|整肃：精于军需与治理。|steady
yuanshao|袁绍|qun|ye|ruler|legend|名门：河北士众归附，统御声望深厚。|steady
yanliang|颜良|qun|nanpi|military|renowned|河北猛将：擅长正面冲击。|assault
wenchou|文丑|qun|nanpi|military|renowned|骁骑：骑军突击威势凌厉。|assault
zhanghe|张郃|qun|ye|military|renowned|巧变：善察地形，灵活用兵。|flank
tianfeng|田丰|qun|ye|civil|renowned|远谋：分析战局，重视长策。|steady
jushou|沮授|qun|nanpi|civil|renowned|经略：军政兼备，善守要冲。|defense
xuyou|许攸|qun|nanpi|civil|renowned|奇谋：寻隙出策，断敌根本。|flank
yuanshu|袁术|yuanshu|shouchun|ruler|renowned|淮南豪主：坐拥丰饶江淮。|steady
jiling|纪灵|yuanshu|shouchun|military|renowned|三尖：勇猛重兵，稳守南线。|assault
gongsunzan|公孙瓒|gongsunzan|ji|ruler|renowned|白马：善用北地骑兵机动。|flank
zhaoyun|赵云|gongsunzan|ji|military|legend|龙胆：银枪白马，攻守兼备。|flank
tianyu|田豫|gongsunzan|ji|military|renowned|边略：长于北地守备与应变。|defense
mateng|马腾|mateng|wuwei|ruler|renowned|西凉：养马聚众，善领骑军。|flank
machao|马超|mateng|tianshui|military|legend|锦骑：银甲长枪，迅疾突阵。|assault
pangde|庞德|mateng|tianshui|military|renowned|决意：临阵无惧，攻坚勇烈。|assault
hansui|韩遂|mateng|wuwei|military|renowned|纵横：熟悉西凉地势与人情。|flank
lijue|李傕|lijue|changan|ruler|common|关中兵锋：依托关隘固守。|assault
guosi|郭汜|lijue|changan|military|common|悍军：擅长强攻，治理薄弱。|assault
jiaxu|贾诩|lijue|changan|civil|legend|深谋：料敌审势，善策奇袭。|flank
zhangji|张济|lijue|changan|military|common|西军：守御边郡的凉州宿将。|steady
liubiao|刘表|liubiao|xiangyang|ruler|renowned|荆州牧：重视文教与地方经营。|defense
caimao|蔡瑁|liubiao|xiangyang|military|common|水军：熟悉荆襄河道。|steady
huangzu|黄祖|liubiao|jiangxia|military|common|江防：据江夏守长江上游。|defense
kuaiyue|蒯越|liubiao|xiangyang|civil|renowned|筹略：善理政务与荆州形势。|steady
huangzhong|黄忠|liubiao|jiangling|military|legend|神弓：老而弥坚，远射沉稳。|assault
liuzhang|刘璋|liuzhang|chengdu|ruler|common|守成：依托蜀地经营内政。|defense
zhangren|张任|liuzhang|jiange|military|renowned|蜀门：熟识险道，擅长设防。|defense
yanyan|严颜|liuzhang|jiangzhou|military|renowned|巴郡宿将：老当益壮，守土坚定。|defense
huangquan|黄权|liuzhang|chengdu|civil|renowned|审势：善察山川与进退得失。|steady
zhanglu|张鲁|zhanglu|hanzhong|ruler|renowned|教化：安定汉中，凝聚人心。|defense
yanpu|阎圃|zhanglu|hanzhong|civil|common|辅谋：审慎经营山地根本。|steady
liuyao|刘繇|liuyao|jianye|ruler|common|江东刺史：据大江谋守土。|defense
taishici|太史慈|liuyao|jianye|military|legend|信义：弓马娴熟，突击果敢。|flank
wanglang|王朗|wanglang|kuaiji|ruler|renowned|经学：擅治政与兴办文教。|steady
taoqian|陶谦|taoqian|xiapi|ruler|renowned|安徐：善待士人，注重民生。|defense
mizhu|糜竺|taoqian|xiapi|civil|renowned|巨商：筹措资财，善于礼聘。|steady
chengui|陈珪|taoqian|xiapi|civil|renowned|老谋：熟悉徐州人情与局势。|flank
chendeng|陈登|taoqian|xiapi|civil|renowned|兴农：军政兼通，长于经营。|steady
kongrong|孔融|kongrong|beihai|ruler|renowned|文名：士林声望深厚，善于访贤。|steady
xuchu|许褚|neutral|xuchang|military|legend|虎痴：身强力壮，擅长正面冲阵。|assault
guojia|郭嘉|neutral|xuchang|civil|legend|奇佐：洞察敌心，谋划机变。|flank
ganning|甘宁|neutral|jiangxia|military|legend|锦帆：轻舟疾行，善于奔袭。|flank
xuhuang|徐晃|neutral|luoyang|military|renowned|长驱：执斧破阵，治军严整。|steady
lusu|鲁肃|neutral|shouchun|civil|legend|远图：善筹财赋与联结人才。|steady
zhugeliang|诸葛亮|neutral|xiangyang|civil|legend|卧龙：通晓军政，精于谋略与治军。|flank
jiangwei|姜维|neutral|tianshui|military|legend|麒麟：兼通韬略与武艺，长于统军应变。|flank
xushu|徐庶|neutral|wan|civil|renowned|识阵：游侠转而研习兵法，善察敌阵与访贤。|flank
fazheng|法正|neutral|chengdu|civil|renowned|奇策：审势决机，善为险战谋取胜机。|flank
weiyan|魏延|neutral|changsha|military|renowned|镇远：勇烈善战，擅领精兵强攻要冲。|assault
pangtong|庞统|neutral|xiangyang|civil|legend|凤雏：奇思善谋，兼长军略与地方经略。|flank
sunshangxiang|孙尚香|neutral|wujun|military|renowned|英气：偏长武艺与轻军应变，内政并非所长。|flank
zhurong|祝融|neutral|chengdu|military|renowned|烈锋：勇于正面冲阵的演义武将，重武而轻治政。|assault
huangyueying|黄月英|neutral|xiangyang|civil|renowned|巧思：长于研习与筹划，兼顾地方经营。|flank
daqiao|大乔|neutral|lujiang|civil|renowned|礼贤：偏重经营与招揽人才的文臣定位。|steady
xiaoqiao|小乔|neutral|chaisang|civil|renowned|雅望：善以声望延揽人才，偏长谋思。|defense
sunquan|孙权|wu|lujiang|civil|legend|权衡：军政兼备，善于经营地方与延揽人才。|steady
wuanguo|武安国|kongrong|beihai|military|renowned|坚勇：善使铁锤，勇于守土；演义人物。|defense
zhouxin|周昕|wanglang|kuaiji|military|renowned|守境：能领兵守土，兼通文事。|steady
luxun|陆逊|neutral|wujun|civil|legend|儒将：军政兼备，善察敌势与筹划侧击。|flank`.trim().split('\n');
  const generals = generalRows.map(row => {
    const [id,name,faction,cityId,role,rarity,trait,ability] = row.split('|');
    const values=ratings.values[id];if(!values)throw new Error('Missing audited abilities: '+id);
    const charisma=values.charisma;
    return { id,name,faction,cityId,...values,role,rarity,trait,ability,xp:0,
      status:faction==='neutral'?'free':'serving',loyalty:faction==='neutral'?0:85+(charisma%16),
      captor:null,capturedTurn:null,revealedTo:faction==='neutral'?[]:[faction],availableYear:194 };
  });
  // Static biographical associations are separate from live campaign ownership.
  // No entry contains a recruit's hidden city, a hiring lock or a release year.
  const historicalNames={wei:'曹操／曹魏',shu:'刘备／蜀汉',wu:'孙氏／东吴',...Object.fromEntries(factions.filter(f=>!['wei','shu','wu'].includes(f.id)).map(f=>[f.id,f.name]))};
  const historicalOverrides={
    luxun:{factionIds:['wu'],label:'孙氏／东吴',note:'陆逊后来辅佐孙权，军政兼备。本剧本采用群英同世，将其提前设为194年可寻访人物；开局尚未任职，孙氏优先延揽，不等实际入仕年份。',volumes:[58],early:true},
    dianwei:{factionIds:['wei'],label:'张邈旧部 → 曹操',note:'《三国志·典韦传》记典韦先属张邈，后属夏侯惇，曹操讨吕布时已在军中。本剧本为招募体验设为194年开局在野，不断言当时尚未归曹；任何势力都可寻访礼聘。',volumes:[18]},
    wuanguo:{factionIds:['kongrong'],label:'孔融（演义关联）',note:'武安国出自《三国演义》第五回，为孔融部将；虎牢关交战负伤后由诸军救回。本作让他在194年继续守卫北海，是演义与玩法改编，不作为正史任职考证。',fictional:true},
    zhouxin:{factionIds:['wanglang'],label:'丹阳太守 → 王朗',note:'《三国志·孙静传》记周昕曾任丹阳太守，后为王朗领兵迎战孙策。本作将其归入王朗班底提前到194年，以补足会稽守将，不把这一月份作为已证史实。',volumes:[51],early:true},
    xuchu:{factionIds:['wei'],label:'曹操／曹魏',note:'许褚曾聚集宗族乡里自保，后来率众归附曹操。本剧本保留为在野人物，任何势力都可寻访礼聘。'},
    guojia:{factionIds:['qun','wei'],label:'袁绍 → 曹操',note:'郭嘉曾北见袁绍，认为袁绍难成大事而离去，后来经荀彧推荐辅佐曹操。“见袁绍”不在此等同于正式任职；本剧本开局仍在野。'},
    ganning:{factionIds:['liuzhang','liubiao','wu'],label:'刘璋 → 刘表、黄祖 → 孙权',note:'《三国志》裴注引《英雄记》载甘宁曾属刘璋，后来依刘表、黄祖，最终归孙权。本剧本开局在野为玩法改编，不按历史转投年份限制招募。',volumes:[31,55]},
    xuhuang:{factionIds:['wei'],label:'杨奉旧部 → 曹操／曹魏',note:'徐晃起初随杨奉，后来归附曹操。杨奉旧部不等同于本剧本的李傕势力；徐晃在此从开局即可寻访。'},
    lusu:{factionIds:['yuanshu','wu'],label:'袁术 → 孙权',note:'袁术曾署鲁肃为东城长，鲁肃未愿长期依从；后来渡江，辅佐孙权。本剧本保留在野身份，关联势力没有独占招募权。'},
    zhugeliang:{factionIds:['shu'],label:'刘备／蜀汉',note:'诸葛亮后来应刘备之请出仕。叔父依刘表不等于诸葛亮本人已仕刘表；本作采用群英同世，使他在194年即可被寻访礼聘。',early:true},
    jiangwei:{factionIds:['wei','shu'],label:'曹魏 → 蜀汉',note:'姜维是历史后期人物，先在曹魏任职，后归蜀汉；“曹魏关联”不表示他曾效力曹操本人。本作将其提前纳入194年可寻访名单。',early:true},
    xushu:{factionIds:['shu','wei'],label:'刘备 → 曹魏',note:'徐庶曾辅佐刘备，后来北归并在曹魏任职。本作开局在野，从194年即可寻访，不按后来的生涯顺序强制转投。'},
    fazheng:{factionIds:['liuzhang','shu'],label:'刘璋 → 刘备',note:'法正在建安初年入蜀依刘璋，后来辅佐刘备。本作将这段较晚生涯的人物提前设为194年可寻访，未直接加入任何一方。',early:true},
    weiyan:{factionIds:['shu'],label:'刘备／蜀汉',note:'史书记载魏延以部曲身份随刘备入蜀；韩玄旧部的故事属于演义叙事。本作开局在野，其招募地点为玩法安排，不据此断言史实。'},
    pangtong:{factionIds:['wu','shu'],label:'周瑜 → 刘备',note:'裴松之注引《江表传》载庞统曾为周瑜功曹，后来辅佐刘备。本作采用群英同世，使他在194年即可寻访，不要求先经过某一势力。',early:true},
    sunquan:{factionIds:['wu'],label:'孙氏／东吴',note:'孙权字仲谋，孙策之弟。《三国志·吴主传》记其十五岁任阳羡长，194年尚年少。本作采用群英同世，提前列入孙策开局班底；孙策仍为君主，死亡、退隐或转投后，仍在本势力任职的孙权是优先继位人选。',volumes:[47],early:true},
    sunshangxiang:{factionIds:['wu','shu'],label:'孙氏／刘备（婚姻关联）',note:'《三国志·法正传》记孙权之妹嫁给刘备，称其才捷刚猛，未记本名。“孙尚香”是后世通行称呼，本作不把它当作史书本名；武将定位与五维为玩法改编，并非史书记载的领军履历。开局在野，任何势力可寻访礼聘。',volumes:[37],early:true},
    zhurong:{factionIds:[],label:'孟获（演义关联）',note:'祝融夫人出自《三国演义》第九十回，是孟获之妻，书中写她善使飞刀并领兵出战。本作按演义人物改编为武将，不当作可考的历史女将；精简地图将其在野地点设于成都，属于玩法安排，194年起任何势力均可寻访礼聘。',fictional:true},
    huangyueying:{factionIds:['shu'],label:'诸葛亮（婚姻关联）',note:'《三国志·诸葛亮传》裴注引《襄阳记》载黄承彦以女配诸葛亮，称其才堪相配，未记女儿本名。“黄月英”是后世通行称呼，不冒充史书本名；智力、政治与文臣身份均为游戏改编，不把机关发明传说当作已证史实。194年起任何势力可寻访礼聘。',volumes:[35],early:true},
    daqiao:{factionIds:['wu'],label:'孙策（婚姻关联）',note:'《三国志·周瑜传》记桥公二女，孙策纳大桥、周瑜纳小桥，未记各自本名。本作采用通行写法“大乔”，不把她写成史有领军记录的女武将；经营、魅力与文臣定位属于玩法改编。开局在野，任何势力可寻访礼聘，不等婚姻年份。',volumes:[54],early:true},
    xiaoqiao:{factionIds:['wu'],label:'周瑜（婚姻关联）',note:'《三国志·周瑜传》记周瑜纳桥公小女小桥，未记本名。本作采用通行写法“小乔”，不把她写成史有领军记录的女武将；谋思、魅力与文臣定位属于玩法改编。柴桑是江东地域化的招募地点，不主张为其194年所在；任何势力均可寻访礼聘。',volumes:[54],early:true},
    diaochan:{factionIds:['lvbu'],label:'吕布（演义关联）',note:'貂蝉以《三国演义》中的形象入选本作，不把演义身份当作可核验的194年历史任职。她在本剧本开局为吕布效力。',fictional:true},
    zhaoyun:{factionIds:['gongsunzan','shu'],label:'公孙瓒 → 刘备／蜀汉',note:'赵云曾随公孙瓒，后归刘备。本剧本保留在公孙瓒势力的开局安排；熟悉的蜀汉形象不意味着开局已为刘备效力。',volumes:[36]},
    zhangliao:{factionIds:['lvbu','wei'],label:'吕布 → 曹操／曹魏',note:'张辽先后经历丁原、董卓、吕布部下阶段，吕布败后归曹操。本剧本开局为吕布效力，后来的魏将身份仅作生涯关联。',volumes:[17]},
    zhanghe:{factionIds:['qun','wei'],label:'袁绍 → 曹操／曹魏',note:'张郃原为韩馥部将，后随袁绍，再归曹操。本剧本开局为袁绍效力，不按后来的转投顺序自动改换阵营。',volumes:[17]},
    pangde:{factionIds:['mateng','zhanglu','wei'],label:'马腾、马超 → 张鲁 → 曹操',note:'庞德曾随马腾、马超，后在张鲁部下，曹操取汉中后归曹。本剧本开局安排在马腾势力，标签概括其后续生涯。',volumes:[18]},
    machao:{factionIds:['mateng','zhanglu','shu'],label:'马腾 → 张鲁 → 刘备',note:'马超与父亲马腾的军政势力相连，后来依张鲁，再归刘备。本剧本将其编入马腾开局班底，不把后来的蜀将身份当作当前归属。',volumes:[36]},
    taishici:{factionIds:['liuyao','wu'],label:'刘繇 → 孙氏／东吴',note:'太史慈曾报恩救孔融，后来依刘繇、再归孙策；救援孔融不在此等同于正式属于孔融。本剧本保留刘繇的开局武将班底。',volumes:[49]},
    huangzhong:{factionIds:['liubiao','wei','shu'],label:'刘表 → 曹操治下 → 刘备',note:'黄忠曾任刘表部下，与刘磐共守长沙攸县；入仕刘表的确切年月未载。曹操取荆州后仍在韩玄部下，后来归刘备。“曹操治下”与直接为曹操领军不同。本剧本保留刘表班底，驻江陵是地图与玩法安排，不当作194年精确驻地。',volumes:[36]},
    mizhu:{factionIds:['taoqian','shu'],label:'陶谦 → 刘备',note:'糜竺曾为陶谦别驾，陶谦死后奉遗命迎刘备。本剧本开局保留陶谦班底，不强制重演人物转投。',volumes:[38]},
    huangquan:{factionIds:['liuzhang','shu','wei'],label:'刘璋 → 刘备 → 曹魏',note:'黄权先为郡吏，后由刘璋召为主簿，再归刘备、曹魏；确切入仕刘璋的年月未载。本剧本按益州任职履历安排为开局班底，不据此断言194年六月已有该职位。曹魏标签不表示当时已属曹操。',volumes:[43]},
    jiaxu:{factionIds:['lijue','wei'],label:'李傕 → 张绣 → 曹操',note:'贾诩曾在董卓、牛辅、李傕等军中，后依段煨、张绣，再归曹操。张绣与刘表结盟不等于贾诩直接仕刘表。本剧本开局仍属李傕。',volumes:[10]},
    chendeng:{factionIds:['taoqian','wei'],label:'陶谦旧臣 → 协助曹操讨吕布',note:'陶谦曾表陈登为典农校尉，后来曹操拜其为广陵太守，他参与谋讨吕布。经历吕布控制徐州的时期，不等于成为吕布心腹。本剧本保留陶谦开局班底。',volumes:[7]},
    chengong:{factionIds:['wei','lvbu'],label:'曹操 → 吕布',note:'陈宫曾随曹操，后来转而辅佐吕布。本剧本开局安排在吕布势力，历史关联不触发游戏中的自动转投。',volumes:[7]},
    zhouyu:{factionIds:['wu','yuanshu'],label:'孙策旧交 → 助孙策渡江 → 袁术治下 → 孙氏',note:'周瑜与孙策早年相善；《孙策传》裴注把孙策渡江作战系于195年，《周瑜传》记他率兵相助，之后曾在袁术治下任居巢长，198年再归孙氏。旧交不等于194年已在孙策军中任职。本剧本改为开局在野，任何势力可立即寻访礼聘，无须等待195或198年，也不固定转投。',volumes:[46,54]},
    hansui:{factionIds:['mateng'],label:'西凉联合势力（剧本合并）',note:'韩遂与马腾既有结盟也有交战，不能简单视为马腾一生的部将。本剧本为规模与可玩性把两者合并为西凉联合势力，开局归入马腾阵营。',volumes:[36]},
    zhangzhao:{factionIds:['wu'],label:'孙策、孙权／东吴',note:'张昭曾拒绝陶谦征辟，避乱渡江后，在孙策创业时受任长史、抚军中郎将；本传未给出确切入仕月份，不能只凭后来辅吴就认定194年六月已经在职。本剧本改为开局在野，任何势力可立即寻访礼聘。',volumes:[52]},
    tianyu:{factionIds:['shu','gongsunzan','wei'],label:'刘备 → 公孙瓒 → 曹操／曹魏',note:'田豫先随刘备，刘备为豫州刺史时因母老归乡，随后受公孙瓒任用，之后归曹；本传未把这次转投标到具体月份。本剧本保留公孙瓒开局配置，属于时间线简化，不能据此否认其早年追随刘备，也不是刘备开局可直接礼聘的在野人才。',volumes:[26]},
    guosi:{factionIds:['lijue'],label:'关中凉州联军（剧本合编）',note:'郭汜与李傕是董卓旧部中的不同军事首领，并非一直服从李傕的普通臣属。本剧本把关中凉州联军合编为一个可选势力，由李傕代表；该合编不复原后来双方交战。',volumes:[6]},
    zhangji:{factionIds:['lijue'],label:'关中凉州联军（剧本合编）',note:'张济是董卓旧部中的军事首领，与李傕、郭汜共同参与关中局势。本剧本按关中联军合编，编入李傕阵营不表示历史上始终是李傕直属部将。',volumes:[6]},
    zhangren:{factionIds:['liuzhang'],label:'刘璋／益州',note:'《先主传》裴注记张任早年仕州为从事，后来抗击刘备；确切任职年月未载。本剧本按益州履历保留为刘璋开局部将，不宣称194年六月的职位、驻地已获确证。',volumes:[32]},
    yanyan:{factionIds:['liuzhang'],label:'刘璋／益州',note:'《张飞传》载严颜为巴郡太守并抵抗入蜀军；开始任职的年月未载。本剧本按益州履历保留为开局班底，不把后来见于记载的官职直接当作194年六月的确证。',volumes:[36]}
  };
  const historicalSourceVolumes={xuchu:[18],guojia:[14],xuhuang:[17],lusu:[54],zhugeliang:[35],jiangwei:[44],xushu:[35],fazheng:[37],weiyan:[40],pangtong:[37]};
  const literatureSources={wuanguo:[{title:'《三国演义》第五回（演义人物）',url:'https://zh.wikisource.org/wiki/三國演義/第005回'}],diaochan:[{title:'《三国演义》第八回',url:'https://zh.wikisource.org/wiki/三國演義/第008回'}],weiyan:[{title:'《三国演义》第五十三回（演义对照）',url:'https://zh.wikisource.org/wiki/三國演義/第053回'}],zhurong:[{title:'《三国演义》第九十回（演义人物）',url:'https://zh.wikisource.org/wiki/三國演義/第090回'}]};
  const characterBackgrounds=Object.fromEntries(generals.map(g=>{
    const override=historicalOverrides[g.id],ids=override?.factionIds||[g.faction],openingStatus=g.status==='free'?'free':'serving';
    const label=override?.label||ids.map(id=>historicalNames[id]).join('、');
    return [g.id,{id:g.id,name:g.name,openingStatus,openingFactionId:openingStatus==='free'?null:g.faction,
      availabilityLabel:override?.fictional?(openingStatus==='free'?'演义人物 · 群英同世，194年起可寻访':'演义人物 · 群英同世开局在职'):override?.early?(openingStatus==='free'?'群英同世 · 提前登场，194年起可寻访':'群英同世 · 提前列入开局班底'):openingStatus==='free'?'194年起可寻访，无需等待历史年份':'群英同世 · 本剧本194年开局在职',
      history:{factionIds:ids.slice(),label,note:override?.note||'本剧本开局安排在'+historicalNames[g.faction]+'阵营。历史关联概括人物通常关联的势力，不判定194年的具体任职，也不代表完整履历。',sources:(override?.volumes||historicalSourceVolumes[g.id]||[]).map(n=>({title:'《三国志》卷'+n+'（含裴注）',url:'https://zh.wikisource.org/wiki/三國志/卷'+String(n).padStart(2,'0')})).concat(literatureSources[g.id]||[])}}];
  }));
  cities.forEach(city => { city.generalId=generals.find(g=>g.cityId===city.id && g.faction===city.owner && g.status==='serving')?.id || null; });
  // One explicit preferred faction per named recruit. Career history may list several,
  // but must not accidentally give each previous employer the same recruitment priority.
  const recruitPreferences={...Object.fromEntries(generals.filter(g=>g.faction!=='neutral').map(g=>[g.id,g.faction])),dianwei:'wei',xuchu:'wei',guojia:'wei',xuhuang:'wei',zhouyu:'wu',zhangzhao:'wu',ganning:'wu',lusu:'wu',luxun:'wu',sunshangxiang:'wu',daqiao:'wu',xiaoqiao:'wu',zhugeliang:'shu',jiangwei:'shu',xushu:'shu',weiyan:'shu',pangtong:'shu',huangyueying:'shu',fazheng:'liuzhang'};
  const commonTemplates={military:{name:'乡勇校尉',leadership:42,force:48,intellect:25,politics:25,charisma:35,role:'military',ability:'steady',trait:'普通武将：适合带兵、练兵与驻守。'},civil:{name:'乡野文士',leadership:25,force:20,intellect:45,politics:48,charisma:40,role:'civil',ability:'steady',trait:'普通文臣：适合经商、屯田与寻访。'}};
  return { id:'qunxiong-194',rosterRevision:'roster-84-v5',ratingsRevision:ratings.revision,recruitPreferences,commonTemplates,mapRevision:'map-36-v1',addedCityIds,name:'群雄割据',startYear:194,startMonth:6,map:{width:1600,height:1100,projection},cities,edges,factions,generals,characterBackgrounds,
    description:'公元194年六月。群雄割据的精简剧本，包含33座城、3处关隘、16支势力与84名人物；保留核心战场与小势力的无主扩张据点，版图并非严格历史复原。',
    notes:['城池坐标按中国地理近似投影，并为关隘可读性做少量偏移。','开局为玩法改编：曹操经营许昌、虎牢，孙策拥有柴桑；这些安排不代表194年实际领土。保留全部十六支势力，合并外围城池与连续关隘，减少反复清扫。','中立城汇总未独立设立的地方势力；济北、琅琊、广陵、上庸提供无守军的扩张空间，城池军政数值为本作原创平衡。','采用群英同世设定；全部在野人物的城市为地域化游戏安排，不代表194年史实。64人在职、20人在野，任何势力都可寻访礼聘在野人才。典韦、周瑜、张昭开局在野，孙权提前列入孙策班底；孔融增加武安国（演义），王朗增加周昕（时间前移）。','有明确早期关系的班底按履历配置；任职月份未详者、韩遂及关中联军的合编另作说明。孙策独立与刘璋继位采用剧本前置，不把每项开局安排当作194年六月史实。','孙尚香、黄月英采用后世通行名；祝融按演义人物入选，二乔的文臣身份为游戏改编，五维参考《三国志14》基础能力，不冒充历史任职或战功。','全部人物开局已在职或可寻访；首次入仕年限10点，每10年减1点，基础五维每点线性下降2%，100年退隐。'],
    sources:[{title:'三国志14 官方剧本：194年6月 群雄割据',url:'https://www.gamecity.com.tw/sangokushi14/scenario.html'},
      {title:'三国志14 官方地形与关隘说明',url:'https://www.gamecity.com.tw/sangokushi14/system-field.html'},
      {title:'三国志14 官方手册：据点',url:'https://www.gamecity.com.tw/manual/sangokushi14/wpk/sc/3100.html'}] };
});
