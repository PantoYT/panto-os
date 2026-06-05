# 🖥️ Panto OS v2

A dark, amber-themed system dashboard — designed to run as a **Wallpaper Engine wallpaper** or in any browser. Features live system stats, Docker management, AI chat, a calendar-style day planner with EduVulcan integration, and more.

---

## ✨ Features

### System Monitoring
- **CPU / RAM / Disk / Temp** — live rings, sparkline chart, process list
- **Docker** — start / stop / restart containers, view logs
- **Tailscale** — device list with online status
- **Ollama** — model count, offline detection
- **Uptime & Boot Time**

### Day Planner
- **Calendar-style timeline** — absolute positioning, 1.5px/min scale
- **EduVulcan integration** — school schedule fetched automatically via Hebe API
- **Recurring events** — weekly routines with custom colors (e.g. every Tue/Thu 17:00–18:00)
- **Task backlog** — pool of tasks to drag into the week
- **Week view** — 7-column calendar with hour grid lines

### Fun Zone
- **Radar**, **Nyan Cat**, **Matrix Rain**, **Crypto Ticker**, **Hacker News**
- **Clock** — `HH:MM:SS.mmm` precision
- **LED Control** — toggle smart lights via Python script
- **Pomodoro** — focus/break timer with ring animation
- **Notepad**, **Ping Monitor**, **Uptime Counter**

### Tile Mode (`Ctrl+T`)
Full-screen grid with all widgets — great as a TV dashboard or second monitor.

### Node Designer (`Ctrl+N`)
Visual automation editor — drag and connect trigger/action nodes:
- **Triggers**: CPU High, RAM High, Temp High, On Startup, Schedule, Time of Day, Docker Down
- **Actions**: LED On/Off/Toggle, Docker Restart/Stop/Start, Kill Ollama, Shutdown PC, Webhook, Open URL

---

## 🚀 Setup

### 1. Clone
```bash
git clone https://github.com/yourname/panto-os
cd panto-os
```

### 2. Configure
Copy `config.example.js` to `config.js` and fill in your values:
```js
const CONFIG = {
  OWM_KEY: 'your_openweathermap_key',
  TAILSCALE_KEY: 'tskey-api-...',
  TAILSCALE_TAILNET: 'your-tailnet',
  OLLAMA: 'http://localhost:11434',
  SYSAPI: 'http://localhost:9001',
}
```

### 3. Python backend
```bash
pip install flask flask-cors psutil docker requests cryptography
python sysapi.py
```
Runs on port `9001`. To run without a console window:
```bash
pythonw sysapi.py
```

### 4. EduVulcan (optional)
Place your Vulcan Hebe credentials in `../DiscordBots/Vred/credentials.json`.
The planner will automatically fetch your school schedule.

### 5. LED Scripts (optional)
Place Python scripts at `E:\Scripts\led\led_on.py` and `led_off.py`.
Edit the `LED_ON` / `LED_OFF` constants in `js/app.js` to change paths.

---

## 🎭 Wallpaper Engine

1. Open Wallpaper Engine → `+` → Open from disk → select `index.html`
2. Set **Type: Web**
3. Enable **Allow mouse input**

> **Overlay mode**: Enable in Settings panel — background becomes transparent.

---

## ⌨️ Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Search |
| `Ctrl+T` | Tile Mode |
| `Ctrl+N` | Node Designer |
| `Esc` | Close overlay |

---

## 📁 File Structure
```
panto-os/
├── index.html          # Main UI
├── js/app/             # Frontend logic, split by concern (core, system, widgets, planner, nodes…)
├── css/app.css         # Styles
├── css/vars.css        # CSS variables / theme
├── sysapi.py           # Python backend (Flask)
├── config.js           # Your keys — gitignored
├── config.example.js   # Template for config.js
├── nyan.gif            # Nyan Cat (download separately)
└── start.bat           # Shortcut to launch sysapi
```

---

## 📝 Notes
- **Weather** location defaults to Tomaszów Lubelski — edit `fetchWx()` in `app.js` to change
- **Crypto ticker** uses CoinGecko live data (falls back to simulated if offline)
- **Hacker News** loads via HN Algolia API

---

## License
MIT
