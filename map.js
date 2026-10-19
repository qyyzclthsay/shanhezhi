/* The living campaign map. All art is drawn locally; no image assets are required. */
(function () {
  'use strict';

  const SCENARIO = globalThis.TKScenario || globalThis.TKEngine?.DATA || {};
  const W = SCENARIO.map?.width || 1600, H = SCENARIO.map?.height || 1100;
  const displayPosition = city => globalThis.TKMapLayout?.position(city) || { x:city.x, y:city.y };
  const NODES = (SCENARIO.cities || []).map(city => ({ ...city, ...displayPosition(city) }));
  const CITIES = NODES.map(city => [city.id, city.x, city.y]);
  const EDGES = SCENARIO.edges || [];
  const COLORS = { ...Object.fromEntries((SCENARIO.factions||[]).map(f=>[f.id,f.color])), neutral:'#50555C' };
  const SEASONS = {
    spring: { id:'spring',name:'春',land:'#e5ebcb',wash:'#c9dfa0',sea:'#a7ced0',water:'#80bcae',waterLight:'#bad8c1',bank:'#c7d9aa',trees:['#8eaf60','#71934c','#b0cb7b'],mountains:['#b3c19d','#92aa8b','#c7d1b1','#e4e5d1'],fields:['#c5cf93','#b0bf7f','#94b278','#ebdfb0'],ink:'#749063',description:'草木初荣 · 桃李新绿' },
    summer: { id:'summer',name:'夏',land:'#e5e7ca',wash:'#b8d29c',sea:'#92bec6',water:'#65aaa8',waterLight:'#a2cfc0',bank:'#bbd0a1',trees:['#789b51','#557d48','#97b568'],mountains:['#adb99a','#899e87','#c5cbb1','#e0e1d0'],fields:['#b7c183','#99af75','#7c9c69','#ded89c'],ink:'#70875e',description:'林深水碧 · 田畴渐盛' },
    autumn: { id:'autumn',name:'秋',land:'#eee2c4',wash:'#e2c78c',sea:'#a7c3c5',water:'#8bb2b2',waterLight:'#bbd0c2',bank:'#d7c594',trees:['#be944e','#a97142','#d5b266'],mountains:['#c0b499','#a69b85','#d5c6a5','#e7dfc9'],fields:['#dbc183','#c8a96e','#b79560','#f0d69d'],ink:'#998157',description:'层林染金 · 五谷将收' },
    winter: { id:'winter',name:'冬',land:'#e4e8e0',wash:'#ced8c9',sea:'#b5cbd3',water:'#9bb7c5',waterLight:'#d4e4e5',bank:'#d6dfd3',trees:['#aab9a1','#859c94','#d3ddd0'],mountains:['#c4cdc3','#a0b3b1','#e1e7dd','#f6f8ec'],fields:['#d5d9c5','#b8c3b0','#a4b5aa','#edf0dc'],ink:'#82918a',description:'霜雪覆野 · 寒江凝碧' },
  };
  function blend(a, b, amount) {
    const rgb = value => /^#[\da-f]{6}$/i.test(value || '') ? [1,3,5].map(i => parseInt(value.slice(i,i+2),16)) : [135,145,123];
    const left=rgb(a),right=rgb(b);
    return '#'+left.map((n,i)=>Math.round(n+(right[i]-n)*amount).toString(16).padStart(2,'0')).join('');
  }
  function seasonOf(state) {
    const info = state && (globalThis.TKEngine?.calendarInfo?.(state) || globalThis.TKCalendar?.info?.(state));
    const supplied = info?.season?.id || info?.seasonId;
    if (SEASONS[supplied]) return supplied;
    const month=Number(state?.month)||6;
    return month>=3&&month<=5?'spring':month>=6&&month<=8?'summer':month>=9&&month<=11?'autumn':'winter';
  }
  const PLACES = Object.fromEntries(NODES.map(city => [city.id, {
    kind: city.kind === 'pass' ? 'pass' : city.tier === 'major' ? 'capital' : city.terrain === 'river' ? 'port' : city.terrain === 'mountain' ? 'fortress' : 'town',
    label: city.description || '治境安民', terrain: { plain: '平原', mountain: '山地', river: '水乡' }[city.terrain] || '平原', region: city.region || '',
  }]));

  function random(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function poly(c, pts, fill, stroke, width) {
    c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = width || 1; c.stroke(); }
  }
  function ellipse(c, x, y, rx, ry, color) {
    c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fillStyle = color; c.fill();
  }
  function roundRect(c, x, y, width, height, radius, fill, stroke) {
    c.beginPath(); c.roundRect(x, y, width, height, radius);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; c.stroke(); }
  }
  function tree(c, x, y, s, type, hue, theme = SEASONS.summer) {
    c.save(); c.translate(x, y); c.scale(s, s);
    ellipse(c, 3, 3, 10, 3.5, 'rgba(63,80,54,.10)');
    c.strokeStyle = '#7d8162'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 2); c.lineTo(0, -13); c.stroke();
    if (type) {
      poly(c, [[-10, -4], [0, -29], [10, -4]], hue || theme.trees[0]);
      poly(c, [[0, -29], [10, -4], [0, -9]], theme.trees[1]);
      poly(c, [[-8, -12], [0, -34], [8, -12]], theme.trees[2]);
    } else {
      ellipse(c, -5, -13, 8, 10, hue || theme.trees[0]);
      ellipse(c, 4, -16, 9, 12, theme.trees[1]);
      ellipse(c, -3, -21, 7, 8, theme.trees[2]);
      if (theme.id === 'spring') { ellipse(c,-7,-20,2,2,'#f0d7c4'); ellipse(c,1,-26,2,2,'#f2dfc7'); }
      if (theme.id === 'winter') { ellipse(c,-4,-24,6,3,'#f5f6e9'); ellipse(c,5,-17,5,2,'#e9eee2'); }
    }
    c.restore();
  }
  function mountain(c, x, y, size, theme = SEASONS.summer) {
    c.save(); c.translate(x, y); c.scale(size, size);
    ellipse(c, 5, 4, 45, 10, 'rgba(109,122,88,.09)');
    poly(c, [[-43, 1], [-29, -23], [-17, -29], [1, -67], [16, -43], [24, -37], [45, 1]], theme.mountains[0]);
    poly(c, [[1, -67], [5, -28], [-5, -12], [16, 1], [45, 1], [24, -37], [16, -43]], theme.mountains[1]);
    poly(c, [[-43, 1], [-29, -23], [-17, -29], [-13, -15], [-28, 1]], theme.mountains[2]);
    poly(c, theme.id==='winter'?[[1,-67],[-17,-29],[-8,-33],[1,-26],[9,-36],[23,-37],[16,-43]]:[[1, -67], [-11, -43], [-1, -47], [7, -41], [16, -43]], theme.mountains[3]);
    c.strokeStyle = 'rgba(103,124,100,.32)'; c.lineWidth = .8;
    c.beginPath(); c.moveTo(5, -28); c.lineTo(17, -19); c.lineTo(23, -5); c.stroke();
    c.beginPath(); c.moveTo(-17, -29); c.lineTo(-20, -10); c.stroke();
    c.restore();
  }
  function farm(c, x, y, size, flip, theme = SEASONS.summer) {
    c.save(); c.translate(x, y); c.scale(size * (flip ? -1 : 1), size);
    poly(c, [[-24, 0], [7, -12], [35, 1], [4, 15]], theme.fields[0], theme.fields[2], .8);
    poly(c, [[-24, 0], [4, 15], [4, 19], [-24, 4]], theme.fields[1]);
    poly(c, [[4, 15], [35, 1], [35, 5], [4, 19]], theme.fields[2]);
    c.strokeStyle = theme.fields[3]; c.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const t = (i + 1) / 7; c.beginPath(); c.moveTo(-24 + 31 * t, -12 * t + 2); c.lineTo(4 + 31 * t, 15 - 14 * t - 2); c.stroke();
    }
    c.restore();
  }
  function house(c, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s);
    poly(c, [[-11, -2], [0, -7], [13, -1], [13, 9], [1, 14], [-11, 8]], '#e3d9b8');
    poly(c, [[1, 3], [13, -1], [13, 9], [1, 14]], '#b9b397');
    poly(c, [[-15, -2], [-2, -13], [18, -5], [4, 6]], '#9eab89', '#758e77', .7);
    poly(c, [[-15, -2], [-2, -13], [-11, 7]], '#859777');
    c.fillStyle = '#787e67'; c.fillRect(-6, 3, 3, 5); c.fillRect(6, 6, 3, 4);
    c.restore();
  }
  function bridge(c, x, y, angle, size) {
    c.save(); c.translate(x, y); c.rotate(angle); c.scale(size, size);
    c.fillStyle = '#a1aa87'; c.fillRect(-8, -23, 19, 52);
    c.fillStyle = '#c4bd9c'; c.fillRect(-10, -27, 18, 50);
    c.strokeStyle = '#f2e7c8'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-10, -28); c.lineTo(-10, 24); c.moveTo(8, -28); c.lineTo(8, 24); c.stroke();
    c.strokeStyle = '#a59b7d'; c.lineWidth = .7;
    for (let i = -23; i < 23; i += 6) { c.beginPath(); c.moveTo(-8, i); c.lineTo(6, i); c.stroke(); }
    c.fillStyle = '#e7ddbe'; [-27, -10, 7, 24].forEach(y2 => { c.fillRect(-12, y2 - 2, 4, 4); c.fillRect(6, y2 - 2, 4, 4); });
    c.restore();
  }

  function boat(c, x, y, size, sail = true, tint = '#e5d6aa') {
    c.save(); c.translate(x, y); c.scale(size, size);
    ellipse(c, 1, 5, 20, 5, 'rgba(235,244,216,.28)');
    poly(c, [[-21, 0], [15, -5], [20, 0], [10, 8], [-13, 9]], '#78897a', '#6b7b6e', .6);
    poly(c, [[-19, 0], [16, -3], [10, 3], [-12, 6]], '#c4b891');
    c.strokeStyle = '#8b8b69'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, 4); c.lineTo(0, -28); c.stroke();
    if (sail) {
      poly(c, [[-1, -27], [-1, -4], [-13, -6], [-15, -14], [-11, -23]], tint, '#beb893', .5);
      poly(c, [[2, -26], [2, -5], [13, -7], [14, -14], [11, -22]], '#f0e5c5', '#b6b795', .5);
      c.strokeStyle = '#b8b18c'; c.lineWidth = .6;
      for (let y2 = -21; y2 < -5; y2 += 5) { c.beginPath(); c.moveTo(-11, y2); c.lineTo(-1, y2 + 1); c.moveTo(2, y2); c.lineTo(11, y2 + 1); c.stroke(); }
    }
    c.restore();
  }
  function tent(c, x, y, size, color) {
    c.save(); c.translate(x, y); c.scale(size, size);
    ellipse(c, 2, 4, 13, 5, 'rgba(77,94,61,.09)');
    poly(c, [[-12, 5], [-4, -13], [10, -8], [17, 9], [3, 14]], '#ded8b7', '#afa989', .65);
    poly(c, [[-12, 5], [-4, -13], [3, 14]], color || '#c5b589');
    poly(c, [[-8, 6], [-4, -5], [-1, 10]], '#7d856b');
    c.strokeStyle = '#9da07d'; c.lineWidth = .6; c.beginPath(); c.moveTo(-4, -13); c.lineTo(3, 14); c.moveTo(10, -8); c.lineTo(17, 9); c.stroke();
    c.restore();
  }
  function watchtower(c, x, y, size) {
    c.save(); c.translate(x, y); c.scale(size, size);
    c.strokeStyle = '#969274'; c.lineWidth = 2.3;
    c.beginPath(); c.moveTo(-8, 7); c.lineTo(-5, -20); c.moveTo(8, 7); c.lineTo(5, -20); c.moveTo(-6, -10); c.lineTo(7, 4); c.moveTo(6, -10); c.lineTo(-7, 4); c.stroke();
    poly(c, [[-10, -20], [0, -25], [10, -20], [10, -11], [0, -7], [-10, -11]], '#d2c9a5');
    poly(c, [[-14, -22], [0, -34], [14, -22], [0, -16]], '#899981', '#71866f', .8);
    c.fillStyle = '#78876c'; c.fillRect(-5, -17, 3, 6); c.fillRect(3, -17, 3, 6);
    c.restore();
  }
  function createTerrain(theme = SEASONS.summer) {
    const resolution = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    const buffer = document.createElement('canvas'); buffer.width = W * resolution; buffer.height = H * resolution;
    const c = buffer.getContext('2d'); c.scale(resolution, resolution);
    const rand = random(1940601), projection = SCENARIO.map?.projection || {};
    const geo = (lon, lat) => {
      const x=(projection.originX ?? 80)+(lon-(projection.originLongitude ?? 102))*(projection.scaleX ?? 70),y=(projection.originY ?? 76)+((projection.originLatitude ?? 40)-lat)*(projection.scaleY ?? 64);
      const p=globalThis.TKMapLayout?.projectPoint?.(x,y)||{x,y};return [p.x,p.y];
    };
    const nearCity = (x, y, radius = 53) => CITIES.some(([, cx, cy]) => Math.hypot(x - cx, (y - cy) * 1.2) < radius);
    function curve(points) {
      c.beginPath(); c.moveTo(...points[0]);
      for (let i = 1; i < points.length - 1; i++) c.quadraticCurveTo(...points[i], (points[i][0] + points[i + 1][0]) / 2, (points[i][1] + points[i + 1][1]) / 2);
      c.lineTo(...points[points.length - 1]);
    }
    c.fillStyle = theme.land; c.fillRect(0, 0, W, H);
    // Broad regional washes follow the scenario's geographic projection.
    [[104.8,30.2,260,'#cbd8a9'],[110.2,34.4,300,'#e2dec0'],[115.2,36.7,320,'#dadcbb'],[114,28.7,310,'#ccd9ad'],[119,30.7,240,'#d0ddba'],[105,37.5,350,'#e2dcc0']].forEach(([lon,lat,r,color])=>{
      const [x,y]=geo(lon,lat); const wash=c.createRadialGradient(x,y,20,x,y,r); wash.addColorStop(0,blend(color,theme.wash,.65));wash.addColorStop(1,theme.land+'00');c.fillStyle=wash;c.fillRect(x-r,y-r,r*2,r*2);
    });
    for(let i=0;i<260;i++)ellipse(c,rand()*W,rand()*H,30+rand()*65,9+rand()*18,i%3?'rgba(167,183,133,.035)':'rgba(255,255,232,.16)');
    // Bohai, Shandong peninsula, the Yangtze estuary and the southeast coast.
    const coastGeo=[[119.6,40.5],[120.4,39.6],[119.1,39.1],[118.0,39.0],[117.9,38.2],[119.0,37.3],[120.8,37.8],[122.6,37.3],[122.3,36.5],[120.6,36.0],[119.4,35.1],[120.1,34.0],[121.1,32.8],[122.0,31.8],[121.4,30.9],[121.0,30.3],[122.0,29.7],[121.6,28.3],[120.5,27.0],[119.8,26.0],[118.8,24.1]];
    const coast=coastGeo.map(p=>geo(...p));
    const seaPolygon = [...coast, [W + 30, H + 30], [W + 30, -30]];
    const atSea = (x, y) => {
      let inside = false;
      for (let i = 0, j = seaPolygon.length - 1; i < seaPolygon.length; j = i++) {
        const [ax, ay] = seaPolygon[i], [bx, by] = seaPolygon[j];
        if ((ay > y) !== (by > y) && x > (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
      }
      return inside;
    };
    curve(coast);c.lineTo(W+30,H+30);c.lineTo(W+30,-30);c.closePath();c.fillStyle=theme.sea;c.fill();
    curve(coast);c.strokeStyle=theme.bank;c.lineWidth=8;c.stroke();curve(coast);c.strokeStyle=blend(theme.bank,'#f7f6e8',.5);c.lineWidth=2;c.stroke();
    for(let i=0;i<90;i++){
      const x=1390+rand()*190,y=80+rand()*990;
      c.strokeStyle='rgba(237,247,224,.35)';c.lineWidth=.8;c.beginPath();c.moveTo(x,y);c.lineTo(x+9+rand()*20,y);c.stroke();
    }
    const rivers=[
      {name:'黄 河',width:12,points:[[103.1,36.0],[104.8,36.2],[105.5,38.3],[107.3,39.0],[109.6,39.3],[110.9,37.8],[110.5,36.0],[110.3,34.7],[112.0,34.7],[113.2,35.1],[114.7,36.0],[116.0,37.0],[117.8,38.1]],label:[107.3,38.6]},
      {name:'长 江',width:17,points:[[102.2,28.1],[104.3,28.6],[106.5,29.35],[108.2,30.3],[109.6,30.8],[111.0,30.4],[112.2,30.15],[113.2,29.65],[114.3,30.45],[115.6,29.75],[116.8,30.3],[118.0,31.3],[118.9,32.05],[120.2,32.0],[122.1,31.7]],label:[107.0,29.1]},
      {name:'汉 水',width:6,points:[[106.5,33.05],[108.1,32.85],[110.0,32.4],[112.15,32.0],[113.0,31.2],[114.3,30.45]],label:[110.6,32.1]},
      {name:'淮 水',width:5,points:[[113.3,32.6],[114.8,32.3],[116.4,32.5],[118.1,33.2],[119.8,33.5]],label:[117.2,33.0]},
      {name:'湘 水',width:5,points:[[111.7,26.2],[112.1,27.0],[112.9,28.1],[112.9,29.2],[113.2,29.65]],label:[112.1,27.0]},
    ];
    const riverSamples=[];
    rivers.forEach(r=>{
      const points=r.points.map(p=>geo(...p));riverSamples.push(...points);
      curve(points);c.lineCap='round';c.lineJoin='round';c.strokeStyle=theme.bank;c.lineWidth=r.width+8;c.stroke();
      curve(points);c.strokeStyle=theme.water;c.lineWidth=r.width;c.stroke();
      curve(points);c.strokeStyle=theme.waterLight;c.lineWidth=Math.max(1,r.width-6);c.stroke();
      curve(points);c.strokeStyle=blend(theme.waterLight,'#fffef0',.5);c.lineWidth=.8;c.stroke();
      const [x,y]=geo(...r.label);c.font='14px "STKaiti", "KaiTi", serif';c.fillStyle='#739789';c.textAlign='center';c.fillText(r.name,x,y+18);
    });
    [[112.8,29.1,31,16],[116.1,29.3,24,35],[120.1,31.2,28,22]].forEach(([lon,lat,rx,ry])=>{const[x,y]=geo(lon,lat);ellipse(c,x,y,rx+5,ry+4,theme.bank);ellipse(c,x,y,rx,ry,theme.water);for(let i=0;i<16;i++){const px=x+(rand()-.5)*rx*2,py=y+(rand()-.5)*ry*2;c.strokeStyle=theme.waterLight;c.lineWidth=.7;c.beginPath();c.moveTo(px,py);c.lineTo(px+5,py);c.stroke();}});
    // Mountain chains: Qinling, Daba, Taihang, Wuyi and the southwest uplands.
    const ranges=[[[103.2,34.2],[105,33.8],[107,33.8],[109.7,33.6],[111.5,33.2]],[[104.7,31.9],[106.4,32.1],[108.2,31.8],[110.4,31.6]],[[112.7,39.1],[113.1,37.4],[113.4,35.7]],[[117.2,28.4],[118.0,27.5],[118.8,26.4]],[[102.8,31.5],[103.0,29.8],[103.7,28.0],[104.8,26.4]],[[103.0,37.9],[104.8,37.2],[106.6,36.4]]];
    const peaks=[];
    ranges.forEach((range,k)=>{
      const pts=range.map(p=>geo(...p));
      for(let i=0;i<pts.length-1;i++){
        const [a,b]=[pts[i],pts[i+1]],count=Math.max(2,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/29));
        for(let j=0;j<count;j++){const t=j/count,x=a[0]+(b[0]-a[0])*t+(rand()-.5)*15,y=a[1]+(b[1]-a[1])*t+(rand()-.5)*25;if(!nearCity(x,y,45))peaks.push([x,y,.46+rand()*.54]);}
      }
      const labels=['秦 岭','大 巴 山','太 行 山','武 夷 山','蜀 山','陇 山'],mid=pts[Math.floor(pts.length/2)];c.font='13px "STKaiti", "KaiTi", serif';c.textAlign='center';c.fillStyle='#a0aa89';c.fillText(labels[k],mid[0],mid[1]+37);
    });
    NODES.filter(node=>node.kind==='pass').forEach(node=>{
      const edge=EDGES.find(pair=>pair.includes(node.id)),neighbor=edge&&NODES.find(n=>n.id===edge.find(id=>id!==node.id));
      const angle=neighbor?Math.atan2(neighbor.y-node.y,neighbor.x-node.x)+Math.PI/2:0;
      [-67,-40,40,67].forEach((offset,i)=>{const x=node.x+Math.cos(angle)*offset,y=node.y+Math.sin(angle)*offset*.7;if(!nearCity(x,y,32))peaks.push([x,y,.4+(i%2)*.19]);});
    });
    peaks.sort((a,b)=>a[1]-b[1]).forEach(p=>mountain(c,...p,theme));
    for(let i=0;i<440;i++){
      const x=35+rand()*(W-210),y=35+rand()*(H-70);if(nearCity(x,y,52)||atSea(x,y))continue;
      if(riverSamples.some(p=>Math.hypot(x-p[0],y-p[1])<25))continue;
      tree(c,x,y,.32+rand()*.45,rand()>.64,null,theme);
      if(i%4===0){tree(c,x+8,y+4,.32,false,null,theme);tree(c,x-7,y-2,.4,false,null,theme);}
    }
    // Small rural settlements between city sites, never additional strategic nodes.
    NODES.filter(node=>node.kind!=='pass').forEach((node,i)=>{
      const x=node.x-52+(i%3)*8,y=node.y+44;if(nearCity(x,y,38)||atSea(x,y))return;
      if(i%3===0){farm(c,x,y,.38,i%2,theme);house(c,x-8,y-15,.35);tree(c,x+18,y,.35,false,null,theme);}
    });
    const regions=new Map();NODES.filter(n=>n.kind!=='pass'&&n.region).forEach(n=>{const a=regions.get(n.region)||[];a.push(n);regions.set(n.region,a);});
    buffer.regionLabels=[];
    regions.forEach((nodes,name)=>{if(nodes.length<2)return;let x=nodes.reduce((n,p)=>n+p.x,0)/nodes.length,y=nodes.reduce((n,p)=>n+p.y,0)/nodes.length+55;if(nearCity(x,y,45))y+=32;buffer.regionLabels.push({name,x,y});});
    if(theme.id==='winter')for(let i=0;i<85;i++){const x=rand()*(W-160),y=rand()*H;if(atSea(x,y)||nearCity(x,y,45))continue;ellipse(c,x,y,12+rand()*25,3+rand()*6,'#f6f7ecb8');}
    if(theme.id==='autumn')for(let i=0;i<70;i++){const x=rand()*(W-160),y=rand()*H;if(atSea(x,y)||nearCity(x,y,45))continue;ellipse(c,x,y,1.7,.7,i%2?'#b7895077':'#bf795c66');}
    [[108.8,30.55],[116.5,30.2],[120.3,31.95],[122.9,28.9]].forEach((p,i)=>{const[x,y]=geo(...p);boat(c,x,y,.38+(i%2)*.1);});
    c.save();c.translate(76,72);c.strokeStyle='#9aa389';c.lineWidth=.8;c.beginPath();c.arc(0,0,21,0,Math.PI*2);c.stroke();poly(c,[[0,-31],[6,1],[0,-5],[-6,1]],'#778f72');poly(c,[[0,27],[4,0],[0,5],[-4,0]],'#b8bea0');c.beginPath();c.moveTo(-28,0);c.lineTo(28,0);c.stroke();c.font='11px Georgia, serif';c.fillStyle='#7f8c70';c.fillText('N',0,-38);c.restore();
    c.font='12px "STKaiti", "KaiTi", serif';c.fillStyle=theme.ink;c.textAlign='left';c.fillText(`${theme.name} · ${theme.description}`,32,H-29);
    c.textAlign='right';c.fillText('地理布局示意',W-35,H-29);
    for(let i=0;i<19000;i++){c.fillStyle=i%2?'rgba(103,119,78,.027)':'rgba(255,255,236,.10)';c.fillRect(rand()*W,rand()*H,.6+rand()*.8,.5);}
    buffer.riverGleams = riverSamples.filter((_, index) => index % 3 === 0);
    return buffer;
  }

  function create(canvas, callbacks = {}) {
    const ctx = canvas.getContext('2d');
    let seasonId = 'summer', seasonTheme = SEASONS[seasonId], terrain = createTerrain(seasonTheme);
    const terrainCache = new Map([[seasonId, terrain]]);
    let state = null, selected = null, targetFrom = null, hover = null, hoverHint = null;
    let alive = true, active = true, frame = 0, lastFrame = 0, width = 1, height = 1, dpr = 1, scale = 1, ox = 0, oy = 0;
    let moving = false, baseScale = 1, zoom = 1, panX = 0, panY = 0;
    let playback = null, selectedMovement = null, movementHits = [], movementClose = null, selectedArmyId = null;
    const armyTracks = new Map();
    let cityLabelHits = [], displayedLabels = [], cityLabelPlan = new Map();
    let suppressClick = false, pointerOrigin = null, dragStarted = false;
    const pointers = new Map(), routeCache = new Map(), settlementCache = new Map();
    let screenRoadCache = null, screenRoadIndex = new Map();
    const originalTouchAction = canvas.style.touchAction;
    const originalTabIndex = canvas.getAttribute('tabindex');
    canvas.style.touchAction = 'none';
    if (originalTabIndex === null) canvas.tabIndex = 0;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const cityList = () => state ? (Array.isArray(state.cities) ? state.cities : Object.values(state.cities || {})) : [];
    const factionList = () => state ? (Array.isArray(state.factions) ? state.factions : Object.values(state.factions || {})) : [];
    const factionColor = (owner) => factionList().find(f => f.id === owner)?.color || COLORS[owner] || COLORS.neutral;
    const factionFlag = owner => factionList().find(f => f.id === owner)?.flag || factionList().find(f => f.id === owner)?.name?.slice(0,1) || '守';
    const isCapital = city => city.owner !== 'neutral' && factionList().some(f => f.id === city.owner && f.capital === city.id);
    const edges = () => globalThis.TKEngine?.DATA?.edges || EDGES;
    const pair = edge => Array.isArray(edge) ? edge : [edge.from || edge.a, edge.to || edge.b];
    const adjacent = (a, b) => edges().some(edge => { const [u, v] = pair(edge); return (a === u && b === v) || (a === v && b === u); });
    const position = city => {
      const display = globalThis.TKMapLayout?.position(city);
      if (display) return [display.x, display.y];
      const fallback = CITIES.find(c => c[0] === city.id);
      return [city.x ?? fallback?.[1] ?? 0, city.y ?? fallback?.[2] ?? 0];
    };
    const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
    const troopCount = city => {
      if (Number.isFinite(city.troops)) return city.troops;
      return Object.values(city.units || {}).reduce((sum, value) => sum + (typeof value === 'number' ? value : Number(value?.count || value?.troops || 0)), 0);
    };
    const place = city => PLACES[city.id] || { kind: 'town', label: '州郡城邑', terrain: '平原', region: '九州' };

    function routeFor(from, to) {
      const start = position(from), end = position(to), key = `${from.id}|${to.id}|${start}|${end}`;
      if (routeCache.has(key)) return routeCache.get(key);
      const planned=globalThis.TKMapLayout?.route(from,to);
      if(planned?.length){const route=sampledRoute(planned.map(p=>[p.x,p.y]),[from.id,to.id]);routeCache.set(key,route);return route;}
      const distance = Math.max(1, Math.hypot(end[0] - start[0], end[1] - start[1]));
      const canonical = [from.id, to.id].sort().join('|'), seed = [...canonical].reduce((n, ch) => n + ch.charCodeAt(0), 0);
      const bend = Math.min(17, distance * .10) * (seed % 2 ? 1 : -1) * (from.id < to.id ? 1 : -1);
      const waypoints = [[(start[0] + end[0]) / 2 - (end[1] - start[1]) / distance * bend, (start[1] + end[1]) / 2 + (end[0] - start[0]) / distance * bend]];
      const points = [[start[0], start[1] + 9], ...waypoints, [end[0], end[1] + 9]], samples = [];
      // A sampled Catmull–Rom curve is shared by roads and moving units.
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[Math.max(0, i - 1)], b = points[i], c = points[i + 1], d = points[Math.min(points.length - 1, i + 2)];
        for (let step = 0; step < 12; step++) {
          const t = step / 12, t2 = t * t, t3 = t2 * t;
          samples.push([0, 1].map(axis => .5 * ((2 * b[axis]) + (-a[axis] + c[axis]) * t + (2 * a[axis] - 5 * b[axis] + 4 * c[axis] - d[axis]) * t2 + (-a[axis] + 3 * b[axis] - 3 * c[axis] + d[axis]) * t3)));
        }
      }
      samples.push(points[points.length - 1]);
      const route = sampledRoute(samples, [from.id, to.id]);
      if (routeCache.size > 512) routeCache.clear(); routeCache.set(key, route); return route;
    }
    function sampledRoute(samples, cityIds) {
      const lengths = [0];
      for (let i = 1; i < samples.length; i++) lengths.push(lengths[i - 1] + Math.hypot(samples[i][0] - samples[i - 1][0], samples[i][1] - samples[i - 1][1]));
      const total = lengths[lengths.length - 1];
      return {
        samples, cityIds, length: total,
        point(t) {
          const distance = clamp(t, 0, 1) * total;
          let i = lengths.findIndex(length => length >= distance); if (i < 1) return samples[0];
          const fraction = (distance - lengths[i - 1]) / Math.max(.0001, lengths[i] - lengths[i - 1]);
          return [samples[i - 1][0] + (samples[i][0] - samples[i - 1][0]) * fraction, samples[i - 1][1] + (samples[i][1] - samples[i - 1][1]) * fraction];
        },
      };
    }
    function movementRoute(from, to) {
      // Rescued officers can wait outside a full city without travelling an edge.
      if (from.id === to.id) {
        const [x, y] = position(from);
        return sampledRoute([[x, y + 9], [x, y + 9]], [from.id]);
      }
      if (adjacent(from.id, to.id)) return routeFor(from, to);
      // Released officers may return to a distant city. Stitch the shortest real
      // road route instead of drawing a fictitious direct cross-country road.
      const cities = cityList(), distances = new Map([[from.id, 0]]), previous = new Map(), remaining = new Set(cities.map(city => city.id));
      while (remaining.size) {
        let nearest = null, best = Infinity;
        remaining.forEach(id => { if ((distances.get(id) ?? Infinity) < best) { nearest = id; best = distances.get(id); } });
        if (nearest === null) break;
        if (nearest === to.id) {
          const ids = [to.id];
          while (ids[0] !== from.id) { const id = previous.get(ids[0]); if (!id) return null; ids.unshift(id); }
          const samples = [];
          for (let i = 0; i < ids.length - 1; i++) {
            const segment = routeFor(cities.find(c => c.id === ids[i]), cities.find(c => c.id === ids[i + 1]));
            samples.push(...segment.samples.slice(i ? 1 : 0));
          }
          return sampledRoute(samples, ids);
        }
        remaining.delete(nearest);
        edges().forEach(edge => {
          const [a, b] = pair(edge), neighbor = a === nearest ? b : b === nearest ? a : null;
          if (!neighbor || !remaining.has(neighbor)) return;
          const here = cities.find(c => c.id === nearest), next = cities.find(c => c.id === neighbor);
          if (!here || !next) return;
          const distance = best + routeFor(here, next).length;
          if (distance < (distances.get(neighbor) ?? Infinity)) { distances.set(neighbor, distance); previous.set(neighbor, nearest); }
        });
      }
      return null;
    }
    function roadPath(route) {
      ctx.beginPath(); route.samples.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p));
    }

    function drawRoads() {
      const cities = cityList();
      edges().forEach(edge => {
        const [a, b] = pair(edge), from = cities.find(c => c.id === a), to = cities.find(c => c.id === b);
        if (!from || !to) return;
        const available = targetFrom && ((a === targetFrom && to.owner !== state.player) || (b === targetFrom && from.owner !== state.player));
        const linked = from.owner === to.owner && from.owner !== 'neutral';
        const route = routeFor(from, to); roadPath(route);
        ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(125,121,86,.15)'; ctx.lineWidth = 6.2; ctx.stroke();
        ctx.strokeStyle = 'rgba(241,234,197,.94)'; ctx.lineWidth = available ? 5 : 3.5; ctx.stroke();
        ctx.strokeStyle = available ? '#b08b4c' : linked ? blend(factionColor(from.owner),'#acaa82',.66) : '#a4a382'; ctx.lineWidth = available ? 1.6 : .8;
        ctx.globalAlpha = available ? 1 : .65;
        ctx.setLineDash(available ? [7, 5] : []); ctx.stroke(); ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        if (zoom >= 1.7 && from.owner !== to.owner && (from.owner === state.player || to.owner === state.player)) {
          const [mx, my] = route.point(.5); ellipse(ctx, mx, my, 4, 4, '#efe9cf');
          ctx.strokeStyle = '#b99965'; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(mx - 2, my - 2); ctx.lineTo(mx + 2, my + 2); ctx.moveTo(mx + 2, my - 2); ctx.lineTo(mx - 2, my + 2); ctx.stroke();
        }
      });
      // Crossings are attached to actual river-city roads, rather than old map coordinates.
      cities.filter(city => city.terrain === 'river' && city.kind !== 'pass').forEach(city => {
        const neighbor = cities.find(other => other.id !== city.id && adjacent(city.id, other.id));
        if (!neighbor) return;
        const route = routeFor(city, neighbor), a = route.point(.18), b = route.point(.20);
        bridge(ctx, ...a, Math.atan2(b[1] - a[1], b[0] - a[0]) - Math.PI / 2, .48);
      });
    }

    // One coherent frontal illustration language: broad wall, arched gateway,
    // low roofs and a few large shaded planes. No simulated isometric bricks.
    function roof(c,x,y,halfWidth,rise,color) {
      c.save();c.translate(x,y);
      c.beginPath();c.moveTo(-halfWidth,0);
      c.quadraticCurveTo(-halfWidth*.72,-.5,-halfWidth*.52,-rise);
      c.lineTo(halfWidth*.52,-rise);
      c.quadraticCurveTo(halfWidth*.72,-.5,halfWidth,0);
      c.quadraticCurveTo(0,2,-halfWidth,0);c.closePath();
      c.fillStyle=seasonId==='winter'?'#e9ede3':blend(color,'#eee3bd',.13);c.fill();
      c.strokeStyle=blend(color,'#263a38',.42);c.lineWidth=.8;c.stroke();
      // A continuous coloured fascia stays visible under winter snow.
      c.fillStyle=blend(color,'#263a38',.22);c.fillRect(-halfWidth+1,.2,halfWidth*2-2,2.2);
      c.strokeStyle=seasonId==='winter'?'#fffdf0':blend(color,'#fff0cd',.36);c.lineWidth=.8;
      c.beginPath();c.moveTo(-halfWidth*.5,-rise+.6);c.lineTo(halfWidth*.5,-rise+.6);c.stroke();
      c.restore();
    }
    function facade(c,x,y,w,h,color,shade=false) {
      roundRect(c,x,y,w,h,.6,color,'#656d5a');
      c.fillStyle=shade?'#59685325':'#fff6d42b';c.fillRect(x+1,y+1,Math.max(0,w-2),2);
      c.fillStyle='#59685320';c.fillRect(x+w-3,y+2,2,Math.max(0,h-3));
    }
    function gateway(c,x,bottom,halfWidth,height) {
      c.save();c.translate(x,bottom);
      c.beginPath();c.moveTo(-halfWidth,0);c.lineTo(-halfWidth,-height+halfWidth);
      c.quadraticCurveTo(-halfWidth,-height,0,-height);c.quadraticCurveTo(halfWidth,-height,halfWidth,-height+halfWidth);
      c.lineTo(halfWidth,0);c.closePath();c.fillStyle='#394840';c.fill();c.strokeStyle='#e3d6b7';c.lineWidth=1.2;c.stroke();
      c.fillStyle='#77664b';c.fillRect(-halfWidth+1,-height*.5,halfWidth*2-2,height*.5);
      c.strokeStyle='#403e31';c.lineWidth=.8;c.beginPath();c.moveTo(0,-height*.51);c.lineTo(0,0);c.stroke();
      c.restore();
    }
    function rampart(c,halfWidth,top,bottom,color) {
      facade(c,-halfWidth,top,halfWidth*2,bottom-top,'#b9b296');
      // A broad flat wall walk and sparse battlements, not rows of tiny cubes.
      c.fillStyle=seasonId==='winter'?'#e8ebdd':'#d7ceb0';c.fillRect(-halfWidth,top,halfWidth*2,2.5);
      c.fillStyle=blend(color,'#aaa38b',.36);c.fillRect(-halfWidth+1,top+3,halfWidth*2-2,2.5);
      const count=Math.round(halfWidth/6);
      for(let i=0;i<=count;i++)facade(c,-halfWidth+i*(halfWidth*2-5)/count,top-3,5,4,seasonId==='winter'?'#e2e7d7':'#c8c2a6');
      c.strokeStyle='#8a8b724a';c.lineWidth=.6;c.beginPath();c.moveTo(-halfWidth+3,bottom-5);c.lineTo(halfWidth-3,bottom-5);c.stroke();
    }
    function hangingBanner(c,x,y,color,height=8) {
      poly(c,[[x-3,y],[x+3,y],[x+3,y+height],[x,y+height-1.2],[x-3,y+height]],color,'#eee1bc',.55);
      c.strokeStyle='#f5e7c6';c.lineWidth=.7;c.beginPath();c.moveTo(x-1.4,y+2);c.lineTo(x+1.4,y+2);c.stroke();
    }
    function hall(c,x,y,halfWidth,height,color,upper=false) {
      facade(c,x-halfWidth,y,halfWidth*2,height,blend('#d4c29f',color,.18));
      c.fillStyle='#48584a';
      for(const dx of [-halfWidth*.5,halfWidth*.5])c.fillRect(x+dx-1.3,y+4,2.6,Math.min(4,height-5));
      roof(c,x,y,halfWidth+4,upper?5:6,color);
    }
    function greatCity(c,color) {
      // Frontal, layered city silhouette: inner citadel, raised gatehouse and
      // broad outer curtain. It reads as a fortified city even at map scale.
      const stone='#b3ad97',pale='#d3c8a9',ink=blend(color,'#303b3b',.5);
      hall(c,0,-51,13,15,color);
      roof(c,0,-51,18,8,color);
      c.fillStyle=ink;c.fillRect(-7,-46,14,6);
      for(const x of [-8,0,8]){c.fillStyle=pale;c.fillRect(x-1,-46,2,9);}
      rampart(c,36,-25,1,color);
      for(const side of [-1,1]) {
        const x=side*29;
        hall(c,x,-35,6.5,16,color);
        c.fillStyle=ink;c.fillRect(x-2,-30,4,6);
      }
      rampart(c,44,-14,12,color);
      // The outer bastions have flat crenellations, unlike the small-city roofs.
      for(const side of [-1,1]) {
        const x=side*43;
        facade(c,x-6,-23,12,35,stone);
        c.fillStyle=pale;c.fillRect(x-6,-24,12,3);
        for(const dx of [-5,0,5])facade(c,x+dx-1.5,-27,3,5,pale);
        c.fillStyle=ink;c.fillRect(x-1.4,-17,2.8,7);
        c.fillStyle=blend(color,'#c4b692',.24);c.fillRect(x-5,-4,10,3);
        gateway(c,side*29,12,3.3,11);
      }
      // A two-storey central gatehouse and a deep, tall city gate.
      facade(c,-17,-26,34,38,blend('#c7ba98',color,.12));
      hall(c,0,-40,11,16,color);roof(c,0,-40,17,7,color);
      c.fillStyle=ink;c.fillRect(-7,-35,14,5);
      c.fillStyle=pale;for(const x of [-8,0,8])c.fillRect(x-1,-36,2,9);
      roof(c,0,-26,23,7,color);
      gateway(c,0,12,6.8,21);
      c.fillStyle='#ebd9ad';c.fillRect(-10,10,20,2);
      hangingBanner(c,-23,-9,color,13);hangingBanner(c,23,-9,color,13);
      // Sparse masonry courses preserve the flat style without miniature bricks.
      c.strokeStyle='#787d6b66';c.lineWidth=.7;c.beginPath();
      for(const y of [0,7]){c.moveTo(-36,y);c.lineTo(-18,y);c.moveTo(18,y);c.lineTo(36,y);}c.stroke();
    }
    function capitalSeal(c,major,color) {
      // A gold-rimmed seal marks the owner's seat; city size stays independent.
      const y=major?-16:-10;
      poly(c,[[-4.2,y],[0,y-4.5],[4.2,y],[0,y+4.5]],'#dfbd70','#8c6a32',.9);
      poly(c,[[-2,y],[0,y-2.1],[2,y],[0,y+2.1]],blend(color,'#24373d',.35));
      const top=major?-40:-19,half=major?17:14;
      c.strokeStyle='#e1c078';c.lineWidth=1.2;c.beginPath();c.moveTo(-half,top+1);c.lineTo(half,top+1);c.stroke();
    }
    function settlement(city,symbolScale) {
      const info=place(city),major=city.tier==='major',capital=isCapital(city),pass=city.kind==='pass',color=factionColor(city.owner);
      const res=Math.min(4,Math.max(2,Math.ceil(scale*symbolScale*dpr)));
      const key=`citadel-v2|${city.id}|${city.owner}|${color}|${major}|${capital}|${city.wall}|${res}|${seasonId}`;
      if(settlementCache.has(key))return settlementCache.get(key);
      const image=document.createElement('canvas');image.width=128*res;image.height=108*res;
      const c=image.getContext('2d');c.scale(res,res);c.translate(64,72);
      ellipse(c,0,12,pass?43:major?49:33,3,'rgba(61,77,52,.13)');
      if(pass) {
        // A long single wall closes the mountain gap. The gate dominates.
        poly(c,[[-48,10],[-43,-10],[-34,-23],[-29,-7],[-30,10]],'#9fa993');
        poly(c,[[-43,-10],[-34,-23],[-36,2],[-30,10]],'#c3c9af');
        poly(c,[[30,10],[31,-12],[40,-22],[48,10]],'#899c8b');
        poly(c,[[31,-12],[40,-22],[39,4],[48,10]],'#b7c2a9');
        rampart(c,38,-10,10,color);
        facade(c,-40,-15,8,25,'#aaa88f');facade(c,32,-15,8,25,'#aaa88f');
        facade(c,-12,-24,24,34,'#c2b99c');
        roof(c,0,-24,17,6,color);gateway(c,0,10,5.3,17);
        hangingBanner(c,-24,-6,color,10);hangingBanner(c,24,-6,color,10);
        if(seasonId==='winter') {poly(c,[[-43,-10],[-34,-23],[-31,-13],[-36,-15]],'#edf0e2');poly(c,[[32,-12],[40,-22],[43,-13],[38,-15]],'#edf0e2');}
      } else if(major) {
        greatCity(c,color);
      } else {
        const half=30,top=-9;
        // Rear hall has the same frontal projection as the entire foreground.
        hall(c,0,-29,10,12,color);
        rampart(c,half,top,10,color);
        for(const side of [-1,1]) {
          const x=side*(half-3),towerTop=-17;
          facade(c,x-4.5,towerTop,9,10-towerTop,'#c4bda0');
          roof(c,x,towerTop,7.5,4.2,color);
          c.fillStyle='#69755d';c.fillRect(x-1,towerTop+5,2,4);
        }
        const gateTop=-19,gateHalf=9;
        facade(c,-gateHalf,gateTop,gateHalf*2,10-gateTop,blend('#c6b590',color,.16));
        roof(c,0,gateTop,gateHalf+5,5.8,color);
        gateway(c,0,10,4.2,13);
        hangingBanner(c,-half*.55,top+5,color);hangingBanner(c,half*.55,top+5,color);
        if(info.kind==='port') {
          // One small quay is part of the silhouette, not a scattered village.
          c.fillStyle='#ae9875';c.fillRect(half-4,13,15,3);
          c.strokeStyle='#7f8569';c.lineWidth=1;c.beginPath();c.moveTo(half-1,13);c.lineTo(half-1,19);c.moveTo(half+8,13);c.lineTo(half+8,19);c.stroke();
          boat(c,half+3,20,.18,false);
        }
      }
      if(capital&&!pass)capitalSeal(c,major,color);
      if(settlementCache.size>100)settlementCache.clear();settlementCache.set(key,image);return image;
    }

    function drawCity(city, time) {
      const [x,y]=position(city),color=factionColor(city.owner),pass=city.kind==='pass';
      const chosen=selected===city.id,hovered=hover===city.id;
      const isTarget=targetFrom&&city.id!==targetFrom&&city.owner!==state.player&&adjacent(targetFrom,city.id);
      const symbolScale=pass?.86:city.tier==='major'?.9:.69;
      ctx.save();ctx.translate(x,y);ctx.scale(symbolScale,symbolScale);
      // Only active interaction adds an outline; the city silhouette is its wall.
      if(chosen||isTarget||hovered) {
        const half=pass?44:city.tier==='major'?50:35;
        const outline=[[-half,6],[half,6],[half+2,15],[-half-2,15]];
        poly(ctx,outline,chosen?color+'18':isTarget?'#cba34c16':'#fffbea30');
        ctx.strokeStyle=isTarget?'#c3984d':color;ctx.lineWidth=1.5/(scale*symbolScale);
        ctx.globalAlpha=.65+(reduceMotion.matches?0:Math.sin(time/520)*.08);
        ctx.beginPath();outline.forEach((point,i)=>i?ctx.lineTo(...point):ctx.moveTo(...point));ctx.closePath();ctx.stroke();ctx.globalAlpha=1;
      }
      ctx.drawImage(settlement(city,symbolScale),-64,-72,128,108);
      // Pigmented tiles and cloth show ownership while walls retain masonry.
      const capital=isCapital(city),major=city.tier==='major';
      const fx=pass?22:major?30:25,fy=pass?-30:major?-45:-32,wave=reduceMotion.matches?0:Math.sin(time/410+x)*.7;
      ctx.strokeStyle='#756b51';ctx.lineWidth=.9;ctx.beginPath();ctx.moveTo(fx,fy+17);ctx.lineTo(fx,fy-5);ctx.stroke();
      poly(ctx,[[fx,fy-5],[fx+13,fy-3+wave],[fx+11,fy+7+wave],[fx,fy+5]],color,capital?'#e9c579':'#f5e9c9',capital?1.2:.6);
      if(capital){poly(ctx,[[fx-2,fy-7],[fx,fy-11],[fx+2,fy-7],[fx,fy-5]],'#dfbd70','#8c6a32',.6);}
      ctx.font='bold 8px "STKaiti", "KaiTi", serif';ctx.fillStyle='#fff6df';ctx.textAlign='center';ctx.fillText(city.owner==='neutral'&&!city.troops?'空':factionFlag(city.owner),fx+5.5,fy+3+wave/2);
      if(isTarget) {
        ctx.strokeStyle='#ac8041';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(42,-9);ctx.lineTo(48,-3);ctx.moveTo(48,-9);ctx.lineTo(42,-3);ctx.stroke();
      }
      ctx.restore();
    }

    function overlaps(a, b, gap = 3) {
      return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
    }
    function drawCityLabels() {
      cityLabelHits = []; cityLabelPlan.clear();
      const candidates = cityList().map(city => {
        const [x, y] = position(city), critical = selected === city.id;
        const target = targetFrom && city.owner !== state.player && adjacent(targetFrom, city.id);
        return { city, sx: ox + x * scale, sy: oy + y * scale, critical, target, score: (selected === city.id ? 12000 : target ? 5000 : city.tier === 'major' ? 100 : city.kind === 'pass' ? 80 : city.owner === state.player ? 60 : 20) };
      }).filter(item => item.sx > -30 && item.sx < width + 30 && item.sy > -30 && item.sy < height + 30).sort((a, b) => b.score - a.score);
      ctx.save();
      for (const item of candidates) {
        const { city, sx, sy, critical, target } = item;
        const text = city.name || city.id;
        // A stable, compact nameplate at every zoom. Hover never changes its
        // geometry or layout priority, so label-edge hit tests cannot flicker.
        ctx.font = '600 10px "Microsoft YaHei", sans-serif';
        const labelW = Math.max(42, Math.ceil(ctx.measureText(text).width) + 28), labelH = 16;
        const baseY = sy + (city.kind === 'pass' ? 9 : 20) * scale;
        const places = [[sx - labelW / 2, baseY], [sx - labelW / 2, sy - 33 * scale - labelH], [sx + 25 * scale, sy - labelH / 2], [sx - 25 * scale - labelW, sy - labelH / 2]];
        if (critical) {
          for (let radius = 32; radius <= 128; radius += 24) for (let step = 0; step < 8; step++) {
            const angle = step * Math.PI / 4;
            places.push([clamp(sx + Math.cos(angle) * radius - labelW / 2, 4, width - labelW - 4), clamp(sy + Math.sin(angle) * radius - labelH / 2, 4, height - labelH - 4)]);
          }
        }
        let bounds = places.map(([x, y]) => ({ x, y, width: labelW, height: labelH })).find(rect => rect.x >= 3 && rect.y >= 3 && rect.x + rect.width <= width - 3 && rect.y + rect.height <= height - 3 && !displayedLabels.some(old => overlaps(rect, old)));
        if (!bounds) continue;
        const ownColor = factionColor(city.owner);
        const anchorX = clamp(sx, bounds.x + 3, bounds.x + labelW - 3), anchorY = clamp(sy, bounds.y + 3, bounds.y + labelH - 3);
        if (Math.hypot(anchorX - sx, anchorY - sy) > 16) {
          ctx.strokeStyle = critical ? '#849a6faa' : '#9da78988'; ctx.lineWidth = .7;
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(anchorX, anchorY); ctx.stroke();
        }
        roundRect(ctx, bounds.x, bounds.y, labelW, labelH, 3, blend(ownColor, '#fffae9', .92) + 'dc', target ? '#b58830' : ownColor + 'a0');
        roundRect(ctx, bounds.x + 2, bounds.y + 2, 12, 12, 2, ownColor);
        ctx.font = 'bold 9px "STKaiti", "KaiTi", serif'; ctx.fillStyle = '#fff8e7'; ctx.textAlign = 'center';
        ctx.fillText(city.owner==='neutral'&&!city.troops?'空':factionFlag(city.owner), bounds.x + 8, bounds.y + 11);
        ctx.font = '600 10px "Microsoft YaHei", sans-serif'; ctx.fillStyle = blend(ownColor, '#283630', .45);
        ctx.fillText(text, bounds.x + 15 + (labelW - 18) / 2, bounds.y + 11.5);
        if(city.owner===state.player){ctx.font='bold 7px "Microsoft YaHei",sans-serif';ctx.fillStyle=city.governorId?'#41756a':'#a56b45';ctx.textAlign='right';ctx.fillText(city.governorId?'守':'缺',bounds.x+labelW-2,bounds.y+7);}
        cityLabelHits.push({ ...bounds, city }); displayedLabels.push(bounds); cityLabelPlan.set(city.id, bounds);
      }
      ctx.restore();
    }

    function clearHover() {
      hoverHint = null;
      if (hover === null) return;
      hover = null; callbacks.onCityHover?.(null);
    }
    function screenRoadSegments() {
      if (screenRoadCache) return screenRoadCache;
      const cities = cityList(), segments = [];
      edges().forEach(edge => {
        const [a, b] = pair(edge), from = cities.find(c => c.id === a), to = cities.find(c => c.id === b);
        if (!from || !to) return;
        const samples = routeFor(from, to).samples.map(point => [ox + point[0] * scale, oy + point[1] * scale]);
        for (let i = 1; i < samples.length; i++) segments.push([samples[i - 1], samples[i]]);
      });
      screenRoadIndex = new Map();
      for (const segment of segments) {
        const [a, b] = segment;
        for (let gx = Math.floor(Math.min(a[0], b[0]) / 64); gx <= Math.floor(Math.max(a[0], b[0]) / 64); gx++) {
          for (let gy = Math.floor(Math.min(a[1], b[1]) / 64); gy <= Math.floor(Math.max(a[1], b[1]) / 64); gy++) {
            const key = `${gx},${gy}`;
            if (!screenRoadIndex.has(key)) screenRoadIndex.set(key, []);
            screenRoadIndex.get(key).push(segment);
          }
        }
      }
      screenRoadCache = segments;
      return segments;
    }
    function crossesRoad(rect, padding = 2) {
      // A small screen-space index keeps dense army layout out of an all-roads
      // scan for each candidate on every animation frame.
      screenRoadSegments();
      for (let gx = Math.floor((rect.x - padding) / 64); gx <= Math.floor((rect.x + rect.width + padding) / 64); gx++) {
        for (let gy = Math.floor((rect.y - padding) / 64); gy <= Math.floor((rect.y + rect.height + padding) / 64); gy++) {
          for (const [a, b] of screenRoadIndex.get(`${gx},${gy}`) || []) if (segmentCrossesRect(a, b, rect, padding)) return true;
        }
      }
      return false;
    }
    function segmentCrossesRect(a, b, rect, padding = 4) {
      // Clip the actual sampled road segment against a padded tooltip rectangle.
      // Checking only segment bounds wrongly rejects space beside diagonal roads.
      if (Math.max(a[0], b[0]) < rect.x - padding || Math.min(a[0], b[0]) > rect.x + rect.width + padding || Math.max(a[1], b[1]) < rect.y - padding || Math.min(a[1], b[1]) > rect.y + rect.height + padding) return false;
      let low = 0, high = 1;
      const dx = b[0] - a[0], dy = b[1] - a[1];
      for (const [p, q] of [[-dx, a[0] - rect.x + padding], [dx, rect.x + rect.width + padding - a[0]], [-dy, a[1] - rect.y + padding], [dy, rect.y + rect.height + padding - a[1]]]) {
        if (!p) { if (q < 0) return false; continue; }
        const t = q / p;
        if (p < 0) low = Math.max(low, t); else high = Math.min(high, t);
        if (low > high) return false;
      }
      return true;
    }
    function drawCityHover() {
      const city = hover && cityList().find(item => item.id === hover);
      if (!city || pointers.size || dragStarted) return;
      const [x, y] = position(city), sx = ox + x * scale, sy = oy + y * scale;
      const text = `驻军 ${troopCount(city).toLocaleString('zh-CN')} 人`;
      ctx.save(); ctx.font = '10.5px "Microsoft YaHei", sans-serif';
      if (!hoverHint || hoverHint.id !== city.id || hoverHint.text !== text || displayedLabels.some(rect => overlaps(hoverHint.bounds, rect, 3))) {
        const w = Math.ceil(ctx.measureText(text).width) + 16, h = 22;
        const cities = cityList(), roadSegments = screenRoadSegments();
        const citySymbols = cities.map(c => {
          const box=globalThis.TKMapLayout?.footprint(c);
          if(box)return {x:ox+box.x*scale,y:oy+box.y*scale,width:box.width*scale,height:box.height*scale};
          const [cx, cy] = position(c), symbol = c.kind === 'pass' ? .86 : c.tier === 'major' ? .9 : .69;
          return { x: ox + (cx - 50 * symbol) * scale, y: oy + (cy - 61 * symbol) * scale, width: 100 * symbol * scale, height: 85 * symbol * scale };
        });
        const label = cityLabelPlan.get(city.id);
        const positions = label ? [[label.x + label.width + 7, label.y - 3], [label.x - w - 7, label.y - 3], [label.x + (label.width - w) / 2, label.y + label.height + 7]] : [];
        for (let radius = 38; radius <= 158; radius += 24) for (let angle = 0; angle < 8; angle++) {
          positions.push([sx + Math.cos(angle * Math.PI / 4) * radius - w / 2, sy + Math.sin(angle * Math.PI / 4) * radius - h / 2]);
        }
        let best = null, bestScore = Infinity;
        positions.forEach(([px, py]) => {
          const rect = { x: clamp(px, 6, width - w - 6), y: clamp(py, 6, height - h - 6), width: w, height: h };
          const coveredLabels = displayedLabels.filter(other => overlaps(rect, other, 5)).length;
          const coveredCities = citySymbols.filter(other => overlaps(rect, other, 4)).length;
          const coveredRoads = roadSegments.filter(([a, b]) => segmentCrossesRect(a, b, rect)).length;
          const score = (coveredLabels + coveredCities) * 100000 + coveredRoads * 10000 + Math.hypot(rect.x + w / 2 - sx, rect.y + h / 2 - sy);
          if (score < bestScore) { best = rect; bestScore = score; }
        });
        hoverHint = { id: city.id, text, bounds: best };
      }
      const bounds = hoverHint.bounds;
      // This overlay is deliberately absent from city and army hit regions.
      roundRect(ctx, bounds.x, bounds.y, bounds.width, bounds.height, 4, 'rgba(255,251,239,.76)', factionColor(city.owner) + '80');
      ctx.fillStyle = '#52604b'; ctx.textAlign = 'center'; ctx.fillText(text, bounds.x + bounds.width / 2, bounds.y + 15);
      ctx.restore();
    }

    function drawInfluence() {
      cityList().forEach(city => {
        if (city.owner === 'neutral') return;
        const [x, y] = position(city), color = factionColor(city.owner);
        ctx.save(); ctx.translate(x, y); ctx.scale(1, .62);
        const wash = ctx.createRadialGradient(0, 0, 16, 0, 0, 111);
        wash.addColorStop(0, color); wash.addColorStop(1, `${color}00`);
        ctx.globalAlpha = .18; ctx.fillStyle = wash; ctx.fillRect(-111, -111, 222, 222); ctx.restore();
      });
    }
    function drawRegionNames() {
      ctx.save();ctx.textAlign='center';ctx.font=`${clamp(29*scale,12,25)/scale}px "STKaiti", "KaiTi", serif`;ctx.fillStyle=seasonTheme.ink;ctx.globalAlpha=.23;
      (terrain.regionLabels||[]).forEach(region=>ctx.fillText(region.name.split('').join(' '),region.x,region.y));ctx.restore();
    }
    function movementNames(record) {
      const ids = Array.isArray(record.generalIds) ? record.generalIds : [];
      return ids.map(id => state?.generals?.find(g => g.id === id)?.name).filter(Boolean);
    }
    function armyProgress(army) {
      const progress = Number.isFinite(army.progress) ? army.progress : Number(army.elapsedDays || 0) / Math.max(1, Number(army.travelDays || 1));
      const start = Number.isFinite(army.routeStartProgress) ? army.routeStartProgress : 0;
      const end = Number.isFinite(army.routeEndProgress) ? army.routeEndProgress : 1;
      return start + (end - start) * clamp(progress, 0, 1);
    }
    function visibleArmyProgress(track, time) {
      if (!track || reduceMotion.matches) return track?.toProgress || 0;
      const p = clamp((time - track.changedAt) / 430, 0, 1), ease = p * p * (3 - 2 * p);
      return track.fromProgress + (track.toProgress - track.fromProgress) * ease;
    }
    function syncArmies() {
      const time = performance.now(), ids = new Set();
      (state?.armies || []).filter(army => !army.status || army.status === 'marching').forEach(army => {
        const from = cityList().find(c => c.id === army.fromId), to = cityList().find(c => c.id === army.toId);
        if (!from || !to) return;
        const route = movementRoute(from, to); if (!route) return;
        const target = armyProgress(army), old = armyTracks.get(army.id), signature = `${army.fromId}|${army.toId}|${army.routeStartProgress ?? 0}|${army.routeEndProgress ?? 1}`;
        ids.add(army.id);
        if (old && old.signature === signature) {
          if (Math.abs(old.toProgress - target) > .00001) {
            old.fromProgress = visibleArmyProgress(old, time); old.toProgress = target; old.changedAt = time;
          }
          old.army = army; old.route = route;
        } else armyTracks.set(army.id, { army, route, signature, fromProgress: target, toProgress: target, changedAt: time });
      });
      armyTracks.forEach((_, id) => { if (!ids.has(id)) armyTracks.delete(id); });
      if (selectedArmyId && !ids.has(selectedArmyId)) { selectedArmyId = null; selectedMovement = null; }
    }
    function drawArmyRoutes(time) {
      armyTracks.forEach((track, id) => {
        if (track.route.length < .01) return;
        const army = track.army, selectedArmy = id === selectedArmyId, enemy = army.faction !== state.player;
        const destination = Number.isFinite(army.routeEndProgress) ? army.routeEndProgress : 1;
        const current = visibleArmyProgress(track, time), forward = destination >= current;
        ctx.beginPath();
        for (let i = 0; i <= 30; i++) { const point = track.route.point(current + (destination - current) * i / 30); i ? ctx.lineTo(...point) : ctx.moveTo(...point); }
        ctx.strokeStyle = enemy && army.kind === 'attack' ? '#bc624d' : factionColor(army.faction);
        ctx.globalAlpha = selectedArmy ? .8 : .36; ctx.lineWidth = (selectedArmy ? 2.2 : 1.3) / scale;
        ctx.setLineDash(selectedArmy ? [] : [4 / scale, 4 / scale]); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
        const arrowAt = clamp(destination - (forward ? .055 : -.055), 0, 1), point = track.route.point(arrowAt), before = track.route.point(clamp(arrowAt - (forward ? .014 : -.014), 0, 1));
        const angle = Math.atan2(point[1] - before[1], point[0] - before[0]);
        ctx.save(); ctx.translate(...point); ctx.rotate(angle); ctx.scale(1 / scale, 1 / scale);
        poly(ctx, [[0, 0], [-7, -3], [-5, 0], [-7, 3]], ctx.strokeStyle); ctx.restore();
        const targetCity = cityList().find(c => c.id === (army.destinationId || (destination === 0 ? army.fromId : army.toId)));
        if (army.kind === 'attack' && enemy && targetCity?.owner === state.player) {
          const [x, y] = position(targetCity); ctx.beginPath(); ctx.ellipse(x, y + 3, 39, 20, 0, 0, Math.PI * 2);
          ctx.strokeStyle = '#c65f48'; ctx.lineWidth = 1.2 / scale; ctx.stroke();
        }
      });
    }
    function drawPersistentArmies(time) {
      if (!Array.isArray(state?.armies)) return;
      movementHits = [];
      const ordered=[...armyTracks.values()].sort((a,b)=>Number(b.army.id===selectedArmyId)-Number(a.army.id===selectedArmyId)),tracks=[];
      const obstacles=cityList().map(c=>{const [cx,cy]=position(c),symbol=c.kind==='pass'?.86:c.tier==='major'?.9:.69,half=(c.kind==='pass'?41:c.tier==='major'?49:35)*symbol*scale;return {x:ox+cx*scale-half-3,y:oy+cy*scale-(c.tier==='major'?60:39)*symbol*scale-3,width:half*2+6,height:(c.tier==='major'?72:51)*symbol*scale+6};});
      for(const t of ordered){const p=t.route.point(visibleArmyProgress(t,time)),group=tracks.find(g=>g.army.faction===t.army.faction&&Math.hypot((g.position[0]-p[0])*scale,(g.position[1]-p[1])*scale)<24);if(group)group.members.push(t.army);else tracks.push({...t,position:p,members:[t.army]});}

      ctx.save();
      for (const track of tracks) {
        const army = track.members.length>1?{...track.army,stackIds:track.members.map(a=>a.id)}:track.army, position = track.position, x = ox + position[0] * scale, y = oy + position[1] * scale;
        if (x < -30 || x > width + 30 || y < -30 || y > height + 30) continue;
        const enemy = army.faction !== state.player, selectedArmy = army.id === selectedArmyId, color = factionColor(army.faction);
        const destination=cityList().find(city=>city.id===(army.destinationId||army.toId));
        const danger=enemy&&army.kind==='attack'&&destination?.owner===state.player;
        const iconScale = clamp(scale * .7, .5, .62);
        ctx.save(); ctx.translate(x, y); ctx.scale(iconScale, iconScale);
        ellipse(ctx, 0, 4, selectedArmy ? 15 : 12, 6, selectedArmy ? '#efe2b5dd' : '#536b4f20');
        if (selectedArmy) { ctx.beginPath(); ctx.arc(0, -4, 16, 0, Math.PI * 2); ctx.strokeStyle = '#b59954'; ctx.lineWidth = 1.4; ctx.stroke(); }
        // Three miniature ranks symbolize this recorded army; the label is its real total.
        const troops = track.members.reduce((n,a)=>n+(a.troops||0),0);
        const count = Math.min(5, Math.ceil(troops / 100));
        for (let i = 0; i < count; i++) {
          const px = -10 + (i % 3) * 5, py = Math.floor(i / 3) * 5;
          ctx.fillStyle = color; ctx.fillRect(px, py - 5, 3, 5); ellipse(ctx, px + 1.5, py - 6, 1.6, 1.6, '#d8c7a2');
        }
        if (!troops) { ellipse(ctx, -3, 0, 5, 3, '#9ca080'); ctx.fillStyle = color; ctx.fillRect(-5, -7, 4, 6); ellipse(ctx, -3, -9, 2, 2, '#d8c7a2'); }
        ctx.strokeStyle = '#788467'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(5, 4); ctx.lineTo(5, -20); ctx.stroke();
        const wave = reduceMotion.matches ? 0 : Math.sin(time / 270 + x) * .7;
        poly(ctx, [[5, -23], [23, -21 + wave], [20, -6 + wave], [5, -8]], color, danger ? '#c4422f' : '#fff8e5', danger ? 1.6 : .9);
        ctx.font = 'bold 10px "Microsoft YaHei", sans-serif'; ctx.fillStyle = '#fff8e2'; ctx.textAlign = 'center';ctx.fillText(army.releaseReturn?'归':army.kind === 'retreat' ? '退' : army.kind === 'reinforce' ? '援' : '征', 13, -12 + wave / 2);
        ctx.restore();
        const title = `${track.members.length>1?track.members.length+'队·':''}${troops.toLocaleString('zh-CN')}兵${army.waiting || army.waitingReason ? ' · 候入' : army.releaseReturn ? ' · 归乡' : ''}`;
        // Selection is a ring; commander details belong to the army panel.
        // Keep every count smaller than the 16px city nameplate at every zoom.
        ctx.font = '600 9px "Microsoft YaHei", sans-serif';
        const w = Math.max(35, Math.ceil(ctx.measureText(title).width) + 15), h = 12;
        let bounds = null, roadsideFallback = null;
        // City labels and silhouettes are reserved first. Army counts stack locally
        // from the real position before trying the rest of the visible map.
        const attempts = [];
        for(let row=0;row<8;row++)for(const column of [0,-1,1,-2,2])attempts.push([-w/2+column*(w+7),-17-h-row*(h+5)]);
        for(let row=0;row<5;row++)for(const column of [0,-1,1,-2,2])attempts.push([-w/2+column*(w+7),12+row*(h+5)]);
        for (const [dx, dy] of attempts) {
          const candidate = { x:x+dx, y:y+dy, width:w, height:h };
          if (candidate.x < 3 || candidate.y < 3 || candidate.x+w > width-3 || candidate.y+h > height-3 || [...displayedLabels,...obstacles].some(rect => overlaps(candidate,rect,2))) continue;
          if (crossesRoad(candidate)) { roadsideFallback ||= candidate; continue; }
          bounds=candidate;break;
        }
        if(!bounds){
          let nearest=Infinity;
          for(let py=5;py+h<height-4;py+=h+4)for(let px=5;px+w<width-4;px+=w+5){
            const candidate={x:px,y:py,width:w,height:h};if([...displayedLabels,...obstacles].some(rect=>overlaps(candidate,rect,2)))continue;
            if(crossesRoad(candidate)){roadsideFallback ||= candidate;continue;}
            const distance=Math.hypot(px+w/2-x,py+h-y);if(distance<nearest){bounds=candidate;nearest=distance;}
          }
        }
        // Even an exceptionally crowded loaded game must never lose its count.
        if(!bounds)bounds=roadsideFallback;if(!bounds)continue;
        movementHits.push({ record:army, x:x-17, y:y-25, width:37, height:36, screen:true });
        ctx.strokeStyle = `${color}aa`;ctx.lineWidth=.9;ctx.beginPath();ctx.moveTo(x,y-8);ctx.lineTo(bounds.x+w/2,bounds.y+h/2);ctx.stroke();
        roundRect(ctx,bounds.x,bounds.y,w,h,3,blend(color,'#fffaec',.94),danger?'#bd4935':selectedArmy?'#a38735':color);
        roundRect(ctx,bounds.x+1.5,bounds.y+1.5,9,9,2,color);
        ctx.font='bold 8px "STKaiti", "KaiTi", serif';ctx.fillStyle='#fff9e6';ctx.textAlign='center';ctx.fillText(factionFlag(army.faction),bounds.x+6,bounds.y+8.5);
        ctx.font='600 9px "Microsoft YaHei", sans-serif';ctx.fillStyle=danger?'#9d3429':blend(color,'#152521',.45);ctx.fillText(title,bounds.x+12+(w-14)/2,bounds.y+9);
        // Visual labels take precedence over generous touch targets of nearby armies.
        movementHits.push({record:army,...bounds,screen:true,precise:true});
        movementHits.push({record:army,x:bounds.x-4,y:bounds.y-5,width:w+8,height:h+10,screen:true});
        displayedLabels.push(bounds);
      }
      ctx.restore();
    }
    function drawMovements(time) {
      movementHits = [];
      if (!playback) return;
      const elapsed = time - playback.started;
      playback.entries.forEach((entry, index) => {
        const progress = reduceMotion.matches ? .58 : clamp((elapsed - entry.delay) / entry.duration, 0, 1);
        if (!reduceMotion.matches && (elapsed < entry.delay || elapsed > entry.delay + entry.duration + 350)) return;
        const record = entry.record, color = factionColor(record.faction || record.factionId), retreat = record.kind === 'retreat';
        const troopNumber = Number(record.troops || 0), relocatingGeneral = troopNumber === 0 && record.generalIds?.length;
        const released = relocatingGeneral && record.outcome === 'released';
        roadPath(entry.route); ctx.strokeStyle = color; ctx.globalAlpha = .18; ctx.lineWidth = 5; ctx.stroke(); ctx.globalAlpha = 1;
        const point = entry.route.point(progress), ahead = entry.route.point(Math.min(1, progress + .015));
        const direction = ahead[0] >= point[0] ? 1 : -1;
        const lift = Math.sin(time / 145 + index) * .9;
        ctx.save(); ctx.translate(point[0], point[1]);
        ellipse(ctx, 0, 6, 22, 7, 'rgba(71,92,54,.12)');
        const visibleUnits = Math.min(6, Math.ceil(troopNumber / 75));
        for (let n = 0; n < visibleUnits; n++) {
          const sx = (n % 3 - 1) * 7 - direction * 8, sy = Math.floor(n / 3) * 7 - 2;
          const walk = reduceMotion.matches ? 0 : Math.sin(time / 100 + n * 2) * .7;
          ctx.fillStyle = color; ctx.fillRect(sx - 2, sy - 5, 4, 5);
          ellipse(ctx, sx, sy - 7, 2, 2, '#dad0ae');
          ctx.strokeStyle = '#737e65'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx - 1, sy); ctx.lineTo(sx - 1 + walk, sy + 3); ctx.moveTo(sx + 1, sy); ctx.lineTo(sx + 1 - walk, sy + 3); ctx.stroke();
          ctx.strokeStyle = '#929472'; ctx.beginPath(); ctx.moveTo(sx + 4, sy - 10); ctx.lineTo(sx + 4, sy + 1); ctx.stroke();
        }
        if (relocatingGeneral) {
          // An unescorted transfer shows the officer alone, never fabricated soldiers.
          ellipse(ctx, -1, -1, 7, 4, '#9c9b7b'); ellipse(ctx, 5, -5, 3, 4, '#9c9b7b');
          ctx.strokeStyle = '#7d876d'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-5, 1); ctx.lineTo(-6, 6); ctx.moveTo(3, 1); ctx.lineTo(5, 6); ctx.stroke();
          poly(ctx, [[-5, -10], [1, -10], [4, -1], [-5, -2]], color); ellipse(ctx, -2, -13, 2.5, 2.5, '#d4bd92');
        }
        ctx.strokeStyle = '#7a8368'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(12, 3); ctx.lineTo(12, -25); ctx.stroke();
        poly(ctx, [[12, -25], [27, -23 + lift], [24, -12 + lift], [12, -14]], color, '#fff7de', .5);
        ctx.font = 'bold 8px "Microsoft YaHei", sans-serif'; ctx.fillStyle = '#f9f2d8'; ctx.textAlign = 'center';
        ctx.fillText(released ? '归' : relocatingGeneral ? '将' : retreat ? '退' : record.kind === 'reinforce' ? '援' : '征', 18, -16 + lift / 2);
        const names = movementNames(record), name = names.length ? names.slice(0, 2).join('、') + (names.length > 2 ? '等' : '') : factionList().find(f => f.id === record.faction)?.name || '行军';
        const count = Number(record.troops || 0).toLocaleString('zh-CN');
        ctx.font = '600 10px "Microsoft YaHei", sans-serif';
        const title = `${name} · ${released ? '返乡' : relocatingGeneral ? '赴任' : `${count}兵`}`, labelW = Math.min(172, Math.max(74, ctx.measureText(title).width + 20));
        ctx.shadowColor = '#50603d22'; ctx.shadowBlur = 7; ctx.shadowOffsetY = 2;
        roundRect(ctx, -labelW / 2, -47, labelW, 21, 5, '#faf6e5', selectedMovement?.id === record.id ? color : '#c6cdb0');
        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        ctx.fillStyle = color; ctx.fillText(title, 0, -33, labelW - 12);
        if (progress > .93) {
          ctx.beginPath(); ctx.ellipse(0, 8, 29 + progress * 5, 13, 0, 0, Math.PI * 2); ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.globalAlpha = .4; ctx.stroke(); ctx.globalAlpha = 1;
        }
        movementHits.push({ record, x: point[0] - labelW / 2, y: point[1] - 48, width: labelW, height: 67 });
        ctx.restore();
      });
    }
    function drawMapStatus() {
      // Interface text stays crisp and a constant size while the world is zoomed.
      ctx.save(); ctx.font = '10px "Microsoft YaHei", sans-serif'; ctx.textAlign = 'right'; ctx.fillStyle = '#869576';
      movementClose = null;
      if (selectedMovement) {
        const record = selectedMovement, from = cityList().find(c => c.id === record.fromId), to = cityList().find(c => c.id === record.toId);
        const w = Math.min(252, Math.max(120, width - 68)), x = 14, y = 55;
        roundRect(ctx, x, y, w, 94, 7, '#fbf8e9f5', '#c7d0b1');
        ctx.textAlign = 'left'; ctx.fillStyle = factionColor(record.faction || record.factionId); ctx.font = '600 11px "Microsoft YaHei", sans-serif';
        const relocating = !Number(record.troops) && record.generalIds?.length;
        ctx.fillText(relocating ? `${record.outcome === 'released' ? '获释返乡' : '调任'} · ${record.generalIds.length} 名武将` : `${record.kind === 'retreat' ? '撤军' : record.kind === 'reinforce' ? '驰援' : '出征'} · ${Number(record.troops || 0).toLocaleString('zh-CN')} 兵`, x + 12, y + 21);
        ctx.fillStyle = '#5b7052'; ctx.font = '12px "Microsoft YaHei", sans-serif'; ctx.fillText(`${from?.name || record.fromId} → ${to?.name || record.toId}`, x + 12, y + 43, w - 24);
        ctx.fillStyle = '#8a9878'; ctx.font = '10px "Microsoft YaHei", sans-serif';
        ctx.fillText(movementNames(record).join('、') || '地方军队', x + 12, y + 63, w - 24);
        const outcome = typeof record.outcome === 'string' ? ({ won: '攻城告捷', lost: '暂退整军', victory: '攻城告捷', defeat: '暂退整军', defeated: '战败撤回', marching: '行军途中', captured: '攻占目标城池', success: '行动完成', released: '获释返乡' }[record.outcome] || record.outcome) : '';
        ctx.fillText(`第 ${record.turn || state.turn} 回合${outcome ? ` · ${outcome}` : ' · 已记录的军情'}`, x + 12, y + 81, w - 24);
        ctx.fillStyle = '#91a083'; ctx.font = '16px sans-serif'; ctx.fillText('×', x + w - 23, y + 22);
        movementClose = { x: x + w - 32, y: y + 4, width: 28, height: 28 };
      }
      ctx.restore();
    }

    function draw(time = performance.now()) {
      if (!alive || !active) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#e8e9d2'; ctx.fillRect(0, 0, width, height);
      ctx.save(); ctx.translate(ox, oy); ctx.scale(scale, scale);
      ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
      ctx.drawImage(terrain, 0, 0, W, H);
      drawRegionNames();
      drawInfluence();
      drawRoads();
      drawArmyRoutes(time);
      cityList().slice().sort((a, b) => position(a)[1] - position(b)[1]).forEach(city => drawCity(city, time));
      if (!Array.isArray(state?.armies)) drawMovements(time);
      // Small glints of sunlight on the water.
      if (!reduceMotion.matches) {
        (terrain.riverGleams || []).forEach(([x, y], i) => {
          ctx.globalAlpha = .16 + Math.max(0, Math.sin(time / 900 + i * 2)) * .32;
          ctx.strokeStyle = '#fffce1'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x + 6, y); ctx.moveTo(x, y - 2); ctx.lineTo(x + 3, y - 2); ctx.stroke();
        });
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      displayedLabels=[];
      drawCityLabels();
      drawPersistentArmies(time);
      drawCityHover();
      drawMapStatus();
    }

    function updateView(notify = true) {
      screenRoadCache = null;
      clearHover();
      scale = baseScale * zoom;
      const maxPanX = Math.max(0, (W * scale - width) / 2), maxPanY = Math.max(0, (H * scale - height) / 2);
      panX = clamp(panX, -maxPanX, maxPanX); panY = clamp(panY, -maxPanY, maxPanY);
      ox = (width - W * scale) / 2 + panX; oy = (height - H * scale) / 2 + panY;
      canvas.dataset.mapZoom = zoom.toFixed(2);
      if (notify) callbacks.onViewChange?.({ zoom, canZoomIn: zoom < 4, canZoomOut: zoom > 1 });
    }
    function zoomAt(nextZoom, x = width / 2, y = height / 2) {
      nextZoom = clamp(nextZoom, 1, 4); if (Math.abs(nextZoom - zoom) < .001) return;
      const worldX = (x - ox) / scale, worldY = (y - oy) / scale;
      zoom = nextZoom; const nextScale = baseScale * zoom;
      panX = x - worldX * nextScale - (width - W * nextScale) / 2;
      panY = y - worldY * nextScale - (height - H * nextScale) / 2;
      updateView(); draw();
    }
    function resetView() { zoom = 1; panX = 0; panY = 0; updateView(); draw(); }
    function resize() {
      const rect = canvas.getBoundingClientRect(); width = rect.width || 1100; height = rect.height || 720;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      baseScale = Math.min(width / W, height / H); updateView(); draw();
    }
    function localPoint(event) {
      const rect = canvas.getBoundingClientRect(); return [event.clientX - rect.left, event.clientY - rect.top];
    }
    function worldPoint(event) {
      const [x, y] = localPoint(event); return [(x - ox) / scale, (y - oy) / scale];
    }
    function contains(bounds, x, y) {
      return bounds && x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height;
    }
    function hit(event) {
      const [sx, sy] = localPoint(event), label = cityLabelHits.find(item => contains(item, sx, sy));
      if (label) return label.city;
      const [x, y] = worldPoint(event);
      return cityList().map(city => {
        const [cx, cy] = position(city), symbol = city.kind === 'pass' ? .86 : city.tier === 'major' ? .9 : .69;
        const halfWidth = city.kind === 'pass' ? 41 : city.tier === 'major' ? 49 : 35;
        // Match the masonry/flag silhouette, not the offscreen cache rectangle
        // or the harbor apron. Army hit testing still takes priority.
        return { city, distance: Math.hypot(x - cx, y - cy), hit: Math.abs(x - cx) < Math.max(halfWidth * symbol, 9 / scale) && y > cy - (city.tier === 'major' ? 60 : 39) * symbol && y < cy + 12 * symbol };
      }).filter(item => item.hit).sort((a, b) => a.distance - b.distance)[0]?.city;
    }
    function hitArmy(event) {
      const screen = localPoint(event), world = worldPoint(event);
      const hits = movementHits.filter(item => contains(item, ...(item.screen ? screen : world)));
      const exact = hits.filter(item => item.precise);
      if (!exact.length && cityLabelHits.some(item => contains(item, ...screen))) return null;
      const candidates = exact.length ? exact : hits;
      return candidates.find(item => item.record.id === selectedArmyId) || candidates.at(-1);
    }
    function pointerDown(event) {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      clearHover();
      const [x, y] = localPoint(event); pointers.set(event.pointerId, { x, y });
      if (pointers.size === 1) { pointerOrigin = { x, y, panX, panY }; dragStarted = false; suppressClick = false; }
      else { suppressClick = true; dragStarted = true; }
      canvas.setPointerCapture?.(event.pointerId);
      draw();
    }
    function pointerMove(event) {
      if (pointers.has(event.pointerId)) {
        const previous = Array.from(pointers.values()), [x, y] = localPoint(event);
        pointers.set(event.pointerId, { x, y });
        if (pointers.size > 1) {
          const next = Array.from(pointers.values());
          const beforeDistance = Math.hypot(previous[0].x - previous[1].x, previous[0].y - previous[1].y);
          const afterDistance = Math.hypot(next[0].x - next[1].x, next[0].y - next[1].y);
          const beforeX = (previous[0].x + previous[1].x) / 2, beforeY = (previous[0].y + previous[1].y) / 2;
          if (beforeDistance > 1) zoomAt(zoom * afterDistance / beforeDistance, beforeX, beforeY);
          panX += (next[0].x + next[1].x) / 2 - beforeX; panY += (next[0].y + next[1].y) / 2 - beforeY;
          updateView(); draw(); return;
        }
        if (pointerOrigin && (dragStarted || Math.hypot(x - pointerOrigin.x, y - pointerOrigin.y) > 5)) {
          dragStarted = true; suppressClick = true;
          panX = pointerOrigin.panX + x - pointerOrigin.x; panY = pointerOrigin.panY + y - pointerOrigin.y;
          clearHover(); canvas.style.cursor = 'grabbing'; updateView(); draw(); return;
        }
      }
      if (event.pointerType && event.pointerType !== 'mouse') { clearHover(); draw(); return; }
      const city = hit(event),movement=city?null:hitArmy(event),nextHover=city?.id||null;
      canvas.style.cursor = city || movement ? 'pointer' : zoom > 1 ? 'grab' : 'default';
      if (nextHover !== hover) { hoverHint = null; hover = nextHover; callbacks.onCityHover?.(hover); draw(); }
    }
    function pointerUp(event) {
      if (event.type === 'pointercancel') suppressClick = true;
      pointers.delete(event.pointerId);
      if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (pointers.size === 1) {
        const next = Array.from(pointers.values())[0]; pointerOrigin = { ...next, panX, panY };
      } else if (!pointers.size) { pointerOrigin = null; dragStarted = false; }
      canvas.style.cursor = zoom > 1 ? 'grab' : 'default';
    }
    function pointerLeave() { if (pointers.size) return; clearHover(); canvas.style.cursor = zoom > 1 ? 'grab' : 'default'; draw(); }
    function click(event) {
      if (suppressClick) { suppressClick = false; return; }
      const [screenX, screenY] = localPoint(event);
      if (contains(movementClose, screenX, screenY)) { selectedMovement = null; draw(); return; }
      const chosenCity=hit(event);if(chosenCity){selectedMovement=null;selectedArmyId=null;callbacks.onCityClick?.(chosenCity.id);return;}
      const movement = hitArmy(event);
      if (movement) {
        selectedArmyId = movement.record.id; selectedMovement = callbacks.onMovementClick ? null : movement.record;
        callbacks.onMovementClick?.(movement.record); draw(); return;
      }
      const city = hit(event); if (city) { selectedMovement = null; selectedArmyId = null; callbacks.onCityClick?.(city.id); }
    }
    function wheel(event) {
      // Unmodified scrolling belongs to the page; Ctrl/⌘ wheel belongs to the map.
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault(); const [x, y] = localPoint(event);
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1);
      zoomAt(zoom * Math.exp(clamp(-delta * .002, -.4, .4)), x, y);
    }
    function keyDown(event) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomAt(zoom * 1.3); }
      else if (event.key === '-') { event.preventDefault(); zoomAt(zoom / 1.3); }
      else if (event.key === '0' || event.key === 'Home') { event.preventDefault(); resetView(); }
      else if (event.key.startsWith('Arrow')) {
        event.preventDefault(); const amount = event.shiftKey ? 90 : 35;
        if (event.key === 'ArrowLeft') panX += amount; if (event.key === 'ArrowRight') panX -= amount;
        if (event.key === 'ArrowUp') panY += amount; if (event.key === 'ArrowDown') panY -= amount;
        updateView(); draw();
      } else if (event.key === 'Escape') { selectedMovement = null; canvas.blur(); draw(); }
    }
    function endPlayback(cancelled = false) {
      if (!playback) return;
      const done = playback; playback = null; movementHits = []; clearTimeout(done.timer);
      const report = { cancelled, count: done.entries.length };
      // Resolve before user callbacks, so a callback exception cannot strand the UI.
      done.resolve(report); if (alive) draw();
      if (!cancelled) { try { done.onComplete?.(report); } catch (error) { console.error('Map movement completion callback failed:', error); } }
    }
    function playMovements(records, options = {}) {
      endPlayback(true); selectedMovement = null;
      if (!alive || !active) return Promise.resolve({ cancelled: true, count: 0 });
      if (Array.isArray(state?.armies)) {
        const report = { cancelled: false, count: 0 };
        try { options.onComplete?.(report); } catch (error) { console.error(error); }
        return Promise.resolve(report);
      }
      const entries = (Array.isArray(records) ? records : []).flatMap((record, index) => {
        if (!record || typeof record !== 'object') return [];
        const from = cityList().find(c => c.id === record.fromId), to = cityList().find(c => c.id === record.toId);
        if (!from || !to || from.id === to.id || !['attack', 'reinforce', 'retreat'].includes(record.kind)) return [];
        const route = movementRoute(from, to); if (!route) return [];
        return [{ record, route, delay: Math.min(index * 120, 1100), duration: 2450 + (index % 3) * 180 }];
      });
      if (!entries.length || document.hidden) {
        const report = { cancelled: false, count: entries.length };
        try { options.onComplete?.(report); } catch (error) { console.error('Map movement completion callback failed:', error); }
        return Promise.resolve(report);
      }
      return new Promise(resolve => {
        playback = { entries, started: performance.now(), resolve, onComplete: options.onComplete, timer: null };
        playback.timer = setTimeout(() => endPlayback(), reduceMotion.matches ? 850 : 4400);
        startMotion();
      });
    }
    function tick(time) {
      if (!alive || !active || document.hidden || reduceMotion.matches) { moving = false; return; }
      if (time - lastFrame > 32) { draw(time); lastFrame = time; }
      frame = requestAnimationFrame(tick);
    }
    function startMotion() {
      draw();
      if (!moving && alive && active && !document.hidden && !reduceMotion.matches) { moving = true; frame = requestAnimationFrame(tick); }
    }
    function visibilityChanged() {
      if (document.hidden && playback) endPlayback();
      startMotion();
    }
    const observer = new ResizeObserver(resize); observer.observe(canvas);
    canvas.addEventListener('pointerdown', pointerDown); canvas.addEventListener('pointerup', pointerUp); canvas.addEventListener('pointercancel', pointerUp);
    canvas.addEventListener('pointermove', pointerMove); canvas.addEventListener('pointerleave', pointerLeave); canvas.addEventListener('click', click);
    canvas.addEventListener('wheel', wheel, { passive: false }); canvas.addEventListener('keydown', keyDown);
    document.addEventListener('visibilitychange', visibilityChanged); reduceMotion.addEventListener('change', startMotion);
    resize(); startMotion();
    return {
      setState(nextState, selectedCityId, targetModeFromId = null) {
        const changedSelection = selected !== selectedCityId;
        state = nextState; selected = selectedCityId; targetFrom = targetModeFromId; screenRoadCache = null;
        const nextSeason=seasonOf(state);
        if(nextSeason!==seasonId){
          seasonId=nextSeason;seasonTheme=SEASONS[seasonId];
          if(!terrainCache.has(seasonId))terrainCache.set(seasonId,createTerrain(seasonTheme));
          terrain=terrainCache.get(seasonId);settlementCache.clear();
          while(terrainCache.size>2){const key=terrainCache.keys().next().value;if(key===seasonId){const value=terrainCache.get(key);terrainCache.delete(key);terrainCache.set(key,value);}else{const old=terrainCache.get(key);terrainCache.delete(key);old.width=0;old.height=0;}}
        }
        canvas.dataset.mapSeason=seasonId;
        syncArmies();
        if (changedSelection && zoom > 1) {
          const city = cityList().find(c => c.id === selected);
          if (city) {
            const [x, y] = position(city), sx = ox + x * scale, sy = oy + y * scale;
            if (sx < 65 || sx > width - 65 || sy < 65 || sy > height - 80) {
              panX = (W / 2 - x) * scale; panY = (H / 2 - y) * scale; updateView();
            }
          }
        }
        draw();
      },
      setActive(value) {
        if (!alive || active === !!value) return;
        active = !!value;
        if (!active) {
          cancelAnimationFrame(frame); frame = 0; moving = false; clearHover();
          // Legacy playback promises must settle even when the map is hidden.
          endPlayback(true);
        } else { resize(); startMotion(); }
      },
      zoomIn() { zoomAt(zoom * 1.3); },
      zoomOut() { zoomAt(zoom / 1.3); },
      resetView,
      setSelectedArmy(id) { selectedArmyId = id || null; selectedMovement = null; draw(); },
      focusCity(id) {
        const city = cityList().find(c => c.id === id); if (!city) return;
        selected = id; selectedArmyId = null; selectedMovement = null;
        zoom = Math.max(1.7, zoom); scale = baseScale * zoom;
        const [x, y] = position(city); panX = (W / 2 - x) * scale; panY = (H / 2 - y) * scale;
        updateView(); draw();
      },
      focusArmy(id) {
        const track = armyTracks.get(id); if (!track) return;
        selectedArmyId = id; selectedMovement = null; zoom = Math.max(1.7, zoom); scale = baseScale * zoom;
        const [x, y] = track.route.point(visibleArmyProgress(track, performance.now()));
        panX = (W / 2 - x) * scale; panY = (H / 2 - y) * scale; updateView(); draw();
      },
      playMovements,
      destroy() {
        alive = false; endPlayback(true); cancelAnimationFrame(frame); observer.disconnect();
        canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointerup', pointerUp); canvas.removeEventListener('pointercancel', pointerUp);
        canvas.removeEventListener('pointermove', pointerMove); canvas.removeEventListener('pointerleave', pointerLeave); canvas.removeEventListener('click', click);
        canvas.removeEventListener('wheel', wheel); canvas.removeEventListener('keydown', keyDown);
        document.removeEventListener('visibilitychange', visibilityChanged); reduceMotion.removeEventListener('change', startMotion);
        canvas.style.touchAction = originalTouchAction;
        if (originalTabIndex === null) canvas.removeAttribute('tabindex');
        pointers.clear(); settlementCache.clear(); routeCache.clear(); armyTracks.clear();terrainCache.forEach(image=>{image.width=0;image.height=0;});terrainCache.clear();
      },
    };
  }
  globalThis.TKMap = { create };
})();
