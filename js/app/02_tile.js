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

