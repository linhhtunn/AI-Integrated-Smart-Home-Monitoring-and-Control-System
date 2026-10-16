const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const req=createRequire(path.resolve('nha-thong-minh-backend/package.json'));
const mqtt=req('mqtt');const WebSocket=req('ws');
async function main(){
 const out={mqtt:[],ws:{},chatbot:{}};
 await new Promise(resolve=>{const c=mqtt.connect('mqtt://localhost:1883',{clientId:'report-passive-audit-'+Date.now()}); const timeout=setTimeout(()=>{c.end();resolve()},7000);c.on('connect',()=>c.subscribe('nha/phongkhach/#'));c.on('message',(t,m,p)=>out.mqtt.push({topic:t,payload:m.toString(),retain:p.retain,qos:p.qos}));c.on('error',e=>out.mqtt_error=e.message);});
 await new Promise(resolve=>{const w=new WebSocket('ws://localhost:8081');const t=setTimeout(()=>{w.terminate();resolve()},5000);w.on('open',()=>{out.ws.connected=true;clearTimeout(t);w.close();resolve()});w.on('error',e=>{out.ws.error=e.message;clearTimeout(t);resolve()})});
 fs.writeFileSync('bao-cao/work/runtime-check.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out));
 const start=performance.now();try{const r=await fetch('http://localhost:3000/api/chatbot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cau_hoi:'What are the temperature and humidity readings? Answer in one sentence.'}),signal:AbortSignal.timeout(180000)});out.chatbot={status:r.status,elapsed_ms:Math.round(performance.now()-start),data:await r.json()};}catch(e){out.chatbot={error:e.message,elapsed_ms:Math.round(performance.now()-start)}}
 fs.writeFileSync('bao-cao/work/runtime-check.json',JSON.stringify(out,null,2));console.log(JSON.stringify({chatbot:out.chatbot}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
