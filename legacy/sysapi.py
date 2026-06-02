from flask import Flask, jsonify, request
from flask_cors import CORS
import psutil
import datetime
import subprocess
import json
import requests
import threading
import time
import os
import concurrent.futures

app = Flask(__name__)
CORS(app)

DISCORD_WEBHOOK = os.getenv('DISCORD_WEBHOOK', '')
ALERT_THRESHOLDS = {'cpu': 90, 'ram': 90, 'disk': 90, 'temp': 95}
_last_alert = {}

_cpu_history = []
_stats_history = []

def background_monitor():
    while True:
        try:
            cpu = psutil.cpu_percent(interval=1)
            ram = psutil.virtual_memory()
            _cpu_history.append(cpu)
            if len(_cpu_history) > 60:
                _cpu_history.pop(0)
            _stats_history.append({
                'ts': int(time.time()),
                'cpu': round(cpu, 1),
                'ram': round(ram.percent, 1)
            })
            if len(_stats_history) > 120:
                _stats_history.pop(0)
            check_alerts(cpu, ram.percent)
        except:
            pass
        time.sleep(5)

def check_alerts(cpu, ram):
    now = time.time()
    def send(msg):
        if not DISCORD_WEBHOOK:
            return
        try:
            requests.post(DISCORD_WEBHOOK, json={'content': msg}, timeout=5)
        except:
            pass
    if cpu > ALERT_THRESHOLDS['cpu']:
        if now - _last_alert.get('cpu', 0) > 300:
            _last_alert['cpu'] = now
            send(f'🔥 **Panto OS Alert** — CPU critical: {cpu:.1f}%')
    if ram > ALERT_THRESHOLDS['ram']:
        if now - _last_alert.get('ram', 0) > 300:
            _last_alert['ram'] = now
            send(f'💾 **Panto OS Alert** — RAM critical: {ram:.1f}%')

def get_temps():
    import re
    temps = {}
    try:
        r = requests.get('http://localhost:8085/data.json', timeout=2)
        data = r.json()
        def find_temps(node):
            name = node.get('Text', '')
            val = str(node.get('Value', '')).strip()
            # Match "47.0 °C" in any encoding — ° may appear as � (replacement char)
            m = re.match(r'^(\d+\.?\d*)\s*\S*\s*C$', val)
            if m and name:
                try:
                    t = float(m.group(1))
                    if 10 < t < 115:
                        temps[name] = round(t, 1)
                except:
                    pass
            for child in node.get('Children', []):
                find_temps(child)
        find_temps(data)
    except:
        pass
    return temps

@app.route('/stats')
def stats():
    cpu = _cpu_history[-1] if _cpu_history else psutil.cpu_percent(interval=0.5)
    ram = psutil.virtual_memory()
    disk = psutil.disk_usage('E:\\')
    net = psutil.net_io_counters()
    boot = datetime.datetime.fromtimestamp(psutil.boot_time())
    uptime = str(datetime.datetime.now() - boot).split('.')[0]

    by_name = {}
    for p in psutil.process_iter(['pid','name','cpu_percent','memory_percent']):
        try:
            name = p.info['name'] or ''
            if name in ('System Idle Process', 'System', '', 'Idle'):
                continue
            cpu_p = (p.info['cpu_percent'] or 0) / max(1, psutil.cpu_count())
            if cpu_p > 100:
                continue
            ram_p = p.info['memory_percent'] or 0
            if name in by_name:
                by_name[name]['cpu'] = round(by_name[name]['cpu'] + cpu_p, 1)
                by_name[name]['ram'] = round(by_name[name]['ram'] + ram_p, 1)
            else:
                by_name[name] = {'name': name, 'cpu': round(cpu_p, 1), 'ram': round(ram_p, 1)}
        except:
            pass
    procs = sorted(by_name.values(), key=lambda x: x['cpu'], reverse=True)[:12]

    return jsonify({
        'cpu': round(cpu, 1),
        'cpu_history': _cpu_history[-20:],
        'ram': round(ram.percent, 1),
        'ram_used': round(ram.used/1024**3, 1),
        'ram_total': round(ram.total/1024**3, 1),
        'ram_free': round(ram.available/1024**3, 1),
        'disk': round(disk.percent, 1),
        'disk_free': round(disk.free/1024**3, 1),
        'disk_total': round(disk.total/1024**3, 1),
        'net_up': round(net.bytes_sent/1024**2, 1),
        'net_down': round(net.bytes_recv/1024**2, 1),
        'uptime': uptime,
        'boot': boot.strftime('%d.%m %H:%M'),
        'temps': get_temps(),
        'procs': procs,
        'cpu_count': psutil.cpu_count()
    })

@app.route('/history')
def history():
    return jsonify(_stats_history[-60:])


def get_container_stats(c):
    """Fetch stats for one container with a hard 3s timeout."""
    stats_data = {}
    if c.status != 'running':
        return stats_data
    def _fetch():
        try:
            s = c.stats(stream=False)
            cpu_d = s['cpu_stats']['cpu_usage']['total_usage'] - s['precpu_stats']['cpu_usage']['total_usage']
            sys_d = s['cpu_stats'].get('system_cpu_usage', 0) - s['precpu_stats'].get('system_cpu_usage', 0)
            ncpu = s['cpu_stats'].get('online_cpus', 1)
            cpu_pct = round((cpu_d / sys_d) * ncpu * 100, 1) if sys_d > 0 else 0
            mem = s['memory_stats']
            mem_used = round(mem.get('usage', 0) / 1024**2, 1)
            mem_limit = round(mem.get('limit', 1) / 1024**2, 1)
            return {'cpu': cpu_pct, 'mem_used': mem_used, 'mem_limit': mem_limit}
        except:
            return {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
        fut = ex.submit(_fetch)
        try:
            return fut.result(timeout=3)
        except:
            return {}


@app.route('/docker')
def docker_list():
    try:
        import docker as dockersdk
        client = dockersdk.from_env()
        all_containers = client.containers.list(all=True)

        # Fetch stats for running containers in parallel, max 3s each
        def process(c):
            stats_data = get_container_stats(c)
            return {
                'name': c.name,
                'status': c.status,
                'image': c.image.tags[0].split('/')[-1] if c.image.tags else c.image.short_id,
                'stats': stats_data
            }

        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
            results = list(ex.map(process, all_containers, timeout=20))

        return jsonify({'containers': results})
    except Exception as e:
        return jsonify({'containers': [], 'error': str(e)})

@app.route('/docker/logs/<name>')
def docker_logs(name):
    try:
        import docker as dockersdk
        client = dockersdk.from_env()
        c = client.containers.get(name)
        logs = c.logs(tail=80, timestamps=True).decode('utf-8', errors='replace')
        return jsonify({'logs': logs})
    except Exception as e:
        return jsonify({'logs': '', 'error': str(e)})

@app.route('/docker/<action>/<name>', methods=['POST'])
def docker_action(action, name):
    try:
        import docker as dockersdk
        client = dockersdk.from_env()
        c = client.containers.get(name)
        if action == 'restart':
            c.restart()
        elif action == 'stop':
            c.stop()
        elif action == 'start':
            c.start()
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)})

@app.route('/tailscale')
def tailscale_proxy():
    key = request.args.get('key', '')
    net = request.args.get('net', '')
    if not key or not net:
        return jsonify({'error': 'missing key or net'})
    try:
        r = requests.get(
            f'https://api.tailscale.com/api/v2/tailnet/{net}/devices',
            headers={'Authorization': 'Bearer ' + key}, timeout=6)
        return jsonify(r.json())
    except Exception as e:
        return jsonify({'error': str(e)})

@app.route('/system/<action>', methods=['POST'])
def system_action(action):
    try:
        if action == 'shutdown':
            subprocess.Popen(['shutdown', '/s', '/t', '30'])
            return jsonify({'ok': True, 'msg': 'Shutdown in 30s'})
        elif action == 'restart':
            subprocess.Popen(['shutdown', '/r', '/t', '30'])
            return jsonify({'ok': True, 'msg': 'Restart in 30s'})
        elif action == 'cancel':
            subprocess.Popen(['shutdown', '/a'])
            return jsonify({'ok': True, 'msg': 'Cancelled'})
        elif action == 'lock':
            subprocess.Popen(['rundll32.exe', 'user32.dll,LockWorkStation'])
            return jsonify({'ok': True})
        return jsonify({'ok': False, 'error': 'unknown action'})
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)})

@app.route('/docker/restart-all', methods=['POST'])
def restart_all():
    try:
        import docker as dockersdk
        client = dockersdk.from_env()
        restarted = []
        for c in client.containers.list():
            c.restart()
            restarted.append(c.name)
        return jsonify({'ok': True, 'restarted': restarted})
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)})

@app.route('/run-script', methods=['POST'])
def run_script():
    data = request.json
    script = data.get('script','')
    allowed = ['E:\\Scripts\\led\\led_on.py', 'E:\\Scripts\\led\\led_off.py']
    if script not in allowed:
        return jsonify({'ok': False, 'error': 'script not allowed'})
    try:
        result = subprocess.run(
            ['C:\\Users\\halas\\AppData\\Local\\Python\\bin\\pythonw.exe', script],
            timeout=15, capture_output=True
        )
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)})

if __name__ == '__main__':
    t = threading.Thread(target=background_monitor, daemon=True)
    t.start()
    app.run(port=9001, host='0.0.0.0')