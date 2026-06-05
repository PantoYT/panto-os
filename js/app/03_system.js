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

