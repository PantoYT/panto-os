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

