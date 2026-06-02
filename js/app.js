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

// ══ TILE MODE ══
function toggleTileMode() { _tileOpen ? closeTileMode() : openTileMode(); }
function openTileMode() {
  if (_tileOpen) return;
  _tileOpen = true;
  const el = $('tile-mode');
  el.classList.add('open');
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('visible')));
  initTileRadar(); initTileNyanStars();
  updateTileStats(); updateTileDocker(); updateTileRSS(); updateTileSyslog(); updateTileNote();
  addLog('INFO', 'Tile mode opened');
}
function closeTileMode() {
  if (!_tileOpen) return;
  _tileOpen = false;
  const el = $('tile-mode');
  el.classList.remove('visible');
  setTimeout(() => el.classList.remove('open'), 350);
  addLog('INFO', 'Tile mode closed');
}

// ══ NODE MODE ══
function toggleNodeMode() { _nodeOpen ? closeNodeMode() : openNodeMode(); }
function openNodeMode() {
  if (_nodeOpen) return;
  _nodeOpen = true;
  const el = $('node-mode');
  el.classList.add('open');
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('visible')));
  _initNodeCanvas();
  addLog('INFO', 'Node Designer opened');
}
function closeNodeMode() {
  if (!_nodeOpen) return;
  _nodeOpen = false;
  const el = $('node-mode');
  el.classList.remove('visible');
  setTimeout(() => el.classList.remove('open'), 280);
}

// ══ TILE DATA SYNC ══
function updateTileStats() {
  if (!lastStats.cpu) return;
  const c = lastStats.cpu, r = Math.round(lastStats.ram || 0), d = lastStats.disk || 0;
  const tv = Object.values(lastStats.temps || {}).filter(t => t > 10 && t < 115);
  const mx = tv.length ? Math.max(...tv) : null;
  const cpuEl = $('tc-cpu'); if (cpuEl) { cpuEl.textContent = c + '%'; cpuEl.className = 'tc-stat-val' + (c > 90 ? ' er' : c > 75 ? ' wn' : ''); }
  const rEl   = $('tc-ram'); if (rEl)  { rEl.textContent  = r + '%'; rEl.className  = 'tc-stat-val' + (r > 90 ? ' er' : r > 80 ? ' wn' : ''); }
  if (mx) { const tEl = $('tc-temp'); if (tEl) { tEl.textContent = Math.round(mx) + '°'; tEl.className = 'tc-stat-val' + (mx > 95 ? ' er' : mx > 80 ? ' wn' : ''); } }
  const dEl = $('tc-disk'); if (dEl) { dEl.textContent = d + '%'; dEl.className = 'tc-stat-val' + (d > 90 ? ' er' : ''); }
  setEl('tc-disk-free', (lastStats.disk_free || '--') + ' GB free');
  const badge = $('tc-alert-badge'); if (badge) badge.textContent = c > 90 || r > 90 || d > 90 ? '⚠' : '';
}
function updateTileDocker() {
  const containers = window._lastDockerContainers || [];
  const el = $('tc-docker-list'), ct = $('tc-docker-count');
  if (!el) return;
  const running = containers.filter(c => c.status === 'running').length;
  if (ct) ct.textContent = running + '/' + containers.length + ' up';
  el.innerHTML = containers.map(c => `<div class="tc-dr"><div class="tc-dr-dot" style="background:${c.status==='running'?'var(--ok)':'var(--er)'}"></div><span class="tc-dr-name">${c.name}</span><span style="font-size:9px;color:${c.status==='running'?'var(--ok)':'var(--er)'}">${c.status}</span></div>`).join('') || '<span style="font-size:10px;color:var(--t3)">No data</span>';
}
function updateTileRSS() {
  const items = window._rssItems || [];
  const el = $('tc-rss-list'); if (!el) return;
  if (!items.length) { el.innerHTML = '<span style="font-size:10px;color:var(--t3)">Loading...</span>'; fetchRSS(); return; }
  el.innerHTML = items.slice(0, 18).map(i => `<div class="tc-rss-item" onclick="window.open('${i.url}','_blank')"><div class="tc-rss-title">${i.title}</div><div class="tc-rss-meta">${i.pts ? '▲' + i.pts + ' · ' : ''}${i.by} · ${i.age}</div></div>`).join('');
}
function updateTileSyslog() {
  const el = $('tc-syslog'), src = $('syslog');
  if (el && src) el.innerHTML = src.innerHTML;
}
function updateTileNote() {
  const src = $('notepad-area'), dst = $('tc-notepad-area');
  if (src && dst) dst.value = src.value;
}
function updateTileTime(n) {
  const h = String(n.getHours()).padStart(2,'0'), m = String(n.getMinutes()).padStart(2,'0'), s = String(n.getSeconds()).padStart(2,'0'), ms = String(n.getMilliseconds()).padStart(3,'0');
  setEl('tc-clock-hms', h+':'+m+':'+s);
  setEl('tc-clock-ms', '.'+ms);
  const days = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  setEl('tc-clock-date', days[n.getDay()]+' · '+n.toLocaleDateString('pl-PL',{day:'numeric',month:'short',year:'numeric'}).toUpperCase());
  setEl('tile-time', h+':'+m+':'+s);
}
function updateTileWx(d) {
  const t = Math.round(d.main.temp);
  const emoji = _wxEmoji(d.weather[0].id);
  ['tc-wx-icon','tc-wx-icon-h'].forEach(id => setEl(id, emoji));
  setEl('tc-wx-temp', t + '°'); setEl('tc-wx-desc', d.weather[0].description);
  setEl('tc-wx-wind', Math.round(d.wind.speed) + ' m/s'); setEl('tc-wx-hum', d.main.humidity + '%');
  setEl('tc-wx-feel', Math.round(d.main.feels_like) + '°');
}

// ══ TILE CANVASES ══
let tileRadarInited = false;
function initTileRadar() { if (tileRadarInited) return; tileRadarInited = true; _makeRadar('tc-radar-canvas'); }
function initTileNyanStars() {
  const c = $('tc-nyan-stars'); if (!c) return;
  _makeNyanStars(c);
}

// ══ SERVICES ══
function renderSvcs() {
  const html = svcs.map(s => `<div class="svc-item" onclick="window.open('${s.url}','_blank')"><div class="svc-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${s.d}"/></svg></div><div class="svc-info"><div class="svc-name">${s.name}</div><div class="svc-host">${s.url.replace(/https?:\/\//,'')}</div></div><div class="svc-dot dot ping" id="dot${s.name.replace(/\W/g,'')}"></div></div>`).join('');
  const el = $('svc-list'); if (el) el.innerHTML = html;
  const tcEl = $('tc-svc-list');
  if (tcEl) tcEl.innerHTML = svcs.map(s => `<a class="tc-svc-item" href="${s.url}" target="_blank"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="${s.d}"/></svg>${s.name}</a>`).join('');
}
function pingAll() {
  svcs.forEach(s => {
    const d = $('dot' + s.name.replace(/\W/g, '')); if (!d) return;
    fetch(s.url, {mode:'no-cors', signal:AbortSignal.timeout(4000)}).then(() => d.className = 'svc-dot dot ok').catch(() => d.className = 'svc-dot dot down');
  });
}

// ══ SYSAPI CONNECTION ══
function _setConn(ok) {
  const dot = $('tb-conn'); if (!dot) return;
  dot.className = 'tb-pill-dot' + (ok ? ' ok' : ' danger');
  const banner = $('offline-banner');
  if (banner) banner.classList.toggle('show', !ok);
}

// ══ STATS ══
const cpuHistory = [];
async function fetchStats() {
  try {
    const r = await fetch(SYSAPI + '/stats', {signal: AbortSignal.timeout(5000)});
    const d = await r.json();
    lastStats = d; _sysapiFailCount = 0; _setConn(true);

    // Overview section
    const cpu = d.cpu, ram = Math.round(d.ram), dsk = d.disk;
    const tv = Object.values(d.temps || {}).filter(t => t > 10 && t < 115);
    const tempMax = tv.length ? Math.max(...tv) : null;

    setEl('ov-cpu', cpu + '%');   const ocEl = $('ov-cpu');  if (ocEl) ocEl.className = 'metric-val' + (cpu > 90 ? ' er' : cpu > 75 ? ' wn' : '');
    setEl('ov-ram', ram + '%');   const orEl = $('ov-ram');  if (orEl) orEl.className = 'metric-val' + (ram > 90 ? ' er' : ram > 80 ? ' wn' : '');
    setEl('ov-disk', dsk + '%');  const odEl = $('ov-disk'); if (odEl) odEl.className = 'metric-val' + (dsk > 90 ? ' er' : '');
    if (tempMax) { setEl('ov-temp', Math.round(tempMax) + '°'); const otEl = $('ov-temp'); if (otEl) otEl.className = 'metric-val' + (tempMax > 95 ? ' er' : tempMax > 80 ? ' wn' : ''); }
    setEl('ov-cpu-sub',  d.cpu + '%');
    setEl('ov-ram-sub',  (d.ram_used||'?') + '/' + (d.ram_total||'?') + 'GB');
    setEl('ov-disk-sub', (d.disk_free||'--') + ' GB free');
    setEl('ov-ut', d.uptime || '--');
    setEl('ov-boot', 'since ' + (d.boot||'--'));
    setEl('ov-ramfree', (d.ram_free||'--') + ' GB');
    setEl('ov-diskfree', (d.disk_free||'--') + ' GB');

    // System section rings
    setEl('cv', cpu + '%'); setEl('cv2', cpu + '%');
    setEl('rv', ram + '%'); setEl('rv2', ram + '%'); setEl('ram-sub', d.ram_used+'/'+(d.ram_total||'?')+'G'); setEl('ram-sub2', d.ram_used+'/'+(d.ram_total||'?')+'G');
    setEl('dv', dsk + '%'); setEl('dv2', dsk + '%'); setEl('disk-sub', d.disk_free+' GB'); setEl('disk-sub2', d.disk_free+' GB');
    ring('c', cpu); ring('r', d.ram); ring('d', dsk);

    // Topbar pills
    setEl('tb-cpu', 'CPU ' + cpu + '%');
    setEl('tb-ram', 'RAM ' + ram + '%');

    // Temp
    if (tempMax) {
      const col = tempMax > 95 ? 'var(--er)' : tempMax > 80 ? 'var(--wn)' : 'var(--t2)';
      setEl('temp-v', Math.round(tempMax) + '°C');
      const tbT = $('tb-temp'); if (tbT) { tbT.textContent = Math.round(tempMax) + '°C'; tbT.style.color = col; }
      setEl('ov-temp-sub', Math.round(tempMax) + '°C');
    } else { setEl('temp-v', 'N/A'); }

    // Misc
    setEl('ut-v', d.uptime || '--');
    setEl('boot-v', 'since ' + (d.boot||'--'));
    setEl('ramf-v', (d.ram_free||'--') + ' GB');
    setEl('net-up', (d.net_up||'--') + ' MB');
    setEl('net-dn', (d.net_down||'--') + ' MB');
    setEl('ov-sub', 'sysapi @ ' + SYSAPI);

    // Chart
    cpuHistory.push(cpu); if (cpuHistory.length > 60) cpuHistory.shift();
    if (cpuHistory.length > 1) drawSparkline('cpu-chart', cpuHistory, getComputedStyle(document.documentElement).getPropertyValue('--acc').trim() || '#e8962a');

    renderProcs(d.procs || []);
    checkAlerts(d);
    updateUptime(d.uptime || '');
    if (_tileOpen) updateTileStats();
    if (_nodes.length > 0) _checkNodeTriggers(d);
    addLog('INFO', `CPU ${cpu}% RAM ${ram}% Temp ${tempMax ? Math.round(tempMax) + '°C' : '--'}`);
  } catch(e) {
    _sysapiFailCount++;
    if (_sysapiFailCount >= 2) _setConn(false);
    setEl('cv', 'ERR'); setEl('ov-cpu', 'ERR');
    addLog('ERR', 'sysapi: ' + e.message);
  }
  // Ollama check + populate model selector
  try {
    const r = await fetch(OLLAMA + '/api/tags', {signal: AbortSignal.timeout(3000)});
    const d = await r.json();
    const models = d.models || [];
    const cnt = models.length + ' mdl';
    setEl('ol-v', cnt);
    ['sys-ollama-badge','ov-ollama-badge'].forEach(id => { const el = $(id); if (el) { el.textContent = 'ollama ' + cnt; el.className = 'badge b-ok'; } });
    // Populate model selector with live models if any found
    if (models.length > 0) {
      const sel = $('mdl'); if (sel) {
        const cur = sel.value;
        sel.innerHTML = models.map(m => `<option value="${m.name}">${m.name}</option>`).join('');
        if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
      }
    }
  } catch(e) {
    setEl('ol-v', 'offline');
    ['sys-ollama-badge','ov-ollama-badge'].forEach(id => { const el = $(id); if (el) { el.textContent = 'ollama offline'; el.className = 'badge b-er'; } });
  }
}

function renderProcs(procs) {
  const byCpu = [...procs].sort((a,b) => b.cpu - a.cpu).slice(0, 7);
  const byRam = [...procs].sort((a,b) => b.ram - a.ram).slice(0, 7);
  const mc = Math.max(...byCpu.map(p => p.cpu), 1);
  const mr = Math.max(...byRam.map(p => p.ram), 1);
  const row = (p, val, max, color) => `<div class="proc-row"><span class="proc-name">${p.name}</span><div class="proc-bar"><div class="proc-fill" style="width:${Math.min(100,val/max*100)}%;background:${color}"></div></div><span class="proc-pct">${val}%</span></div>`;
  setEl('proc-cpu', byCpu.map(p => row(p, p.cpu, mc, 'var(--acc)')).join(''), 'innerHTML');
  setEl('proc-ram', byRam.map(p => row(p, p.ram, mr, 'var(--acc-l)')).join(''), 'innerHTML');
}

function checkAlerts(d) {
  const al = [];
  if (d.cpu > 90) al.push({t:'err', m:'CPU critical: ' + d.cpu + '%'}); else if (d.cpu > 75) al.push({t:'warn', m:'CPU elevated: ' + d.cpu + '%'});
  if (d.ram > 90) al.push({t:'err', m:'RAM critical: ' + Math.round(d.ram) + '%'}); else if (d.ram > 80) al.push({t:'warn', m:'RAM high'});
  if (d.disk > 90) al.push({t:'err', m:'Disk full: ' + d.disk + '%'});
  if (Object.values(d.temps || {}).some(t => t > 95)) al.push({t:'err', m:'Temperature critical!'});
  if (!al.length) al.push({t:'ok', m:'All systems nominal'});
  const html = al.map(a => `<div class="alert-item ${a.t}">${a.m}</div>`).join('');
  setEl('alerts-list', html, 'innerHTML');
  setEl('ov-alerts', html, 'innerHTML');
  const crit = al.filter(a => a.t === 'err');
  const strip = $('tb-alert-strip'); if (strip) strip.classList.toggle('show', crit.length > 0);
  setEl('tb-al', crit.length ? '⚠ ' + crit[0].m : '');
}

function ring(id, pct) {
  const c = 125.7;
  const el = $('r' + id);
  if (el) el.setAttribute('stroke-dashoffset', c - (c * Math.min(100, Math.max(0, pct)) / 100));
}

function drawSparkline(canvasId, data, color) {
  const c = $(canvasId); if (!c || data.length < 2) return;
  const w = c.parentElement.clientWidth - 10; c.width = w; c.height = 36;
  const ctx = c.getContext('2d'); ctx.clearRect(0,0,w,36);
  const max = Math.max(...data, 1);
  const pts = data.map((v,i) => ({x:(i/(data.length-1))*w, y:36-(v/max)*32+2}));
  ctx.beginPath(); pts.forEach((p,i) => i===0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y));
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.lineTo(w,36); ctx.lineTo(0,36); ctx.closePath();
  const g = ctx.createLinearGradient(0,0,0,36);
  const rgb = color.startsWith('#') ? `${parseInt(color.slice(1,3),16)},${parseInt(color.slice(3,5),16)},${parseInt(color.slice(5,7),16)}` : '232,150,42';
  g.addColorStop(0, `rgba(${rgb},0.25)`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.fill();
}

// ══ PING ══
function renderPings() {
  const el = $('ping-list'); if (!el) return;
  el.innerHTML = pingTargets.map(p => `<div class="ping-row"><span class="ping-name">${p.name}</span><div class="dot ping" id="pp${p.name.replace(/\W/g,'')}"></div></div>`).join('');
  pingTargets.forEach(p => {
    const d = $('pp' + p.name.replace(/\W/g,''));
    fetch(p.url, {mode:'no-cors', signal:AbortSignal.timeout(3000)}).then(() => { if (d) d.className = 'dot ok'; }).catch(() => { if (d) d.className = 'dot down'; });
  });
}
const pingHistory = {};
function initPingMonitor() {
  pingTargets.forEach(t => pingHistory[t.name] = []);
  const probe = () => pingTargets.forEach(t => {
    const start = performance.now();
    fetch(t.url, {mode:'no-cors', signal:AbortSignal.timeout(3000)}).then(() => pushPing(t.name, Math.round(performance.now()-start))).catch(() => pushPing(t.name, 999));
  });
  probe(); setInterval(probe, 5000); renderPingBars();
}
function pushPing(name, ms) {
  if (!pingHistory[name]) pingHistory[name] = [];
  pingHistory[name].push(ms); if (pingHistory[name].length > 20) pingHistory[name].shift();
  renderPingBars();
}
function renderPingBars() {
  const panel = $('ping-monitor-panel'); if (!panel) return;
  panel.innerHTML = pingTargets.map(t => {
    const hist = pingHistory[t.name] || []; const last = hist[hist.length-1] || 0;
    const color = last === 999 ? 'var(--er)' : last < 100 ? 'var(--ok)' : last < 300 ? 'var(--wn)' : 'var(--er)';
    return `<div class="ping-row"><span class="ping-name">${t.name}</span><div class="ping-bar"><div class="ping-fill" style="width:${Math.min(100,last/500*100)}%;background:${color}"></div></div><span class="ping-val" style="color:${color}">${last===999?'N/A':last+'ms'}</span></div>`;
  }).join('');
}

// ══ DOCKER ══
async function fetchDocker() {
  const el = $('docker-list'); if (!el) return;
  el.innerHTML = '<div style="color:var(--t3);font-size:12px;padding:8px;">Fetching...</div>';
  try {
    const ctrl = new AbortController(); const tid = setTimeout(() => ctrl.abort(), 30000);
    const r = await fetch(SYSAPI + '/docker', {signal: ctrl.signal}); clearTimeout(tid);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    window._lastDockerContainers = d.containers || [];
    el.innerHTML = (d.containers || []).map(c => {
      const up = c.status === 'running';
      const mem = c.stats?.mem_used ? `<span class="dr-mem">${Math.round(c.stats.mem_used)}M</span>` : '';
      return `<div><div class="dr"><div class="dr-dot" style="background:${up?'var(--ok)':'var(--er)'}"></div><span class="dr-name" onclick="toggleLogs('${c.name}')">${c.name}</span><span class="dr-status ${up?'up':'dn'}">${c.status}</span>${mem}<div class="dr-actions">${up?`<button class="dr-btn stop" onclick="dAct('stop','${c.name}')">Stop</button>`:`<button class="dr-btn start" onclick="dAct('start','${c.name}')">Start</button>`}<button class="dr-btn" onclick="dAct('restart','${c.name}')">Restart</button><button class="dr-btn" onclick="toggleLogs('${c.name}')">Logs</button></div></div><div id="logs-${c.name}" style="display:none;padding:0 0 8px;"></div></div>`;
    }).join('') || '<div style="color:var(--t3);font-size:12px;padding:8px;">No containers</div>';
    if (_tileOpen) updateTileDocker();
    addLog('INFO', 'Docker: ' + (d.containers?.length || 0) + ' containers');
  } catch(e) {
    const msg = e.name === 'AbortError' ? 'Timeout — sysapi slow?' : e.message;
    el.innerHTML = `<div style="color:var(--er);font-size:12px;padding:8px;">${msg}</div><button class="btn btn-sm" style="margin:4px 8px;" onclick="fetchDocker()">↻ Retry</button>`;
    addLog('ERR', 'Docker: ' + msg);
  }
}
async function toggleLogs(name) {
  const el = $('logs-' + name); if (!el) return;
  if (el.style.display === 'block') { el.style.display = 'none'; return; }
  el.style.display = 'block'; el.innerHTML = '<div style="color:var(--t3);font-size:11px;padding:4px 12px;">Loading...</div>';
  try {
    const r = await fetch(SYSAPI + '/docker/logs/' + name, {signal: AbortSignal.timeout(8000)});
    const d = await r.json();
    el.innerHTML = `<div class="log-box" style="margin:0 12px 8px;">${(d.logs||'No logs').replace(/</g,'&lt;')}</div>`;
    el.querySelector('.log-box').scrollTop = 99999;
  } catch(e) { el.innerHTML = '<div style="color:var(--er);font-size:11px;padding:4px 12px;">Error loading logs</div>'; }
}
async function dAct(a, n) {
  try { await fetch(SYSAPI + '/docker/' + a + '/' + n, {method:'POST', signal:AbortSignal.timeout(25000)}); setTimeout(fetchDocker, 2500); addLog('INFO', 'Docker ' + a + ': ' + n); }
  catch(e) { addLog('ERR', 'Docker action failed: ' + e.message); }
}

// ══ HONEYPOT ══
async function fetchHoneypot() {
  const el = $('hp-list'), sub = $('hp-sub'); if (!el) return;
  try {
    const r = await fetch(SYSAPI + '/hp-read', {signal: AbortSignal.timeout(5000)});
    const d = await r.json();
    const entries = d.entries || [];
    if (sub) sub.textContent = entries.length + ' events';
    if (!entries.length) { el.innerHTML = '<div style="color:var(--t3);font-size:12px;padding:8px;">No honeypot events yet</div>'; return; }
    const sevColor = e => {
      if (e.event === 'CREDENTIAL_CAPTURE') return 'var(--er)';
      if (e.event === 'login_attempt') return 'var(--wn)';
      if (e.event === '404_probe') return 'var(--t3)';
      return 'var(--t2)';
    };
    el.innerHTML = entries.map(e => {
      const t = e.ts ? e.ts.slice(11,19) : '--:--:--';
      const ip = e.ip || '?';
      const ev = e.event || '?';
      const extra = e.username ? ` · user:<b style="color:var(--er)">${e.username}</b>` : e.path ? ` · <span style="color:var(--t2)">${e.path}</span>` : '';
      return `<div style="padding:5px 10px;border-bottom:1px solid var(--br);display:flex;gap:8px;align-items:baseline;">
        <span style="color:var(--t3);flex-shrink:0;">${t}</span>
        <span style="color:var(--acc);flex-shrink:0;">${ip}</span>
        <span style="color:${sevColor(e)};flex-shrink:0;">${ev}</span>
        <span style="color:var(--t3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${extra}</span>
      </div>`;
    }).join('');
    addLog('INFO', `Honeypot: ${entries.length} events`);
  } catch(e) {
    el.innerHTML = '<div style="color:var(--er);font-size:12px;padding:8px;">sysapi offline</div>';
  }
}

// ══ DISCORD BOTS ══
async function fetchBots() {
  const el = $('bots-list'), sub = $('bots-sub'); if (!el) return;
  try {
    const r = await fetch(SYSAPI + '/bots', {signal: AbortSignal.timeout(5000)});
    const d = await r.json();
    const bots = d.bots || [];
    const online = bots.filter(b => b.online).length;
    if (sub) sub.textContent = `${online}/${bots.length} online`;
    el.innerHTML = bots.map(b => `
      <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--br);">
        <div class="dot ${b.online ? 'ok' : 'down'}" style="flex-shrink:0;"></div>
        <div style="flex:1;">
          <div style="font-size:12px;font-weight:600;color:var(--t1);">${b.name}</div>
          <div style="font-size:10px;color:var(--t3);">${b.label}</div>
        </div>
        <span class="badge ${b.online ? 'b-ok' : 'b-er'}" style="font-size:10px;">${b.online ? 'online' : 'offline'}</span>
        ${b.pid ? `<span style="font-size:9px;color:var(--t3);">PID ${b.pid}</span>` : ''}
      </div>`).join('') || '<div style="color:var(--t3);font-size:12px;">No bots configured</div>';
    addLog('INFO', `Bots: ${online}/${bots.length} online`);
  } catch(e) {
    el.innerHTML = `<div style="color:var(--er);font-size:12px;">sysapi offline</div>`;
    if (sub) sub.textContent = 'error';
  }
}

// ══ TAILSCALE ══
async function fetchTS() {
  const el = $('ts-list'); if (!el) return;
  if (!TS_KEY || !TS_NET) { el.innerHTML = '<div style="color:var(--t3);font-size:12px;">No Tailscale key in config.js</div>'; return; }
  try {
    const r = await fetch(SYSAPI + '/tailscale?key=' + encodeURIComponent(TS_KEY) + '&net=' + encodeURIComponent(TS_NET), {signal: AbortSignal.timeout(8000)});
    const d = await r.json();
    if (d.error) { el.innerHTML = `<div style="color:var(--er);font-size:12px;">${d.error}</div>`; return; }
    el.innerHTML = (d.devices || []).map(dev => {
      const online = dev.lastSeen && (Date.now() - new Date(dev.lastSeen).getTime()) < 86400000;
      const ip = (dev.addresses || [])[0] || '--';
      const seen = dev.lastSeen ? new Date(dev.lastSeen).toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'}) : '--';
      return `<div class="ts-dev"><div class="ts-top"><div class="dot ${online?'ok':'down'}"></div><span class="ts-name">${dev.hostname||dev.name}</span><span class="badge ${online?'b-ok':'b-mute'}" style="font-size:10px;">${online?'online':'offline'}</span></div><div class="ts-info"><span class="ts-kv">IP: <span>${ip}</span></span><span class="ts-kv">Seen: <span>${seen}</span></span><span class="ts-kv">OS: <span>${dev.os||'--'}</span></span><span class="ts-kv">Ver: <span>${(dev.clientVersion||'').substring(0,8)||'--'}</span></span></div></div>`;
    }).join('') || '<div style="color:var(--t3);font-size:12px;">No devices</div>';
  } catch(e) { el.innerHTML = `<div style="color:var(--er);font-size:12px;">${e.message}</div>`; }
}

// ══ WEATHER ══
function _wxEmoji(id) {
  const icons = {2:'⛈',3:'🌦',5:'🌧',6:'❄',7:'🌫',800:'☀️',801:'🌤',802:'⛅',803:'🌥',804:'☁️'};
  const key = id>=200&&id<300?2:id>=300&&id<400?3:id>=500&&id<600?5:id>=600&&id<700?6:id>=700&&id<800?7:id;
  return icons[key] || '🌤';
}
async function fetchWx() {
  if (!OWM) { setEl('wx-city-label', 'No OWM key'); return; }
  try {
    const loc = wxCity ? `q=${encodeURIComponent(wxCity)}` : `lat=50.4534&lon=23.4197`;
    const r = await fetch(`https://api.openweathermap.org/data/2.5/weather?${loc}&appid=${OWM}&units=metric&lang=en`);
    const d = await r.json();
    const t = Math.round(d.main.temp);
    setEl('wt', t + '°'); setEl('wd2', d.weather[0].description);
    setEl('wf', Math.round(d.main.feels_like) + '°C'); setEl('wh', d.main.humidity + '%');
    setEl('ww', Math.round(d.wind.speed) + ' m/s'); setEl('wc', d.clouds.all + '%');
    setEl('wx-icon-left', _wxEmoji(d.weather[0].id));
    setEl('wx-city-label', d.name + ', ' + d.sys.country);
    if (_tileOpen) updateTileWx(d);
    window._lastWxData = d;
  } catch(e) { setEl('wd2', 'Weather unavailable'); }
}

// ══ CHAT ══
let hist = [];
function injectCtx() {
  const ctx = `[System @ ${new Date().toLocaleTimeString()}] CPU:${lastStats.cpu||'?'}% RAM:${Math.round(lastStats.ram||0)}%`;
  hist.push({role:'user', content:ctx}); hist.push({role:'assistant', content:'Got context.'});
  appendMsg('sys', 'Context injected');
}
function appendMsg(type, text) {
  const msgs = $('chat-msgs'); if (!msgs) return;
  if (type === 'sys') {
    const d = document.createElement('div'); d.className = 'msg-bubble sys'; d.style.cssText = 'align-self:center;'; d.textContent = text;
    msgs.appendChild(d);
  } else {
    const wrap = document.createElement('div'); wrap.className = 'msg-wrap' + (type==='user'?' user':'');
    const av = document.createElement('div'); av.className = 'msg-avatar ' + (type==='user'?'usr':'ai'); av.textContent = type==='user'?'ME':'AI';
    const bub = document.createElement('div'); bub.className = 'msg-bubble ' + (type==='user'?'usr':'ai'); bub.textContent = text;
    if (type === 'user') { wrap.appendChild(bub); wrap.appendChild(av); } else { wrap.appendChild(av); wrap.appendChild(bub); }
    msgs.appendChild(wrap);
  }
  msgs.scrollTop = msgs.scrollHeight;
  return msgs.lastElementChild;
}
async function sendMsg() {
  const inp = $('chat-input'); const txt = inp ? inp.value.trim() : ''; if (!txt) return;
  if (inp) inp.value = '';
  const model = $('mdl')?.value || 'llama3.1:8b';
  hist.push({role:'user', content:txt});
  appendMsg('user', txt);
  const wrap = appendMsg('ai', '...');
  const bub = wrap?.querySelector?.('.msg-bubble.ai') || wrap;
  const send = $('chat-send'); if (send) send.disabled = true;
  try {
    const res = await fetch(OLLAMA + '/api/chat', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({model, messages:hist, stream:true})});
    const reader = res.body.getReader(); const dec = new TextDecoder(); let full = ''; if (bub) bub.textContent = '';
    while (true) {
      const {done, value} = await reader.read(); if (done) break;
      dec.decode(value).split('\n').filter(Boolean).forEach(l => {
        try { const j = JSON.parse(l); if (j.message?.content) { full += j.message.content; if (bub) bub.textContent = full; $('chat-msgs').scrollTop = 99999; } } catch(e) {}
      });
    }
    hist.push({role:'assistant', content:full});
  } catch(e) { if (bub) bub.textContent = 'Error: ' + e.message; }
  if (send) send.disabled = false;
}
function clearChat() { hist = []; const m = $('chat-msgs'); if (m) m.innerHTML = '<div class="msg-wrap"><div class="msg-avatar ai">AI</div><div class="msg-bubble ai">Hey. What do you need?</div></div>'; }
function ckChat(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } }
// legacy alias
const cinput = null;
document.addEventListener('DOMContentLoaded', () => { const ci = $('chat-input'); if (ci) { const inp = document.createElement('textarea'); } });

// ══ SYSTEM ACTIONS ══
async function sysAct(a) {
  if ((a === 'shutdown' || a === 'restart') && ledState) { await runLed('off'); await new Promise(r => setTimeout(r, 600)); }
  try { await fetch(SYSAPI + '/system/' + a, {method:'POST', signal:AbortSignal.timeout(5000)}); addLog('WARN', 'System: ' + a); }
  catch(e) {}
}
function confirmAct(msg, action) {
  setEl('confirm-msg', msg);
  const modal = $('confirm-modal'); if (modal) modal.classList.add('open');
  const yes = $('confirm-yes');
  if (yes) yes.onclick = async () => {
    closeConfirm();
    if (action === 'restart-all') { await fetch(SYSAPI + '/docker/restart-all', {method:'POST', signal:AbortSignal.timeout(30000)}); setTimeout(fetchDocker, 3000); }
    else await sysAct(action);
  };
}
function closeConfirm() { const m = $('confirm-modal'); if (m) m.classList.remove('open'); }

// ══ LED ══
async function runLed(state) {
  addLog('INFO', 'LED ' + state.toUpperCase());
  document.querySelectorAll('.led-on-btn, .tc-led-on').forEach(b => b.disabled = true);
  document.querySelectorAll('.led-off-btn, .tc-led-off').forEach(b => b.disabled = true);
  document.querySelectorAll('.led-on-btn, .tc-led-on').forEach(b => b.classList.remove('active'));
  ledState = state === 'on';
  const label = 'Lights — ' + (ledState ? 'On' : 'Off');
  ['led-label','led-label-fun','tc-led-status'].forEach(id => setEl(id, label));
  _updateLedIndicators();
  try {
    const r = await fetch(SYSAPI + '/run-script', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({script: state==='on' ? LED_ON : LED_OFF}), signal:AbortSignal.timeout(15000)});
    const d = await r.json();
    if (!d.ok) { ledState = !ledState; ['led-label','led-label-fun','tc-led-status'].forEach(id => setEl(id, 'Lights — '+(ledState?'On':'Off'))); _updateLedIndicators(); }
    const fb = $('led-feedback'); if (fb) { fb.textContent = d.ok ? '✓ OK' : '✗ ' + (d.error||'failed'); fb.style.color = d.ok ? 'var(--ok)' : 'var(--er)'; setTimeout(() => { if (fb) fb.textContent = ''; }, 3000); }
    addLog(d.ok ? 'OK' : 'ERR', 'LED: ' + (d.ok ? 'ok' : d.error||'failed'));
  } catch(e) {
    ledState = !ledState;
    ['led-label','led-label-fun','tc-led-status'].forEach(id => setEl(id, 'Lights — '+(ledState?'On':'Off')));
    _updateLedIndicators();
    const fb = $('led-feedback'); if (fb) { fb.textContent = '✗ ' + e.message; fb.style.color = 'var(--er)'; setTimeout(() => { if (fb) fb.textContent = ''; }, 4000); }
    addLog('ERR', 'LED: ' + e.message);
  } finally {
    document.querySelectorAll('.led-on-btn,.led-off-btn,.tc-led-on,.tc-led-off').forEach(b => b.disabled = false);
    if (ledState) document.querySelectorAll('.led-on-btn,.tc-led-on').forEach(b => b.classList.add('active'));
  }
}
function _updateLedIndicators() {
  ['led-indicator','led-indicator-fun'].forEach(id => { const el = $(id); if (el) el.classList.toggle('on', ledState); });
  ['led-dot','led-dot-fun'].forEach(id => { const el = $(id); if (el) el.classList.toggle('on', ledState); });
}

// ══ SYSLOG ══
const logLines = [];
function addLog(level, msg) {
  const ts = new Date().toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  logLines.push({ts, level, msg}); if (logLines.length > 150) logLines.shift();
  const html = logLines.slice(-40).map(l => `<div class="log-line"><span class="log-ts">${l.ts}</span><span class="log-lvl ${l.level==='ERR'?'err':l.level==='WARN'?'warn':l.level==='OK'?'ok':'info'}">[${l.level}]</span><span class="log-msg">${l.msg}</span></div>`).join('');
  const el = $('syslog'); if (el) { el.innerHTML = html; el.scrollTop = el.scrollHeight; }
  if (_tileOpen) updateTileSyslog();
}
function copyLog() {
  const lines = $('syslog')?.innerText || '';
  navigator.clipboard.writeText(lines).then(() => addLog('OK','Log copied')).catch(() => { const ta = document.createElement('textarea'); ta.value = lines; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); addLog('OK','Log copied'); });
}
function _accRgb(a) {
  const hex = getComputedStyle(document.documentElement).getPropertyValue('--acc').trim() || '#e8962a';
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

// ══ RADAR ══
function _makeRadar(canvasId) {
  const c = $(canvasId); if (!c) return;
  const ctx = c.getContext('2d');
  function resize() { c.width = c.parentElement.clientWidth; c.height = c.parentElement.clientHeight; }
  resize(); new ResizeObserver(resize).observe(c.parentElement);
  const blips = Array.from({length:9}, () => ({a:Math.random()*Math.PI*2, d:0.15+Math.random()*0.75, flash:0}));
  let angle = 0;
  function draw() {
    if (!c.width || !c.height) return;
    const cx = c.width/2, cy = c.height/2, r = Math.min(cx,cy)*0.86;
    ctx.fillStyle = 'rgba(0,0,8,0.2)'; ctx.fillRect(0,0,c.width,c.height);
    [0.25,0.5,0.75,1].forEach(f => { ctx.beginPath(); ctx.arc(cx,cy,r*f,0,Math.PI*2); ctx.strokeStyle = _accRgb(0.1); ctx.lineWidth = 0.5; ctx.stroke(); });
    ctx.strokeStyle = _accRgb(0.08); ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(cx-r,cy); ctx.lineTo(cx+r,cy); ctx.moveTo(cx,cy-r); ctx.lineTo(cx,cy+r); ctx.stroke();
    for (let i = 0; i < 50; i++) { const a = angle - (i/50)*Math.PI*0.5; const fade = (1-i/50)*0.22; const gr = ctx.createRadialGradient(cx,cy,0,cx,cy,r); gr.addColorStop(0,_accRgb(0)); gr.addColorStop(0.4,_accRgb(fade*0.4)); gr.addColorStop(1,_accRgb(fade)); ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,a,a+0.022); ctx.closePath(); ctx.fillStyle = gr; ctx.fill(); }
    ctx.shadowBlur = 16; ctx.shadowColor = _accRgb(0.9);
    const lg = ctx.createLinearGradient(cx,cy,cx+Math.cos(angle)*r,cy+Math.sin(angle)*r); lg.addColorStop(0,_accRgb(0)); lg.addColorStop(0.15,_accRgb(0.3)); lg.addColorStop(1,_accRgb(1));
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(angle)*r,cy+Math.sin(angle)*r); ctx.strokeStyle = lg; ctx.lineWidth = 1.5; ctx.stroke(); ctx.shadowBlur = 0;
    blips.forEach(b => { const diff = ((b.a-angle)%(Math.PI*2)+Math.PI*2)%(Math.PI*2); if (diff > Math.PI*2-0.08) b.flash = 1; if (b.flash > 0) { b.flash = Math.max(0,b.flash-0.015); const bx = cx+Math.cos(b.a)*r*b.d, by = cy+Math.sin(b.a)*r*b.d; ctx.shadowBlur = 14*b.flash; ctx.shadowColor = _accRgb(0.9); ctx.beginPath(); ctx.arc(bx,by,2.5,0,Math.PI*2); ctx.fillStyle = _accRgb(b.flash*0.9); ctx.fill(); ctx.beginPath(); ctx.arc(bx,by,7,0,Math.PI*2); ctx.fillStyle = _accRgb(b.flash*0.12); ctx.fill(); ctx.shadowBlur = 0; if (b.flash < 0.02 && Math.random() < 0.25) { b.a = Math.random()*Math.PI*2; b.d = 0.15+Math.random()*0.75; } } });
    ctx.shadowBlur = 10; ctx.shadowColor = _accRgb(0.7); ctx.fillStyle = _accRgb(0.95); ctx.beginPath(); ctx.arc(cx,cy,3,0,Math.PI*2); ctx.fill(); ctx.shadowBlur = 0;
    angle = (angle+0.035)%(Math.PI*2);
  }
  setInterval(draw, 16);
}
let radarInited = false;
function initRadar() { if (radarInited) return; radarInited = true; _makeRadar('radar-canvas'); }

// ══ NYAN ══
function _makeNyanStars(c) {
  const ctx = c.getContext('2d');
  function resize() { c.width = c.parentElement.clientWidth; c.height = c.parentElement.clientHeight; }
  resize(); new ResizeObserver(resize).observe(c.parentElement);
  const stars = Array.from({length:22}, () => ({x:Math.random()*800, y:Math.random()*300, s:Math.random()*1.3+0.4, t:Math.random()*80}));
  function draw() { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(0,0,c.width,c.height); stars.forEach(s => { s.t++; s.x -= 2; if (s.x < 0) s.x = c.width; const a = 0.4+0.45*Math.abs(Math.sin(s.t*0.07)); ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fillRect(s.x, s.y%c.height, s.s, s.s); }); }
  setInterval(draw, 40);
}
let nyanInited = false;
function initNyanStars() { if (nyanInited) return; nyanInited = true; const c = $('nyan-stars'); if (c) _makeNyanStars(c); }

// ══ MATRIX ══
let matrixInited = false;
function initMatrix() {
  if (matrixInited) return; matrixInited = true;
  const c = $('matrix-canvas'); if (!c) return;
  const ctx = c.getContext('2d'); const drops = [];
  function resize() { c.width = c.parentElement.clientWidth; c.height = c.parentElement.clientHeight; drops.length = 0; for (let i = 0; i < c.width/13; i++) drops.push(Math.random()*c.height); }
  resize(); new ResizeObserver(resize).observe(c.parentElement);
  const chars = '01アイウエオカキクケコサシスセソ░▒▓';
  function draw() {
    ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fillRect(0,0,c.width,c.height); ctx.font = '12px monospace';
    drops.forEach((y,i) => { const ch = chars[Math.floor(Math.random()*chars.length)]; ctx.fillStyle = Math.random()>0.95 ? 'rgba(180,255,150,0.95)' : 'rgba(0,210,70,0.65)'; ctx.fillText(ch, i*13, y); drops[i] = y > c.height+80 ? Math.random()*-100 : y+13; });
  }
  setInterval(draw, 45);
}

// ══ CLOCK ══
function initClock() {
  setInterval(() => {
    const n = new Date();
    const h = String(n.getHours()).padStart(2,'0'), m = String(n.getMinutes()).padStart(2,'0'), s = String(n.getSeconds()).padStart(2,'0'), ms = String(n.getMilliseconds()).padStart(3,'0');
    setEl('clock-full', h+':'+m+':'+s+'.'+ms);
    const days = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
    setEl('clock-date', days[n.getDay()]+' · '+n.toLocaleDateString('pl-PL',{day:'numeric',month:'short',year:'numeric'}).toUpperCase());
    // Topbar clock
    setEl('clk-time', h+':'+m);
    setEl('clk-date', days[n.getDay()]+' '+n.toLocaleDateString('pl-PL',{day:'numeric',month:'short'}));
    updateTileTime(n);
  }, 50);
}

// ══ CRYPTO ══
const cryptoData = {BTC:{p:67420,c:2.3},ETH:{p:3540,c:-0.8},SOL:{p:182,c:4.1},BNB:{p:610,c:1.2}};
let _cryptoLive = false;
async function fetchCrypto() {
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,binancecoin&vs_currencies=usd&include_24hr_change=true', {signal:AbortSignal.timeout(8000)});
    const d = await r.json();
    if (d.bitcoin) { cryptoData.BTC={p:d.bitcoin.usd,c:d.bitcoin.usd_24h_change||0}; cryptoData.ETH={p:d.ethereum.usd,c:d.ethereum.usd_24h_change||0}; cryptoData.SOL={p:d.solana.usd,c:d.solana.usd_24h_change||0}; cryptoData.BNB={p:d.binancecoin.usd,c:d.binancecoin.usd_24h_change||0}; _cryptoLive=true; }
  } catch(e) { Object.keys(cryptoData).forEach(sym => { cryptoData[sym].p *= (1+(Math.random()-0.5)*0.002); cryptoData[sym].c += (Math.random()-0.5)*0.08; }); _cryptoLive=false; }
  _renderCrypto();
}
function _renderCrypto() {
  const panel = $('crypto-panel'); if (!panel) return;
  panel.innerHTML = Object.entries(cryptoData).map(([sym,d]) => `<div class="crypto-row"><span class="crypto-sym">${sym}</span><span class="crypto-price">$${d.p<1000?d.p.toFixed(2):Math.round(d.p).toLocaleString()}</span><span class="crypto-change ${d.c>=0?'pos':'neg'}">${d.c>=0?'+':''}${d.c.toFixed(2)}%</span></div>`).join('') + `<div class="${_cryptoLive?'crypto-live':'crypto-note'}">${_cryptoLive?'● live via CoinGecko':'* simulated data'}</div>`;
}

// ══ RSS / HN ══
window._rssItems = [];
async function _fetchRetry(url, opts, retries=3) { let e; for (let i=0;i<retries;i++) { try { return await fetch(url,opts); } catch(err) { e=err; if (i<retries-1) await new Promise(r=>setTimeout(r,2000*(i+1))); } } throw e; }
async function fetchRSS() {
  try {
    const r = await _fetchRetry('https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=30', {signal:AbortSignal.timeout(10000)}, 3);
    const d = await r.json();
    const items = (d.hits||[]).map(h => ({title:h.title||'', url:h.url||'https://news.ycombinator.com/item?id='+h.objectID, pts:h.points||0, by:h.author||'', age:h.created_at?_timeAgo(h.created_at):''}));
    window._rssItems = items;
    const renderEl = (id, max, cls) => { const el=$(id); if(!el) return; el.innerHTML=items.slice(0,max).map(i=>`<div class="${cls}" onclick="window.open('${i.url}','_blank')"><div class="${cls}-title">${i.title}</div><div class="${cls}-meta">${i.pts?`<span class="rss-pts">▲${i.pts}</span> · `:''}<span style="color:var(--t3)">${i.by} · ${i.age}</span></div></div>`).join(''); };
    renderEl('rss-list', 30, 'rss-item'); renderEl('tc-rss-list', 25, 'tc-rss-item');
    addLog('INFO', 'HN: ' + items.length + ' stories');
  } catch(e) {
    addLog('ERR', 'HN fetch failed: ' + e.message);
    const el = $('rss-list'); if (el) el.innerHTML = '<div style="color:var(--er);font-size:12px;padding:8px;">Failed to load. <button class="btn btn-sm" onclick="fetchRSS()">Retry</button></div>';
  }
}
function _timeAgo(iso) { const s=Math.floor((Date.now()-new Date(iso).getTime())/1000); if(s<60)return s+'s ago'; if(s<3600)return Math.floor(s/60)+'m ago'; if(s<86400)return Math.floor(s/3600)+'h ago'; return Math.floor(s/86400)+'d ago'; }

// ══ UPTIME ══
function updateUptime(uptimeStr) {
  if (!uptimeStr) return;
  setEl('uptime-big', uptimeStr);
  const parts = uptimeStr.split(':');
  if (parts.length >= 2) { const h = parseInt(parts[0])||0; setEl('up-days', Math.floor(h/24)); setEl('up-hours', h%24); }
}

// ══ NOTEPAD ══
function noteChanged() { const v=$('notepad-area')?.value||''; setEl('note-chars',v.length); const tc=$('tc-notepad-area'); if(tc)tc.value=v; setEl('tc-note-chars',v.length+' chars'); }
function tcNoteChanged() { const v=$('tc-notepad-area')?.value||''; const m=$('notepad-area'); if(m)m.value=v; setEl('note-chars',v.length); setEl('tc-note-chars',v.length+' chars'); }
function saveNote() { const v=$('notepad-area')?.value||$('tc-notepad-area')?.value||''; localStorage.setItem('panto-notes',v); ['note-saved','tc-note-saved'].forEach(id=>{setEl(id,'Saved ✓');setTimeout(()=>setEl(id,''),2000);}); }
function exportNote() { const v=$('notepad-area')?.value||''; const a=document.createElement('a'); a.href='data:text/plain;charset=utf-8,'+encodeURIComponent(v); a.download='panto-notes.txt'; a.click(); addLog('OK','Notes exported'); }
function loadNote() { const v=localStorage.getItem('panto-notes')||''; const a=$('notepad-area'),b=$('tc-notepad-area'); if(a)a.value=v; if(b)b.value=v; setEl('note-chars',v.length); setEl('tc-note-chars',v.length+' chars'); }

// ══ POMODORO ══
let pomoState = {running:false, seconds:25*60, phase:'focus', sessions:0, interval:null};
const POMO_TIMES = {focus:25*60, short:5*60, long:15*60};
function renderPomoDisplay() {
  const m=Math.floor(pomoState.seconds/60), s=pomoState.seconds%60;
  const str=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  ['pomo-time','tc-pomo-time'].forEach(id=>setEl(id,str));
  const lbl=pomoState.phase==='focus'?'Focus':pomoState.phase==='short'?'Short Break':'Long Break';
  ['pomo-label','tc-pomo-label'].forEach(id=>setEl(id,lbl));
  const btnStr=pomoState.running?'⏸ Pause':'▶ Start';
  ['pomo-start','tc-pomo-start'].forEach(id=>setEl(id,btnStr));
  const dotsEl=$('pomo-dots'); if(dotsEl) dotsEl.innerHTML=Array.from({length:4},(_,i)=>`<div class="pomo-dot${i<pomoState.sessions%4?' done':''}"></div>`).join('');
  const tcDots=$('tc-pomo-dots'); if(tcDots) tcDots.innerHTML=Array.from({length:4},(_,i)=>`<div class="tc-pomo-dot${i<pomoState.sessions%4?' done':''}"></div>`).join('');
  setEl('pomo-sessions','Sessions: '+pomoState.sessions);
  const sb=$('tc-pomo-sessions-badge'); if(sb) sb.textContent=pomoState.sessions>0?'×'+pomoState.sessions:'';
  renderPomoRing();
}
function renderPomoRing() {
  const c=$('pomo-ring'); if(!c) return;
  const ctx=c.getContext('2d'); ctx.clearRect(0,0,100,100);
  const total=POMO_TIMES[pomoState.phase];
  const remain=Math.max(0, pomoState.seconds/total); // 1=full, 0=empty
  const accColor=getComputedStyle(document.documentElement).getPropertyValue('--acc').trim()||'#e8962a';
  // Background track
  ctx.beginPath(); ctx.arc(50,50,40,0,Math.PI*2);
  ctx.strokeStyle='rgba(255,255,255,0.10)'; ctx.lineWidth=7; ctx.stroke();
  // Remaining time arc (full at start, depletes as time passes)
  if(remain>0){
    ctx.beginPath();
    ctx.arc(50,50,40,-Math.PI/2,-Math.PI/2+remain*Math.PI*2);
    ctx.strokeStyle=accColor; ctx.lineWidth=7; ctx.lineCap='round'; ctx.stroke();
  }
}
function pomoToggle() {
  if(pomoState.running){clearInterval(pomoState.interval);pomoState.running=false;}
  else{pomoState.running=true;pomoState.interval=setInterval(()=>{pomoState.seconds--;if(pomoState.seconds<=0){clearInterval(pomoState.interval);pomoState.running=false;if(pomoState.phase==='focus'){pomoState.sessions++;pomoState.phase=pomoState.sessions%4===0?'long':'short';pomoState.seconds=POMO_TIMES[pomoState.phase];}else{pomoState.phase='focus';pomoState.seconds=POMO_TIMES.focus;}addLog('INFO','Pomodoro: '+pomoState.phase);}renderPomoDisplay();},1000);}
  renderPomoDisplay();
}
function pomoReset(){clearInterval(pomoState.interval);pomoState.running=false;pomoState.seconds=POMO_TIMES.focus;pomoState.phase='focus';renderPomoDisplay();}

// ══ SEARCH ══
const SI = [
  ...svcs.map(s=>({label:s.name,sub:s.url,ico:'🔗',action:()=>window.open(s.url,'_blank')})),
  {label:'Overview',      sub:'Dashboard',        ico:'📊', action:()=>showSection('overview')},
  {label:'System',        sub:'CPU RAM Disk',      ico:'💻', action:()=>showSection('system')},
  {label:'Network',       sub:'Ping Tailscale',    ico:'📡', action:()=>showSection('network')},
  {label:'Docker',        sub:'Containers',        ico:'🐳', action:()=>showSection('docker')},
  {label:'AI Chat',       sub:'Ollama',            ico:'💬', action:()=>showSection('chat')},
  {label:'Fun Zone',      sub:'Widgets',           ico:'⭐', action:()=>showSection('fun')},
  {label:'Tile Mode',     sub:'Full screen',       ico:'⊞',  action:toggleTileMode},
  {label:'Node Designer', sub:'Automation',        ico:'⚡', action:toggleNodeMode},
  {label:'LED ON',        sub:'Lights on',         ico:'💡', action:()=>runLed('on')},
  {label:'LED OFF',       sub:'Lights off',        ico:'🔦', action:()=>runLed('off')},
  {label:'Settings',      sub:'Preferences',       ico:'⚙',  action:toggleSettings},
  {label:'Shutdown',      sub:'Power off',         ico:'⏻',  action:()=>confirmAct('Shutdown PC in 30s?','shutdown')},
  {label:'Restart',       sub:'Reboot',            ico:'↺',  action:()=>confirmAct('Restart PC in 30s?','restart')},
  {label:'Lock',          sub:'Lock screen',       ico:'🔒', action:()=>sysAct('lock')},
];
function openSearch() { const m=$('search-modal'); if(m)m.classList.add('open'); setTimeout(()=>$('search-input')?.focus(),50); doSearch(''); }
function closeSearch() { const m=$('search-modal'); if(m)m.classList.remove('open'); setEl('search-input','','value'); }
function doSearch(q) {
  const res = q ? SI.filter(i=>i.label.toLowerCase().includes(q.toLowerCase())||i.sub.toLowerCase().includes(q.toLowerCase())) : SI;
  const el = $('search-results'); if(!el) return;
  el.innerHTML = res.slice(0,10).map((r,i)=>`<div class="sr" onclick="runS(${SI.indexOf(r)})"><span class="sr-ico">${r.ico}</span><div><div class="sr-label">${r.label}</div><div class="sr-sub">${r.sub}</div></div></div>`).join('');
}
function runS(i) { SI[i].action(); closeSearch(); }
function searchKey(e) { if(e.key==='Escape')closeSearch(); if(e.key==='Enter'){const q=e.target.value;const res=SI.filter(i=>i.label.toLowerCase().includes(q.toLowerCase()));if(res[0]){res[0].action();closeSearch();}} }

// ══ SETTINGS ══
function toggleSettings() { $('settings-panel')?.classList.toggle('open'); }
function setAccent(hex) {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  const mk=(r2,g2,b2,a)=>`rgba(${r2},${g2},${b2},${a})`;
  const lighter=`#${Math.min(255,r+28).toString(16).padStart(2,'0')}${Math.min(255,g+28).toString(16).padStart(2,'0')}${Math.min(255,b+28).toString(16).padStart(2,'0')}`;
  const darker=`#${Math.max(0,r-38).toString(16).padStart(2,'0')}${Math.max(0,g-38).toString(16).padStart(2,'0')}${Math.max(0,b-38).toString(16).padStart(2,'0')}`;
  const root = document.documentElement;
  root.style.setProperty('--acc', hex);
  root.style.setProperty('--acc-l', lighter);
  root.style.setProperty('--acc-d', darker);
  root.style.setProperty('--acc-bg', mk(r,g,b,0.10));
  root.style.setProperty('--acc-bd', mk(r,g,b,0.22));
  root.style.setProperty('--acc-glow', mk(r,g,b,0.18));
  root.style.setProperty('--bd-a', mk(r,g,b,0.24));
  root.style.setProperty('--bd-f', mk(r,g,b,0.55));
  const p=$('acc-picker'); if(p) p.value=hex;
  localStorage.setItem('panto-accent', hex);
}
function toggleOverlayMode(on) { document.body.classList.toggle('overlay', on); localStorage.setItem('panto-overlay', on?'1':'0'); }
function setPanelOpacity(v) { document.documentElement.style.setProperty('--pa', v); setEl('opacity-val', Math.round(v*100)+'%'); localStorage.setItem('panto-panel-opacity', v); }
function setWxCity(val) { wxCity=val.trim(); localStorage.setItem('panto-wx-city', wxCity); }
function setDockerInt(ms) { if(_dockerIntTimer)clearInterval(_dockerIntTimer); _dockerIntTimer=setInterval(fetchDocker,ms); }

// ══ NODE DESIGNER ══
let _nodes=[], _conns=[], _nodeId=0, _dragging=null, _dragOff={x:0,y:0}, _pendingPort=null, _placeX=60, _placeY=60;
const NDEFS = {
  cpu_high:      {name:'CPU High',       cat:'t',icon:'⚡',fields:[{k:'threshold',l:'Threshold %',t:'number',v:90}]},
  ram_high:      {name:'RAM High',       cat:'t',icon:'⚡',fields:[{k:'threshold',l:'Threshold %',t:'number',v:90}]},
  temp_high:     {name:'Temp High',      cat:'t',icon:'⚡',fields:[{k:'threshold',l:'Threshold °C',t:'number',v:90}]},
  startup:       {name:'On Startup',     cat:'t',icon:'⚡',fields:[]},
  schedule:      {name:'Schedule',       cat:'t',icon:'⚡',fields:[{k:'interval',l:'Every (min)',t:'number',v:5}]},
  disk_high:     {name:'Disk High',      cat:'t',icon:'⚡',fields:[{k:'threshold',l:'Threshold %',t:'number',v:90}]},
  ollama_down:   {name:'Ollama Down',    cat:'t',icon:'⚡',fields:[]},
  docker_down:   {name:'Container Down', cat:'t',icon:'⚡',fields:[{k:'name',l:'Container name',t:'text',v:'myapp'}]},
  time_of_day:   {name:'Time of Day',    cat:'t',icon:'⚡',fields:[{k:'hour',l:'Hour (0-23)',t:'number',v:22},{k:'min',l:'Minute',t:'number',v:0}]},
  led_on:        {name:'LED On',         cat:'a',icon:'▶',fields:[]},
  led_off:       {name:'LED Off',        cat:'a',icon:'▶',fields:[]},
  led_toggle:    {name:'LED Toggle',     cat:'a',icon:'▶',fields:[]},
  docker_restart:{name:'Docker Restart', cat:'a',icon:'▶',fields:[{k:'name',l:'Container',t:'text',v:'myapp'}]},
  docker_stop:   {name:'Docker Stop',    cat:'a',icon:'▶',fields:[{k:'name',l:'Container',t:'text',v:'myapp'}]},
  docker_start:  {name:'Docker Start',   cat:'a',icon:'▶',fields:[{k:'name',l:'Container',t:'text',v:'myapp'}]},
  kill_ollama:   {name:'Kill Ollama',    cat:'a',icon:'▶',fields:[{k:'confirm',l:'confirm=yes',t:'text',v:'no'}]},
  log_msg:       {name:'Log Message',    cat:'a',icon:'▶',fields:[{k:'msg',l:'Message',t:'text',v:'Automation fired'}]},
  shutdown_pc:   {name:'Shutdown PC',    cat:'a',icon:'▶',fields:[{k:'delay',l:'Delay (s)',t:'number',v:30}]},
  open_url:      {name:'Open URL',       cat:'a',icon:'▶',fields:[{k:'url',l:'URL',t:'text',v:'https://'}]},
  pomodoro_start:{name:'Start Pomodoro', cat:'a',icon:'▶',fields:[]},
  send_webhook:  {name:'Webhook',        cat:'a',icon:'▶',fields:[{k:'url',l:'Webhook URL',t:'text',v:'https://'}]},
};
function addNode(type, x, y) {
  const def=NDEFS[type]; if(!def) return;
  const id='n'+(++_nodeId);
  const fx=x!==undefined?x:_placeX, fy=y!==undefined?y:_placeY;
  _placeX=(_placeX+170)%700; if(_placeX<60)_placeY+=100;
  const fields={};
  def.fields.forEach(f=>fields[f.k]=f.v);
  _nodes.push({id,type,x:fx,y:fy,fields});
  _renderNode(id); _drawConns();
  if(type==='startup')setTimeout(()=>_fireNode(id),500);
  if(type==='schedule')_startSched(id);
  saveNodes();
}
function _renderNode(id){
  const n=_nodes.find(n=>n.id===id); if(!n) return;
  const def=NDEFS[n.type]; const wrap=document.getElementById('node-canvas-wrap'); if(!wrap) return;
  let el=document.getElementById('nel-'+id);
  if(!el){el=document.createElement('div');el.className='node-el';el.id='nel-'+id;wrap.appendChild(el);}
  el.style.left=n.x+'px'; el.style.top=n.y+'px';
  el.innerHTML=`<div class="ne-head"><span class="ne-ico">${def.icon}</span><span class="ne-name">${def.name}</span><span class="ne-cat ${def.cat==='t'?'cat-t':'cat-a'}">${def.cat==='t'?'trigger':'action'}</span><button class="ne-del" onclick="delNode('${id}')">✕</button></div><div class="ne-body">${def.fields.map(f=>`<div class="ne-field"><label>${f.l}</label><input type="${f.t}" value="${n.fields[f.k]??f.v}" onchange="_nodes.find(n=>n.id==='${id}').fields['${f.k}']=this.${f.t==='number'?'valueAsNumber':'value'}"/></div>`).join('')}</div><div class="ne-ports"><div class="ne-port" id="port-in-${id}" onclick="_portClick('in','${id}')" title="Input"></div><span class="ne-port-lbl">in</span><span class="ne-port-lbl">out</span><div class="ne-port" id="port-out-${id}" onclick="_portClick('out','${id}')" title="Output"></div></div>`;
  el.onmousedown=ev=>{if(ev.target.closest('.ne-field')||ev.target.closest('.ne-port')||ev.target.closest('.ne-del'))return;_dragging=id;_dragOff={x:ev.clientX-n.x,y:ev.clientY-n.y};ev.preventDefault();};
}
function delNode(id){
  const n=_nodes.find(n=>n.id===id); if(n&&n._sched)clearInterval(n._sched);
  _nodes=_nodes.filter(n=>n.id!==id); _conns=_conns.filter(c=>c.f!==id&&c.t!==id);
  const el=document.getElementById('nel-'+id); if(el)el.remove(); _drawConns(); saveNodes();
}
function _portClick(side, id){
  if(!_pendingPort){_pendingPort={side,id};const port=document.getElementById(`port-${side}-${id}`);if(port)port.classList.add('active');}
  else{
    const {side:ps,id:pi}=_pendingPort;
    if(ps==='out'&&side==='in'&&pi!==id){_conns.push({f:pi,t:id});nlog('Connected: '+pi+' → '+id);_drawConns();saveNodes();}
    else if(ps==='in'&&side==='out'&&pi!==id){_conns.push({f:id,t:pi});nlog('Connected: '+id+' → '+pi);_drawConns();saveNodes();}
    document.querySelectorAll('.ne-port.active').forEach(p=>p.classList.remove('active'));
    _pendingPort=null;
  }
}
function _drawConns(){
  const canvas=document.getElementById('node-canvas'); if(!canvas) return;
  const wrap=document.getElementById('node-canvas-wrap'); if(!wrap) return;
  canvas.width=wrap.clientWidth; canvas.height=wrap.clientHeight;
  const ctx=canvas.getContext('2d');
  _conns.forEach(c=>{
    const fo=document.getElementById('port-out-'+c.f), ti=document.getElementById('port-in-'+c.t);
    if(!fo||!ti) return;
    const wr=wrap.getBoundingClientRect(), fr=fo.getBoundingClientRect(), tr=ti.getBoundingClientRect();
    const x1=fr.left-wr.left+6,y1=fr.top-wr.top+6,x2=tr.left-wr.left+6,y2=tr.top-wr.top+6;
    ctx.beginPath(); ctx.moveTo(x1,y1);
    const cp=(x2-x1)*0.5;
    ctx.bezierCurveTo(x1+cp,y1,x2-cp,y2,x2,y2);
    ctx.strokeStyle=_accRgb(0.7); ctx.lineWidth=1.5; ctx.stroke();
  });
}
function _initNodeCanvas(){
  const wrap=document.getElementById('node-canvas-wrap'); if(!wrap) return;
  wrap.onmousemove=ev=>{if(!_dragging)return;const n=_nodes.find(n=>n.id===_dragging);if(!n)return;n.x=ev.clientX-_dragOff.x;n.y=ev.clientY-_dragOff.y;const el=document.getElementById('nel-'+_dragging);if(el){el.style.left=n.x+'px';el.style.top=n.y+'px';}throttle(_drawConns,50);};
  wrap.onmouseup=()=>{_dragging=null;};
  new ResizeObserver(_drawConns).observe(wrap);
}
let _throttleT=null;
function throttle(fn,ms){clearTimeout(_throttleT);_throttleT=setTimeout(fn,ms);}
function _fireNode(id){
  const n=_nodes.find(n=>n.id===id); if(!n) return;
  nlog('▶ Fire: '+NDEFS[n.type].name,'fire');
  const el=document.getElementById('nel-'+id); if(el){el.classList.add('firing');setTimeout(()=>el.classList.remove('firing'),800);}
  _conns.filter(c=>c.f===id).forEach(c=>_execNode(c.t));
}
async function _execNode(id){
  const n=_nodes.find(n=>n.id===id); if(!n) return;
  const def=NDEFS[n.type]; nlog('⚡ Exec: '+def.name,'fire');
  const el=document.getElementById('nel-'+id); if(el){el.classList.add('firing');setTimeout(()=>el.classList.remove('firing'),600);}
  switch(n.type){
    case 'led_on': await runLed('on'); nlog('✓ LED On','ok'); break;
    case 'led_off': await runLed('off'); nlog('✓ LED Off','ok'); break;
    case 'led_toggle': await runLed(ledState?'off':'on'); nlog('✓ LED toggled','ok'); break;
    case 'log_msg': addLog('INFO','[NODE] '+(n.fields.msg||'')); nlog('✓ Logged','ok'); break;
    case 'docker_restart':{const name=n.fields.name||'';if(name){await fetch(SYSAPI+'/docker/restart/'+name,{method:'POST',signal:AbortSignal.timeout(20000)}).catch(()=>{});nlog('✓ Restart: '+name,'ok');}break;}
    case 'docker_stop':{const nm=n.fields.name||'';if(nm){await fetch(SYSAPI+'/docker/stop/'+nm,{method:'POST',signal:AbortSignal.timeout(15000)}).catch(()=>{});nlog('✓ Stopped: '+nm,'ok');}break;}
    case 'docker_start':{const nm=n.fields.name||'';if(nm){await fetch(SYSAPI+'/docker/start/'+nm,{method:'POST',signal:AbortSignal.timeout(15000)}).catch(()=>{});nlog('✓ Started: '+nm,'ok');}break;}
    case 'kill_ollama': if(n.fields.confirm==='yes'){await fetch(SYSAPI+'/docker/stop/ollama',{method:'POST',signal:AbortSignal.timeout(15000)}).catch(()=>{});nlog('✓ Ollama stopped','ok');}else nlog('Set confirm=yes','err'); break;
    case 'shutdown_pc':{const delay=parseInt(n.fields.delay)||30;addLog('WARN','[NODE] Shutdown in '+delay+'s');await fetch(SYSAPI+'/system/shutdown',{method:'POST',signal:AbortSignal.timeout(5000)}).catch(()=>{});nlog('✓ Shutdown','ok');break;}
    case 'open_url': window.open(n.fields.url||'','_blank'); nlog('✓ Opened URL','ok'); break;
    case 'pomodoro_start': if(!pomoState.running)pomoToggle(); nlog('✓ Pomodoro started','ok'); break;
    case 'send_webhook':{const url=n.fields.url||'';if(url&&url.startsWith('http')){fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source:'panto-os',ts:Date.now()})}).then(()=>nlog('✓ Webhook sent','ok')).catch(e=>nlog('✗ Webhook: '+e.message,'err'));}break;}
    default: nlog('Unknown: '+n.type,'err');
  }
}
function _checkNodeTriggers(stats){
  _nodes.forEach(n=>{
    const d=NDEFS[n.type]; if(!d||d.cat!=='t') return;
    if(n.type==='cpu_high'){const thr=+n.fields.threshold||90;const fire=stats.cpu>thr;if(fire&&!n._trig){n._trig=true;_fireNode(n.id);}else if(!fire)n._trig=false;}
    if(n.type==='ram_high'){const thr=+n.fields.threshold||90;const fire=Math.round(stats.ram||0)>thr;if(fire&&!n._trig){n._trig=true;_fireNode(n.id);}else if(!fire)n._trig=false;}
    if(n.type==='temp_high'){const thr=+n.fields.threshold||90;const tv=Object.values(stats.temps||{}).filter(t=>t>10&&t<115);const mx=tv.length?Math.max(...tv):0;const fire=mx>thr;if(fire&&!n._trig){n._trig=true;_fireNode(n.id);}else if(!fire)n._trig=false;}
    if(n.type==='disk_high'){const thr=+n.fields.threshold||90;const fire=stats.disk>thr;if(fire&&!n._trig){n._trig=true;_fireNode(n.id);}else if(!fire)n._trig=false;}
    if(n.type==='ollama_down'){const ol=$('ol-v');const down=ol&&ol.textContent==='offline';if(down&&!n._trig){n._trig=true;_fireNode(n.id);}else if(!down)n._trig=false;}
    if(n.type==='docker_down'){const conts=window._lastDockerContainers||[];const name=n.fields.name||'';const cont=conts.find(x=>x.name===name);const down=cont&&cont.status!=='running';if(down&&!n._trig){n._trig=true;_fireNode(n.id);}else if(!down)n._trig=false;}
    if(n.type==='time_of_day'){const now=new Date();const fire=now.getHours()===+n.fields.hour&&now.getMinutes()===+n.fields.min&&now.getSeconds()<10;if(fire&&!n._trig){n._trig=true;_fireNode(n.id);setTimeout(()=>n._trig=false,15000);}else if(!fire&&now.getSeconds()>15)n._trig=false;}
  });
}
function _startSched(id){const n=_nodes.find(n=>n.id===id);if(!n)return;const mins=+n.fields.interval||5;n._sched=setInterval(()=>_fireNode(id),mins*60000);nlog('Schedule: every '+mins+'min');}
function runAllNodes(){_nodes.filter(n=>NDEFS[n.type]?.cat==='t').forEach(n=>_fireNode(n.id));}
function clearAllNodes(){_nodes.forEach(n=>{if(n._sched)clearInterval(n._sched);const el=document.getElementById('nel-'+n.id);if(el)el.remove();});_nodes=[];_conns=[];_drawConns();saveNodes();nlog('Cleared');}
function nlog(msg,cls){const el=$('node-log');if(!el)return;const d=document.createElement('div');d.className='nl '+(cls||'');d.textContent=new Date().toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit',second:'2-digit'})+' '+msg;el.appendChild(d);el.scrollTop=el.scrollHeight;}
function nodeDragStart(e,type){e.dataTransfer.setData('nodeType',type);}
function nodeDropped(e){e.preventDefault();const type=e.dataTransfer.getData('nodeType');if(!type)return;const wr=document.getElementById('node-canvas-wrap').getBoundingClientRect();addNode(type,e.clientX-wr.left-70,e.clientY-wr.top-35);}
function saveNodes(){
  const data={nodes:_nodes.map(n=>({id:n.id,type:n.type,x:n.x,y:n.y,fields:{...n.fields}})),conns:_conns,nodeId:_nodeId};
  localStorage.setItem('panto-nodes',JSON.stringify(data));
  nlog('Saved ✓','ok');
  const btn=$('node-save-btn'); if(btn){btn.textContent='✓ Saved';setTimeout(()=>btn.textContent='💾 Save',1500);}
}
function loadNodes(){
  try{
    const raw=localStorage.getItem('panto-nodes'); if(!raw)return;
    const data=JSON.parse(raw);
    if(data.nodeId)_nodeId=data.nodeId;
    (data.conns||[]).forEach(c=>_conns.push(c));
    (data.nodes||[]).forEach(n=>{
      const fields={};
      const def=NDEFS[n.type]; if(!def)return;
      def.fields.forEach(f=>fields[f.k]=f.v);
      Object.assign(fields,n.fields);
      _nodes.push({id:n.id,type:n.type,x:n.x,y:n.y,fields});
      _renderNode(n.id);
      if(n.type==='schedule')_startSched(n.id);
    });
    _drawConns();
    nlog('Loaded '+_nodes.length+' nodes','ok');
  }catch(e){nlog('Load error: '+e.message,'err');}
}

// ══ DAY PLANNER ══
const PLANNER_HOURS = Array.from({length:18}, (_,i) => i + 6); // 6:00 – 23:00
const PLAN_PX_MIN   = 1.5;          // px per minute
const PLAN_START    = 6 * 60;       // 360 min
const PLAN_END      = 23 * 60;      // 1380 min
const PLAN_H        = (PLAN_END - PLAN_START) * PLAN_PX_MIN; // 1530 px
function _minToPx(m) { return (m - PLAN_START) * PLAN_PX_MIN; }
function _nowMin()   { const n = new Date(); return n.getHours()*60 + n.getMinutes(); }
function _parseTimePair(s) {
  if (!s) return null;
  const m = s.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
  if (!m) return null;
  const st = +m[1]*60 + +m[2], en = +m[3]*60 + +m[4];
  return { start: st, duration: en - st };
}
const _now = new Date();
let _plannerDate = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate());
let _plannerWeekMode = false;

function _localISO(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function _plannerKey(d) {
  return 'panto-planner-' + _localISO(d);
}
function _plannerLoad(d) {
  try { return JSON.parse(localStorage.getItem(_plannerKey(d)) || '{}'); } catch { return {}; }
}
function _plannerSave(d, data) {
  localStorage.setItem(_plannerKey(d), JSON.stringify(data));
}
function _backlogKey() { return 'panto-planner-backlog'; }
function _backlogLoad() {
  try { return JSON.parse(localStorage.getItem(_backlogKey()) || '[]'); } catch { return []; }
}
function _backlogSave(items) { localStorage.setItem(_backlogKey(), JSON.stringify(items)); }

function _weekStart(d) {
  const dow = d.getDay(); // 0=Sun,1=Mon,...,6=Sat
  const diff = dow === 0 ? -6 : 1 - dow;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
}
function _weekDays(d) {
  const mon = _weekStart(d);
  const y = mon.getFullYear(), m = mon.getMonth(), day = mon.getDate();
  return Array.from({length:7}, (_, i) => new Date(y, m, day + i));
}

// wipe all stale vulcan entries saved with UTC-offset bug — let Vulcan refetch with correct keys
(function _wipeStalePlannerVulcan() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('panto-planner-') && k !== 'panto-planner-backlog') keys.push(k);
  }
  keys.forEach(k => {
    try {
      const data = JSON.parse(localStorage.getItem(k) || '{}');
      let changed = false;
      for (const h of Object.keys(data)) {
        if (h === '_vulcan' || data[h]?.vulcan) { delete data[h]; changed = true; }
      }
      if (changed) {
        if (Object.keys(data).length === 0) localStorage.removeItem(k);
        else localStorage.setItem(k, JSON.stringify(data));
      }
    } catch {}
  });
})();

function plannerToday() {
  const n = new Date(); _plannerDate = new Date(n.getFullYear(), n.getMonth(), n.getDate()); renderPlanner();
}
function plannerPrevDay() {
  const d = _plannerDate;
  _plannerDate = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (_plannerWeekMode?7:1));
  renderPlanner();
}
function plannerNextDay() {
  const d = _plannerDate;
  _plannerDate = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (_plannerWeekMode?7:1));
  renderPlanner();
}
function plannerToggleWeek() {
  _plannerWeekMode = !_plannerWeekMode;
  const btn = $('planner-week-btn');
  if (btn) btn.textContent = _plannerWeekMode ? '📅 Day' : '📆 Week';
  renderPlanner();
}

async function fetchVulcanSchedule(date) {
  const iso = _localISO(date);
  const today = new Date(); today.setHours(0,0,0,0);
  const isToday = date.getTime() === today.getTime();
  try {
    const url = SYSAPI + (isToday ? '/schedule-today' : '/schedule-date/' + iso);
    const r = await fetch(url, {signal: AbortSignal.timeout(12000)});
    const d = await r.json();
    if (!d.ok) return 0;
    const data = _plannerLoad(date);
    // clear stale vulcan (old hour-keyed and new _vulcan array)
    delete data._vulcan;
    for (const k of Object.keys(data)) { if (data[k]?.vulcan) delete data[k]; }
    const lessons = [];
    for (const l of d.lessons || []) {
      const t = _parseTimePair(l.display);
      if (!t) continue;
      const label = l.subject + (l.room ? ' · ' + l.room : '') + (l.change ? ' [Z]' : '');
      lessons.push({start: t.start, duration: t.duration, text: label, done: false, vulcan: true, display: l.display});
    }
    if (lessons.length) data._vulcan = lessons;
    _plannerSave(date, data);
    return lessons.length;
  } catch(e) {
    addLog('WARN', 'Vulcan ' + iso + ': ' + e.message);
    return 0;
  }
}

function renderPlanner() {
  const n = new Date();
  const today = new Date(n.getFullYear(), n.getMonth(), n.getDate());

  if (_plannerWeekMode) {
    const days = _weekDays(_plannerDate);
    const mon = days[0], sun = days[6];
    setEl('planner-date-sub',
      mon.toLocaleDateString('pl-PL',{day:'numeric',month:'short'}) + ' – ' +
      sun.toLocaleDateString('pl-PL',{day:'numeric',month:'short',year:'numeric'}));
    _renderWeekSlots(days, today);
    renderBacklog();
    // fetch all 7 days async, always re-render after
    Promise.allSettled(days.map(d => fetchVulcanSchedule(d))).then(() => {
      _renderWeekSlots(days, today);
      addLog('INFO', 'Vulcan week loaded');
    });
  } else {
    const isToday = _plannerDate.getTime() === today.getTime();
    const dateStr = _plannerDate.toLocaleDateString('pl-PL', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
    setEl('planner-date-sub', isToday ? 'Today — ' + dateStr : dateStr);
    _renderPlannerSlots();
    renderBacklog();
    // fetch vulcan async, always re-render after
    fetchVulcanSchedule(_plannerDate).then(() => {
      _renderPlannerSlots();
    });
  }
}

function _renderPlannerSlots() {
  const data = _plannerLoad(_plannerDate);
  const today = new Date(); today.setHours(0,0,0,0);
  const isToday = _plannerDate.getTime() === today.getTime();
  const nm = _nowMin();
  const tl = $('planner-timeline'); if (!tl) return;

  const hrLines = PLANNER_HOURS.map(h =>
    `<div class="plc-hr" style="top:${_minToPx(h*60)}px"><span class="plc-hr-lbl">${String(h).padStart(2,'0')}:00</span></div>`
  ).join('');

  const nowLine = (isToday && nm >= PLAN_START && nm < PLAN_END)
    ? `<div class="plc-now" style="top:${_minToPx(nm)}px"></div>` : '';

  const clicks = PLANNER_HOURS.map(h =>
    `<div class="plc-click" style="top:${_minToPx(h*60)}px;height:${60*PLAN_PX_MIN}px" onclick="plannerSlotClick(${h})"></div>`
  ).join('');

  let sched = 0, done = 0;

  const manual = Object.keys(data).filter(k => k !== '_vulcan' && !isNaN(+k) && data[k]?.text).map(k => {
    const s = data[k]; sched++; if (s.done) done++;
    const top = _minToPx(+k * 60), ht = Math.max(24, 55 * PLAN_PX_MIN);
    return `<div class="plc-task${s.done?' plc-done':''}" style="top:${top}px;height:${ht}px">
      <div class="plc-task-txt">${s.text}</div>
      <div class="plc-task-btns">
        <button class="pt-btn${s.done?' pt-done-active':''}" onclick="event.stopPropagation();plannerToggleDone(${k})">✓</button>
        <button class="pt-btn pt-del" onclick="event.stopPropagation();plannerClearSlot(${k})">✕</button>
      </div>
    </div>`;
  }).join('');

  const vulcan = (data._vulcan || []).map((l, i) => {
    sched++; if (l.done) done++;
    const top = _minToPx(l.start), ht = Math.max(24, l.duration * PLAN_PX_MIN);
    return `<div class="plc-task plc-vulcan${l.done?' plc-done':''}" style="top:${top}px;height:${ht}px">
      <div class="plc-task-txt"><span class="planner-vulcan-badge">V</span>${l.text}<span class="plc-task-time">${l.display}</span></div>
      <div class="plc-task-btns">
        <button class="pt-btn${l.done?' pt-done-active':''}" onclick="event.stopPropagation();plannerVulcanDone('${_localISO(_plannerDate)}',${i})">✓</button>
      </div>
    </div>`;
  }).join('');

  const toHM = m => String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
  const recurring = _recurForDate(_plannerDate).map(r => {
    sched++;
    const top = _minToPx(r.startMin), ht = Math.max(24, r.duration * PLAN_PX_MIN);
    const c = r.color || '#a78bfa';
    return `<div class="plc-task plc-recur" style="top:${top}px;height:${ht}px;border-left-color:${c};background:color-mix(in srgb,${c} 10%,var(--bg3))">
      <div class="plc-col"><div class="plc-task-txt"><span style="color:${c};margin-right:3px;font-size:9px;">↻</span>${r.text}</div><div class="plc-task-time">${toHM(r.startMin)}–${toHM(r.startMin+r.duration)}</div></div>
    </div>`;
  }).join('');

  tl.innerHTML = `<div class="plc-wrap" style="height:${PLAN_H}px">${clicks}${hrLines}${nowLine}${manual}${vulcan}${recurring}</div>`;
  _updatePlannerSummary(sched, done);
  if (isToday && nm >= PLAN_START && nm < PLAN_END)
    setTimeout(() => tl.scrollTo({top: Math.max(0, _minToPx(nm) - 150), behavior:'smooth'}), 150);
}

function _renderWeekSlots(days, today) {
  const tl = $('planner-timeline'); if (!tl) return;
  const DAY_NAMES = ['Pon','Wt','Śr','Czw','Pt','Sob','Nd'];
  let totalSched = 0, totalDone = 0;
  const nm = _nowMin();

  const hrLabels = PLANNER_HOURS.map(h =>
    `<div class="pwn-hr-lbl" style="top:${_minToPx(h*60)+20}px">${String(h).padStart(2,'0')}:00</div>`
  ).join('');
  const hrLines = PLANNER_HOURS.map(h =>
    `<div class="pwn-hr-line" style="top:${_minToPx(h*60)+20}px"></div>`
  ).join('');

  const dayCols = days.map((d,i) => {
    const data = _plannerLoad(d);
    const isToday = d.getTime() === today.getTime();
    const iso = _localISO(d);

    const clicks = '';

    const manual = Object.keys(data).filter(k => k !== '_vulcan' && !isNaN(+k) && data[k]?.text).map(k => {
      const s = data[k]; totalSched++; if (s.done) totalDone++;
      const top = _minToPx(+k*60)+20, ht = Math.max(18, 55*PLAN_PX_MIN);
      return `<div class="plc-task plc-wk${s.done?' plc-done':''}" style="top:${top}px;height:${ht}px">
        <div class="plc-task-txt">${s.text}</div>
      </div>`;
    }).join('');

    const vulcan = (data._vulcan || []).map((l, j) => {
      totalSched++; if (l.done) totalDone++;
      const top = _minToPx(l.start)+20, ht = Math.max(18, l.duration*PLAN_PX_MIN);
      return `<div class="plc-task plc-vulcan plc-wk${l.done?' plc-done':''}" style="top:${top}px;height:${ht}px" onclick="event.stopPropagation();plannerVulcanDone('${iso}',${j})">
        <div class="plc-task-txt">${l.text}</div>
        <div class="plc-task-time">${l.display}</div>
      </div>`;
    }).join('');

    const nowLine = (isToday && nm >= PLAN_START && nm < PLAN_END)
      ? `<div class="plc-now" style="top:${_minToPx(nm)+20}px"></div>` : '';

    const toHM2 = m => String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
    const recurring = _recurForDate(d).map(r => {
      totalSched++;
      const top = _minToPx(r.startMin)+20, ht = Math.max(18, r.duration*PLAN_PX_MIN);
      const c = r.color || '#a78bfa';
      return `<div class="plc-task plc-recur plc-wk" style="top:${top}px;height:${ht}px;border-left-color:${c};background:color-mix(in srgb,${c} 10%,var(--bg3))">
        <div class="plc-col"><div class="plc-task-txt">${r.text}</div><div class="plc-task-time">${toHM2(r.startMin)}–${toHM2(r.startMin+r.duration)}</div></div>
      </div>`;
    }).join('');

    const head = `<div class="pwn-day-head-inline${isToday?' pw-today':''}">${DAY_NAMES[i]} ${d.getDate()}</div>`;
    return `<div class="pwn-day-col${isToday?' pwn-today':''}" style="position:relative;height:${PLAN_H+20}px" onclick="plannerWeekClickPos('${iso}',event)">${head}${hrLines}${manual}${vulcan}${recurring}${nowLine}</div>`;
  }).join('');

  tl.innerHTML = `<div class="pwn-body"><div class="pwn-hr-col" style="position:relative;height:${PLAN_H+20}px">${hrLabels}</div>${dayCols}</div>`;
  _updatePlannerSummary(totalSched, totalDone);

  if (days.some(d => d.getTime() === today.getTime()) && nm >= PLAN_START)
    setTimeout(() => tl.scrollTo({top: Math.max(0, _minToPx(nm) - 150), behavior:'smooth'}), 150);
}

// ══ RECURRING EVENTS ══
function _recurLoad() { try { return JSON.parse(localStorage.getItem('panto-recurring') || '[]'); } catch { return []; } }
function _recurSave(r) { localStorage.setItem('panto-recurring', JSON.stringify(r)); }

let _recurSelDays = new Set();
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.recur-day').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = +btn.dataset.d;
      if (_recurSelDays.has(d)) { _recurSelDays.delete(d); btn.classList.remove('active'); }
      else { _recurSelDays.add(d); btn.classList.add('active'); }
    });
  });
  renderRecurList();
});

function recurAdd() {
  const text = document.getElementById('recur-text')?.value.trim();
  const startVal = document.getElementById('recur-start')?.value;
  const endVal   = document.getElementById('recur-end')?.value;
  if (!text || !startVal || !endVal || _recurSelDays.size === 0) return;
  const [sh,sm] = startVal.split(':').map(Number);
  const [eh,em] = endVal.split(':').map(Number);
  const startMin = sh*60+sm, endMin = eh*60+em;
  if (endMin <= startMin) return;
  const rules = _recurLoad();
  const color = document.getElementById('recur-color')?.value || '#a78bfa';
  rules.push({id: Date.now(), days: [..._recurSelDays], startMin, duration: endMin-startMin, text, color});
  _recurSave(rules);
  document.getElementById('recur-text').value = '';
  _recurSelDays.clear();
  document.querySelectorAll('.recur-day').forEach(b => b.classList.remove('active'));
  renderRecurList();
  renderPlanner();
}

function recurDelete(id) {
  _recurSave(_recurLoad().filter(r => r.id !== id));
  renderRecurList();
  renderPlanner();
}

const DAY_SHORT = ['Nd','Pn','Wt','Śr','Cz','Pt','Sb'];
function renderRecurList() {
  const el = document.getElementById('recur-list'); if (!el) return;
  const rules = _recurLoad();
  setEl('recur-count', rules.length);
  const toHM = m => String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
  el.innerHTML = rules.map(r => `
    <div class="backlog-item" style="font-size:11px;">
      <span style="color:var(--acc);flex-shrink:0;min-width:70px;">${r.days.sort().map(d=>DAY_SHORT[d]).join(' ')}</span>
      <span style="color:var(--t3);flex-shrink:0;min-width:90px;">${toHM(r.startMin)}–${toHM(r.startMin+r.duration)}</span>
      <span class="backlog-text">${r.text}</span>
      <button class="pt-btn pt-del" onclick="recurDelete(${r.id})">✕</button>
    </div>`).join('') || '<div style="color:var(--t3);font-size:11px;padding:4px 0;">Brak rutyn</div>';
}

function _recurForDate(date) {
  const dow = date.getDay(); // 0=Sun..6=Sat
  return _recurLoad().filter(r => r.days.includes(dow));
}

function plannerVulcanDone(dateIso, idx) {
  const [y,m,d] = dateIso.split('-').map(Number);
  const date = new Date(y, m-1, d);
  const data = _plannerLoad(date);
  if (data._vulcan?.[idx] !== undefined) {
    data._vulcan[idx].done = !data._vulcan[idx].done;
    _plannerSave(date, data);
    renderPlanner();
  }
}

function plannerWeekClickPos(dateIso, e) {
  if (e.target.closest('.plc-task') || e.target.closest('.pwn-day-head-inline')) return;
  const col = e.currentTarget;
  const rect = col.getBoundingClientRect();
  const y = e.clientY - rect.top - 20; // subtract header height
  const clickedMin = PLAN_START + y / PLAN_PX_MIN;
  const h = Math.floor(clickedMin / 60);
  if (h < 6 || h >= 23) return;
  plannerWeekClick(dateIso, h);
}

function plannerWeekClick(dateIso, h) {
  const [y,m,day] = dateIso.split('-').map(Number);
  const d = new Date(y, m-1, day);
  const data = _plannerLoad(d);
  if (data[h]?.text) return;
  const txt = prompt(`Task — ${dateIso} ${String(h).padStart(2,'0')}:00?`);
  if (!txt?.trim()) return;
  data[h] = {text: txt.trim(), done: false};
  _plannerSave(d, data);
  renderPlanner();
}

function _updatePlannerSummary(scheduled, done) {
  const backlog = _backlogLoad();
  const pct = scheduled > 0 ? Math.round(done / scheduled * 100) : 0;
  setEl('pls-scheduled', scheduled); setEl('pls-done', done);
  setEl('pls-backlog', backlog.length); setEl('pls-pct', pct + '%');
  setEl('planner-busy-badge', scheduled + ' task' + (scheduled!==1?'s':''));
  const bar = $('pls-bar'); if (bar) bar.style.width = pct + '%';
}

function plannerSlotClick(h) {
  const data = _plannerLoad(_plannerDate);
  if (data[h]?.text) return;
  const backlog = _backlogLoad();
  if (backlog.length > 0) {
    plannerPickFromBacklog(h);
  } else {
    const txt = prompt('Task for ' + String(h).padStart(2,'0') + ':00?');
    if (!txt?.trim()) return;
    data[h] = {text: txt.trim(), done: false};
    _plannerSave(_plannerDate, data); renderPlanner();
  }
}

function plannerPickFromBacklog(h) {
  const backlog = _backlogLoad();
  if (!backlog.length) { plannerSlotClick(h); return; }
  const choice = prompt(`Pick task for ${String(h).padStart(2,'0')}:00\n\n${backlog.map((t,i)=>`${i+1}. ${t}`).join('\n')}\n\n(Enter number, or 0 for custom)`);
  if (choice === null) return;
  const idx = parseInt(choice) - 1;
  const data = _plannerLoad(_plannerDate);
  if (idx >= 0 && idx < backlog.length) {
    data[h] = {text: backlog[idx], done: false};
    backlog.splice(idx, 1);
    _backlogSave(backlog);
  } else {
    const txt = prompt('Custom task:');
    if (!txt?.trim()) return;
    data[h] = {text: txt.trim(), done: false};
  }
  _plannerSave(_plannerDate, data); renderPlanner();
}

function plannerToggleDone(h) {
  const data = _plannerLoad(_plannerDate);
  if (!data[h]) return;
  data[h].done = !data[h].done;
  _plannerSave(_plannerDate, data); renderPlanner();
}

function plannerClearSlot(h) {
  const data = _plannerLoad(_plannerDate);
  delete data[h];
  _plannerSave(_plannerDate, data); renderPlanner();
}

function plannerAddBacklog() {
  const inp = $('planner-new-task'); if (!inp) return;
  const txt = inp.value.trim(); if (!txt) return;
  const backlog = _backlogLoad();
  backlog.push(txt);
  _backlogSave(backlog);
  inp.value = '';
  renderBacklog();
  setEl('pls-backlog', backlog.length);
}

function plannerDeleteBacklog(idx) {
  const backlog = _backlogLoad();
  backlog.splice(idx, 1);
  _backlogSave(backlog);
  renderBacklog();
  setEl('pls-backlog', backlog.length);
}

function renderBacklog() {
  const el = $('planner-backlog'); if (!el) return;
  const backlog = _backlogLoad();
  setEl('planner-backlog-count', backlog.length);
  el.innerHTML = backlog.map((t, i) => `
    <div class="backlog-item">
      <span class="backlog-text">${t}</span>
      <button class="pt-btn pt-del" onclick="plannerDeleteBacklog(${i})" title="Remove">✕</button>
    </div>`).join('') || '<div style="color:var(--t3);font-size:11px;padding:4px 0;">Empty backlog</div>';
}

// ══ KEYBOARD SHORTCUTS ══
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
  if (e.key === 'Escape') { closeSearch(); closeConfirm(); if ($('settings-panel')?.classList.contains('open')) toggleSettings(); }
});

// ══ INIT ══
renderSvcs();
initClock();
loadNote();
renderPomoDisplay();

// Restore prefs
(function() {
  const a = localStorage.getItem('panto-accent'); if (a) setAccent(a);
  const o = localStorage.getItem('panto-overlay'); if (o === '1') { toggleOverlayMode(true); const c = $('overlay-chk'); if (c) c.checked = true; }
  const op = localStorage.getItem('panto-panel-opacity'); if (op) { setPanelOpacity(+op); const sl = $('opacity-sl'); if (sl) sl.value = op; }
  const wc = localStorage.getItem('panto-wx-city'); if (wc) { wxCity = wc; const inp = $('wx-city-inp'); if (inp) inp.value = wc; }
  const lsc = $('led-startup-chk'); if (lsc) lsc.checked = localStorage.getItem('panto-led-startup') === '1';
})();

fetchStats();  setInterval(fetchStats, 8000);
fetchWx();     setInterval(fetchWx, 300000);
pingAll();     setInterval(pingAll, 30000);
fetchDocker(); _dockerIntTimer = setInterval(fetchDocker, 60000);
fetchTS();
fetchBots();      setInterval(fetchBots, 30000);
fetchHoneypot();  setInterval(fetchHoneypot, 60000);
fetchCrypto(); setInterval(fetchCrypto, 30000);
fetchRSS();    setInterval(fetchRSS, 180000);
setInterval(() => { if (_tileOpen) { updateTileSyslog(); updateTileStats(); } }, 2000);

if (localStorage.getItem('panto-led-startup') === '1') setTimeout(() => runLed('on'), 2000);

loadNodes();
addLog('INFO', 'Panto OS v2 ready');
addLog('INFO', 'sysapi @ ' + SYSAPI);
addLog('INFO', 'ollama @ ' + OLLAMA);
