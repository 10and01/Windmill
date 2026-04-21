# Windmill Focus
<div align="center">
  <img src="./Windmill.ico" alt="Icon" />
</div>

Windmill Focus is a lightweight focus app that combines windmill interaction, task management, a focus timer, and local weather ambience. It supports both web and desktop (Electron) modes.

## UI
![Demo](./Demo.png)
<p align="center">English  |  <a title="中文" href="README.md"></a></p>

## Features

1. Windmill Interaction for Focus
- Click the windmill to accelerate rotation.
- Rapid clicks trigger high-speed mode.
- Dynamic ambient audio responds to wheel speed.

2. Task Management
- Add, complete, and delete tasks.
- Local persistence for task data.
- Completed tasks are auto-cleaned weekly.

3. Focus Timer
- Built-in countdown timer (25 minutes by default).
- Supports custom minute input.
- Optional timer overlay on the wheel.

4. Local Weather Ambience
- Uses geolocation + Open-Meteo for current weather.
- Updates visual ambience based on weather condition.
- Shows temperature, weather description, and wind speed.

5. Background and Audio Settings
- Custom background image support.
- Custom background music URL input.
- Import local custom music files and play them instantly.
- Volume and oscillator type controls.

6. Desktop Floating Window (Electron)
- Frameless, compact, always-on-top focus window.
- Tray integration for quick show/hide behavior.

## Development Commands

1. Install dependencies

```bash
npm install
```

2. Run web development mode

```bash
npm run dev
```

3. Run desktop development mode

```bash
npm run desktop:dev
```

This command starts Vite first, then opens the Electron window after the dev server is ready.

4. Type check

```bash
npm run lint
```

## Music Notes

- You can paste an online audio URL or import a local audio file from the settings panel.
- Imported music is converted into a playable resource and saved with your settings.
- Use Reset in Settings to return to the default ambient audio.
