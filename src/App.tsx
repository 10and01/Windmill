import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ListTodo, 
  Timer, 
  CloudSun, 
  Settings, 
  X, 
  Plus, 
  Trash2, 
  Play, 
  Pause,
  MapPin,
  Volume2,
  Image as ImageIcon,
  Wind
} from 'lucide-react';

const DEFAULT_BGM_URL = 'https://actions.google.com/sounds/v1/water/waves_crashing_on_rock_beach.ogg';

type Task = {
  id: number;
  text: string;
  done: boolean;
  createdAt: number;
  completedAt: number | null;
};

type PersistedState = {
  tasks: Task[];
  settings: {
    showTimerOnWheel: boolean;
    audioVolume: number;
    audioType: OscillatorType;
    bgmUrl: string;
    bgmLabel: string;
    customBg: string | null;
    timerInput: string;
  };
  lastCompletedCleanupAt: number;
};

const STORAGE_KEY = 'windmill.focus.state.v1';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeTask(raw: unknown): Task | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Record<string, unknown>;

  if (typeof candidate.id !== 'number' || typeof candidate.text !== 'string' || typeof candidate.done !== 'boolean') {
    return null;
  }

  const createdAt = typeof candidate.createdAt === 'number' ? candidate.createdAt : Date.now();
  const completedAt = typeof candidate.completedAt === 'number' ? candidate.completedAt : null;

  return {
    id: candidate.id,
    text: candidate.text,
    done: candidate.done,
    createdAt,
    completedAt,
  };
}

// --- CUSTOM HOOK FOR GAME LOOP ---
function useGameLoop(callback: (deltaTime: number) => void) {
  const requestRef = useRef<number>(0);
  const previousTimeRef = useRef<number | null>(null);

  const animate = useCallback((time: number) => {
    if (previousTimeRef.current !== null) {
      const deltaTime = time - previousTimeRef.current;
      callback(deltaTime);
    }
    previousTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  }, [callback]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [animate]);
}

// --- SYNTHESIZED SOUNDS ---
const playTick = () => {}; // Replaced with continuous dynamic audio (Web Audio API)

// Remove Hamster component and its animations completely


// --- MAIN APP COMPONENT ---
export default function App() {
  // State
  const [activeModal, setActiveModal] = useState<string | null>(null);
  
// Audio refs for dynamic sound
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  const initAudio = () => {
    if (audioCtxRef.current) return;
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.value = 50;
    
    gain.gain.value = 0;
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    
    audioCtxRef.current = ctx;
    oscRef.current = osc;
    gainRef.current = gain;
  };

  // Wheel State
  const rotationRef = useRef(0);
  const speedRef = useRef(0);
  const clickTimesRef = useRef<number[]>([]);
  const wheelRef = useRef<HTMLDivElement>(null);
  const effectRef = useRef<HTMLDivElement>(null);
  const MAX_SPEED = 15;
  const SPEED_DECAY = 5; // units per second

  // Required React State for UI bindings
  const [uiSpeed, setUiSpeed] = useState(0);
  const [isJumping, setIsJumping] = useState(false);
  const [showTimerOnWheel, setShowTimerOnWheel] = useState(true);

  // Tools / Features State
  const [tasks, setTasks] = useState<Task[]>([
    { id: 1, text: 'Keep running!', done: false, createdAt: Date.now(), completedAt: null }
  ]);
  const [newTask, setNewTask] = useState('');
  const [lastCompletedCleanupAt, setLastCompletedCleanupAt] = useState(Date.now());
  const hasLoadedPersistedStateRef = useRef(false);
  
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 mins
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [hasTimerStarted, setHasTimerStarted] = useState(false);
  const [timerInput, setTimerInput] = useState('25');

  const [weather, setWeather] = useState('sunny'); // 'normal', 'sunny', 'rain', 'snow'
  const [weatherData, setWeatherData] = useState<{temp: number, desc: string, wind: number} | null>(null);
  const [isFetchingWeather, setIsFetchingWeather] = useState(false);
  const [weatherStatus, setWeatherStatus] = useState<string | null>(null);
  const [customBg, setCustomBg] = useState<string | null>(null);
  const [audioVolume, setAudioVolume] = useState(0.5);
  const [audioType, setAudioType] = useState<OscillatorType>('triangle');
  const [bgmUrl, setBgmUrl] = useState(DEFAULT_BGM_URL);
  const [bgmLabel, setBgmLabel] = useState('Default ambient audio');
  const hasFetchedWeatherRef = useRef(false);
  const volumeRef = useRef(audioVolume);
  const typeRef = useRef(audioType);
  useEffect(() => { volumeRef.current = audioVolume; }, [audioVolume]);
  useEffect(() => { typeRef.current = audioType; if(oscRef.current) oscRef.current.type = audioType; }, [audioType]);

  // --- WEATHER LOGIC ---
  const fetchLocalWeather = useCallback(() => {
    setIsFetchingWeather(true);
    setWeatherStatus('正在自动定位并获取天气...');
    if (!navigator.geolocation) {
      setWeatherStatus('当前环境不支持定位，无法自动获取天气。');
      setIsFetchingWeather(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const { latitude, longitude } = pos.coords;
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
        const data = await res.json();
        if (data && data.current_weather) {
          const temp = data.current_weather.temperature;
          const code = data.current_weather.weathercode;
          const windSpeed = data.current_weather.windspeed;
          
          let w = 'normal';
          let desc = 'Clear';
          if (code === 0) { w = temp > 25 ? 'sunny' : 'normal'; desc = 'Clear Sky'; }
          else if (code >= 1 && code <= 3) { w = 'normal'; desc = 'Cloudy'; }
          else if (code >= 51 && code <= 67) { w = 'rain'; desc = 'Rainy'; }
          else if (code >= 71 && code <= 77) { w = 'snow'; desc = 'Snowy'; }
          else if (code >= 95) { w = 'rain'; desc = 'Thunderstorm'; }
          
          setWeather(w);
          setWeatherData({ temp, desc, wind: windSpeed });
          setWeatherStatus('已自动更新当前天气。');
        }
      } catch (err) {
        console.error("Weather fetch failed", err);
        setWeatherStatus('天气获取失败，请稍后重试。');
      } finally {
        setIsFetchingWeather(false);
      }
    }, () => {
      setWeatherStatus('未获得定位权限，无法自动获取天气。');
      setIsFetchingWeather(false);
    });
  }, []);

  useEffect(() => {
    if (hasFetchedWeatherRef.current) {
      return;
    }
    hasFetchedWeatherRef.current = true;
    fetchLocalWeather();
  }, [fetchLocalWeather]);
  const audioRef = useRef<HTMLAudioElement>(null);

  const isTimerRunningRef = useRef(isTimerRunning);
  useEffect(() => {
    isTimerRunningRef.current = isTimerRunning;
  }, [isTimerRunning]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        hasLoadedPersistedStateRef.current = true;
        return;
      }

      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      const normalizedTasks = Array.isArray(parsed.tasks)
        ? parsed.tasks.map(normalizeTask).filter((task): task is Task => task !== null)
        : [];

      const settings: Partial<PersistedState['settings']> = parsed.settings ?? {};
      const now = Date.now();
      let cleanupAt = typeof parsed.lastCompletedCleanupAt === 'number' ? parsed.lastCompletedCleanupAt : now;
      let nextTasks = normalizedTasks.length > 0 ? normalizedTasks : [{ id: 1, text: 'Keep running!', done: false, createdAt: now, completedAt: null }];

      if (now - cleanupAt >= WEEK_MS) {
        nextTasks = nextTasks.filter((task) => !task.done);
        cleanupAt = now;
      }

      setTasks(nextTasks);
      setLastCompletedCleanupAt(cleanupAt);

      if (typeof settings.showTimerOnWheel === 'boolean') setShowTimerOnWheel(settings.showTimerOnWheel);
      if (typeof settings.audioVolume === 'number') setAudioVolume(settings.audioVolume);
      if (typeof settings.audioType === 'string') setAudioType(settings.audioType as OscillatorType);
      if (typeof settings.bgmUrl === 'string') setBgmUrl(settings.bgmUrl);
      if (typeof settings.bgmLabel === 'string') setBgmLabel(settings.bgmLabel);
      if (typeof settings.customBg === 'string' || settings.customBg === null) setCustomBg(settings.customBg ?? null);
      if (typeof settings.timerInput === 'string') setTimerInput(settings.timerInput);
    } catch (error) {
      console.error('Failed to restore local state', error);
    } finally {
      hasLoadedPersistedStateRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedPersistedStateRef.current) {
      return;
    }

    const payload: PersistedState = {
      tasks,
      settings: {
        showTimerOnWheel,
        audioVolume,
        audioType,
        bgmUrl,
        bgmLabel,
        customBg,
        timerInput,
      },
      lastCompletedCleanupAt,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [tasks, showTimerOnWheel, audioVolume, audioType, bgmUrl, bgmLabel, customBg, timerInput, lastCompletedCleanupAt]);

  const handleCustomMusicFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setBgmUrl(reader.result);
        setBgmLabel(file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  const resetMusicToDefault = () => {
    setBgmUrl(DEFAULT_BGM_URL);
    setBgmLabel('Default ambient audio');
  };

  useEffect(() => {
    if (!hasLoadedPersistedStateRef.current) {
      return;
    }

    const now = Date.now();
    if (now - lastCompletedCleanupAt < WEEK_MS) {
      return;
    }

    const filtered = tasks.filter((task) => !task.done);
    setLastCompletedCleanupAt(now);
    if (filtered.length !== tasks.length) {
      setTasks(filtered);
    }
  }, [tasks, lastCompletedCleanupAt]);

  // --- AUDIO LOGIC ---
  const handleUserInteraction = () => {
    if (audioRef.current && audioRef.current.paused) {
      audioRef.current.volume = 0.4;
      audioRef.current.play().catch(e => console.log('Audio autoplay prevented'));
    }
  };

  // --- WHEEL LOGIC ---
  const handleWheelClick = () => {
    handleUserInteraction();
    initAudio();
    const now = Date.now();
    
    // 3 clicks in 2 seconds rule
    clickTimesRef.current = clickTimesRef.current.filter(t => now - t <= 2000);
    clickTimesRef.current.push(now);

    if (clickTimesRef.current.length >= 3) {
      speedRef.current = MAX_SPEED;
    } else {
      speedRef.current = Math.min(speedRef.current + 5, MAX_SPEED);
    }
  };

  useGameLoop((deltaTime) => {
    // Delta time is in ms
    const dtSeconds = deltaTime / 1000;
    
    // If timer is running, keep speed up
    if (isTimerRunningRef.current) {
      speedRef.current = Math.max(speedRef.current, 8);
    }
    
    // Decay speed smoothly
    if (speedRef.current > 0) {
      speedRef.current = Math.max(isTimerRunningRef.current ? 8 : 0, speedRef.current - SPEED_DECAY * dtSeconds);
    }
    
    // Update Rotation based on current speed
    rotationRef.current += speedRef.current * dtSeconds * -60; // negative to rotate 'backwards' so hamster runs forward

    // Manage dynamic audio
    if (audioCtxRef.current && gainRef.current && oscRef.current) {
      const s = speedRef.current;
      const targetGain = s > 0.5 ? Math.min(0.25, s / 40) * volumeRef.current : 0;
      const targetFreq = 50 + s * 15;
      gainRef.current.gain.setTargetAtTime(targetGain, audioCtxRef.current.currentTime, 0.1);
      oscRef.current.frequency.setTargetAtTime(targetFreq, audioCtxRef.current.currentTime, 0.1);
    }

    // Apply directly to DOM for smoothness
    if (wheelRef.current) {
      wheelRef.current.style.transform = `rotate(${rotationRef.current}deg)`;
    }
    if (effectRef.current) {
      effectRef.current.style.transform = `rotate(${-rotationRef.current * 0.5}deg)`;
    }
    
    // Sync React state for slower rendering features (like SVG animation)
    // Avoid re-rendering every frame if speed is basically 0
    if (Math.abs(uiSpeed - speedRef.current) > 0.5) {
      setUiSpeed(speedRef.current);
    } else if (speedRef.current === 0 && uiSpeed !== 0) {
      setUiSpeed(0);
    }
  });

  // --- TIMER LOGIC ---
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (isTimerRunning && timeLeft === 0) {
      // Timer finished!
      setIsTimerRunning(false);
      setHasTimerStarted(false);
      // Removed hamster squeak
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timeLeft]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const setTimer = (mins: number) => {
    setTimeLeft(mins * 60);
    setIsTimerRunning(false);
    setHasTimerStarted(false);
  };

  const formatTaskCreatedDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };


  // --- DYNAMIC WINDMILL COLORS ---
  const getBladeColors = () => {
    if (weatherData && weatherData.temp >= 30) {
      return [['#fca5a5','#ef4444'], ['#fdba74','#f97316'], ['#fcd34d','#f59e0b'], ['#fb7185','#e11d48']];
    } else if (weatherData && weatherData.temp <= 10) {
      return [['#e0f2fe','#bae6fd'], ['#f0f9ff','#e0f2fe'], ['#bae6fd','#7dd3fc'], ['#ffffff','#f1f5f9']];
    } else if (weather === 'rain') {
      return [['#94a3b8','#64748b'], ['#cbd5e1','#94a3b8'], ['#64748b','#475569'], ['#e2e8f0','#cbd5e1']];
    }
    return [['#fca5a5','#f87171'], ['#93c5fd','#60a5fa'], ['#fde047','#facc15'], ['#86efac','#4ade80']];
  };
  const bladeColors = getBladeColors();

  return (
    <div className="min-h-screen relative overflow-hidden font-sans text-gray-800 transition-colors duration-1000"
         style={{
           backgroundColor: customBg ? 'transparent' : weather === 'sunny' ? '#FFF9E6' : weather === 'rain' ? '#E2E8F0' : weather === 'snow' ? '#F1F5F9' : '#FDF6E3',
           backgroundImage: customBg ? `url(${customBg})` : undefined,
           backgroundSize: 'cover',
           backgroundPosition: 'center'
         }}
         onClick={handleUserInteraction}>
      
      {/* --- WEATHER ATMOSPHERE OVERLAYS --- */}
      {weather === 'rain' && (
        <div className="absolute inset-0 pointer-events-none opacity-40 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMDAiPjxyZWN0IHg9IjQiIHk9IjAiIHdpZHRoPSIxIiBoZWlnaHQ9IjIwIiBmaWxsPSIjOTRGM0ZCIi8+PC9zdmc+')] animate-[rain_0.3s_linear_infinite]" />
      )}
      {weather === 'snow' && (
        <div className="absolute inset-0 pointer-events-none opacity-60 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMiIgZmlsbD0iI0ZGRkZGRiIvPjwvc3ZnPg==')] animate-[snow_5s_linear_infinite]" />
      )}
      <style>{`
        @keyframes rain { 0% { background-position: 0 0; } 100% { background-position: 10px 100px; } }
        @keyframes snow { 0% { background-position: 0 0; } 100% { background-position: 20px 200px; } }
      `}</style>

      <audio ref={audioRef} loop src={bgmUrl} />

      {/* --- CENTRAL STAGE --- */}
      <div className="absolute inset-0 flex items-center justify-center">
        
        {/* WHEEL CONTAINER */}
        <div className="relative group p-12">
          
          <div 
            onClick={handleWheelClick}
            className="cursor-pointer relative w-[360px] h-[360px] flex items-center justify-center select-none"
          >
            {/* Speed Visual Effects Overlay behind Windmill */}
            <div 
              className="absolute pointer-events-none rounded-full flex items-center justify-center transition-all duration-300" 
              style={{ opacity: Math.min(1, uiSpeed / 10) }}
            >
              <div 
                ref={effectRef}
                className="w-[480px] h-[480px] flex items-center justify-center"
              >
                <div className="w-[480px] h-[480px] rounded-full border-[10px] border-white/40 border-dashed animate-[spin_3s_linear_infinite]" />
                <div className="absolute w-[400px] h-[400px] rounded-full border-[15px] border-amber-200/50 border-dotted animate-[spin_2s_linear_infinite_reverse]" />
              </div>
              <div className="absolute w-[360px] h-[360px] rounded-full shadow-[0_0_120px_rgba(255,255,255,1)]" />
            </div>

            {/* The Rotating Windmill Blades */}
            <div 
              className="absolute top-0 left-0 w-full h-[360px] z-0 flex items-center justify-center"
            >
              <div 
                ref={wheelRef}
                className="w-[340px] h-[340px] flex items-center justify-center transform-gpu"
              >
                <svg viewBox="0 0 200 200" className="absolute w-[340px] h-[340px] drop-shadow-[0_10px_20px_rgba(0,0,0,0.15)] pointer-events-none">
                 <defs>
                   <linearGradient id="blade1" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={bladeColors[0][0]} />
                      <stop offset="100%" stopColor={bladeColors[0][1]} />
                   </linearGradient>
                   <linearGradient id="blade2" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={bladeColors[1][0]} />
                      <stop offset="100%" stopColor={bladeColors[1][1]} />
                   </linearGradient>
                   <linearGradient id="blade3" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={bladeColors[2][0]} />
                      <stop offset="100%" stopColor={bladeColors[2][1]} />
                   </linearGradient>
                   <linearGradient id="blade4" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={bladeColors[3][0]} />
                      <stop offset="100%" stopColor={bladeColors[3][1]} />
                   </linearGradient>
                 </defs>
                 
                 <g stroke="#ffffff" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round">
                   {/* Top-Right Blade */}
                   <path d="M100,100 L100,15 C150,15 185,50 185,100 Z" fill="url(#blade3)"/>
                   
                   {/* Bottom-Right Blade */}
                   <path d="M100,100 L185,100 C185,150 150,185 100,185 Z" fill="url(#blade2)"/>

                   {/* Bottom-Left Blade */}
                   <path d="M100,100 L100,185 C50,185 15,150 15,100 Z" fill="url(#blade4)"/>

                   {/* Top-Left Blade */}
                   <path d="M100,100 L15,100 C15,50 50,15 100,15 Z" fill="url(#blade1)"/>
                 </g>
                </svg>

                {/* Windmill Buttons / Sectors (Inside wheelRef so they rotate) */}
                <div className="absolute w-[70%] h-[70%] rounded-full z-10 pointer-events-none">
                  {/* Top-Left: Task */}
                  <button onClick={(e) => { e.stopPropagation(); setActiveModal('task'); }} title="Tasks" className="absolute top-[22%] left-[22%] w-14 h-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/40 backdrop-blur-md shadow-lg pointer-events-auto flex items-center justify-center text-rose-600 hover:bg-white/80 hover:scale-110 transition-all cursor-pointer border-2 border-white/60">
                    <ListTodo size={28} />
                  </button>
                  {/* Top-Right: Timer */}
                  <button onClick={(e) => { e.stopPropagation(); setActiveModal('timer'); }} title="Timer" className="absolute top-[22%] right-[22%] w-14 h-14 translate-x-1/2 -translate-y-1/2 rounded-full bg-white/40 backdrop-blur-md shadow-lg pointer-events-auto flex items-center justify-center text-amber-600 hover:bg-white/80 hover:scale-110 transition-all cursor-pointer border-2 border-white/60">
                    <Timer size={28} />
                  </button>
                  {/* Bottom-Right: Weather */}
                  <button onClick={(e) => { e.stopPropagation(); setActiveModal('weather'); }} title="Weather" className="absolute bottom-[22%] right-[22%] w-14 h-14 translate-x-1/2 translate-y-1/2 rounded-full bg-white/40 backdrop-blur-md shadow-lg pointer-events-auto flex items-center justify-center text-blue-600 hover:bg-white/80 hover:scale-110 transition-all cursor-pointer border-2 border-white/60">
                    <CloudSun size={28} />
                  </button>
                  {/* Bottom-Left: Settings */}
                  <button onClick={(e) => { e.stopPropagation(); setActiveModal('settings'); }} title="Settings" className="absolute bottom-[22%] left-[22%] w-14 h-14 -translate-x-1/2 translate-y-1/2 rounded-full bg-white/40 backdrop-blur-md shadow-lg pointer-events-auto flex items-center justify-center text-emerald-600 hover:bg-white/80 hover:scale-110 transition-all cursor-pointer border-2 border-white/60">
                    <Settings size={28} />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Windmill Center Pin (Static, in front of blades) */}
            <div className="absolute top-[180px] left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full z-10 shadow-[0_4px_10px_rgba(0,0,0,0.1)] border-4 border-gray-100 flex items-center justify-center pointer-events-none">
              <div className="w-4 h-4 bg-gray-200 rounded-full" />
            </div>

            {/* Windmill Stick (behind everything) */}
            <div className="absolute top-[180px] left-1/2 -translate-x-1/2 w-6 h-[220px] bg-gradient-to-r from-amber-200 to-amber-400 rounded-full z-[-1] border-l-2 border-r-2 border-white/50 shadow-inner" />

            {/* Timer Display + Pause Button */}
            {isTimerRunning && (
              <div
                className={`absolute z-30 transition-opacity duration-300 ${
                  showTimerOnWheel
                    ? 'top-[-60px] left-1/2 -translate-x-1/2 flex items-center gap-3'
                    : 'top-[-60px] left-1/2 -translate-x-1/2'
                }`}
              >
                {showTimerOnWheel && (
                  <span className="font-mono text-4xl font-black text-rose-500 bg-white/80 px-5 py-2 rounded-3xl backdrop-blur-md border-4 border-white shadow-[0_8px_20px_rgba(0,0,0,0.1)] block">
                    {formatTime(timeLeft)}
                  </span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsTimerRunning(false);
                  }}
                  title="Pause Timer"
                  className={`rounded-full bg-amber-400 text-white shadow-[0_6px_0_#F59E0B] active:translate-y-[6px] active:shadow-none transition-all flex items-center justify-center ${
                    showTimerOnWheel ? 'w-12 h-12' : 'w-14 h-14'
                  }`}
                >
                  <Pause size={showTimerOnWheel ? 22 : 24} fill="white" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- OVERLAY MODALS --- */}
      {activeModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center px-4 animate-in fade-in cursor-default">
          <div className="bg-[#FFFFFE] w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 relative">
            
            <button 
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              <X size={20} />
            </button>

            {/* 1. TASK LIST MODAL */}
            {activeModal === 'task' && (
              <div className="p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <ListTodo className="text-rose-400" /> Daily Tasks
                </h2>
                
                <div className="flex gap-2 mb-6">
                  <input 
                    type="text"
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newTask.trim()) {
                        const now = Date.now();
                        setTasks([...tasks, { id: now, text: newTask.trim(), done: false, createdAt: now, completedAt: null }]);
                        setNewTask('');
                      }
                    }}
                    placeholder="Feed the hamster..."
                    className="flex-1 bg-gray-50 rounded-2xl px-4 py-3 outline-none border-2 border-transparent focus:border-rose-200 transition-colors"
                  />
                  <button 
                    onClick={() => {
                      if(newTask.trim()){
                        const now = Date.now();
                        setTasks([...tasks, { id: now, text: newTask.trim(), done: false, createdAt: now, completedAt: null }]);
                        setNewTask('');
                      }
                    }}
                    className="w-12 h-12 bg-rose-400 text-white rounded-2xl flex items-center justify-center shadow-[0_4px_0_#FB7185] active:translate-y-[4px] active:shadow-none transition-all"
                  >
                    <Plus size={24} />
                  </button>
                </div>

                <div className="space-y-3 max-h-[300px] overflow-y-auto p-1">
                  {tasks.map(task => (
                    <div key={task.id} className={`flex items-center gap-3 bg-white border-2 border-gray-100 rounded-2xl p-3 shadow-sm transition-colors ${task.done ? 'task-done-anim' : ''}`}>
                      <input 
                        type="checkbox" 
                        checked={task.done} 
                        onChange={() => {
                          setTasks(tasks.map(t => {
                            if (t.id !== task.id) return t;
                            const nextDone = !t.done;
                            return {
                              ...t,
                              done: nextDone,
                              completedAt: nextDone ? Date.now() : null,
                            };
                          }))
                        }}
                        className="w-5 h-5 accent-rose-400 cursor-pointer" 
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`${task.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                          {task.text}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          创建于 {formatTaskCreatedDate(task.createdAt)}
                        </p>
                      </div>
                      <button 
                        onClick={() => setTasks(tasks.filter(t => t.id !== task.id))}
                        className="text-gray-300 hover:text-red-400 p-1"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                  {tasks.length === 0 && (
                    <p className="text-center text-gray-400 mt-8">All caught up! Time to run.</p>
                  )}
                </div>
              </div>
            )}

            {/* 2. TIMER MODAL */}
            {activeModal === 'timer' && (
              <div className="p-8 text-center">
                <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-2">
                  <Timer className="text-blue-400" /> Focus Timer
                </h2>
                <p className="text-gray-500 mb-8 mt-2 text-sm">When time's up, hamster reminds you!</p>

                <div className="text-[64px] font-black text-gray-800 tracking-tighter mb-8 font-mono">
                  {formatTime(timeLeft)}
                </div>

                {!isTimerRunning ? (
                  <div className="flex flex-col gap-4">
                     {!hasTimerStarted && (
                       <>
                         <div className="flex justify-center gap-2 mb-2">
                            {[5, 15, 25].map(mins => (
                              <button 
                                key={mins}
                                onClick={() => {
                                  setTimerInput(mins.toString());
                                  setTimer(mins);
                                }}
                                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl font-bold transition-colors"
                              >
                                {mins}m
                              </button>
                            ))}
                         </div>
                         
                         <div className="flex items-center justify-center gap-2 mb-2">
                            <span className="text-gray-500 font-bold text-sm">Custom:</span>
                            <input 
                              type="number" 
                              min="1" 
                              max="120"
                              value={timerInput}
                              onChange={(e) => setTimerInput(e.target.value)}
                              className="w-16 bg-gray-50 border-2 border-gray-200 rounded-lg px-2 py-1 text-center font-bold text-gray-700 outline-none focus:border-blue-400 transition-colors"
                            />
                            <span className="text-gray-500 font-bold text-sm">m</span>
                         </div>
                       </>
                     )}

                     <button 
                        onClick={() => {
                          if (hasTimerStarted && timeLeft > 0) {
                            setIsTimerRunning(true);
                            setActiveModal(null);
                            return;
                          }
                          const val = parseInt(timerInput, 10);
                          if (!isNaN(val) && val > 0) {
                            setTimeLeft(val * 60);
                            setIsTimerRunning(true);
                            setHasTimerStarted(true);
                            setActiveModal(null); // Auto close
                          }
                        }}
                        className="w-full bg-blue-400 text-white rounded-2xl py-4 font-bold text-xl shadow-[0_6px_0_#60A5FA] active:translate-y-[6px] active:shadow-none transition-all flex items-center justify-center gap-2"
                      >
                        <Play fill="white" /> {hasTimerStarted && timeLeft > 0 ? 'Resume Focus' : 'Start Focus'}
                      </button>
                      {hasTimerStarted && timeLeft > 0 && (
                        <button
                          onClick={() => {
                            const val = parseInt(timerInput, 10);
                            if (!isNaN(val) && val > 0) {
                              setTimer(val);
                            }
                          }}
                          className="w-full bg-gray-200 text-gray-700 rounded-2xl py-3 font-bold text-lg hover:bg-gray-300 transition-colors"
                        >
                          Reset Timer
                        </button>
                      )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <button 
                      onClick={() => setIsTimerRunning(false)}
                      className="w-full bg-amber-400 text-white rounded-2xl py-4 font-bold text-xl shadow-[0_6px_0_#F59E0B] active:translate-y-[6px] active:shadow-none transition-all flex items-center justify-center gap-2"
                    >
                      <X /> Pause
                    </button>
                    <button
                      onClick={() => {
                        const val = parseInt(timerInput, 10);
                        if (!isNaN(val) && val > 0) {
                          setTimer(val);
                        }
                      }}
                      className="w-full bg-gray-200 text-gray-700 rounded-2xl py-3 font-bold text-lg hover:bg-gray-300 transition-colors"
                    >
                      Reset Timer
                    </button>
                  </div>
                )}

                <div className="mt-8">
                   <label className="inline-flex items-center justify-center gap-2 text-sm text-gray-500 font-bold cursor-pointer hover:text-gray-700 transition-colors">
                     <input 
                       type="checkbox" 
                       checked={showTimerOnWheel} 
                       onChange={e => setShowTimerOnWheel(e.target.checked)} 
                       className="accent-blue-400 w-4 h-4 cursor-pointer" 
                     />
                     Show Time on Wheel
                   </label>
                </div>
              </div>
            )}

            {/* 3. WEATHER MODAL */}
            {activeModal === 'weather' && (
              <div className="p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <CloudSun className="text-amber-400" /> Atmosphere
                </h2>
                
                {weatherData ? (
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 text-center border-2 border-blue-200 mb-6 shadow-sm">
                    <div className="text-5xl font-black text-blue-900 mb-2">{weatherData.temp}°C</div>
                    <div className="text-lg font-bold text-blue-700">{weatherData.desc}</div>
                    <div className="text-sm text-blue-500 mt-2 flex items-center justify-center gap-1">
                       <Wind size={14} /> Wind: {weatherData.wind} km/h
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8 mb-4 border-2 border-dashed border-gray-200 rounded-2xl">
                     <MapPin size={48} className="mx-auto text-gray-300 mb-4" />
                     <p className="font-medium px-4">正在自动获取你当前位置的天气信息...</p>
                  </div>
                )}

                <div className="rounded-2xl border-2 border-amber-100 bg-amber-50/60 p-4 text-sm text-amber-800">
                  {isFetchingWeather ? '正在自动更新天气...' : weatherStatus ?? '天气状态待更新'}
                </div>
              </div>
            )}

            {/* 4. SETTINGS MODAL */}
            {activeModal === 'settings' && (
              <div className="p-8 pb-12">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <Settings className="text-slate-400" /> Settings
                </h2>
                
                <div className="space-y-6">
                   {/* Audio Volume */}
                   <div>
                     <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-4">
                       <Volume2 size={18} className="text-slate-500" /> Windmill Sound Volume
                     </label>
                     <input 
                       type="range" min="0" max="1" step="0.05" 
                       value={audioVolume} 
                       onChange={(e) => setAudioVolume(parseFloat(e.target.value))}
                       className="w-full accent-slate-500 cursor-pointer"
                     />
                   </div>

                   {/* Audio Type */}
                   <div>
                     <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                       <Wind size={18} className="text-slate-500" /> Windmill Sound Effect
                     </label>
                     <select 
                       value={audioType} 
                       onChange={(e) => setAudioType(e.target.value as OscillatorType)}
                       className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-700 outline-none focus:border-slate-400 cursor-pointer"
                     >
                       <option value="triangle">Soft Wind (Triangle)</option>
                       <option value="sawtooth">Mechanical (Sawtooth)</option>
                       <option value="sine">Muted (Sine)</option>
                     </select>
                   </div>

                   {/* Background Music */}
                   <div>
                     <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                       <Play size={18} className="text-slate-500" /> Background Music
                     </label>
                     <input
                       type="url"
                       value={bgmUrl.startsWith('data:') ? '' : bgmUrl}
                       onChange={(e) => {
                         setBgmUrl(e.target.value);
                         setBgmLabel('Custom URL');
                       }}
                       placeholder="Paste an audio URL here"
                       className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 font-medium text-gray-700 outline-none focus:border-slate-400 mb-3"
                     />
                     <label className="cursor-pointer block w-full border-2 border-dashed border-gray-300 hover:border-slate-400 hover:bg-slate-50 rounded-xl p-4 text-center transition-colors">
                       <span className="text-gray-500 font-bold text-sm">Import local music file</span>
                       <input
                         type="file"
                         accept="audio/*"
                         className="hidden"
                         onChange={(e) => {
                           const file = e.target.files?.[0];
                           if (file) {
                             handleCustomMusicFile(file);
                           }
                         }}
                       />
                     </label>
                     <div className="mt-3 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-600 flex items-center justify-between gap-3">
                       <span className="truncate">Current: {bgmLabel}</span>
                       <button
                         onClick={resetMusicToDefault}
                         className="shrink-0 text-slate-500 font-bold hover:text-slate-700"
                       >
                         Reset
                       </button>
                     </div>
                   </div>

                   {/* Custom Background */}
                   <div>
                     <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                       <ImageIcon size={18} className="text-slate-500" /> Background Image
                     </label>
                     <label className="cursor-pointer block w-full border-2 border-dashed border-gray-300 hover:border-slate-400 hover:bg-slate-50 rounded-xl p-4 text-center transition-colors">
                       <span className="text-gray-500 font-bold text-sm">Click to Upload Background Image</span>
                       <input 
                         type="file" 
                         accept="image/*" 
                         className="hidden" 
                         onChange={(e) => {
                           if (e.target.files && e.target.files[0]) {
                             const reader = new FileReader();
                             reader.onload = () => {
                               if (typeof reader.result === 'string') {
                                 setCustomBg(reader.result);
                               }
                             };
                             reader.readAsDataURL(e.target.files[0]);
                           }
                         }} 
                       />
                     </label>
                     {customBg && (
                       <button onClick={() => setCustomBg(null)} className="mt-2 w-full text-center text-sm text-red-500 font-bold hover:underline">
                         Remove Custom Background
                       </button>
                     )}
                   </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
