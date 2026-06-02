# 🖥️ Panto OS

A dark, amber-themed system dashboard built as a single HTML file — designed to run as a **Wallpaper Engine wallpaper** or in any browser. Features live system stats, Docker management, AI chat, automations, and a full-screen tile mode.

![Panto OS Screenshot](screenshot.png)

---

## ✨ Features

### System Monitoring
- **CPU / RAM / Disk / Temp** — live rings, sparkline chart, process list
- **Docker** — start / stop / restart containers, view logs
- **Tailscale** — device list with online status
- **Ollama** — model count, offline detection
- **Uptime & Boot Time**

### Fun Zone (right panel)
- **Radar** — animated amber laser sweep
- **Nyan Cat** — real GIF with star field
- **Clock** — `HH:MM:SS.mmm` precision
- **LED Control** — toggle smart lights via Python script
- **System Log** — copyable live log stream
- **Hacker News** — live RSS feed
- **Pomodoro** — configurable focus/break timer with ring
- **Notepad** — persists to localStorage
- **Matrix Rain**, **Crypto Ticker** (simulated), **Ping Monitor**, **Uptime Counter**

### Tile Mode (`Ctrl+T`)
Full-screen 4×3 grid with all widgets — great as a TV dashboard or second monitor.

### Node Designer (`Ctrl+N`)
Visual automation editor. Drag and connect nodes:
- **Triggers**: CPU High, RAM High, Temp High, On Startup, Schedule
- **Actions**: LED On/Off, Docker Restart, Kill Ollama, Log Message, Shutdown PC

### Settings Panel
- **Accent color picker** + 7 presets (Amber, Cyan, Purple, Red, Green, Blue, Pink)
- **Overlay mode** — transparent background (use over your desktop wallpaper)
- **Panel opacity** slider
- **Docker poll interval**

---

## 🚀 Setup

### 1. Clone / Download
```bash
git clone https://github.com/yourname/panto-os
cd panto-os
```

### 2. Configure (`config.js`)
Create `config.js` next to `index.html`:
```js
var CONFIG = {
  OWM_KEY: 'your_openweathermap_key',     // https://openweathermap.org/api
  OLLAMA: 'http://localhost:11434',
  SYSAPI: 'http://localhost:9001',          // or https://sys.panto-dev.com
  TAILSCALE_KEY: 'tskey-api-...',
  TAILSCALE_TAILNET: 'your-tailnet.ts.net',
};
```

### 3. Nyan Cat GIF
Download the GIF and place it as `nyan.gif` next to `index.html`:
```
https://media.giphy.com/media/sIIhZliB2McAo/giphy.gif
```

### 4. sysapi (Python backend)
The dashboard talks to a local Python server for system stats and Docker:

```bash
pip install flask flask-cors psutil docker requests
python sysapi.py
```

> Runs on port `9001`. Exposes `/stats`, `/docker`, `/docker/logs/<name>`, `/tailscale`, `/system/<action>`, `/run-script`.

### 5. LED Scripts (optional)
Place Python scripts at `E:\Scripts\led\led_on.py` and `led_off.py`.
Paths are hardcoded — edit the `LED_ON` / `LED_OFF` constants in `index.html`.

---

## 🎭 Wallpaper Engine

1. Open Wallpaper Engine → `+` → `Open from disk`
2. Select `index.html`
3. Set **Type: Web**
4. Enable **Allow mouse input** in properties
5. For links to open in browser: **Properties → Open links in browser** (or the app uses `wallpaperOpenUrl` API automatically when available)

> **Overlay mode**: Enable in Settings panel. The background becomes transparent — you'll see your desktop wallpaper through the gaps between panels.

---

## ⌨️ Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+T` | Toggle Tile Mode |
| `Ctrl+N` | Toggle Node Designer |
| `Ctrl+K` | Search |
| `Esc` | Close active overlay |

---

## 🔧 Node Designer Examples

**Auto-off LEDs on shutdown:**
1. Add `On Startup` trigger → connect to `Log Message` ("System ready")
2. Add `CPU High` (90%) → connect to `Kill Ollama`

**RAM watchdog:**
1. `RAM High` (threshold: 85%) → `Docker Restart` (container: `open-webui`)
2. `RAM High` → `Log Message` ("RAM pressure: restarted open-webui")

---

## 📁 File Structure
```
panto-os/
├── index.html      # Everything — one file
├── config.js       # Your keys & endpoints (gitignored)
├── sysapi.py       # Python backend
├── nyan.gif        # Download separately
└── README.md
```

Add to `.gitignore`:
```
config.js
nyan.gif
```

---

## 🎨 Color Presets
Open Settings (gear icon) → pick any accent color or choose a preset. The entire UI updates instantly — all CSS variables cascade from a single `--acc` value.

---

## 📝 Notes
- **Crypto ticker** is simulated data (random walk) — not real prices
- **Hacker News** loads via `allorigins.win` CORS proxy — may be slow occasionally
- **Weather** requires a free OpenWeatherMap API key
- Location is hardcoded to Tomaszów Lubelski (`lat=50.4534, lon=23.4197`) — edit `fetchWx()` to change

---

## License
MIT — do whatever you want with it.