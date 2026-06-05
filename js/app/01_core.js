// ══ CONFIG ══
const CFG = (typeof CONFIG !== 'undefined') ? CONFIG : {};
const OWM    = CFG.OWM_KEY || '';
const OLLAMA = CFG.OLLAMA  || 'http://localhost:11434';
const SYSAPI = CFG.SYSAPI  || 'http://localhost:9001';
const TS_KEY = CFG.TAILSCALE_KEY || '';
const TS_NET = CFG.TAILSCALE_TAILNET || '';
const LED_ON  = CFG.LED_ON  || 'E:\\Scripts\\led\\led_on.py';
const LED_OFF = CFG.LED_OFF || 'E:\\Scripts\\led\\led_off.py';

// ══ HELPERS ══
const $ = id => document.getElementById(id);
const setEl = (id, v, prop = 'textContent') => { const e = $(id); if (e) e[prop] = v; };

// ══ STATE ══
let _sysapiFailCount = 0;
let wxCity = localStorage.getItem('panto-wx-city') || '';
let ledState = false;
let lastStats = {};
let _tileOpen = false;
let _nodeOpen = false;
let _dockerIntTimer = null;

const svcs = [
  {name:'Open WebUI',   url:'https://control.panto-dev.com',  d:'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'},
  {name:'Homepage',     url:'https://home.panto-dev.com',      d:'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'},
  {name:'Portainer',    url:'https://portainer.panto-dev.com', d:'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z'},
  {name:'Uptime Kuma',  url:'https://monitor.panto-dev.com',   d:'M22 12h-4l-3 9L9 3l-3 9H2'},
  {name:'Filebrowser',  url:'https://files.panto-dev.com',     d:'M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z'},
  {name:'Gitea',        url:'https://git.panto-dev.com',       d:'M18 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'},
  {name:'Stirling PDF', url:'https://pdf.panto-dev.com',       d:'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'},
  {name:'TubeYou',      url:'https://tubeyou.panto-dev.com',   d:'M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z'},
  {name:'Portfolio',    url:'https://me.panto-dev.com',        d:'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'},
  {name:'Router',       url:'http://192.168.33.1',             d:'M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01'},
  {name:'Nextcloud',    url:'https://dell-cloud.panto-dev.com',    d:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM8 12l4-4 4 4M12 8v8'},
  {name:'Jellyfin',     url:'https://dell-jellyfin.panto-dev.com', d:'M15 10l4.553-2.87A1 1 0 0 1 21 8v8a1 1 0 0 1-1.447.87L15 14v-4zM3 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z'},
  {name:'Grafana',      url:'https://dell-grafana.panto-dev.com',  d:'M18 20V10M12 20V4M6 20v-6'},
  {name:'Duplicati',    url:'https://dell-duplicati.panto-dev.com',d:'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12'},
  {name:'Dell Homer',   url:'https://dell-homer.panto-dev.com',    d:'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'},
  {name:'Speedtest',    url:'https://dell-speedtest.panto-dev.com',d:'M12 2a10 10 0 0 1 10 10M12 6v6l4 2'},
];

const pingTargets = [
  {name:'Cloudflare', url:'https://1.1.1.1'},
  {name:'Google',     url:'https://8.8.8.8'},
  {name:'AI',         url:'https://ai.panto-dev.com'},
  {name:'Sys',        url:'https://sys.panto-dev.com'},
];

// ══ NAVIGATION ══
function showSection(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tb-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.sb-btn[id^="sb-"]').forEach(b => b.classList.remove('active'));
  const sec = $('sec-' + id);
  if (sec) sec.classList.add('active');
  const tab = $('tab-' + id);
  if (tab) tab.classList.add('active');
  const sb = $('sb-' + id);
  if (sb) sb.classList.add('active');
  // Lazy inits
  if (id === 'network') { fetchTS(); pingAll(); initPingMonitor(); fetchBots(); fetchHoneypot(); }
  if (id === 'docker') fetchDocker();
  if (id === 'planner') renderPlanner();
  if (id === 'fun') { initRadar(); initNyanStars(); initMatrix(); renderPomoRing(); }
}

