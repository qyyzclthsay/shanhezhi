(function(root,factory){'use strict';const data=factory();if(typeof module==='object'&&module.exports)module.exports=data;root.TKOfficerRatings=data;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // ROTK XIV base abilities, without items, offices or scenario-specific bracketed variants.
  // Audited individually against wikiwiki.jp/sangokushi14, 2026-10-15.
  // The game retains its own battle, economy, aging, and trait mechanics.
  const values={
  "caocao": {
    "leadership": 98,
    "force": 72,
    "intellect": 91,
    "politics": 94,
    "charisma": 96
  },
  "xiahou": {
    "leadership": 89,
    "force": 90,
    "intellect": 60,
    "politics": 74,
    "charisma": 88
  },
  "xiahouyuan": {
    "leadership": 92,
    "force": 91,
    "intellect": 55,
    "politics": 61,
    "charisma": 79
  },
  "caoren": {
    "leadership": 90,
    "force": 87,
    "intellect": 58,
    "politics": 46,
    "charisma": 78
  },
  "dianwei": {
    "leadership": 57,
    "force": 95,
    "intellect": 35,
    "politics": 29,
    "charisma": 58
  },
  "xunyu": {
    "leadership": 54,
    "force": 14,
    "intellect": 95,
    "politics": 99,
    "charisma": 94
  },
  "chengyu": {
    "leadership": 70,
    "force": 49,
    "intellect": 90,
    "politics": 79,
    "charisma": 56
  },
  "yujin": {
    "leadership": 84,
    "force": 77,
    "intellect": 72,
    "politics": 57,
    "charisma": 56
  },
  "yuejin": {
    "leadership": 80,
    "force": 84,
    "intellect": 53,
    "politics": 51,
    "charisma": 65
  },
  "lvbu": {
    "leadership": 95,
    "force": 100,
    "intellect": 26,
    "politics": 13,
    "charisma": 36
  },
  "zhangliao": {
    "leadership": 95,
    "force": 92,
    "intellect": 78,
    "politics": 58,
    "charisma": 77
  },
  "gaoshun": {
    "leadership": 88,
    "force": 86,
    "intellect": 60,
    "politics": 46,
    "charisma": 69
  },
  "chengong": {
    "leadership": 79,
    "force": 55,
    "intellect": 89,
    "politics": 83,
    "charisma": 69
  },
  "diaochan": {
    "leadership": 20,
    "force": 26,
    "intellect": 81,
    "politics": 65,
    "charisma": 95
  },
  "liubei": {
    "leadership": 76,
    "force": 73,
    "intellect": 74,
    "politics": 78,
    "charisma": 99
  },
  "guanyu": {
    "leadership": 96,
    "force": 97,
    "intellect": 75,
    "politics": 63,
    "charisma": 94
  },
  "zhangfei": {
    "leadership": 86,
    "force": 98,
    "intellect": 33,
    "politics": 22,
    "charisma": 44
  },
  "jianyong": {
    "leadership": 22,
    "force": 33,
    "intellect": 70,
    "politics": 71,
    "charisma": 74
  },
  "sunce": {
    "leadership": 93,
    "force": 92,
    "intellect": 69,
    "politics": 68,
    "charisma": 91
  },
  "zhouyu": {
    "leadership": 97,
    "force": 71,
    "intellect": 96,
    "politics": 86,
    "charisma": 94
  },
  "chengpu": {
    "leadership": 85,
    "force": 79,
    "intellect": 79,
    "politics": 74,
    "charisma": 86
  },
  "huanggai": {
    "leadership": 80,
    "force": 83,
    "intellect": 68,
    "politics": 65,
    "charisma": 81
  },
  "zhangzhao": {
    "leadership": 33,
    "force": 3,
    "intellect": 84,
    "politics": 97,
    "charisma": 81
  },
  "zhuzhi": {
    "leadership": 70,
    "force": 56,
    "intellect": 72,
    "politics": 73,
    "charisma": 76
  },
  "lufan": {
    "leadership": 73,
    "force": 60,
    "intellect": 74,
    "politics": 74,
    "charisma": 68
  },
  "yuanshao": {
    "leadership": 81,
    "force": 69,
    "intellect": 70,
    "politics": 73,
    "charisma": 92
  },
  "yanliang": {
    "leadership": 86,
    "force": 93,
    "intellect": 40,
    "politics": 32,
    "charisma": 51
  },
  "wenchou": {
    "leadership": 85,
    "force": 94,
    "intellect": 25,
    "politics": 25,
    "charisma": 40
  },
  "zhanghe": {
    "leadership": 89,
    "force": 89,
    "intellect": 69,
    "politics": 57,
    "charisma": 72
  },
  "tianfeng": {
    "leadership": 72,
    "force": 29,
    "intellect": 93,
    "politics": 87,
    "charisma": 68
  },
  "jushou": {
    "leadership": 79,
    "force": 35,
    "intellect": 90,
    "politics": 89,
    "charisma": 76
  },
  "xuyou": {
    "leadership": 36,
    "force": 21,
    "intellect": 81,
    "politics": 56,
    "charisma": 24
  },
  "yuanshu": {
    "leadership": 44,
    "force": 65,
    "intellect": 68,
    "politics": 15,
    "charisma": 42
  },
  "jiling": {
    "leadership": 78,
    "force": 83,
    "intellect": 51,
    "politics": 48,
    "charisma": 60
  },
  "gongsunzan": {
    "leadership": 84,
    "force": 83,
    "intellect": 71,
    "politics": 46,
    "charisma": 77
  },
  "zhaoyun": {
    "leadership": 91,
    "force": 96,
    "intellect": 76,
    "politics": 65,
    "charisma": 81
  },
  "tianyu": {
    "leadership": 80,
    "force": 72,
    "intellect": 80,
    "politics": 78,
    "charisma": 75
  },
  "mateng": {
    "leadership": 82,
    "force": 80,
    "intellect": 51,
    "politics": 59,
    "charisma": 89
  },
  "machao": {
    "leadership": 90,
    "force": 96,
    "intellect": 44,
    "politics": 26,
    "charisma": 82
  },
  "pangde": {
    "leadership": 81,
    "force": 94,
    "intellect": 71,
    "politics": 44,
    "charisma": 70
  },
  "hansui": {
    "leadership": 82,
    "force": 72,
    "intellect": 77,
    "politics": 63,
    "charisma": 78
  },
  "lijue": {
    "leadership": 69,
    "force": 72,
    "intellect": 23,
    "politics": 1,
    "charisma": 16
  },
  "guosi": {
    "leadership": 65,
    "force": 76,
    "intellect": 13,
    "politics": 14,
    "charisma": 13
  },
  "jiaxu": {
    "leadership": 86,
    "force": 48,
    "intellect": 97,
    "politics": 85,
    "charisma": 57
  },
  "zhangji": {
    "leadership": 70,
    "force": 66,
    "intellect": 55,
    "politics": 53,
    "charisma": 60
  },
  "liubiao": {
    "leadership": 48,
    "force": 31,
    "intellect": 71,
    "politics": 83,
    "charisma": 85
  },
  "caimao": {
    "leadership": 77,
    "force": 68,
    "intellect": 77,
    "politics": 73,
    "charisma": 59
  },
  "huangzu": {
    "leadership": 76,
    "force": 67,
    "intellect": 55,
    "politics": 45,
    "charisma": 32
  },
  "kuaiyue": {
    "leadership": 47,
    "force": 27,
    "intellect": 82,
    "politics": 88,
    "charisma": 73
  },
  "huangzhong": {
    "leadership": 87,
    "force": 93,
    "intellect": 63,
    "politics": 52,
    "charisma": 74
  },
  "liuzhang": {
    "leadership": 18,
    "force": 5,
    "intellect": 9,
    "politics": 38,
    "charisma": 70
  },
  "zhangren": {
    "leadership": 85,
    "force": 84,
    "intellect": 76,
    "politics": 59,
    "charisma": 76
  },
  "yanyan": {
    "leadership": 79,
    "force": 82,
    "intellect": 69,
    "politics": 67,
    "charisma": 77
  },
  "huangquan": {
    "leadership": 76,
    "force": 59,
    "intellect": 85,
    "politics": 79,
    "charisma": 80
  },
  "zhanglu": {
    "leadership": 51,
    "force": 26,
    "intellect": 73,
    "politics": 78,
    "charisma": 89
  },
  "yanpu": {
    "leadership": 31,
    "force": 25,
    "intellect": 81,
    "politics": 79,
    "charisma": 70
  },
  "liuyao": {
    "leadership": 65,
    "force": 66,
    "intellect": 47,
    "politics": 72,
    "charisma": 64
  },
  "taishici": {
    "leadership": 86,
    "force": 93,
    "intellect": 67,
    "politics": 58,
    "charisma": 79
  },
  "wanglang": {
    "leadership": 47,
    "force": 35,
    "intellect": 79,
    "politics": 81,
    "charisma": 50
  },
  "taoqian": {
    "leadership": 51,
    "force": 33,
    "intellect": 63,
    "politics": 64,
    "charisma": 77
  },
  "mizhu": {
    "leadership": 33,
    "force": 29,
    "intellect": 77,
    "politics": 83,
    "charisma": 84
  },
  "chengui": {
    "leadership": 15,
    "force": 5,
    "intellect": 82,
    "politics": 77,
    "charisma": 74
  },
  "chendeng": {
    "leadership": 80,
    "force": 64,
    "intellect": 81,
    "politics": 80,
    "charisma": 64
  },
  "kongrong": {
    "leadership": 30,
    "force": 5,
    "intellect": 72,
    "politics": 76,
    "charisma": 65
  },
  "xuchu": {
    "leadership": 66,
    "force": 96,
    "intellect": 36,
    "politics": 20,
    "charisma": 56
  },
  "guojia": {
    "leadership": 62,
    "force": 15,
    "intellect": 98,
    "politics": 84,
    "charisma": 80
  },
  "ganning": {
    "leadership": 87,
    "force": 94,
    "intellect": 76,
    "politics": 18,
    "charisma": 55
  },
  "xuhuang": {
    "leadership": 88,
    "force": 90,
    "intellect": 74,
    "politics": 48,
    "charisma": 73
  },
  "lusu": {
    "leadership": 81,
    "force": 56,
    "intellect": 92,
    "politics": 92,
    "charisma": 89
  },
  "zhugeliang": {
    "leadership": 93,
    "force": 38,
    "intellect": 100,
    "politics": 96,
    "charisma": 93
  },
  "jiangwei": {
    "leadership": 91,
    "force": 89,
    "intellect": 90,
    "politics": 67,
    "charisma": 80
  },
  "xushu": {
    "leadership": 85,
    "force": 64,
    "intellect": 93,
    "politics": 80,
    "charisma": 81
  },
  "fazheng": {
    "leadership": 82,
    "force": 47,
    "intellect": 94,
    "politics": 78,
    "charisma": 57
  },
  "weiyan": {
    "leadership": 84,
    "force": 92,
    "intellect": 69,
    "politics": 46,
    "charisma": 39
  },
  "pangtong": {
    "leadership": 78,
    "force": 34,
    "intellect": 97,
    "politics": 85,
    "charisma": 69
  },
  "sunshangxiang": {
    "leadership": 67,
    "force": 80,
    "intellect": 57,
    "politics": 56,
    "charisma": 80
  },
  "zhurong": {
    "leadership": 74,
    "force": 85,
    "intellect": 29,
    "politics": 23,
    "charisma": 69
  },
  "huangyueying": {
    "leadership": 37,
    "force": 28,
    "intellect": 88,
    "politics": 77,
    "charisma": 70
  },
  "daqiao": {
    "leadership": 18,
    "force": 12,
    "intellect": 73,
    "politics": 69,
    "charisma": 92
  },
  "xiaoqiao": {
    "leadership": 17,
    "force": 13,
    "intellect": 74,
    "politics": 68,
    "charisma": 92
  },
  "sunquan": {
    "leadership": 76,
    "force": 67,
    "intellect": 80,
    "politics": 89,
    "charisma": 95
  },
  "wuanguo": {
    "leadership": 68,
    "force": 83,
    "intellect": 34,
    "politics": 33,
    "charisma": 27
  },
  "zhouxin": {
    "leadership": 65,
    "force": 58,
    "intellect": 73,
    "politics": 65,
    "charisma": 62
  },
  "luxun": {
    "leadership": 96,
    "force": 69,
    "intellect": 95,
    "politics": 88,
    "charisma": 91
  }
};
  return {revision:'rotk14-base-20261015',values};
});
