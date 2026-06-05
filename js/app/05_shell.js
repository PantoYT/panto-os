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

