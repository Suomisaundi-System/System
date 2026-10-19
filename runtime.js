// Suomisaundi System browser runtime v1: capability discovery and local coordination.
// Browser pools are advisory, per-browser only; never claim server compute capacity.
const prefix = "suomisaundi:v1:";
export const browser = Object.freeze({
  userAgent: navigator.userAgent,
  language: navigator.language,
  languages: [...(navigator.languages || [])],
  platform: navigator.userAgentData?.platform || navigator.platform || "unknown",
  online: navigator.onLine,
  secureContext: isSecureContext,
  hardwareConcurrency: navigator.hardwareConcurrency ?? null,
  deviceMemory: navigator.deviceMemory ?? null,
  touch: navigator.maxTouchPoints > 0,
  capabilities: Object.freeze({
    wasm: typeof WebAssembly !== "undefined",
    gpu: Boolean(navigator.gpu),
    webAudio: Boolean(window.AudioContext || window.webkitAudioContext),
    svg: Boolean(document.createElementNS),
    canvas: Boolean(document.createElement("canvas").getContext),
    workers: typeof Worker !== "undefined",
    sharedWorkers: typeof SharedWorker !== "undefined",
    serviceWorkers: "serviceWorker" in navigator,
    indexedDB: "indexedDB" in window,
    localStorage: storageAvailable("localStorage"),
    sessionStorage: storageAvailable("sessionStorage"),
    broadcastChannel: "BroadcastChannel" in window,
    webSockets: "WebSocket" in window,
    webRTC: "RTCPeerConnection" in window,
    webTransport: "WebTransport" in window,
    crypto: Boolean(globalThis.crypto?.subtle),
    compression: "CompressionStream" in window,
    fileSystemAccess: "showOpenFilePicker" in window,
    offscreenCanvas: "OffscreenCanvas" in window,
    webGL2: Boolean(document.createElement("canvas").getContext("webgl2")),
    notifications: "Notification" in window,
    cookies: navigator.cookieEnabled
  })
});
function storageAvailable(type) {
  try { const store = window[type]; const key = prefix+"probe"; store.setItem(key,"1"); store.removeItem(key); return true; }
  catch { return false; }
}
export const localState = {
  get(key) { try { return JSON.parse(localStorage.getItem(prefix+key)); } catch { return null; } },
  set(key,value) { try { localStorage.setItem(prefix+key,JSON.stringify(value)); return true; } catch { return false; } },
  remove(key) { try { localStorage.removeItem(prefix+key); } catch {} }
};
export const sessionState = {
  get(key) { try { return JSON.parse(sessionStorage.getItem(prefix+key)); } catch { return null; } },
  set(key,value) { try { sessionStorage.setItem(prefix+key,JSON.stringify(value)); return true; } catch { return false; } }
};
export const preferences = {
  get() { return localState.get("preferences") || {}; },
  update(patch) {
    const next = {...this.get(),...patch};
    return localState.set("preferences",next) ? next : null;
  }
};
// Cookies are optional, first-party, and never contain bot tokens or credentials.
export const cookies = {
  get(name) {
    const key=encodeURIComponent(prefix+name)+"=";
    const entry=document.cookie.split("; ").find(v=>v.startsWith(key));
    return entry ? decodeURIComponent(entry.slice(key.length)) : null;
  },
  set(name,value,days=30) {
    if (preferences.get().cookies !== true) return false;
    document.cookie=encodeURIComponent(prefix+name)+"="+encodeURIComponent(String(value))+
      "; Max-Age="+Math.max(0,Math.floor(days*86400))+"; Path=/; SameSite=Lax; Secure";
    return true;
  },
  remove(name) { document.cookie=encodeURIComponent(prefix+name)+"=; Max-Age=0; Path=/; SameSite=Lax; Secure"; }
};
export function showStoragePreferences() {
  if (document.getElementById("suomisaundi-storage-consent")) return;
  const panel=document.createElement("aside");
  panel.id="suomisaundi-storage-consent";
  panel.style.cssText="position:fixed;bottom:1rem;right:1rem;z-index:2147483646;max-width:340px;background:#152a2e;color:white;border:1px solid #547c7c;border-radius:12px;padding:16px;font:14px system-ui";
  const description=document.createElement("p");
  description.textContent="Optional cookies and persistent preferences are disabled until you choose to enable them.";
  const allow=document.createElement("button"); allow.textContent="Enable optional storage";
  const decline=document.createElement("button"); decline.textContent="Keep disabled";
  for(const b of [allow,decline]) b.style.cssText="margin:4px;padding:8px;cursor:pointer";
  allow.addEventListener("click",()=>{preferences.update({cookies:true});panel.remove();});
  decline.addEventListener("click",()=>{preferences.update({cookies:false});panel.remove();});
  panel.append(description,allow,decline);document.body.append(panel);
}
// Advisory peer discovery among active same-origin tabs, not distributed compute.
export const poolId = "suomisaundi-browser-pool-v1";
const channel = typeof BroadcastChannel === "function" ? new BroadcastChannel(poolId) : null;
const peers = new Map();
const nodeId = crypto.randomUUID?.() || String(Math.random()).slice(2);
const node = location.pathname.split("/").filter(Boolean)[0] || "Main";
const group = "browser-local";
const ttl = 20000;
export const sessionPool = {
  id:nodeId, node, group,
  peers() { const now=Date.now(); for(const [id,p] of peers) if(now-p.lastSeen>ttl) peers.delete(id); return [...peers.values()]; },
  available() { return {node,group,peers:this.peers().length,online:navigator.onLine}; },
  publish(type,data=null) { channel?.postMessage({protocol:poolId,source:nodeId,node,group,type,data,time:Date.now()}); },
  close() { channel?.close(); }
};
channel?.addEventListener("message",e=>{
  const m=e.data;
  if(!m || m.protocol!==poolId || m.source===nodeId || m.group!==group) return;
  peers.set(m.source,{id:m.source,node:m.node,group,lastSeen:Date.now()});
  if(m.type==="hello") sessionPool.publish("present");
});
sessionPool.publish("hello");
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange",()=>{if(!document.hidden) sessionPool.publish("present");});
}
export function createElement(tag,attributes={},children=[]) {
  const el=document.createElement(tag);
  for(const [key,value] of Object.entries(attributes)) {
    if(key==="text") el.textContent=String(value);
    else if(key==="className") el.className=String(value);
    else if(key==="style" && typeof value==="object") Object.assign(el.style,value);
    else if(key.startsWith("on")) continue;
    else el.setAttribute(key,String(value));
  }
  for(const child of children) el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return el;
}
export function injectCSS(css) {
  const style=document.createElement("style");style.textContent=String(css);document.head.append(style);return style;
}
export function createVector(width=320,height=180) {
  const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
  svg.setAttribute("viewBox",`0 0 ${width} ${height}`);return svg;
}
export function browserRuntimeStatus() {
  return {node,browser,sessionPool:sessionPool.available(),storageConsent:preferences.get().cookies===true};
}
