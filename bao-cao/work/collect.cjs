const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const req = createRequire(path.resolve('nha-thong-minh-backend/package.json'));
req('dotenv').config({path:path.resolve('nha-thong-minh-backend/.env'),quiet:true});
const mysql = req('mysql2/promise');
const vm = require('node:vm');
async function main(){
  const c=await mysql.createConnection({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,dateStrings:true});
  const out={collected_at:'2026-10-15',queries:{},api:[],logic:[]};
  const queries={
    schema_sensors:'SHOW CREATE TABLE cam_bien_data',
    schema_habits:'SHOW CREATE TABLE thoi_quen_nguoi_dung',
    summary:"SELECT COUNT(*) AS total, MIN(thoi_gian) AS first_time, MAX(thoi_gian) AS last_time FROM cam_bien_data WHERE thoi_gian < '2026-10-15'",
    topics:'SELECT topic, COUNT(*) AS n FROM cam_bien_data GROUP BY topic ORDER BY topic',
    states:"SELECT topic,gia_tri,COUNT(*) AS n FROM cam_bien_data GROUP BY topic,gia_tri ORDER BY topic,gia_tri",
    numeric:"SELECT topic, COUNT(*) AS n,MIN(CAST(gia_tri AS DECIMAL(8,2))) AS minimum,MAX(CAST(gia_tri AS DECIMAL(8,2))) AS maximum,AVG(CAST(gia_tri AS DECIMAL(8,2))) AS average FROM cam_bien_data WHERE thoi_gian < '2026-10-15' AND topic IN ('nha/phongkhach/nhietdo/state','nha/phongkhach/doam/state') GROUP BY topic",
    daily:'SELECT DATE(thoi_gian) AS day,COUNT(*) AS n FROM cam_bien_data GROUP BY DATE(thoi_gian) ORDER BY day',
    samples:'SELECT id,topic,gia_tri,thoi_gian FROM cam_bien_data ORDER BY id DESC LIMIT 30',
    series:"SELECT id,topic,gia_tri,thoi_gian FROM cam_bien_data WHERE thoi_gian < '2026-10-15' AND topic IN ('nha/phongkhach/nhietdo/state','nha/phongkhach/doam/state') ORDER BY thoi_gian,id",
    historical_topics:"SELECT topic,COUNT(*) AS n FROM cam_bien_data WHERE thoi_gian < '2026-10-15' GROUP BY topic ORDER BY topic",
    habits:'SELECT danh_muc,COUNT(*) AS n FROM thoi_quen_nguoi_dung GROUP BY danh_muc',
    activity:"SELECT id,topic,gia_tri,thoi_gian FROM cam_bien_data WHERE thoi_gian BETWEEN '2026-09-08 08:28:00' AND '2026-09-08 16:04:00' AND topic NOT LIKE '%nhietdo%' AND topic NOT LIKE '%doam%' ORDER BY id",
    server:'SELECT NOW() AS server_now, @@system_time_zone AS tz,@@session.time_zone AS session_tz,VERSION() AS mysql_version',
  };
  for (const [k,q] of Object.entries(queries)){const [rows]=await c.query(q);out.queries[k]=rows;}
  await c.end();
  for(const endpoint of ['/api/lichsu/nhietdo','/api/lichsu/doam','/api/lichsu/chuyendong','/api/lichsu/anhsang','/api/lichsu/relay','/api/lichsu/khong-co','/api/bat-thuong','/api/thoi-quen']){
    const start=performance.now();try{const r=await fetch('http://localhost:3000'+endpoint,{signal:AbortSignal.timeout(10000)});const data=await r.json();out.api.push({endpoint,status:r.status,elapsed_ms:Math.round(performance.now()-start),data});}catch(e){out.api.push({endpoint,error:e.message});}
  }
  for(const endpoint of ['/api/relay','/api/che-do-thu-cong']){
    const r=await fetch('http://localhost:3000'+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trang_thai:'INVALID'})});out.api.push({endpoint,invalid_input:true,status:r.status,data:await r.json()});
  }
  const src=fs.readFileSync('nha-thong-minh-backend/index.js','utf8');
  const g=src.slice(src.indexOf('function kiemTraGoiY'),src.indexOf('const pool ='));
  const l=src.slice(src.indexOf('function phatHienLenh'),src.indexOf("app.post('/api/chatbot'"));
  const context={};vm.createContext(context);vm.runInContext(g+'\n'+l,context);
  for(const [kind,input,expected] of [
    ['temperature','30',null],['temperature','30.1','goi_y'],['temperature','33','goi_y'],['temperature','33.1','canh_bao'],
    ['humidity','39.9','goi_y'],['humidity','40',null],['humidity','80',null],['humidity','80.1','goi_y'],
    ['command','bật đèn','den:ON'],['command','tắt đèn','den:OFF'],['command','bật còi','coi:ON'],['command','tắt còi','coi:OFF'],
    ['command','turn on the light','den:ON'],['command','turn off the buzzer','coi:OFF'],['command','Nhiệt độ hiện tại là bao nhiêu?',null],
  ]){
    let actual;if(kind==='command'){const r=context.phatHienLenh(input);actual=r?`${r.thiet_bi}:${r.hanh_dong}`:null;}else{const topic='nha/phongkhach/'+(kind==='temperature'?'nhietdo':'doam')+'/state';actual=context.kiemTraGoiY(topic,input)[0]?.muc||null;}out.logic.push({kind,input,expected,actual,passed:expected===actual});
  }
  fs.writeFileSync('bao-cao/work/evidence.json',JSON.stringify(out,null,2));
  console.log(JSON.stringify({summary:out.queries.summary,numeric:out.queries.numeric,daily:out.queries.daily,server:out.queries.server,api:out.api.map(x=>({endpoint:x.endpoint,status:x.status,n:Array.isArray(x.data)?x.data.length:undefined,error:x.error,data:x.endpoint==='/api/bat-thuong'?x.data:undefined})),logic_pass:out.logic.filter(x=>x.passed).length,logic_total:out.logic.length},null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
