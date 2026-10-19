// Suomisaundi System: JavaScript-only application bootstrap and shared protocol.
export const systemNode = location.pathname.split("/").filter(Boolean)[0] || "Main";
export const systemBus = typeof BroadcastChannel === "function"
  ? new BroadcastChannel("suomisaundi-system-v1") : null;
const subscribers = new Set();
export function onSystemMessage(callback) {
  if (typeof callback !== "function") throw new TypeError("Callback required");
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}
export function sendSystemMessage(type, payload = null, target = "*") {
  if (!systemBus) return false;
  if (typeof type !== "string" || !type || type.length > 80) throw new TypeError("Invalid message type");
  systemBus.postMessage({protocol:"suomisaundi-system-v1",source:systemNode,target,type,payload,timestamp:Date.now()});
  return true;
}
systemBus?.addEventListener("message", event => {
  const m=event.data;
  if (!m || m.protocol !== "suomisaundi-system-v1" || (m.target !== "*" && m.target !== systemNode)) return;
  for (const fn of subscribers) { try { fn(m); } catch (err) { console.error(err); } }
});
export const browserCapabilities = Object.freeze({
  webAssembly: typeof WebAssembly !== "undefined",
  webGPU: typeof navigator !== "undefined" && "gpu" in navigator,
  vectorGraphics: typeof document !== "undefined" && typeof document.createElementNS === "function",
  webAudio: typeof window !== "undefined" && Boolean(window.AudioContext || window.webkitAudioContext)
});
export async function createWebAssemblyModule(bytes, imports = {}) {
  if (!browserCapabilities.webAssembly) throw new Error("WebAssembly unavailable");
  return WebAssembly.instantiate(bytes, imports);
}
export async function requestWebGPUDevice() {
  if (!browserCapabilities.webGPU) throw new Error("WebGPU unavailable");
  const adapter=await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("No WebGPU adapter");
  return {adapter,device:await adapter.requestDevice()};
}
export function createSVG(width=320,height=180) {
  if (!browserCapabilities.vectorGraphics) throw new Error("SVG unavailable");
  const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
  svg.setAttribute("viewBox",`0 0 ${width} ${height}`);
  return svg;
}
export function createAudioContext() {
  if (!browserCapabilities.webAudio) throw new Error("Web Audio unavailable");
  return new (window.AudioContext || window.webkitAudioContext)();
}
document.title = "Suomisaundi System — " + systemNode;
const main=document.createElement("main");
main.style.cssText="font:16px system-ui,sans-serif;max-width:850px;margin:10vh auto;padding:24px;line-height:1.6";
const heading=document.createElement("h1");
heading.textContent="Suomisaundi System — "+systemNode;
const detail=document.createElement("p");
detail.textContent="Independent subsystem foundation. JavaScript runtime and inter-system protocol initialized.";
const home=document.createElement("a");
home.href="https://suomisaundi-system.github.io/";
home.textContent="Return to Suomisaundi System";
main.append(heading,detail,home);
document.body.append(main);
