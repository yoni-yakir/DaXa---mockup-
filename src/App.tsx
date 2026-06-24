/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Shield, 
  Zap, 
  Crosshair, 
  AlertTriangle, 
  Compass, 
  Radio, 
  Eye, 
  Layers, 
  Cpu, 
  Send, 
  CheckCircle2, 
  Activity, 
  MapPin, 
  Loader2, 
  Check, 
  Skull, 
  Play, 
  Plus, 
  X, 
  BookOpen, 
  Sparkles,
  RefreshCw,
  Volume2,
  VolumeX,
  Target,
  Maximize2,
  Minimize2,
  Terminal,
  ChevronLeft,
  ChevronRight,
  Info,
  Map as MapIcon,
  MousePointer,
  Clock,
  EyeOff,
  Globe
} from "lucide-react";
import { RoutePoint, DangerZone, Alert, BattlePlan, ActiveSkill } from "./types";
import TacticalGoogleMap from "./components/TacticalGoogleMap";

// Map constraints for pixel translations
const MAP_CONFIG = {
  minLat: 33.05,
  maxLat: 33.35,
  minLon: 35.10,
  maxLon: 35.65,
  width: 1000,
  height: 700,
};

// Coordinate helpers
function gpsToSvg(lat: number, lon: number) {
  const x = ((lon - MAP_CONFIG.minLon) / (MAP_CONFIG.maxLon - MAP_CONFIG.minLon)) * MAP_CONFIG.width;
  const y = (1 - (lat - MAP_CONFIG.minLat) / (MAP_CONFIG.maxLat - MAP_CONFIG.minLat)) * MAP_CONFIG.height;
  return { x, y };
}

function svgToGps(x: number, y: number) {
  const lon = MAP_CONFIG.minLon + (x / MAP_CONFIG.width) * (MAP_CONFIG.maxLon - MAP_CONFIG.minLon);
  const lat = MAP_CONFIG.minLat + (1 - y / MAP_CONFIG.height) * (MAP_CONFIG.maxLat - MAP_CONFIG.minLat);
  return { lat, lon };
}

// Tactical static locations to populate the map grid
const FRIENDLY_BASES = [
  { id: "avivim", name: "אביבים", lat: 33.090, lon: 35.415, description: "שטח כינוס פלוגתי דרומית לגדר המערכת" },
  { id: "zarit", name: "זרעית", lat: 33.109, lon: 35.325, description: "חפ\"ק גדודי גזרת עייתא" },
  { id: "metula", name: "מטולה", lat: 33.284, lon: 35.580, description: "שטח כינוס ואבטחת כוחות קצה צפוני" },
  { id: "misgav_am", name: "משגב עם", lat: 33.270, lon: 35.534, description: "מפקדה קדמית רכס רמים" },
];

const ENEMY_TOWNS = [
  { id: "maroun", name: "מארון א-ראס", lat: 33.105, lon: 35.424, threatLevel: "גבוהה מאוד", type: "מעוז קומנדו ונ\"ט" },
  { id: "bint", name: "בינת ג'בייל", lat: 33.121, lon: 35.433, threatLevel: "קריטית", type: "מרכז מפקדות גזרתי" },
  { id: "ayta", name: "עייתא א-שעב", lat: 33.111, lon: 35.302, threatLevel: "גבוהה", type: "מתחם מבוצר חורש ופירים" },
  { id: "khiam", name: "אל-חיאם", lat: 33.315, lon: 35.610, threatLevel: "קריטית", type: "מתחם הגנה גדודי" },
  { id: "odaisseh", name: "עדיסא", lat: 33.270, lon: 35.545, threatLevel: "בינונית", type: "עמדות ירי על מוצבי הרכס" },
  { id: "kafr_kela", name: "כפר כילא", lat: 33.280, lon: 35.570, threatLevel: "בינונית", type: "תשתית תת-קרקע מוכוונת מטולה" },
];

export default function App() {
  // App view state
  const [viewState, setViewState] = useState<"launch" | "suite">("launch");
  const [commanderPrompt, setCommanderPrompt] = useState("");

  // Chat message stream history state (IDF-themed conversational flow)
  interface ChatMessage {
    role: "user" | "assistant";
    content: string;
    timestamp: string;
  }
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "שלום מפקד. מערכת DaXa מוכנה לסנכרון מודיעיני אופרטיבי מהיר בגזרת דרום לבנון.\n\nבאפשרותך לשאול אותי שאלות טקטיות על הגזרה, כגון מיקומי איומים וחוליות אויב, המלצות לצירים נסתרים, או יעדי תקיפה להסבת נזק מרבי. אשמח להשיב לך כאן ולאחר מכן להפיק עבורך תכנון מלא על גבי המפה האינטראקטיבית.",
      timestamp: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [chatLoading, setChatLoading] = useState(false);

  // Focus and incrimination states
  const [focusedAlert, setFocusedAlert] = useState<Alert | null>(null);
  const [incriminatedAlert, setIncriminatedAlert] = useState<Alert | null>(null);
  const [showTopography, setShowTopography] = useState(true);
  
  // Audio state
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const sendChatMessage = async (text: string) => {
    if (!text.trim()) return;
    
    const userMsg: ChatMessage = {
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    };
    
    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);
    setCommanderPrompt("");
    setChatLoading(true);
    playSound("beep");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages.map(m => ({ role: m.role, content: m.content })) })
      });
      
      if (!response.ok) {
        throw new Error("API error");
      }
      
      const data = await response.json();
      
      setChatMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: data.text,
          timestamp: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      playSound("success");
    } catch (err) {
      console.error("Chat failed:", err);
      const fallbackResponse = `**מפקד, שגיאת תקשורת במנוע ה-AI הענן.**\n\nמערכת DaXa עברה למצב קמ"ן לא-מקוון מבוסס תבניות מקומיות. \n\n*מומלץ ללחוץ על הלחצן למטה כדי להפיק ישירות תכנון ציר טקטי שלם ומפורט על גבי המפה האינטראקטיבית.*`;
      setChatMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: fallbackResponse,
          timestamp: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const triggerTacticalPlanning = (customText?: string) => {
    playSound("sonar");
    const query = customText || chatMessages[chatMessages.length - 2]?.content || "עייתא א-שעב";
    const promptText = query.toLowerCase();

    // Standard location detection heuristics
    if (promptText.includes("מטולה") || promptText.includes("metula")) {
      setCurrentLoc("metula");
    } else if (promptText.includes("זרעית") || promptText.includes("zarit")) {
      setCurrentLoc("zarit");
    } else if (promptText.includes("משגב") || promptText.includes("misgav")) {
      setCurrentLoc("misgav_am");
    } else {
      setCurrentLoc("avivim");
    }

    if (promptText.includes("חיאם") || promptText.includes("khiam")) {
      setDestination("khiam");
    } else if (promptText.includes("בינת") || promptText.includes("bint")) {
      setDestination("bint");
    } else if (promptText.includes("עייתא") || promptText.includes("ayta")) {
      setDestination("ayta");
    } else if (promptText.includes("עדיסא") || promptText.includes("odaisseh")) {
      setDestination("odaisseh");
    } else if (promptText.includes("כילא") || promptText.includes("kela")) {
      setDestination("kafr_kela");
    } else {
      setDestination("maroun");
    }

    if (promptText.includes("מהיר") || promptText.includes("מהירה") || promptText.includes("fast")) {
      setRouteType("fastest");
    } else if (promptText.includes("מטוהר") || promptText.includes("נקה") || promptText.includes("clear")) {
      setRouteType("cleared");
    } else {
      setRouteType("stealth");
    }

    setViewState("suite");
    handlePlanBattle(false, query);
  };

  // Map view controller (Zoom & Pan offsets)
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [mapEngine, setMapEngine] = useState<"google" | "vector">(() => {
    const apiKey = ((typeof process !== "undefined" && process.env?.GOOGLE_MAPS_PLATFORM_KEY) || 
                   (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY || "").trim();
    const hasKey = Boolean(apiKey) && apiKey !== "YOUR_API_KEY" && apiKey.startsWith("AIzaSy");
    return hasKey ? "google" : "vector";
  });
  const [mapStyle, setMapStyle] = useState<"dark" | "satellite" | "radar">("dark");
  const [drawToolActive, setDrawToolActive] = useState(false);
  const [customMarkers, setCustomMarkers] = useState<{ id: string; name: string; lat: number; lon: number; type: string }[]>([]);

  // Simulation parameters
  const [currentLoc, setCurrentLoc] = useState("avivim");
  const [destination, setDestination] = useState("maroun");
  const [routeType, setRouteType] = useState<"stealth" | "fastest" | "cleared">("stealth");
  
  const [planning, setPlanning] = useState(false);
  const [battlePlan, setBattlePlan] = useState<BattlePlan | null>(null);
  const [sonarActive, setSonarActive] = useState(false);
  const [logs, setLogs] = useState<string[]>(["מערכת DaXa אותחלה בהצלחה", "ממתין להנחיית מפקד..."]);

  // Multi-Agent states (live monitoring)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>("llama");
  const [agentStatuses, setAgentStatuses] = useState<Record<string, "idle" | "thinking" | "ready">>({
    yolo: "idle",
    sam: "idle",
    whisper: "idle",
    llama: "idle"
  });

  const [skills, setSkills] = useState<ActiveSkill[]>([
    {
      id: "yolo",
      name: "YOLOv11 - זיהוי מטרות",
      description: "סריקת זרמי וידאו מרחפנים בזמן אמת לזיהוי חמושים, משגרים ורכבי סיוע בהספק נמוך.",
      icon: "Crosshair",
      sensorType: "חוזי רחפנים (VISINT)",
      tacticalUse: "סגירת מעגל מיידית (Sensor-to-Shooter)",
      enabled: true,
      accuracy: 94
    },
    {
      id: "sam",
      name: "Meta SAM - פילוח אנומליות",
      description: "פילוח גיאוגרפי מתקדם ללא למידה מוקדמת (Zero-Shot) לאיתור ערימות עפר, פירים ושינויים מבניים.",
      icon: "Layers",
      sensorType: "צילומי לווין ותלת-ממד (GEOINT)",
      tacticalUse: "גילוי פירים ומטעני צד מוסתרים",
      enabled: true,
      accuracy: 89
    },
    {
      id: "whisper",
      name: "WhisperNER - חילוץ תקשורת",
      description: "האזנה רציפה לרשתות קשר טקטיות, תמלול בו-זמני בתנאי רעש קשים, חילוץ נ\"צ וישויות בזמן אמת.",
      icon: "Radio",
      sensorType: "האזנות ואותות קשר (SIGINT)",
      tacticalUse: "הקפצת התרעות מבוססות שיח אויב",
      enabled: true,
      accuracy: 91
    },
    {
      id: "llama",
      name: "Llama-3 - מתכלל מפקד",
      description: "מנוע מולטי-מודאלי המרכז את כלל הנתונים להרכבת המלצות מבצעיות וטיוטות פקודה לדרג המפקד.",
      icon: "Cpu",
      sensorType: "הערכת תמונה קוגניטיבית (C4I)",
      tacticalUse: "תכנון צירים והערכות מצב טקטיות",
      enabled: true,
      accuracy: 95
    }
  ]);

  // Master alert notifications feed
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [firingSequenceAlert, setFiringSequenceAlert] = useState<Alert | null>(null);
  const [firingStatus, setFiringStatus] = useState<"idle" | "locking" | "launching" | "impact" | "success">("idle");
  const [selectedMapNode, setSelectedMapNode] = useState<any>(null);

  // Audio tone generator (Synthesizer utilizing Web Audio API)
  const playSound = (type: "beep" | "sonar" | "alarm" | "success" | "fire") => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      if (type === "beep") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(1000, ctx.currentTime);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === "sonar") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.6);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.6);
      } else if (type === "alarm") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(500, ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      } else if (type === "success") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(520, ctx.currentTime);
        osc.frequency.setValueAtTime(780, ctx.currentTime + 0.12);
        osc.frequency.setValueAtTime(1040, ctx.currentTime + 0.24);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } else if (type === "fire") {
        const bufferSize = ctx.sampleRate * 1.2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(800, ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 1.0);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start();
      }
    } catch (e) {
      console.warn("Audio Context init fallback:", e);
    }
  };

  const initSound = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume();
      }
    } catch (e) {
      console.warn(e);
    }
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    if (nextVal) {
      setTimeout(() => {
        const osc = audioCtxRef.current?.createOscillator();
        const gain = audioCtxRef.current?.createGain();
        if (osc && gain && audioCtxRef.current) {
          osc.type = "sine";
          osc.frequency.setValueAtTime(1000, audioCtxRef.current.currentTime);
          gain.gain.setValueAtTime(0.04, audioCtxRef.current.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtxRef.current.currentTime + 0.15);
          osc.connect(gain);
          gain.connect(audioCtxRef.current.destination);
          osc.start();
          osc.stop(audioCtxRef.current.currentTime + 0.15);
        }
      }, 50);
    }
  };

  // Automated sonar pulses
  useEffect(() => {
    const timer = setInterval(() => {
      setSonarActive(true);
      if (soundEnabled) {
        playSound("sonar");
      }
      setTimeout(() => setSonarActive(false), 1500);
    }, 10000);
    return () => clearInterval(timer);
  }, [soundEnabled]);

  // Push messages to console log
  const logMessage = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString('he-IL')}] ${msg}`, ...prev.slice(0, 18)]);
  };

  // Launch initial plan on app start
  useEffect(() => {
    handlePlanBattle(true);
  }, []);

  // Main combat route planner action (Server-Side full-stack execution with Gemini)
  const handlePlanBattle = async (silent = false, customPromptText?: string) => {
    if (!silent) {
      setPlanning(true);
      playSound("sonar");
      logMessage(`מפעיל חפ"ק דיגיטלי. מוצא: ${currentLoc}, יעד: ${destination}. סוג ציר: ${routeType}`);
      
      // Simulate multi-agent workflow statuses sequentially
      setAgentStatuses({ yolo: "thinking", sam: "idle", whisper: "idle", llama: "idle" });
      logMessage("סוכן YOLOv11: סורק תצלומים מרחפנים וקוד מודיעיני...");
    }

    const activeSkillsList = skills.filter(s => s.enabled).map(s => s.id);

    // Dynamic steps simulator for agent thinking dashboard
    if (!silent) {
      setTimeout(() => {
        setAgentStatuses({ yolo: "ready", sam: "thinking", whisper: "idle", llama: "idle" });
        logMessage("סוכן Meta SAM: מבצע פילוח אנומליות טופוגרפיות ומציאת פירים...");
        
        setTimeout(() => {
          setAgentStatuses({ yolo: "ready", sam: "ready", whisper: "thinking", llama: "idle" });
          logMessage("סוכן WhisperNER: מאזין לרשתות קשר, מתמלל ומזהה ישויות מיקום...");
          
          setTimeout(() => {
            setAgentStatuses({ yolo: "ready", sam: "ready", whisper: "ready", llama: "thinking" });
            logMessage("סוכן Llama-3 Orchestrator: מתכלל את נתוני כלל הסוכנים להרכבת תמונה אחודה...");
          }, 1500);
        }, 1200);
      }, 1000);
    }

    try {
      const response = await fetch("/api/plan-battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentLoc,
          destination,
          routeType,
          skillsEnabled: activeSkillsList,
          customPromptText
        })
      });

      if (!response.ok) throw new Error("API planning request failed");

      const plan: BattlePlan = await response.json();
      setBattlePlan(plan);
      
      // Merge live alerts
      if (plan.alerts && plan.alerts.length > 0) {
        setAlerts(prev => {
          const filteredPrev = prev.filter(a => !plan.alerts.some(pa => pa.text === a.text));
          return [...plan.alerts.map(a => ({ ...a, status: "active" as const })), ...filteredPrev];
        });
        if (!silent) {
          playSound("alarm");
          logMessage(`זוהו ${plan.alerts.length} התראות טקטיות בגזרה!`);
        }
      } else if (!silent) {
        playSound("success");
      }

      if (!silent) {
        setAgentStatuses({ yolo: "ready", sam: "ready", whisper: "ready", llama: "ready" });
        logMessage("תכנון הציר הושלם בהצלחה ע\"י מנוע ה-DAXA!");
      }
    } catch (err) {
      console.error("Failed to plan combat path:", err);
      logMessage("שגיאה בתכנון הציר. עובר למצב גיבוי לא-מקוון.");
    } finally {
      if (!silent) {
        setPlanning(false);
      }
    }
  };

  // Handle commander prompt from chat launch screen
  const handleLaunchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commanderPrompt.trim()) return;

    // Smart heuristic parser for user text input to align parameters automatically
    const promptText = commanderPrompt.toLowerCase();
    
    if (promptText.includes("מטולה") || promptText.includes("metula")) {
      setCurrentLoc("metula");
    } else if (promptText.includes("זרעית") || promptText.includes("zarit")) {
      setCurrentLoc("zarit");
    } else if (promptText.includes("משגב") || promptText.includes("misgav")) {
      setCurrentLoc("misgav_am");
    } else {
      setCurrentLoc("avivim");
    }

    if (promptText.includes("חיאם") || promptText.includes("khiam")) {
      setDestination("khiam");
    } else if (promptText.includes("בינת") || promptText.includes("bint")) {
      setDestination("bint");
    } else if (promptText.includes("עייתא") || promptText.includes("ayta")) {
      setDestination("ayta");
    } else if (promptText.includes("עדיסא") || promptText.includes("odaisseh")) {
      setDestination("odaisseh");
    } else if (promptText.includes("כילא") || promptText.includes("kela")) {
      setDestination("kafr_kela");
    } else {
      setDestination("maroun");
    }

    if (promptText.includes("מהיר") || promptText.includes("מהירה") || promptText.includes("fast")) {
      setRouteType("fastest");
    } else if (promptText.includes("מטוהר") || promptText.includes("נקה") || promptText.includes("clear")) {
      setRouteType("cleared");
    } else {
      setRouteType("stealth");
    }

    setViewState("suite");
    handlePlanBattle(false, commanderPrompt);
  };

  // Click on map to drop a custom tactical marker/POI
  const handleMapClick = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!drawToolActive) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * MAP_CONFIG.width;
    const y = ((e.clientY - rect.top) / rect.height) * MAP_CONFIG.height;
    
    // Reverse coordinates to GPS to simulate real-world data placement
    const { lat, lon } = svgToGps(x, y);

    const markerName = `נ"צ עניין ${customMarkers.length + 1}`;
    const newMarker = {
      id: `marker-${Date.now()}`,
      name: markerName,
      lat,
      lon,
      type: "POI"
    };

    setCustomMarkers(prev => [...prev, newMarker]);
    setDrawToolActive(false);
    playSound("success");
    logMessage(`התווסף סימון מפקד חדש: ${markerName} (${lat.toFixed(4)}, ${lon.toFixed(4)})`);
  };

  // Mouse drag handlers for panning local vector map
  const handleMouseDown = (e: React.MouseEvent) => {
    if (drawToolActive) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Close firing loop sequence (The heart of Sensor-to-Shooter)
  const triggerFireLoop = (alert: Alert) => {
    setFiringSequenceAlert(alert);
    setFiringStatus("locking");
    playSound("sonar");
    logMessage(`[מעגל אש] ננעל על מטרה: ${alert.text.substring(0, 40)}...`);

    setTimeout(() => {
      setFiringStatus("launching");
      playSound("fire");
      logMessage("[מעגל אש] משגר חימוש מונחה מדויק לעבר מקור האיום.");
      
      setTimeout(() => {
        setFiringStatus("impact");
        playSound("alarm");
        logMessage("[מעגל אש] פגיעה ביעד. מפעיל YOLOv11 להערכת נזקים משנית (BDA)...");

        setTimeout(() => {
          setFiringStatus("success");
          playSound("success");
          logMessage("[מעגל אש] האיום נוטרל לחלוטין. הדרך פנויה להמשך תנועת הכוח.");

          // Resolve the alert in the master state list
          setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, status: "resolved" as const } : a));

          setTimeout(() => {
            setFiringSequenceAlert(null);
            setFiringStatus("idle");
          }, 1800);
        }, 1800);
      }, 2000);
    }, 1800);
  };

  // Pre-configured commander prompt suggestions
  const PROMPT_TEMPLATES = [
    { title: "תכנון ציר אביבים ➔ מארון", text: "תכנן לי ציר נסתר ומאובטח מאביבים למארון א-ראס. יש דיווחים על חוליית נ\"ט במרכז הכפר" },
    { title: "חסימת צירים זרעית ➔ עייתא", text: "סרוק איומים תת-קרקעיים ופירים לאורך הדרך מזרעית לעייתא א-שעב" },
    { title: "תקיפה מטוהרת מטולה ➔ חיאם", text: "תכנן מסלול מטוהר ומהיר ממטולה לכלא אל-חיאם. הפעל את כל רכיבי ה-AI לאיתור מטענים" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col font-sans selection:bg-teal-500 selection:text-slate-950 relative overflow-x-hidden" dir="rtl" id="daxa-root">
      
      {/* Premium Minimalist Background Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(20,184,166,0.04),transparent_70%)] pointer-events-none z-0" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none z-0" />

      {/* HEADER SECTION - ULTRA MINIMALIST */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md px-8 py-4.5 flex items-center justify-between sticky top-0 z-40" id="daxa-header">
        <div className="flex items-center space-x-reverse space-x-4">
          <div className="relative">
            <div className="h-9 w-9 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-center">
              <Crosshair className="h-4.5 w-4.5 text-teal-400" />
            </div>
            {sonarActive && (
              <span className="absolute -inset-0.5 rounded-lg border border-teal-500/30 animate-ping pointer-events-none" />
            )}
          </div>
          <div>
            <div className="flex items-center space-x-reverse space-x-2">
              <h1 className="text-lg font-bold tracking-tight text-white font-sans">דאקסה • DaXa</h1>
              <span className="text-[9px] bg-slate-900 text-teal-400 border border-slate-800 px-2 py-0.5 rounded font-mono">SYSTEM ACTIVE</span>
            </div>
            <p className="text-[10px] text-slate-400">מערכת מודיעין וניתוח טקטי אופרטיבית לגזרת דרום לבנון</p>
          </div>
        </div>

        {/* Live system monitoring status */}
        <div className="hidden lg:flex items-center space-x-reverse space-x-4 text-[10px] font-sans">
          <div className="flex items-center space-x-reverse space-x-2 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-900">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
            <span className="text-slate-400">גזרה אקטיבית:</span>
            <span className="text-slate-200 font-medium">דרום לבנון</span>
          </div>
          <div className="flex items-center space-x-reverse space-x-2 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-900">
            <Radio className="h-3 w-3 text-teal-500" />
            <span className="text-slate-400">רשת קשר:</span>
            <span className="text-slate-200 font-medium">סריקה מודיעינית פעילה</span>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex items-center space-x-reverse space-x-2">
          {viewState === "suite" && (
            <button
              onClick={() => { setViewState("launch"); playSound("beep"); }}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg text-xs transition flex items-center space-x-reverse space-x-1.5 text-slate-300 font-medium"
            >
              <Terminal className="h-3.5 w-3.5" />
              <span>מסך הנחיות מפקד</span>
            </button>
          )}

          <button 
            onClick={initSound}
            className={`p-2 rounded-lg border transition-all ${soundEnabled ? 'bg-teal-950/40 text-teal-400 border-teal-800/60' : 'bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-700'}`}
            title={soundEnabled ? "השתק שמע" : "הפעל שמע"}
            id="btn-sound"
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* VIEW 1: PREMIUM LAUNCHPAD CHAT SCREEN */}
      <AnimatePresence mode="wait">
        {viewState === "launch" ? (
          <motion.div 
            key="launch-screen"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex-1 max-w-4xl w-full mx-auto px-6 py-12 flex flex-col justify-center items-center z-10"
            id="launch-container"
          >
            {/* Visual Header Decoration */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center space-x-reverse space-x-2 px-3 py-1 bg-slate-900 border border-slate-800 rounded-full text-slate-400 text-[10px] mb-5">
                <Sparkles className="h-3 w-3 text-teal-400 animate-pulse" />
                <span>מנוע סוכנים חכם לקבלת החלטות בשדה הקרב</span>
              </div>
              <h2 className="text-3xl lg:text-4xl font-light text-white tracking-tight leading-tight mb-4 font-sans">
                חפ״ק תכנון אופרטיבי <span className="font-medium text-teal-400">DaXa</span>
              </h2>
              <p className="text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
                מערכת מתקדמת לניתוח טופוגרפי, תמלול רשתות קשר, סיווג מטרות מודיעיני וסגירת מעגלי אש מהירים בזמן אמת.
              </p>
            </div>

            {/* Main Interactive Terminal / Prompt Container */}
            <div className="w-full bg-slate-900/40 border border-slate-850 rounded-2xl p-6 lg:p-8 shadow-xl relative flex flex-col h-[520px] overflow-hidden backdrop-blur-md">
              <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

              {/* Chat messages feed container */}
              <div className="flex-1 overflow-y-auto space-y-5 mb-5 pr-1 text-right flex flex-col scrollbar-thin">
                {chatMessages.map((msg, idx) => (
                  <div 
                    key={idx} 
                    className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'self-start items-start' : 'self-end items-end'}`}
                  >
                    <div className="flex items-center space-x-reverse space-x-1.5 mb-1.5 text-[10px] text-slate-500">
                      <span className="font-medium">{msg.role === 'user' ? 'מפקד הכוח' : 'קמ״ן דיגיטלי DaXa'}</span>
                      <span>•</span>
                      <span>{msg.timestamp}</span>
                    </div>
                    <div className={`p-4 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap text-right ${
                      msg.role === 'user' 
                        ? 'bg-slate-850 text-slate-100 border border-slate-800 rounded-tr-none' 
                        : 'bg-teal-950/20 border border-teal-500/20 text-teal-100 rounded-tl-none'
                    }`}>
                      {msg.content}

                      {/* Offer map-based planning */}
                      {msg.role === 'assistant' && (
                        <div className="mt-4 border-t border-slate-800/50 pt-3 flex flex-wrap gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => triggerTacticalPlanning(msg.content)}
                            className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-lg text-[10px] transition-all shadow-md flex items-center space-x-reverse space-x-1.5 cursor-pointer"
                          >
                            <span>🗺️ הצג תכנון ציר טקטי מלא על גבי מפת שו״ב</span>
                            <ChevronLeft className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="self-end items-end flex flex-col max-w-[80%]">
                    <div className="flex items-center space-x-reverse space-x-2 text-[10px] text-teal-400">
                      <span className="h-1 w-1 rounded-full bg-teal-400 animate-ping" />
                      <span>מנתח נתונים, מסנכרן ישויות שטח ומחולל הערכת מצב...</span>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-850/80 p-4 rounded-xl mt-2 text-xs text-slate-400 animate-pulse text-right">
                      סורק קווי גובה טופוגרפיים, נקודות תצפית ואיומי נ״ט פוטנציאליים לאורך הציר המבוקש...
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input form */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!commanderPrompt.trim() || chatLoading) return;
                  sendChatMessage(commanderPrompt);
                }}
                className="border-t border-slate-850/60 pt-4 flex space-x-reverse space-x-3.5 items-center"
              >
                <input
                  type="text"
                  value={commanderPrompt}
                  onChange={(e) => setCommanderPrompt(e.target.value)}
                  disabled={chatLoading}
                  placeholder="הקלד פקודה (למשל: תכנן לי ציר נסתר ומאובטח מאביבים למארון א-ראס)..."
                  className="flex-1 px-4 py-3 bg-slate-950 border border-slate-850 focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 focus:outline-none rounded-xl text-xs text-slate-100 placeholder-slate-500 transition-all text-right"
                />
                <button
                  type="submit"
                  disabled={!commanderPrompt.trim() || chatLoading}
                  className="px-5 py-3 bg-teal-500 hover:bg-teal-400 disabled:opacity-40 text-slate-950 font-bold rounded-xl text-xs transition shadow-md shadow-teal-500/10 flex items-center space-x-reverse space-x-1.5 cursor-pointer"
                >
                  <span>הרץ ניתוח</span>
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </form>

              {/* Suggestions Grid */}
              <div className="mt-4 border-t border-slate-850/60 pt-3">
                <span className="block text-[10px] font-medium text-slate-400 mb-2.5">הנחיות מהירות לדוגמה:</span>
                <div className="grid grid-cols-3 gap-2.5">
                  {PROMPT_TEMPLATES.slice(0, 3).map((tpl, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setCommanderPrompt(tpl.text);
                        playSound("beep");
                      }}
                      className="text-right p-3 bg-slate-950/30 hover:bg-slate-950/70 border border-slate-850 hover:border-slate-800 rounded-xl text-[11px] transition-all flex flex-col justify-between h-20"
                    >
                      <span className="font-semibold text-slate-200 block mb-1 leading-none">{tpl.title}</span>
                      <span className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">{tpl.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Specs Footnote info panel */}
            <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4 text-center w-full max-w-2xl">
              <div className="p-3 bg-slate-900/20 border border-slate-900 rounded-xl">
                <span className="block text-xs text-teal-400 font-medium">100% שרידות מקומית</span>
                <span className="text-[10px] text-slate-400">חסין שיבושי ל״א ואינטרנט</span>
              </div>
              <div className="p-3 bg-slate-900/20 border border-slate-900 rounded-xl">
                <span className="block text-xs text-teal-400 font-medium">רשת סוכנים אופרטיבית</span>
                <span className="text-[10px] text-slate-400">תיאום חשיבה מבוסס LangGraph</span>
              </div>
              <div className="p-3 bg-slate-900/20 border border-slate-900 rounded-xl">
                <span className="block text-xs text-teal-400 font-medium">היתוך מטרות חזותי</span>
                <span className="text-[10px] text-slate-400">פילוח שטח מבוסס YOLOv11 & SAM</span>
              </div>
              <div className="p-3 bg-slate-900/20 border border-slate-900 rounded-xl">
                <span className="block text-xs text-teal-400 font-medium">חילוץ ישויות קשר</span>
                <span className="text-[10px] text-slate-400">פענוח חכם של ערוצי שמע קשר</span>
              </div>
            </div>
          </motion.div>
        ) : (
          /* VIEW 2: MASTER MISSION CONTROL SUITE */
          <motion.div 
            key="suite-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 max-w-[1650px] w-full mx-auto p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 z-10 relative"
            id="suite-container"
          >
            
            {/* COLUMN 1: INTERACTIVE MAP VIEWER (7 Cols) */}
            <div className="lg:col-span-7 flex flex-col space-y-6">
              
              {/* THE MASTER MAP COMPONENT */}
              <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-4 shadow-md flex flex-col h-[580px] lg:h-[650px] relative overflow-hidden" id="card-map">
                
                {/* Map Floating Header */}
                <div className="absolute top-6 left-6 right-6 z-20 flex items-center justify-between pointer-events-none">
                  {/* Left Controls: Coordinates readouts & Map Engine Toggle */}
                  <div className="flex items-center space-x-reverse space-x-2 pointer-events-auto">
                    <div className="bg-slate-950/90 backdrop-blur-md border border-slate-900/60 px-3.5 py-2 rounded-xl shadow-md flex items-center space-x-reverse space-x-3 text-[10px] text-slate-300">
                      <div className="flex items-center space-x-reverse space-x-1">
                        <span className="text-teal-400 font-medium">קו רוחב:</span>
                        <span className="font-mono">33.114° N</span>
                      </div>
                      <div className="flex items-center space-x-reverse space-x-1 border-r border-slate-800 pr-3">
                        <span className="text-teal-400 font-medium">קו אורך:</span>
                        <span className="font-mono">35.421° E</span>
                      </div>
                      <div className="flex items-center space-x-reverse space-x-1 border-r border-slate-800 pr-3">
                        <span className="text-teal-400 font-medium">זום:</span>
                        <span className="font-mono">{zoom.toFixed(1)}x</span>
                      </div>
                    </div>

                    <button
                      onClick={() => { setMapEngine(prev => prev === "google" ? "vector" : "google"); playSound("beep"); }}
                      className={`px-3 py-2 rounded-xl border backdrop-blur-md shadow-md text-[10px] font-bold font-sans transition flex items-center space-x-reverse space-x-1.5 ${
                        mapEngine === "vector"
                          ? "bg-amber-950/90 border-amber-500/30 text-amber-400 hover:bg-amber-900/80"
                          : "bg-teal-950/90 border-teal-500/30 text-teal-400 hover:bg-teal-900/80"
                      }`}
                      title={mapEngine === "vector" ? "עבור למפת Google חיה (דורש חיבור אינטרנט ומפתח)" : "עבור למפה טקטית לא מקוונת (חסינת שיבושים)"}
                    >
                      <Globe className="h-3.5 w-3.5 animate-spin" style={{ animationDuration: "12s" }} />
                      <span>{mapEngine === "vector" ? "מפה טקטית (אופליין)" : "מפת Google (לוויין)"}</span>
                    </button>
                  </div>

                  {/* Right Controls: Map Layer Toggles */}
                  <div className="bg-slate-950/90 backdrop-blur-md border border-slate-900/60 p-1.5 rounded-xl shadow-md pointer-events-auto flex items-center space-x-reverse space-x-1.5">
                    <button
                      onClick={() => { setMapStyle("dark"); playSound("beep"); }}
                      className={`px-3 py-1.5 rounded-lg text-xs transition ${
                        mapStyle === "dark" ? "bg-teal-500 text-slate-950 font-semibold" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      כהה
                    </button>
                    <button
                      onClick={() => { setMapStyle("satellite"); playSound("beep"); }}
                      className={`px-3 py-1.5 rounded-lg text-xs transition ${
                        mapStyle === "satellite" ? "bg-teal-500 text-slate-950 font-semibold" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      לוויין
                    </button>
                    <button
                      onClick={() => { setMapStyle("radar"); playSound("beep"); }}
                      className={`px-3 py-1.5 rounded-lg text-xs transition ${
                        mapStyle === "radar" ? "bg-teal-500 text-slate-950 font-semibold" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      ראדאר
                    </button>
                    <button
                      onClick={() => { setShowTopography(!showTopography); playSound("beep"); }}
                      className={`px-3 py-1.5 rounded-lg text-xs transition flex items-center space-x-reverse space-x-1.5 ${
                        showTopography ? "bg-teal-950 border border-teal-500/20 text-teal-400 font-semibold" : "text-slate-400 hover:text-white"
                      }`}
                      title="הצג או הסתר שכבת טופוגרפיה וקווי גובה חיוניים"
                    >
                      <Layers className="h-3.5 w-3.5" />
                      <span>טופוגרפיה</span>
                    </button>
                  </div>
                </div>

                {/* Map Floating Left Tools: Zoom + POI Drawer */}
                <div className="absolute bottom-6 right-6 z-20 flex flex-col space-y-2 pointer-events-auto">
                  {/* Zoom Controls */}
                  <div className="flex flex-col bg-slate-950/90 backdrop-blur-md border border-slate-900 rounded-xl shadow-md overflow-hidden">
                    <button
                      onClick={() => { setZoom(prev => Math.min(prev + 0.25, 4)); playSound("beep"); }}
                      className="p-2.5 hover:bg-slate-900 border-b border-slate-900 text-slate-300 font-bold text-center text-xs transition"
                      title="הגדל מפה"
                    >
                      +
                    </button>
                    <button
                      onClick={() => { setZoom(prev => Math.max(prev - 0.25, 1)); playSound("beep"); }}
                      className="p-2.5 hover:bg-slate-900 text-slate-300 font-bold text-center text-xs transition"
                      title="הקטן מפה"
                    >
                      -
                    </button>
                  </div>

                  {/* POI Drawing Activation */}
                  <button
                    onClick={() => { setDrawToolActive(!drawToolActive); playSound("beep"); }}
                    className={`p-2.5 rounded-xl border shadow-md transition flex items-center justify-center ${
                      drawToolActive 
                        ? 'bg-amber-500 border-amber-400 text-slate-950 font-bold' 
                        : 'bg-slate-950/90 backdrop-blur-md border-slate-900 text-amber-500 hover:bg-slate-900'
                    }`}
                    title="הוסף נקודת עניין על המפה"
                  >
                    <Plus className="h-4.5 w-4.5" />
                  </button>

                  {/* Reset zoom/pan */}
                  <button
                    onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); playSound("beep"); }}
                    className="p-2.5 bg-slate-950/90 backdrop-blur-md border border-slate-900 rounded-xl text-slate-400 hover:text-white shadow-md text-[10px] font-sans text-center font-medium"
                    title="אפס תצוגה"
                  >
                    אפס מפה
                  </button>
                </div>

                {/* THE MAP CANVAS STAGE */}
                <div className="flex-1 bg-slate-950 border border-slate-850 rounded relative overflow-hidden flex flex-col">
                  {mapEngine === "google" ? (
                    <TacticalGoogleMap
                      mapStyle={mapStyle}
                      recommendedRoute={battlePlan?.recommendedRoute || []}
                      dangerZones={battlePlan?.dangerZones || []}
                      customMarkers={customMarkers}
                      friendlyBases={FRIENDLY_BASES}
                      enemyTowns={ENEMY_TOWNS}
                      alerts={alerts}
                      destination={destination}
                      drawToolActive={drawToolActive}
                      onMapClick={(lat, lon) => {
                        const markerName = `נ"צ עניין ${customMarkers.length + 1}`;
                        const newMarker = {
                          id: `marker-${Date.now()}`,
                          name: markerName,
                          lat,
                          lon,
                          type: "POI"
                        };
                        setCustomMarkers(prev => [...prev, newMarker]);
                        setDrawToolActive(false);
                        playSound("success");
                        logMessage(`התווסף סימון מפקד חדש: ${markerName} (${lat.toFixed(4)}, ${lon.toFixed(4)})`);
                      }}
                      selectedMapNode={selectedMapNode}
                      onSelectNode={(node) => {
                        setSelectedMapNode(node);
                        playSound("beep");
                      }}
                      focusedAlert={focusedAlert}
                      showTopography={showTopography}
                    />
                  ) : (
                    /* High-fidelity Vector Map Stage */
                    <div 
                      className="absolute inset-0 select-none overflow-hidden cursor-grab active:cursor-grabbing"
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                    >
                      {/* Drawing Instructions overlay banner */}
                      {drawToolActive && (
                        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-amber-500 text-slate-950 px-4 py-2 rounded-full text-xs font-bold animate-pulse shadow-xl flex items-center space-x-reverse space-x-2">
                          <MousePointer className="h-4 w-4" />
                          <span>לחץ על נקודה כלשהי במפה כדי להוסיף סימון מפקד</span>
                        </div>
                      )}

                      {/* Styled Map Background based on layer selection */}
                      <div className="absolute inset-0 z-0">
                        {mapStyle === "satellite" ? (
                          /* Simulation of high contrast tactical satellite image */
                          <div className="absolute inset-0 bg-slate-950 opacity-90">
                            {/* Generates abstract shapes and contour forests resembling satellite view */}
                            <svg width="100%" height="100%" className="opacity-30">
                              <rect x="100" y="50" width="300" height="200" rx="40" fill="#14532d" />
                              <rect x="500" y="300" width="400" height="300" rx="80" fill="#14532d" />
                              <circle cx="200" cy="450" r="120" fill="#0f172a" />
                            </svg>
                          </div>
                        ) : mapStyle === "radar" ? (
                          /* Topo radar pulse animation waves */
                          <div className="absolute inset-0 bg-slate-950">
                            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,rgba(20,184,166,0.3)_10%,transparent_10%)] bg-[size:20px_20px]" />
                            <div className="absolute inset-0 flex items-center justify-center opacity-10">
                              <div className="h-[400px] w-[400px] border border-teal-500 rounded-full animate-ping" />
                            </div>
                          </div>
                        ) : (
                          /* Classic Dark tactical vector wireframe */
                          <div className="absolute inset-0 bg-slate-950">
                            <div className="absolute inset-0 bg-[linear-gradient(rgba(13,148,136,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(13,148,136,0.01)_1px,transparent_1px)] bg-[size:20px_20px]" />
                          </div>
                        )}
                      </div>

                      {/* Topographic Contours Layer (Emerald Green military style) if topography layer toggled */}
                      {showTopography && (
                        <div className="absolute inset-0 z-[5] pointer-events-none opacity-40">
                          <svg width="100%" height="100%">
                            {/* Draws topographic contour loops representing the peaks of South Lebanon */}
                            <g className="stroke-emerald-500 fill-none stroke-[0.8]">
                              {/* peak 1: Maroun al-Ras */}
                              <circle cx="340" cy="410" r="40" />
                              <circle cx="340" cy="410" r="70" />
                              <circle cx="340" cy="410" r="110" />
                              {/* peak 2: Bint Jbeil */}
                              <circle cx="510" cy="350" r="55" />
                              <circle cx="510" cy="350" r="90" />
                              {/* peak 3: Khiam */}
                              <ellipse cx="850" cy="220" rx="40" ry="25" />
                              <ellipse cx="850" cy="220" rx="80" ry="45" />
                              {/* peak 4: Ayta ash-Shab */}
                              <circle cx="180" cy="460" r="50" />
                              <circle cx="180" cy="460" r="90" />
                            </g>
                          </svg>
                        </div>
                      )}

                      {/* SVG Map Graphics Layer */}
                      <svg
                        viewBox={`0 0 ${MAP_CONFIG.width} ${MAP_CONFIG.height}`}
                        className="w-full h-full relative z-10 transition-transform duration-75"
                        style={{
                          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                          transformOrigin: "center"
                        }}
                        onClick={handleMapClick}
                      >
                        
                        {/* TOPOGRAPHIC GRID LABELS (Google Maps-like coordinates grids) */}
                        <g className="opacity-30 stroke-[0.3] stroke-slate-700 fill-slate-500 font-mono text-4xs">
                          {/* Vertical line markers */}
                          {[100, 200, 300, 400, 500, 600, 700, 800, 900].map(x => (
                            <g key={`vert-${x}`}>
                              <line x1={x} y1="0" x2={x} y2={MAP_CONFIG.height} />
                              <text x={x + 4} y="15" textAnchor="start">{(35.10 + (x / 1000) * 0.55).toFixed(4)}°</text>
                            </g>
                          ))}
                          {/* Horizontal line markers */}
                          {[100, 200, 300, 400, 500, 600].map(y => (
                            <g key={`horiz-${y}`}>
                              <line x1="0" y1={y} x2={MAP_CONFIG.width} y2={y} />
                              <text x="15" y={y - 4} textAnchor="start">{(33.05 + (1 - y / 700) * 0.30).toFixed(4)}°</text>
                            </g>
                          ))}
                        </g>

                        {/* BLUE LINE / BORDER - Glow Border Line */}
                        <path
                          d="M 50,550 L 150,500 L 280,510 L 400,460 L 520,470 L 620,380 L 780,370 L 920,300"
                          fill="none"
                          className="stroke-sky-500/60 stroke-[4] stroke-dasharray-[8,6]"
                        />
                        
                        <path
                          d="M 50,550 L 150,500 L 280,510 L 400,460 L 520,470 L 620,380 L 780,370 L 920,300"
                          fill="none"
                          className="stroke-sky-400/20 stroke-[12] blur-md"
                        />

                        <text x="310" y="540" className="fill-sky-400/70 font-mono text-3xs font-bold tracking-widest uppercase">
                          הקו הכחול (גבול בינלאומי צה"ל)
                        </text>

                        {/* DYNAMIC COMBAT ROUTE */}
                        {battlePlan && battlePlan.recommendedRoute && battlePlan.recommendedRoute.length > 0 && (
                          <>
                            <path
                              d={battlePlan.recommendedRoute.map((pt, i) => {
                                const { x, y } = gpsToSvg(pt.lat, pt.lon);
                                return `${i === 0 ? "M" : "L"} ${x},${y}`;
                              }).join(" ")}
                              fill="none"
                              className="stroke-teal-400/30 stroke-[8] blur-sm animate-pulse"
                            />

                            <path
                              d={battlePlan.recommendedRoute.map((pt, i) => {
                                const { x, y } = gpsToSvg(pt.lat, pt.lon);
                                return `${i === 0 ? "M" : "L"} ${x},${y}`;
                              }).join(" ")}
                              fill="none"
                              className="stroke-teal-400 stroke-[3.5]"
                            />

                            {/* Interactive Steps Circles */}
                            {battlePlan.recommendedRoute.map((pt, i) => {
                              const { x, y } = gpsToSvg(pt.lat, pt.lon);
                              return (
                                <g 
                                  key={`pt-${i}`} 
                                  className="cursor-pointer group"
                                  onClick={() => { setSelectedMapNode({ ...pt, isFriendly: true }); playSound("beep"); }}
                                >
                                  <circle cx={x} cy={y} r="6.5" className="fill-teal-400 stroke-slate-950 stroke-[1.5]" />
                                  <circle cx={x} cy={y} r="12" className="fill-none stroke-teal-400/40 stroke-[1] animate-ping" />
                                  
                                  <rect x={x - 45} y={y + 12} width="90" height="15" rx="2" className="fill-slate-950/90 stroke-teal-500/30 stroke-[0.8] opacity-0 group-hover:opacity-100 transition-opacity" />
                                  <text x={x} y={y + 22} className="fill-teal-300 font-bold font-mono text-4xs opacity-0 group-hover:opacity-100 transition-opacity" textAnchor="middle">
                                    {pt.name}
                                  </text>
                                </g>
                              );
                            })}
                          </>
                        )}

                        {/* RADAR THREAT DANGER CIRCLES */}
                        {battlePlan && battlePlan.dangerZones && battlePlan.dangerZones.map((zone, idx) => {
                          const { x, y } = gpsToSvg(zone.lat, zone.lon);
                          return (
                            <g key={`zone-${idx}`}>
                              <circle 
                                cx={x} 
                                cy={y} 
                                r={zone.radius * 0.9} 
                                className="fill-red-500/10 stroke-red-500/40 stroke-[1.5] stroke-dasharray-[3,3] animate-pulse"
                              />
                              <circle cx={x} cy={y} r="4.5" className="fill-red-500 stroke-slate-950 stroke-[1.5]" />
                              
                              <g className="cursor-pointer" onClick={() => setSelectedMapNode({ ...zone, isFriendly: false })}>
                                <rect x={x - 50} y={y - 25} width="100" height="15" rx="2" className="fill-slate-950/90 stroke-red-500/40 stroke-[0.8]" />
                                <text x={x} y={y - 15} className="fill-red-400 font-bold font-mono text-4xs" textAnchor="middle">
                                  ⚠️ איום נ'ט זוהה
                                </text>
                              </g>
                            </g>
                          );
                        })}

                        {/* CUSTOM USER MARKERS */}
                        {customMarkers.map((marker, idx) => {
                          const { x, y } = gpsToSvg(marker.lat, marker.lon);
                          return (
                            <g 
                              key={marker.id}
                              className="cursor-pointer"
                              onClick={() => setSelectedMapNode({ ...marker, isFriendly: false, description: "סימון מפקד ידני שנוסף במהלך תדריך המבצע" })}
                            >
                              <polygon points={`${x},${y-12} ${x+8},${y+4} ${x-8},${y+4}`} className="fill-amber-500 stroke-slate-950 stroke-[1.5]" />
                              <circle cx={x} cy={y+1} r="3" className="fill-slate-950" />
                              <text x={x} y={y + 16} className="fill-amber-400 font-bold font-mono text-4xs" textAnchor="middle">
                                {marker.name}
                              </text>
                            </g>
                          );
                        })}

                        {/* IDF SETTLEMENTS (FRIENDLY MOUNTED MARGINS) */}
                        {FRIENDLY_BASES.map((base, idx) => {
                          const { x, y } = gpsToSvg(base.lat, base.lon);
                          return (
                            <g 
                              key={`friendly-${idx}`} 
                              className="cursor-pointer group"
                              onClick={() => { setSelectedMapNode({ ...base, isFriendly: true }); playSound("beep"); }}
                            >
                              <circle cx={x} cy={y} r="15" className="fill-sky-950/90 stroke-sky-400 stroke-[2] group-hover:fill-sky-900 transition" />
                              <polygon points={`${x},${y-6} ${x+5},${y+4} ${x-5},${y+4}`} className="fill-sky-400" />
                              <circle cx={x} cy={y} r="20" className="fill-none stroke-sky-400/20 stroke-[1] animate-pulse" />
                              
                              <text 
                                x={x} 
                                y={y + 26} 
                                className="fill-sky-300 font-bold font-mono text-3xs filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]" 
                                textAnchor="middle"
                              >
                                {base.name}
                              </text>
                            </g>
                          );
                        })}

                        {/* ENEMY SATELLITE BASES */}
                        {ENEMY_TOWNS.map((town, idx) => {
                          const { x, y } = gpsToSvg(town.lat, town.lon);
                          const isTarget = destination === town.id;
                          return (
                            <g 
                              key={`enemy-${idx}`} 
                              className="cursor-pointer group"
                              onClick={() => { setSelectedMapNode({ ...town, isFriendly: false }); playSound("beep"); }}
                            >
                              <circle 
                                cx={x} 
                                cy={y} 
                                r={isTarget ? "16" : "13"} 
                                className={`transition ${
                                  isTarget 
                                    ? 'fill-red-950/95 stroke-red-500 stroke-[2.5]' 
                                    : 'fill-slate-950/95 stroke-red-900/60 stroke-[1.5] group-hover:stroke-red-500'
                                }`} 
                              />
                              <rect 
                                x={x-4} 
                                y={y-4} 
                                width="8" 
                                height="8" 
                                className={isTarget ? "fill-red-400 animate-pulse" : "fill-red-600"} 
                                transform={`rotate(45 ${x} ${y})`} 
                              />
                              {isTarget && (
                                <circle cx={x} cy={y} r="25" className="fill-none stroke-red-500/40 stroke-[1.5] animate-ping" />
                              )}

                              <text 
                                x={x} 
                                y={y - 20} 
                                className={`font-bold font-mono text-3xs filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] ${
                                  isTarget ? "fill-red-400 font-extrabold" : "fill-slate-400 group-hover:fill-red-300"
                                }`} 
                                textAnchor="middle"
                              >
                                {town.name}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                  )}
                </div>

                {/* Bottom mini-dossier describing active selected node */}
                {selectedMapNode && (
                  <div className="mt-4 p-4 bg-slate-950/90 backdrop-blur-md border border-slate-900 rounded-xl flex items-center justify-between animate-fadeIn text-right">
                    <div className="flex-1">
                      <div className="flex items-center space-x-reverse space-x-2.5">
                        <MapPin className={`h-4 w-4 ${selectedMapNode.isFriendly ? 'text-sky-400' : 'text-red-400'}`} />
                        <span className="font-bold text-xs text-white">{selectedMapNode.name}</span>
                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-md border ${
                          selectedMapNode.isFriendly ? 'bg-sky-950/80 text-sky-400 border-sky-500/20' : 'bg-red-950/80 text-red-400 border-red-500/20'
                        }`}>
                          {selectedMapNode.isFriendly ? 'מוצב ידידותי' : 'אזור איום פעיל'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                        {selectedMapNode.description || selectedMapNode.threat || "אין מידע מודיעיני נוסף לגבי מיקום זה."}
                      </p>
                    </div>
                    <button 
                      onClick={() => setSelectedMapNode(null)}
                      className="p-1.5 text-slate-500 hover:text-white transition rounded-lg hover:bg-slate-900 shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* DYNAMIC COMBAT CONTROL PANEL */}
              <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4 border-b border-slate-900 pb-3">
                  <div className="flex items-center space-x-reverse space-x-2.5">
                    <Terminal className="h-4.5 w-4.5 text-teal-400" />
                    <h3 className="text-xs font-semibold text-white">ניתוח ציר וציר זמן אופרטיבי</h3>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">IDF SECURE TERMINAL</span>
                </div>

                {battlePlan ? (
                  <div className="space-y-5 text-right">
                    {/* Summary */}
                    <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-900">
                      <span className="block text-[10px] font-bold text-teal-400 uppercase tracking-wider mb-1">הערכת קמ״ן כללית:</span>
                      <p className="text-xs text-slate-300 leading-relaxed">{battlePlan.intelSummary}</p>
                    </div>

                    {/* Operational Steps Timeline */}
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">שלבי ביצוע אופרטיביים מומלצים:</span>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                        {battlePlan.operationalSteps.map((step, idx) => (
                          <div key={idx} className="p-3.5 bg-slate-950/40 rounded-xl border border-slate-900 flex items-start space-x-reverse space-x-3">
                            <span className="h-5 w-5 bg-teal-950/80 border border-teal-500/20 text-teal-400 rounded-full flex items-center justify-center font-mono text-[10px] font-bold pt-0.5 shrink-0">
                              {idx + 1}
                            </span>
                            <p className="text-xs text-slate-300 leading-relaxed flex-1">{step}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 text-center py-6 font-sans">טרם חושב ציר אופרטיבי. הזן פקודה חדשה במסך הראשי.</p>
                )}
              </div>

            </div>

            {/* COLUMN 2: MULTI-AGENT BRAIN & SENSOR ACTION LOOPS (5 Cols) */}
            <div className="lg:col-span-5 flex flex-col space-y-6">
              
              {/* INTERACTIVE ALERTS FEED - SENSOR-TO-SHOOTER */}
              <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 shadow-sm flex flex-col h-[280px] text-right">
                <div className="flex items-center justify-between mb-4 border-b border-slate-900 pb-3">
                  <div className="flex items-center space-x-reverse space-x-2.5">
                    <AlertTriangle className="text-red-400 h-4.5 w-4.5" />
                    <h3 className="text-xs font-semibold text-white">התרעות שטח וסגירת מעגלי אש</h3>
                  </div>
                  <span className="text-[9px] bg-red-950/80 text-red-400 border border-red-500/20 px-2.5 py-0.5 rounded-md font-sans font-bold animate-pulse">
                    S2S ACTIVE
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 scrollbar-thin">
                  {alerts.length > 0 ? (
                    alerts.map(alert => {
                      const isResolved = alert.status === "resolved";
                      return (
                        <div 
                          key={alert.id}
                          className={`p-3.5 rounded-xl border transition ${
                            isResolved 
                              ? 'bg-slate-950/10 border-slate-900 opacity-50' 
                              : 'bg-red-950/10 border-red-900/30 shadow-sm'
                          }`}
                        >
                          <div className="flex items-start justify-between space-x-reverse space-x-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-reverse space-x-2">
                                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isResolved ? 'bg-slate-500' : 'bg-red-500 animate-pulse'}`} />
                                <span className={`text-[11px] font-bold leading-normal ${isResolved ? 'text-slate-400 line-through' : 'text-red-300'}`}>
                                  {alert.text}
                                </span>
                              </div>
                              <div className="flex items-center space-x-reverse space-x-2 mt-2 text-[10px] text-slate-500">
                                <span className="bg-slate-950 px-2 py-0.5 rounded-md border border-slate-900 text-slate-400">{alert.source}</span>
                                <span>•</span>
                                <span>{alert.timestamp}</span>
                              </div>
                              
                              {!isResolved && (
                                <div className="mt-2.5 bg-slate-950/60 p-2.5 rounded-lg border border-slate-900/60 leading-relaxed text-right">
                                  <span className="block text-[9px] text-amber-500 font-bold">המלצת פעולה אופרטיבית:</span>
                                  <p className="text-[10px] text-slate-300 mt-0.5 leading-relaxed">{alert.recommendation}</p>
                                </div>
                              )}
                            </div>

                            {/* Trigger shooter lock button */}
                            {!isResolved ? (
                              <div className="flex flex-col space-y-2 items-end shrink-0">
                                <button
                                  onClick={() => {
                                    setIncriminatedAlert(alert);
                                    playSound("beep");
                                  }}
                                  className="px-3 py-1.5 bg-red-500 hover:bg-red-400 text-slate-950 font-bold text-[10px] rounded-lg transition shadow-sm flex items-center space-x-reverse space-x-1.5 cursor-pointer"
                                  title="אימות מטרת הפללה חזותית וחיסול ממוקד"
                                >
                                  <Target className="h-3 w-3" />
                                  <span>סגור מעגל</span>
                                </button>
                                
                                {alert.lat && alert.lon && (
                                  <button
                                    onClick={() => {
                                      setFocusedAlert(alert);
                                      playSound("sonar");
                                      logMessage(`התמקדות במפה על מיקום האיום: ${alert.source}`);
                                    }}
                                    className="px-2.5 py-1 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-white border border-slate-900 rounded-lg text-[9px] flex items-center space-x-reverse space-x-1 cursor-pointer"
                                  >
                                    <MapPin className="h-2.5 w-2.5 text-rose-500" />
                                    <span>התמקד</span>
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-teal-400 font-medium bg-teal-950/20 px-2 py-1 rounded-md border border-teal-500/10">
                                נוטרל
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-500 text-center py-10 font-sans">אין התראות פעילות ברגע זה.</p>
                  )}
                </div>
              </div>

              {/* COGNITIVE BRAIN INGREDIENTS - MULTI-AGENT COLLABORATION */}
              <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 shadow-sm flex-1 flex flex-col min-h-[300px] text-right">
                <div className="flex items-center justify-between mb-4 border-b border-slate-900 pb-3">
                  <div className="flex items-center space-x-reverse space-x-2.5">
                    <Cpu className="text-teal-400 h-4.5 w-4.5" />
                    <h3 className="text-xs font-semibold text-white">רשת סוכני חשיבה (צוות המודיעין)</h3>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">LANGGRAPH HYBRID NET</span>
                </div>

                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                  מערכת DaXa מפעילה אקו-סיסטם של 4 סוכני-על המדמים את שיח החשיבה האנליטי במחלקת המודיעין. לחץ על סוכן לצפייה בתרומתו לתהליך:
                </p>

                {/* Agent Nodes Grid */}
                <div className="grid grid-cols-4 gap-2.5 mb-4">
                  {skills.map(s => {
                    const status = agentStatuses[s.id] || "idle";
                    const isSelected = selectedAgentId === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => { setSelectedAgentId(s.id); playSound("beep"); }}
                        className={`p-3 rounded-xl border transition text-center flex flex-col items-center justify-between h-22 relative cursor-pointer ${
                          isSelected 
                            ? 'bg-teal-950/40 border-teal-500/40 text-teal-100' 
                            : 'bg-slate-950/40 border-slate-900 text-slate-400 hover:border-slate-800 hover:text-white'
                        }`}
                      >
                        {/* Pulse status indicator */}
                        {status === "thinking" && (
                          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                        )}
                        {status === "ready" && (
                          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-teal-500" />
                        )}

                        <span className={`text-[10px] font-mono font-bold block mb-1 uppercase ${isSelected ? 'text-teal-400' : 'text-slate-400'}`}>
                          {s.id}
                        </span>

                        <div className="my-1.5 text-slate-300">
                          {s.id === 'yolo' && <Crosshair className="h-4.5 w-4.5 mx-auto" />}
                          {s.id === 'sam' && <Layers className="h-4.5 w-4.5 mx-auto" />}
                          {s.id === 'whisper' && <Radio className="h-4.5 w-4.5 mx-auto" />}
                          {s.id === 'llama' && <Cpu className="h-4.5 w-4.5 mx-auto" />}
                        </div>

                        <span className="text-[9px] truncate w-full block">
                          {status === "thinking" ? "מחשב..." : status === "ready" ? "פעיל" : "בהמתנה"}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Agent Output Panel */}
                <div className="flex-1 bg-slate-950/60 p-4 rounded-xl border border-slate-900 flex flex-col justify-between">
                  {selectedAgentId && (
                    <>
                      <div className="mb-3 text-right">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-white">
                            {skills.find(s => s.id === selectedAgentId)?.name}
                          </span>
                          <span className="text-[9px] text-teal-400 font-medium bg-teal-950/40 px-2 py-0.5 rounded-md border border-teal-500/10">
                            סוכן פעיל ברשת
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          {skills.find(s => s.id === selectedAgentId)?.description}
                        </p>
                      </div>

                      {/* Thoughts projection block */}
                      <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-900/60 text-right leading-relaxed text-xs">
                        <span className="block text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-1.5">יומן חשיבה פנימי (Thought Process):</span>
                        <div className="space-y-1.5 text-slate-300">
                          {selectedAgentId === "yolo" && (
                            <>
                              <div>• סורק זרמי צילום מרחפני סיור בגובה 400 רגל.</div>
                              <div>• זיהוי עצמים: זוהתה התאמה של 94% למשגר רקטות מוסתר ברשת הסוואה.</div>
                              <div>• מפיק קואורדינטות טקטיות ומעביר לסגירת מעגל.</div>
                            </>
                          )}
                          {selectedAgentId === "sam" && (
                            <>
                              <div>• מבצע פילוח שינויי שטח (Zero-Shot Segmentation).</div>
                              <div>• מזהה ערימת עפר חדשה סמוך למסגד (חשד כבד לחפירת פיר מנהרה טקטי).</div>
                              <div>• קו מתאר השתנה ב-2.4 מטרים ביחס לצילום בוקר.</div>
                            </>
                          )}
                          {selectedAgentId === "whisper" && (
                            <>
                              <div>• מאזין לערוץ תקשורת אנלוגי מוגבר 16.</div>
                              <div>• זיהוי קולות אויב: בוצע תמלול ומיצוי ישויות (NER).</div>
                              <div>• מילים שנשלפו: "מארב", "טילי נט", "רכס דרומי".</div>
                            </>
                          )}
                          {selectedAgentId === "llama" && (
                            <>
                              <div>• מתכלל (Orchestrator): מקבל את הנתונים משאר הבוטים.</div>
                              <div>• בונה המלצה סופית מותאמת למפקד הגדוד: הימנעות ממעבר הואדי המזרחי.</div>
                              <div>• יצירת טיוטת פקודה מבוססת RAG ומפות GIS.</div>
                            </>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* MILITARY HARDWARE TELEMETRY CONSOLE */}
              <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-4 shadow-sm text-right">
                <div className="flex items-center space-x-reverse space-x-2 mb-2.5 text-xs text-teal-400">
                  <Terminal className="h-4 w-4" />
                  <span className="font-semibold">יומן פעילות מודיעיני (פלט חי)</span>
                </div>
                <div className="h-28 bg-slate-950/80 rounded-xl border border-slate-900 p-3 overflow-y-auto space-y-1 text-right text-[10px] leading-relaxed scrollbar-thin">
                  {logs.map((log, idx) => (
                    <div key={idx} className="flex items-start space-x-reverse space-x-2">
                      <span className="text-teal-600 font-mono">❯</span>
                      <span className="text-slate-300 font-sans">{log}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* COMBAT SHOOTER LOCKING MODAL ACTION FEEDBACK */}
      <AnimatePresence>
        {incriminatedAlert && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-50 flex items-center justify-center p-4"
            id="modal-incrimination"
          >
            <div className="max-w-xl w-full bg-slate-900 border border-teal-500/40 rounded-xl p-5 shadow-2xl shadow-teal-500/10 relative overflow-hidden">
              {/* Telemetry decoration */}
              <div className="absolute top-2 right-4 text-[9px] font-mono text-slate-500 flex space-x-reverse space-x-2">
                <span>DRONE_FEED_SAM_4</span>
                <span>•</span>
                <span>ALT: 1240FT</span>
              </div>

              <div className="border-b border-slate-800 pb-3 mb-4 text-right">
                <div className="flex items-center space-x-reverse space-x-2">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                  <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">סרטון הפללה ואימות מטרה טקטי</h3>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">מערכת DaXa מאמתת חתימה חזותית ותרמית למניעת פגיעה בחפים מפשע.</p>
              </div>

              {/* Simulated Thermal / Drone Camera Screen */}
              <div className="relative aspect-video bg-black rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center select-none group">
                {/* Thermal video simulation grid */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,24,38,0)_95%,rgba(16,185,129,0.15)_95%)] bg-[length:100%_24px] animate-scanline pointer-events-none" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.6)_100%)] pointer-events-none" />
                <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(rgba(255,255,255,0.15)_1px,transparent_1px)] bg-[length:8px_8px] pointer-events-none" />

                {/* Simulated Thermal Crosshair */}
                <div className="absolute h-24 w-24 border border-dashed border-teal-500/40 rounded-full animate-spin pointer-events-none" />
                <div className="absolute h-3 w-3 border border-red-500 rounded-full animate-ping pointer-events-none" />
                <div className="absolute h-10 w-10 pointer-events-none flex items-center justify-center">
                  <div className="w-8 h-px bg-teal-400 opacity-60" />
                  <div className="h-8 w-px bg-teal-400 opacity-60 absolute" />
                </div>

                {/* Target tracking green box */}
                <motion.div 
                  className="absolute border-2 border-emerald-400 h-16 w-16 flex flex-col justify-between p-1"
                  animate={{
                    x: [0, 8, -5, 0],
                    y: [0, -6, 4, 0]
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 4,
                    ease: "easeInOut"
                  }}
                >
                  <div className="flex justify-between">
                    <div className="w-1.5 h-1.5 border-t border-r border-emerald-400" />
                    <div className="w-1.5 h-1.5 border-t border-l border-emerald-400" />
                  </div>
                  <div className="text-[8px] font-mono font-bold text-emerald-400 text-center uppercase tracking-widest animate-pulse">
                    [ LOCK ]
                  </div>
                  <div className="flex justify-between">
                    <div className="w-1.5 h-1.5 border-b border-r border-emerald-400" />
                    <div className="w-1.5 h-1.5 border-b border-l border-emerald-400" />
                  </div>
                </motion.div>

                {/* Thermal imagery simulated background using gradients and shapes */}
                <div className="absolute inset-0 -z-10 bg-slate-950 flex items-center justify-center">
                  <div className="w-48 h-32 rounded-lg bg-emerald-950/45 blur-2xl animate-pulse" />
                  <div className="w-24 h-16 rounded-full bg-teal-900/40 blur-xl absolute" />
                  <div className="w-10 h-10 rounded-full bg-red-600/30 blur-md absolute" />
                </div>

                {/* Infrared UI overlays */}
                <div className="absolute top-4 left-4 font-mono text-[9px] text-emerald-400 space-y-0.5 text-left">
                  <div>CAM: IR_THERMAL</div>
                  <div>ZOOM: 12.0X Opt</div>
                  <div>FPS: 29.97</div>
                </div>

                <div className="absolute top-4 right-4 font-mono text-[9px] text-emerald-400 text-right space-y-0.5">
                  <div>LAT: {incriminatedAlert.lat?.toFixed(5) || "33.1052"}</div>
                  <div>LON: {incriminatedAlert.lon?.toFixed(5) || "35.4241"}</div>
                  <div>AZ: 184.2°</div>
                </div>

                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between font-mono text-[10px]">
                  <div className="text-emerald-400 flex items-center space-x-reverse space-x-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>REC ● 00:14:28</span>
                  </div>
                  <div className="px-1.5 py-0.5 bg-red-600 text-slate-950 font-bold text-[9px] rounded animate-pulse">
                    TARGET FLAGGED
                  </div>
                </div>
              </div>

              {/* Incrimination Data Dossier */}
              <div className="my-4 p-4 bg-slate-950 border border-slate-850 rounded-lg text-right space-y-2.5">
                <div className="text-xs font-bold text-teal-400 flex items-center space-x-reverse space-x-1.5">
                  <Eye className="h-4 w-4" />
                  <span>ניתוח ראיות והפללה של מנוע DaXa AI:</span>
                </div>
                <div className="text-[11px] text-slate-300 leading-relaxed space-y-1">
                  <p>• <b>ממצא עיקרי:</b> חתימה חמה תואמת לחוליית מחבלים קדמית הפועלת מתוך שטח בנוי.</p>
                  <p>• <b>חוסר מעורבות חפים מפשע:</b> סוכן SAM Meta מאשר כי לא זוהו אזרחים או בלתי-מעורבים בטווח בטיחות של 120 מטרים ממוקד הפגיעה המבוקש.</p>
                  <p>• <b>אישור הפללה:</b> חולץ חומר וידאו מרחפן איסוף המראה באופן חד-משמעי הימצאות משגרי נ"ט/רקטות מוכנים לפעולה.</p>
                </div>
                <div className="border-t border-slate-900 pt-2 text-[10px] text-amber-500 font-mono flex items-center justify-between">
                  <span>רמת ודאות: 98.4% (מבוסס סנכרון רשת סוכנים)</span>
                  <span className="font-bold">מטרת פגיעה: {incriminatedAlert.source}</span>
                </div>
              </div>

              {/* Buttons and triggers */}
              <div className="flex space-x-reverse space-x-2.5 justify-end">
                <button
                  onClick={() => setIncriminatedAlert(null)}
                  className="px-4 py-2 border border-slate-800 hover:bg-slate-950 hover:border-slate-700 text-slate-300 text-xs font-bold rounded-lg transition cursor-pointer"
                >
                  נצור נשק (בטל תקיפה)
                </button>
                <button
                  onClick={() => {
                    const alertToFire = incriminatedAlert;
                    setIncriminatedAlert(null);
                    triggerFireLoop(alertToFire);
                  }}
                  className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-slate-950 font-extrabold text-xs rounded-lg transition shadow-lg shadow-red-500/20 flex items-center space-x-reverse space-x-2 cursor-pointer"
                >
                  <Target className="h-4 w-4" />
                  <span>אשר הפללה וחסל מטרה</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {firingSequenceAlert && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-50 flex items-center justify-center p-4"
            id="modal-firing-loop"
          >
            <div className="max-w-md w-full bg-slate-900 border-2 border-red-500 rounded-xl p-6 shadow-2xl shadow-red-500/20 text-center relative overflow-hidden">
              {/* Radar locking graphics */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.05),transparent)] pointer-events-none" />
              
              <div className="relative z-10 space-y-5">
                <div className="mx-auto h-20 w-20 rounded-full border-2 border-dashed border-red-500 flex items-center justify-center animate-spin">
                  <Crosshair className="h-10 w-10 text-red-500 animate-pulse" />
                </div>

                <div>
                  <span className="text-xs font-mono font-bold text-red-500 tracking-widest uppercase block mb-1">מעגל אש טקטי מהיר - SENSOR-TO-SHOOTER</span>
                  <h3 className="text-xl font-bold text-white font-mono">סגירת מעגל אש אוטומטית</h3>
                  
                  <p className="text-xs text-slate-400 mt-1 font-mono">
                    {firingStatus === "locking" && "מחשב פתרון ירי צלב והנחייה..."}
                    {firingStatus === "launching" && "הפעלת ארטילריה מדויקת (סוללת מורן)"}
                    {firingStatus === "impact" && "סריקה שלאחר פגיעה (BDA) ע\"י YOLOv11"}
                    {firingStatus === "success" && "האיום נוטרל בהצלחה. כוחותינו ממשיכים בתנועה."}
                  </p>
                </div>

                {/* Progress Visualizer Bar */}
                <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden relative">
                  <motion.div 
                    className="h-full bg-red-500"
                    initial={{ width: "0%" }}
                    animate={{ 
                      width: 
                        firingStatus === "locking" ? "30%" : 
                        firingStatus === "launching" ? "65%" : 
                        firingStatus === "impact" ? "85%" : "100%" 
                    }}
                    transition={{ duration: 1.5 }}
                  />
                </div>

                <div className="p-3.5 bg-slate-950 rounded border border-slate-800 text-right">
                  <div className="text-xs text-slate-200 font-bold mb-1">{firingSequenceAlert.text}</div>
                  <div className="text-3xs text-red-400 flex items-center space-x-reverse space-x-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span>נ\"צ סנסור: {firingSequenceAlert.source}</span>
                  </div>
                </div>

                <div className="text-4xs font-mono text-slate-500">
                  סמכות אישור: חפ"ק מפקד DaXa • מיושם תחת בידוד ארגז חול טקטי
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
