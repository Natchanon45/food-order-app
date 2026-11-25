// Financial reporting clock: tenant sales use Asia/Bangkok (UTC+07:00),
// independent of the merchant browser's OS time zone. Thailand has no DST.
const BANGKOK_MS=7*60*60*1000;
const DAY_MS=24*60*60*1000;
const two=value=>String(value).padStart(2,"0");
function shifted(value){
 const d=value instanceof Date?value:new Date(value);
 return Number.isFinite(d.getTime())?new Date(d.getTime()+BANGKOK_MS):null;
}
export function bangkokParts(value){
 const date=shifted(value);
 if(!date)return null;
 return {year:date.getUTCFullYear(),month:date.getUTCMonth()+1,
  day:date.getUTCDate(),hour:date.getUTCHours()};
}
export function bangkokDateKey(value){
 const p=bangkokParts(value);
 return p?`${p.year}-${two(p.month)}-${two(p.day)}`:"";
}
export function bangkokMonthKey(value){
 return bangkokDateKey(value).slice(0,7);
}
export function bangkokHour(value){
 return bangkokParts(value)?.hour??-1;
}
function parsedDate(key){
 const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key||""));
 if(!m)return null;
 const [year,month,day]=m.slice(1).map(Number);
 const localMs=Date.UTC(year,month-1,day);
 const d=new Date(localMs);
 if(!Number.isFinite(localMs)||d.getUTCFullYear()!==year||
    d.getUTCMonth()+1!==month||d.getUTCDate()!==day)return null;
 return localMs;
}
export function bangkokStartOfDay(key){
 const localMs=parsedDate(key);
 return localMs===null?null:new Date(localMs-BANGKOK_MS);
}
export function bangkokEndOfDay(key){
 const start=bangkokStartOfDay(key);
 return start?new Date(start.getTime()+DAY_MS-1):null;
}
export function bangkokMonthRange(value){
 const match=/^(\d{4})-(\d{2})$/.exec(String(value||""));
 if(!match)return null;
 const year=Number(match[1]),month=Number(match[2]);
 if(year<2000||year>2100||month<1||month>12)return null;
 const start=bangkokStartOfDay(`${year}-${two(month)}-01`);
 const nextLocal=Date.UTC(year,month,1)-BANGKOK_MS;
 return {start,end:new Date(nextLocal-1)};
}
export function bangkokYearRange(value){
 const year=Number(value);
 if(!Number.isInteger(year)||year<2000||year>2100)return null;
 return {start:bangkokStartOfDay(`${year}-01-01`),
  end:bangkokEndOfDay(`${year}-12-31`)};
}
export function bangkokDaysInRange(start,end,maxDays=367){
 if(!(start instanceof Date)||!(end instanceof Date)||
    !Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||
    start>end)return null;
 const days=[],first=bangkokStartOfDay(bangkokDateKey(start));
 for(let time=first.getTime();time<=end.getTime();time+=DAY_MS){
  if(days.length>=maxDays)return null;
  days.push(bangkokDateKey(time));
 }
 return days;
}
export const salesBangkokClock={DAY_MS,BANGKOK_MS};
