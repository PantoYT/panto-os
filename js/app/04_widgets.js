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

