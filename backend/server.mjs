// Optional trusted Node.js bridge. Deploy only in a protected runtime.
// Never run this in GitHub Pages or expose its credentials to browser code.
import http from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";
const token=process.env.TELEGRAM_BOT_TOKEN;
const chat=process.env.TELEGRAM_CHAT_ID;
const topic=process.env.TELEGRAM_TOPIC_ID;
const apiKey=process.env.SYSTEM_INGEST_KEY;
const port=Number(process.env.PORT || 8787);
const clients=new Map();
const events=[];
const maxEvents=500;
const rate=new Map();
function reply(res,status,data) {
  res.writeHead(status,{"content-type":"application/json","cache-control":"no-store","access-control-allow-origin":process.env.ALLOWED_ORIGIN || "https://suomisaundi-system.github.io","vary":"Origin"});
  res.end(JSON.stringify(data));
}
function authorized(req) {
  if(!apiKey) return false;
  const provided=req.headers["x-system-ingest-key"];
  if(typeof provided!=="string") return false;
  const a=Buffer.from(provided),b=Buffer.from(apiKey);
  return a.length===b.length && timingSafeEqual(a,b);
}
async function telegram(event) {
  if(!token || !chat || !topic) return false;
  // Public topic: publish redacted summary only, never IP addresses or credentials.
  const text=`Suomisaundi System event: ${event.kind}\nSource: ${event.source}\nEvent ID: ${event.id}`;
  const response=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({chat_id:chat,message_thread_id:Number(topic),text})
  });
  return response.ok;
}
const server=http.createServer(async(req,res)=>{
  const origin=req.headers.origin;
  if(origin && origin!==(process.env.ALLOWED_ORIGIN || "https://suomisaundi-system.github.io")) return reply(res,403,{error:"origin denied"});
  if(req.method==="GET" && req.url==="/health") return reply(res,200,{ok:true,service:"suomisaundi-bridge"});
  if(req.method!=="POST" || req.url!=="/events") return reply(res,404,{error:"not found"});
  if(!authorized(req)) return reply(res,401,{error:"unauthorized"});
  const peer=req.socket.remoteAddress || "unknown";
  const entry=rate.get(peer) || {time:Date.now(),count:0};
  if(Date.now()-entry.time>60000){entry.time=Date.now();entry.count=0;}
  entry.count++;rate.set(peer,entry);
  if(entry.count>30) return reply(res,429,{error:"rate limited"});
  let raw="";
  for await(const chunk of req) {raw+=chunk; if(raw.length>8192) return reply(res,413,{error:"too large"});}
  let body;
  try {body=JSON.parse(raw);} catch {return reply(res,400,{error:"invalid json"});}
  if(typeof body.kind!=="string" || !/^[a-z0-9_.-]{1,64}$/i.test(body.kind)) return reply(res,400,{error:"invalid kind"});
  const event={id:randomUUID(),time:new Date().toISOString(),kind:body.kind,source:String(body.source||"unknown").slice(0,80)};
  events.push(event);if(events.length>maxEvents)events.shift();
  telegram(event).catch(error=>console.error("Telegram delivery failed:",error.message));
  return reply(res,202,{accepted:true,id:event.id});
});
server.listen(port,"127.0.0.1",()=>console.log("Bridge listening on localhost:"+port));
