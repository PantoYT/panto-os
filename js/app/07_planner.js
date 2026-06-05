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

