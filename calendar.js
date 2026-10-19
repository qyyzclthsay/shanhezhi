(function (root, factory) {
  'use strict';
  const calendar = factory();
  if (typeof module === 'object' && module.exports) module.exports = calendar;
  root.TKCalendar = calendar;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // A fixed game calendar: 365 days every year. These are game dates, not an
  // astronomical or historical reconstruction of the Han calendar.
  const MONTH_DAYS = Object.freeze([31,28,31,30,31,30,31,31,30,31,30,31]);
  const TERMS = Object.freeze([
    ['小寒',1,5],['大寒',1,20],['立春',2,4],['雨水',2,19],
    ['惊蛰',3,6],['春分',3,21],['清明',4,5],['谷雨',4,20],
    ['立夏',5,6],['小满',5,21],['芒种',6,6],['夏至',6,21],
    ['小暑',7,7],['大暑',7,23],['立秋',8,8],['处暑',8,23],
    ['白露',9,8],['秋分',9,23],['寒露',10,8],['霜降',10,23],
    ['立冬',11,7],['小雪',11,22],['大雪',12,7],['冬至',12,22]
  ].map(([name,month,day])=>Object.freeze({name,month,day})));
  const dayOfYear = (month,day) => MONTH_DAYS.slice(0,month-1).reduce((a,b)=>a+b,0)+day;
  const START_DAY_OF_YEAR = dayOfYear(6,1);
  function dateToTotalDays(year,month,day) {
    if(!Number.isInteger(year)||!Number.isInteger(month)||month<1||month>12||!Number.isInteger(day)||day<1||day>MONTH_DAYS[month-1])return NaN;
    return (year-194)*365+dayOfYear(month,day)-START_DAY_OF_YEAR;
  }
  function fromTotalDays(totalDays) {
    const absolute=totalDays+START_DAY_OF_YEAR-1,year=194+Math.floor(absolute/365);
    let remaining=((absolute%365)+365)%365,month=1;
    while(remaining>=MONTH_DAYS[month-1]){remaining-=MONTH_DAYS[month-1];month++;}
    return {year,month,day:remaining+1,totalDays};
  }
  function calendarInfo(state) {
    const date=typeof state==='number'?fromTotalDays(state):fromTotalDays(state.totalDays);
    const {year,month,day,totalDays}=date,doy=dayOfYear(month,day);
    const seasonId=month>=3&&month<=5?'spring':month>=6&&month<=8?'summer':month>=9&&month<=11?'autumn':'winter';
    const term=TERMS.find(t=>t.month===month&&t.day===day)||null;
    const next=TERMS.find(t=>dayOfYear(t.month,t.day)>doy)||TERMS[0];
    const nextMonth=month<3?3:month<6?6:month<9?9:month<12?12:3,nextYear=year+(month===12?1:0);
    const nextPeriodDay=dateToTotalDays(nextYear,nextMonth,1),seasonName={spring:'春',summer:'夏',autumn:'秋',winter:'冬'}[seasonId];
    return {...date,dayOfYear:doy,daysInMonth:MONTH_DAYS[month-1],
      season:{id:seasonId,name:seasonName},
      term:term?{...term}:null,nextTerm:{...next,inDays:(dayOfYear(next.month,next.day)-doy+365)%365},
      period:Math.floor(((year-194)*12+month-6)/3),periodInYear:month<3?4:Math.floor((month-3)/3)+1,
      periodName:seasonName+'季',nextPeriodDay,daysToNextPeriod:nextPeriodDay-totalDays,
      isPeriodStart:day===1&&[3,6,9,12].includes(month),isMonthStart:day===1,fixedTerms:true};
  }
  const monthIndex = state => {const d=calendarInfo(state);return (d.year-194)*12+d.month-6;};
  return {MONTH_DAYS,TERMS,dateToTotalDays,fromTotalDays,calendarInfo,monthIndex};
});
