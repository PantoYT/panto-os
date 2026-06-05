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
