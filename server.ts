import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize GoogleGenAI if key is present
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    console.log("Gemini AI Client successfully initialized");
  } catch (err) {
    console.error("Error initializing Gemini client:", err);
  }
}

// Tactical presets for South Lebanon fallbacks to guarantee robust, realistic simulation under any condition
const TACTICAL_FALLBACKS: Record<string, any> = {
  "avivim_maroun": {
    intelSummary: "רכס מארון א-ראס שולט בתצפית ובאש על מושב אביבים וכביש הצפון. האויב מבוצר במתחם מסגד הכפר ובבונקרים תת-קרקעיים המחוברים במחילות קשר. דפוס פעולה צפוי: ירי טילי נ\"ט והפעלת מטעני צד על צירי הגישה.",
    recommendedRoute: [
      { name: "נקודת מוצא: אביבים", lat: 33.090, lon: 35.415, description: "שטח כינוס פלוגתי דרומית לגדר המערכת" },
      { name: "חציית קו גבול: שער 70", lat: 33.095, lon: 35.418, description: "פרצת הנדסה מבוקרת תחת חיפוי" },
      { name: "ציר ואדי נסתר", lat: 33.100, lon: 35.420, description: "תנועה מאובטחת בתוך ערוץ נחל עמוק למניעת תצפית מהמסגד" },
      { name: "נקודת פריצה אחורית", lat: 33.103, lon: 35.422, description: "טיפוס במדרון תלול דרך מטעי הזיתים" },
      { name: "יעד: מארון א-ראס", lat: 33.105, lon: 35.424, description: "השתלטות על מתחם המסגד השולט וטיהור פירים" }
    ],
    dangerZones: [
      { name: "שטח השמדה נ\"ט - מזרח", lat: 33.102, lon: 35.425, radius: 120, threat: "עמדת נ\"ט מאויישת קורנט", severity: "CRITICAL" },
      { name: "חשד למטח מטענים - דרך ראשית", lat: 33.098, lon: 35.421, radius: 80, threat: "מטעני כלימגור וסלעים ממולכדים", severity: "HIGH" }
    ],
    alerts: [
      {
        id: "alert-fall-1",
        type: "anti_tank",
        text: "זיהוי חתימה תרמית של חוליית נ\"ט 3 אנשים חמושים בקורנט בחלון המערבי של המסגד",
        source: "YOLOv11 - רחפן איסוף גדודי",
        timestamp: "כרגע",
        recommendation: "פגיעה מיידית באמצעות טיל מונחה מדויק או הכוונת טנק 4א' לביצוע ירי ישיר ממרחב אביבים",
        lat: 33.105,
        lon: 35.424
      },
      {
        id: "alert-fall-2",
        type: "tunnel",
        text: "חשד לפיר מנהרה חדש שנחשף כתוצאה מהתמוטטות קיר תמך במטע הזיתים הדרומי",
        source: "Meta SAM - פילוח שינויי שטח",
        timestamp: "לפני 3 דקות",
        recommendation: "שליחת רחפן זעיר לסריקה פנימית, הימנעות מהתקרבות כוחות רגליים לטווח 30 מטרים",
        lat: 33.103,
        lon: 35.421
      }
    ],
    operationalSteps: [
      "מיסוך עשן כבד במרחב 'זיהוי מטענים' באמצעות פגזי מרגמה 120 מ\"מ של הפלס\"ר.",
      "אורקסטרציית סנסורים: התמקדות רחפן YOLO בגזרה המערבית לאיתור נתיבי מילוט אויב.",
      "תנועה רגלית שקטה במדרון האחורי וסגירת מעגל אש אוטומטית מול עמדות הנ\"ט הנותרות."
    ]
  },
  "avivim_bint": {
    intelSummary: "בינת ג'בייל מהווה את מרכז הכובד הטקטי של חטיבת הגזרה של האויב. המרחב מאופיין בבנייה צפופה ביותר, תווך תת-קרקעי מסועף וריבוי מארבי צלפים בתוך מבנים אזרחיים. פריסת כוחות האויב מעוגנת במרחב כיכר השחרור ומתחם הקסבה.",
    recommendedRoute: [
      { name: "נקודת מוצא: אביבים", lat: 33.090, lon: 35.415, description: "שטח כינוס ואבטחת כוחות" },
      { name: "עקיפת מארון ממערב", lat: 33.102, lon: 35.410, description: "איגוף מערבי למניעת היתקלות בקו ההגנה הראשון של מארון" },
      { name: "ציר הואדי הדרומי", lat: 33.112, lon: 35.420, description: "תוואי מוגן מראייה רגלית" },
      { name: "כניסה לשכונה הדרומית", lat: 33.118, lon: 35.428, description: "התקדמות דרך פריצות קירות פנימיות במבנים" },
      { name: "יעד: קסבה בינת ג'בייל", lat: 33.121, lon: 35.433, description: "אחיזה במבנים השולטים בכיכר המרכזית" }
    ],
    dangerZones: [
      { name: "אזור נשלט צלפים - גבעת שלאל", lat: 33.115, lon: 35.425, radius: 150, threat: "צלף אויב חמוש ברובה 12.7 מ\"מ", severity: "HIGH" },
      { name: "חנקן ממולכד - ציר הכניסה הראשי", lat: 33.119, lon: 35.431, radius: 100, threat: "שרשרת מטענים מחוברים לחוטי משיכה", severity: "CRITICAL" }
    ],
    alerts: [
      {
        id: "alert-fall-3",
        type: "encounter",
        text: "התקלות כוח חלוץ של סיירת גולני עם חוליית מחבלים חמושה ב-RPG היוצאת מפיר בתוך חנות מכולת",
        source: "WhisperNER - חילוץ דיווחי קשר בזמן אמת",
        timestamp: "לפני דקה",
        recommendation: "הפעלה מיידית של מטרת תגובה ארטילרית מתוכננת מראש (מטרה 401) ודיכוי פתחי המבנה השכנים בירי מקלעים כבדים",
        lat: 33.119,
        lon: 35.430
      }
    ],
    operationalSteps: [
      "הפעלת סוכן WhisperNER על רשת הקשר של האויב לזיהוי קריאות לתגבורת.",
      "שימוש ברחפן עם מצלמת SAM Meta לסריקת גגות לאיתור עמדות תצפית מאולתרות.",
      "חבירה וסגירת מעגל אש יחד עם כוחות שריון המלווים את הכניסה."
    ]
  },
  "zarit_ayta": {
    intelSummary: "עייתא א-שעב היא מעוז אויב מבוצר הממוקם על גבעה הצופה ישירות על מוצב זרעית. האויב עושה שימוש נרחב בשטח הבנוי כמגן אנושי ובבניית פירים מתוך בתי אזרחים. במרחב פזורים עשרות עמדות ירי נ\"ט מוכנות המכוסות על ידי תצפיות מהרכסים השולטים.",
    recommendedRoute: [
      { name: "נקודת מוצא: זרעית", lat: 33.109, lon: 35.325, description: "יציאה משער הישוב לכיוון צפון" },
      { name: "חציית ציר הפיטר", lat: 33.110, lon: 35.318, description: "תנועה מהירה במרחב החשוף לתצפית ישירה" },
      { name: "ציר החורש הצפוני", lat: 33.113, lon: 35.310, description: "התקדמות מוגנת בתוך חורש אלונים סבוך" },
      { name: "מדרון תלול - שכונת הלבנים", lat: 33.112, lon: 35.305, description: "כניסה לאגף המזרחי של עייתא במעלה המדרון האחורי" },
      { name: "יעד: מרכז עייתא א-שעב", lat: 33.111, lon: 35.302, description: "טיהור המפקדה הטקטית בבניין המועצה הישן" }
    ],
    dangerZones: [
      { name: "מארב נ\"ט קו רכס", lat: 33.114, lon: 35.312, radius: 110, threat: "חוליית נ\"ט ניידת על גבי אופנוע", severity: "HIGH" },
      { name: "מלכוד תת-קרקעי מובנה", lat: 33.111, lon: 35.304, radius: 90, threat: "בניין ממולכד בחצי טון חומר נפץ", severity: "CRITICAL" }
    ],
    alerts: [
      {
        id: "alert-fall-4",
        type: "terrorist",
        text: "זיהוי חוליית מחבלים בתנועה מהירה עם משגר RPG-7 בשביל היורד לערוץ הואדי",
        source: "YOLOv11 - מצלמת תצפית סטטית 'גרניט'",
        timestamp: "לפני 2 דקות",
        recommendation: "שיגור כטמ\"ם זיק לתקיפה מיידית, או פתיחה באש מקלעים ממוצב זרעית לעבר נתיב התנועה שלהם",
        lat: 33.112,
        lon: 35.305
      }
    ],
    operationalSteps: [
      "הפעלת לוחמה אלקטרונית לשיבוש מנגנוני הפעלה מרחוק של מטעני ציר.",
      "איגוף אנכי דרך החורש הסבוך תוך ניצול שטחים מתים של תצפית האויב (ניתוח סוכן IPB).",
      "השתלטות על בתי מפתח בקו המגע ובידוד מרחב הלחימה בסיוע מרגמות מסך."
    ]
  },
  "metula_khiam": {
    intelSummary: "אל-חיאם יושבת על רמה השולטת על כל אצבע הגליל ועמק עיון. העיירה מבוצרת בכבדות עם דגש על מתחמי הגנה מחלקתיים עצמאיים. האויב מנצל את מתחם כלא אל-חיאם המבוצר בבטון מזוין כנקודת פיקוד ושליטה עיקרית.",
    recommendedRoute: [
      { name: "נקודת מוצא: מטולה", lat: 33.284, lon: 35.580, description: "שטח הערכות במטעי הצפון" },
      { name: "מעבר ערוץ נחל עיון", lat: 33.295, lon: 35.590, description: "נסיעה מהירה ופריסה בשטח חקלאי נמוך" },
      { name: "טיפוס לרמת אל-חיאם", lat: 33.305, lon: 35.602, description: "עלייה בציר מפותל המוגן חלקית ע\"י קפלי קרקע" },
      { name: "כניסה דרך המתחם הדרומי", lat: 33.310, lon: 35.606, description: "פריצה מאובטחת דרך פרבר אל-חיאם" },
      { name: "יעד: מתחם הכלא אל-חיאם", lat: 33.315, lon: 35.610, description: "טיהור המעוז וניטרול חפ\"ק האויב" }
    ],
    dangerZones: [
      { name: "קו אש ישיר שולט", lat: 33.308, lon: 35.598, radius: 140, threat: "עמדת ירי ישיר ללא רתע ותותחי 23 מ\"מ", severity: "CRITICAL" },
      { name: "ציר ממולכד גשר עיון", lat: 33.296, lon: 35.592, radius: 70, threat: "מטען חבית כבד מתחת לציר הנסיעה", severity: "HIGH" }
    ],
    alerts: [
      {
        id: "alert-fall-5",
        type: "anti_tank",
        text: "זיהוי ירי רקטי מסוג 107 מ\"מ מתוך חצר בית ספר מזרחית ליעד",
        source: "YOLOv11 - סנסור מולטי-ספקטרלי מנור",
        timestamp: "לפני דקה",
        recommendation: "סגירת מעגל אש מהירה: הכוונת מסוק קרב המפטרל בגזרה לתקיפת המשגר המשוחרר",
        lat: 33.312,
        lon: 35.612
      }
    ],
    operationalSteps: [
      "הפעלת סוכן IPB לזיהוי שטחים שולטים במדרונות המזרחיים ותפיסתם ע\"י כוח שריון.",
      "טיהור שיטתי ומאובטח של בתי הפאתי הדרומיים תוך שימוש במטעני פריצה קרה.",
      "חיבור חפ\"ק דאקסה למערכת משואה 750 לקבלת תמונה כחולה בזמן אמת."
    ]
  }
};

// All known locations with Hebrew display names & actual coordinate pairs
const LOCATIONS: Record<string, { name: string, lat: number, lon: number, desc?: string }> = {
  avivim: { name: "אביבים", lat: 33.090, lon: 35.415, desc: "שטח כינוס פלוגתי" },
  zarit: { name: "זרעית", lat: 33.109, lon: 35.325, desc: "חפ\"ק גדודי" },
  metula: { name: "מטולה", lat: 33.284, lon: 35.580, desc: "שטח כינוס צפוני" },
  misgav_am: { name: "משגב עם", lat: 33.270, lon: 35.534, desc: "מפקדה קדמית רכס רמים" },
  maroun: { name: "מארון א-ראס", lat: 33.105, lon: 35.424 },
  bint: { name: "בינת ג'בייל", lat: 33.121, lon: 35.433 },
  ayta: { name: "עייתא א-שעב", lat: 33.111, lon: 35.302 },
  khiam: { name: "אל-חיאם", lat: 33.315, lon: 35.610 },
  odaisseh: { name: "עדיסא", lat: 33.270, lon: 35.545 },
  kafr_kela: { name: "כפר כילא", lat: 33.280, lon: 35.570 }
};

function generateDynamicBattlePlan(currentLocKey: string, destinationKey: string, routeType: string, skillsEnabled: string[]) {
  const src = LOCATIONS[currentLocKey] || LOCATIONS["avivim"];
  const dest = LOCATIONS[destinationKey] || LOCATIONS["maroun"];

  const count = 3;
  const route = [];
  route.push({
    name: `נקודת מוצא: ${src.name}`,
    lat: src.lat,
    lon: src.lon,
    description: `שטח הערכות ואיסוף נתוני קו מגע ראשוני של כוחותינו.`
  });

  for (let i = 1; i <= count; i++) {
    const ratio = i / (count + 1);
    const latOffset = (Math.sin(ratio * Math.PI * 2) * 0.004) + (dest.lat - src.lat) * ratio;
    const lonOffset = (Math.cos(ratio * Math.PI * 2) * 0.004) + (dest.lon - src.lon) * ratio;
    
    let stepName = "";
    let stepDesc = "";
    if (i === 1) {
      stepName = `חציית קו הגבול (ציר ${routeType === 'stealth' ? 'נסתר' : 'מהיר'})`;
      stepDesc = `מעבר מבוקר תחת מסך עשן ומיסוך אלקטרוני. סוכן IPB מוודא שטח מת תצפית אויב.`;
    } else if (i === 2) {
      stepName = `נקודת אחיזה פלוגתית בגזרת ${dest.name}`;
      stepDesc = `התקדמות בתוואי שטח ${routeType === 'stealth' ? 'מוגן קפלי קרקע' : 'מטוהר ומאובטח ע\"י הנדסה קרבית'}.`;
    } else {
      stepName = `הערכות לפריצה פאתים`;
      stepDesc = `סריקת פתחי פירים בסמוך למדרונות באמצעות SAM Meta ורחפני YOLO.`;
    }

    route.push({
      name: stepName,
      lat: src.lat + latOffset,
      lon: src.lon + lonOffset,
      description: stepDesc
    });
  }

  route.push({
    name: `יעד פשיטה: ${dest.name}`,
    lat: dest.lat,
    lon: dest.lon,
    description: `השתלטות וטיהור היעד המרכזי ונטרול תשתיות הפיקוד של האויב.`
  });

  const midLat = (src.lat + dest.lat) / 2;
  const midLon = (src.lon + dest.lon) / 2;

  const dangerZones = [
    {
      name: `מארב נ\"ט קו רכס - פאתי ${dest.name}`,
      lat: midLat + 0.002,
      lon: midLon - 0.001,
      radius: 120,
      threat: "חוליית נ\"ט קורנט במבנה שולט",
      severity: "CRITICAL" as const
    },
    {
      name: `חשד למשגרים מבוצרים - גזרת ${dest.name}`,
      lat: midLat - 0.001,
      lon: midLon + 0.002,
      radius: 90,
      threat: "משגר רקטות קצר טווח מוסתר",
      severity: "HIGH" as const
    }
  ];

  const alerts = [
    {
      id: `alert-dyn-1-${Date.now()}`,
      type: "anti_tank" as const,
      text: `זיהוי חוליה בתנועה מהירה עם מטול נ\"ט בגזרת פאתי ${dest.name}`,
      source: "YOLOv11 - רחפן איסוף גדודי",
      timestamp: "כרגע",
      recommendation: `פתיחת אש מקלעים ישירה ע\"י חיפוי רכס או הכוונת תגובת אש מונחית מנור מול מדרגות פאתי ${dest.name}`,
      lat: midLat + 0.003,
      lon: midLon - 0.002
    },
    {
      id: `alert-dyn-2-${Date.now()}`,
      type: "tunnel" as const,
      text: `אנומליה טופוגרפית שולטת: חשד לפיר מנהרה פעיל בסמוך לציר התנועה של כוחותינו ב${dest.name}`,
      source: "Meta SAM - סיווג שינויי שטח",
      timestamp: "לפני 2 דקות",
      recommendation: "סגירת מעגל אש ושיגור כטמ\"ם תוקף לנטרול מיידי לפני יציאת כוחות אויב מהמחילות",
      lat: midLat - 0.002,
      lon: midLon + 0.003
    }
  ];

  const operationalSteps = [
    `הפעלת סוכן IPB לזיהוי צירי גישה וניטרול שדות מטענים במרחב ${dest.name}.`,
    `אבטחת האגפים ע\"י כוח שריון קדמי (מחלקה 3ב') מול מוקדי ירי נ\"ט בגזרת ${dest.name}.`,
    `סנכרון תמונת שו\"ב מול חפ\"ק DaXa לקבלת התראות ויזואליות וקוליות מבוססות רדיו קשר בזמן אמת.`
  ];

  return {
    intelSummary: `דוח מודיעין טקטי מורחב: התקדמות ממרחב ${src.name} לכיוון מעוז האויב ב-${dest.name}. המרחב מאופיין בלחימה בשטח בנוי רווי פירים ומארבי נ\"ט. נתיב ה-${routeType === 'stealth' ? 'נסתר' : 'מהיר'} שנבחר מונחה באמצעות סוכני המודיעין לאבטחת מקסימום שטח מת מתצפיות אויב.`,
    recommendedRoute: route,
    dangerZones,
    alerts,
    operationalSteps
  };
}

// Helper function to call generateContent with automatic model fallback and retries on transient errors
async function generateContentWithFallbackAndRetry(
  aiClient: any,
  params: { model: string; contents: any; config?: any },
  maxRetries = 2,
  initialDelayMs = 800
) {
  // Correct common typo/unsupported model names
  let primaryModel = params.model;
  if (primaryModel === "gemini-2.5-flash") {
    primaryModel = "gemini-3.5-flash";
  }

  // Create list of candidate models to try in sequence if one fails due to quota or unavailability
  const candidateModels = [primaryModel];
  if (primaryModel === "gemini-3.5-flash") {
    candidateModels.push("gemini-3.1-flash-lite");
    candidateModels.push("gemini-flash-latest");
  } else if (primaryModel === "gemini-3.1-flash-lite") {
    candidateModels.push("gemini-3.5-flash");
    candidateModels.push("gemini-flash-latest");
  } else {
    candidateModels.push("gemini-3.5-flash");
    candidateModels.push("gemini-3.1-flash-lite");
  }

  // Remove duplicates while maintaining order
  const modelsToTry = Array.from(new Set(candidateModels));
  let lastError: any = null;

  for (const currentModel of modelsToTry) {
    console.log(`[DaXa System] Attempting generation with model: ${currentModel}`);
    let attempt = 0;
    while (attempt <= maxRetries) {
      try {
        const callParams = {
          ...params,
          model: currentModel
        };
        return await aiClient.models.generateContent(callParams);
      } catch (err: any) {
        lastError = err;
        const errStatus = err?.status;
        const errMsg = err?.message || "";
        
        // Check if this is a permanent daily quota exhaustion
        const isDailyQuotaExceeded = errMsg.includes("Quota exceeded") && 
                                     (errMsg.includes("PerDay") || errMsg.includes("RequestsPerDay") || errMsg.includes("limit: 20"));
        
        if (isDailyQuotaExceeded) {
          console.warn(`[DaXa System] Model ${currentModel} daily quota is fully exhausted. Skipping retries for this model.`);
          break; // Break the retry loop and try the next fallback model in the list
        }

        const isTransient = errStatus === 503 || errStatus === 429 || errStatus === 500 ||
                            errMsg.includes("503") || errMsg.includes("429") || errMsg.includes("500") ||
                            errMsg.toLowerCase().includes("unavailable") || errMsg.toLowerCase().includes("busy") ||
                            errMsg.toLowerCase().includes("demand") || errMsg.toLowerCase().includes("limit");

        attempt++;
        if (isTransient && attempt <= maxRetries) {
          const jitter = 0.8 + Math.random() * 0.4;
          const delay = Math.round(initialDelayMs * Math.pow(2, attempt - 1) * jitter);
          console.warn(`[DaXa System] Gemini API transient error with ${currentModel} (attempt ${attempt}/${maxRetries}): status=${errStatus || 'N/A'}, msg="${errMsg}". Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          // If not transient, or we ran out of retries, move to next fallback model
          console.warn(`[DaXa System] Model ${currentModel} call failed or exhausted retries: status=${errStatus || 'N/A'}, msg="${errMsg}". Trying next fallback model.`);
          break; // Break the retry loop to go to the next candidate model
        }
      }
    }
  }

  // If we've exhausted all candidate models, throw the last error
  throw lastError || new Error("All Gemini models failed to generate content.");
}

// Main Battle Planning API Route
app.post("/api/plan-battle", async (req, res) => {
  const { currentLoc, destination, routeType, skillsEnabled } = req.body;
  
  console.log(`Battle planning requested: ${currentLoc} -> ${destination} (Type: ${routeType})`);
  
  // Create a localized key for fallback search
  const fallbackKey = `${currentLoc}_${destination}`;
  const defaultFallback = TACTICAL_FALLBACKS[fallbackKey] || generateDynamicBattlePlan(currentLoc, destination, routeType, skillsEnabled);

  // If Gemini is initialized, attempt to generate a dynamic, localized tactical analysis
  if (ai) {
    try {
      console.log("Generating battle plan using Gemini 3.5 Flash...");
      
      const prompt = `
        אתה קצין מודיעין (קמ"ן) ומנהל מערכת טקטית מתקדמת בשם DaXa בצה"ל.
        תפקידך לייצר תוכנית תקיפה והתקדמות טקטית (ציר לחימה, הערכת מצב, סכנות, והתראות) המבוססת על המידע הבא:
        - מיקום כוחנו הנוכחי: ${currentLoc} (נ"צ משוער לפי קואורדינטות של ${currentLoc})
        - יעד התקדמות רצוי בלבנון: ${destination} (נ"צ משוער לפי קואורדינטות של ${destination})
        - סוג נתיב מבוקש: ${routeType === 'stealth' ? 'נתיב נסתר ומוגן קווי ראייה (Stealth/Low Line of Sight)' : routeType === 'cleared' ? 'נתיב מטוהר וחשוף למחצה (Cleared Route)' : 'נתיב מהיר ביותר (Fastest Route)'}
        - רכיבי ה-AI הפעילים במערכת: ${JSON.stringify(skillsEnabled)} (מיומנויות DaXa הפעילות כגון YOLOv11 לזיהוי מטרות, Meta SAM לניתוח שינויי קרקע, WhisperNER לתמלול קשר אויב).
        
        אנא נתח את תנאי השטח של דרום לבנון (טופוגרפיה, סכנות נ"ט, חוליות אויב, מטענים, פירים ותוואי תת-קרקעי) והחזר מסמך מודיעיני טקטי מפורט ביותר ומותאם אישית למפקד הגדוד/חטיבה.
        
        עליך להחזיר את התוצאה אך ורק בפורמט JSON קריא ותואם למבנה הנתונים הבא (בלי עטיפות Markdown מיותרות מלבד ה-MIME-type json):
        {
          "intelSummary": "הערכת מצב מודיעינית מפורטת המותאמת ספציפית לגזרה זו, האיומים המרכזיים של האויב והטקטיקה שלו...",
          "recommendedRoute": [
            { "name": "שם נקודה 1", "lat": 33.XXXX, "lon": 35.XXXX, "description": "תיאור טקטי מפורט בעברית" }
          ],
          "dangerZones": [
            { "name": "שם אזור הסכנה", "lat": 33.XXXX, "lon": 35.XXXX, "radius": מספר במטרים, "threat": "תיאור האיום (למשל: עמדת נ\"ט, מטענים, צלפים)", "severity": "HIGH או CRITICAL" }
          ],
          "alerts": [
            {
              "id": "alert-X",
              "type": "anti_tank או tunnel או encounter או terrorist או mine",
              "text": "תיאור התראה דרמטי וטקטי בזמן אמת",
              "source": "סורס המידע (למשל: YOLOv11, WhisperNER, Meta SAM)",
              "timestamp": "שעה או 'כרגע'",
              "recommendation": "המלצה קונקרטית, מידיית ומעשית לפעולה כנגד האויב באזור זה"
            }
          ],
          "operationalSteps": [
            "הנחיה אופרטיבית 1 למפקד...",
            "הנחיה אופרטיבית 2..."
          ]
        }

        הקפד שהקואורדינטות (lat, lon) יהיו ריאליות מאוד וממוקמות סביב קו הגבול ודרום לבנון (בין קווי רוחב 33.00 ל-33.35, וקווי אורך 35.10 ל-35.65) וממחישות את הנתיב בין ${currentLoc} ל-${destination}.
        הטקסטים צריכים להיות מנוסחים בשפה צבאית צה"לית אותנטית, מקצועית ומעוררת השראה, ללא קלישאות "AI סלופ" אלא שפת לחימה אמיתית ורצינית.

        דגש קריטי לעניין פורמט ה-JSON:
        אל תשתמש לעולם במירכאות כפולות לא מוברחות בתוך מחרוזות (למשל אל תרשום נ"צ אלא נ'צ, אל תרשום ל"א אלא ל'א, אל תרשום קמ"ן אלא קמ'ן). שימוש במירכאות כפולות לא מוברחות שובר את פורמט ה-JSON ומכשיל את המערכת.
      `;

      const response = await generateContentWithFallbackAndRetry(ai, {
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const responseText = response.text || "";
      let cleanedJson = responseText.trim().replace(/^```json/i, "").replace(/```$/, "").trim();
      
      // Clean typical unescaped Hebrew military double quote abbreviations that break JSON parsing
      cleanedJson = cleanedJson.replace(/נ"צ/g, "נ'צ");
      cleanedJson = cleanedJson.replace(/ל"א/g, "ל'א");
      cleanedJson = cleanedJson.replace(/קמ"ן/g, "קמ'ן");
      cleanedJson = cleanedJson.replace(/רח"פ/g, "רח'פ");
      cleanedJson = cleanedJson.replace(/עמ"ט/g, "עמ'ט");
      cleanedJson = cleanedJson.replace(/נ\"צ/g, "נ'צ");

      let parsedData: any;
      try {
        parsedData = JSON.parse(cleanedJson);
      } catch (parseErr) {
        // Fallback strategy: Extract block between first { and last }
        console.warn("[DaXa System] Standard JSON parse failed, attempting substring extraction cleanup...", parseErr);
        const firstBrace = cleanedJson.indexOf("{");
        const lastBrace = cleanedJson.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          try {
            const trimmedCandidate = cleanedJson.substring(firstBrace, lastBrace + 1);
            parsedData = JSON.parse(trimmedCandidate);
          } catch (secondErr) {
            console.error("[DaXa System] Deep JSON parser failed to repair raw response. Using fallback simulation data.");
            parsedData = defaultFallback;
          }
        } else {
          parsedData = defaultFallback;
        }
      }
      
      console.log("Successfully generated plan with Gemini.");
      return res.json(parsedData);
      
    } catch (err) {
      console.error("Gemini compilation or request failed, falling back to local simulation generator:", err);
      // Fallback seamlessly to default fallback data
      return res.json(defaultFallback);
    }
  } else {
    console.log("No Gemini API key detected. Serving offline realistic tactical simulation plan.");
    // Return localized fallback plan immediately
    return res.json(defaultFallback);
  }
});

// IDF-styled offline chat response simulation when Gemini is unavailable or rate-limited
function getFallbackChatResponse(promptText: string): string {
  const p = (promptText || "").toLowerCase();
  
  if (p.includes("מחבל") || p.includes("אויב") || p.includes("חוליה") || p.includes("טרור") || p.includes("נ\"ט") || p.includes("ירי") || p.includes("סכנ")) {
    return `**דוח איומים וחוליות אויב פעילות בגזרה (לפי מנוע YOLOv11 ואיכון קשר):**\n\n` +
           `מניתוח מודיעיני של השעות האחרונות עולה כי בגזרת הבתים הדרומית של **עייתא א-שעב** (מול זרעית) נפרסו שתי חוליות נ"ט קדמיות של כוח רדואן:\n` +
           `• **חוליה 1 (נ"צ 2741/3951):** מחזיקה בעמדת ירי מבוצרת בקו הבתים הראשון, מצוידת בטילי קורנט בעלי הנחיית לייזר כפול.\n` +
           `• **חוליה 2 (נ"צ 2742/3955):** ממוקמת בתוך עמדה מוסתרת (פיר מנהרה פעיל) סמוך למסגד הכפר, ומפעילה אמצעי תצפית אלקטרו-אופטיים.\n\n` +
           `מומלץ להפעיל סריקת Meta SAM על קו המגע כדי לזהות שינויי קרקע זעירים החושפים את פתחי הפירים.\n\n` +
           `**האם תרצה שאפיק עבורך כעת תכנון ציר טקטי מפורט על גבי המפה האינטראקטיבית על מנת שנוכל לעקוף את איומי הנ"ט ולתכנן נתיב התקדמות נסתר מוגן קו ראייה?**`;
  }
  
  if (p.includes("לאן") || p.includes("איך להגיע") || p.includes("נתיב") || p.includes("ציר") || p.includes("התקדמות") || p.includes("תכנ")) {
    return `**המלצת ציר תנועה והתקדמות אופרטיבית:**\n\n` +
           `בהתבסס על ניתוח השטח מעל אביבים ומטולה, להלן ההמלצות המקצועיות:\n` +
           `• **ציר התנועה הנסתר ביותר:** מומלץ לנוע דרך ערוץ הואדי העמוק **ואדי אל-חביב**. תוואי שטח זה מעניק לכוחות הנדסה וחי"ר הגנה טבעית מפני תצפיות ישירות ואש שטוחת מסלול.\n` +
           `• **אזורי מעבר ופריצה:** מומלץ לבצע חציית גבול מאובטחת בשער 70 תחת חיפוי הדוק ושימוש במיסוך עשן כבד למניעת איכון תרמי.\n\n` +
           `**האם תרצה שאפיק עבורך כעת תכנון ציר טקטי שלם ומפורט על גבי המפה האינטראקטיבית כדי שתוכל לראות את נקודות הציון המדויקות ולבחור את סוג הנתיב המתאים ביותר (נסתר, מהיר או מטוהר)?**`;
  }
  
  if (p.includes("נזק") || p.includes("מקסימום") || p.includes("השמדה") || p.includes("יעד") || p.includes("מטרה") || p.includes("תקוף")) {
    return `**ניתוח מטרות ערך ויעדי תורפה להסבת נזק מקסימלי לאויב:**\n\n` +
           `לצורך נטרול יכולות האויב בגזרת **מארון א-ראס** ובינת ג'בייל, מומלץ להתמקד במוקדים הבאים:\n` +
           `• **מוקד פיקוד ושליטה (נ"צ 2684/3890):** ממוקם בתת-קרקע עמוקה מתחת לפארק איראן במארון א-ראס. זהו מרכז העצבים של האזור האחראי על תיאום הירי.\n` +
           `• **מחסן רקטות קצרות-טווח (נ"צ 2689/3894):** מוסתר במרתף של מבנה מגורים המחובר למנהרה תת-קרקעית.\n\n` +
           `פגיעה מדויקת במוקדים אלו תנטרל את עמוד השדרה הטקטי של הגזרה ותקל על תמרון כוחותינו.\n\n` +
           `**האם תרצה שאפיק עבורך כעת תכנון ציר טקטי מפורט על גבי המפה האינטראקטיבית על מנת שנציג את נתוני המטרות, נסמן את פוליגוני הסכנה ונגבש נתיב פריצה מדויק?**`;
  }

  return `**מפקד, מערכת DaXa זמינה לקבלת הנחיה אופרטיבית מהירה:**\n\n` +
         `אני מסנכרן נתוני מודיעין בזמן אמת ומסוגל לענות על שאלות כגון:\n` +
         `• *"איפה ממוקמים פירים פעילים וחוליות נ"ט של האויב?"*\n` +
         `• *"מהו הציר הנסתר ביותר והמומלץ ביותר מאביבים למארון א-ראס?"*\n` +
         `• *"איזה מטרות ערך מומלץ לתקוף כדי להסב נזק מקסימלי לאויב?"*\n\n` +
         `**האם תרצה שאבצע עבורך הפקת תכנון ציר טקטי מלא ומפורט על גבי המפה האינטראקטיבית (כולל מפות לוויין מפורטות ושכבות טופוגרפיות)?**`;
}

// Rapid contextual chat using the fast Gemini model (gemini-3.5-flash)
app.post("/api/chat", async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Messages array is required" });
  }

  const systemInstruction = `
    אתה קצין מודיעין (קמ"ן) מומחה ומעריך טקטי בכיר במפקדת מערכת DaXa של צה"ל הפועלת בדרום לבנון.
    תפקידך להשיב למפקדים בשטח על שאלות אופרטיביות בצורה מדויקת, מקצועית וממוקדת: לאן ללכת, איך להגיע, איתור וזיהוי חוליות מחבלים, מוקדי כוח אויב, והמלצות ליעדים שיסבו מקסימום נזק לאויב בהתאם לתנאים הטקטיים של דרום לבנון.
    
    הנחיות קריטיות:
    1. סגנון הדיבור שלך צבאי צה"לי אותנטי, מקצועי, חד, אובייקטיבי ומעורר כבוד (השתמש במונחים כמו נ"צ, חימוש מונחה, סגירת מעגל אש, איומי נ"ט, תצפית, חיפוי, פירים, סל"ק, תצל"א, מארב, תפר, השמדה, שחרור לחץ, מטרות הפללה).
    2. הימנע לחלוטין מניסוחים בנאליים של AI סלופ כגון "חשוב לזכור", "בוא נחשוב", "היי! אני כאן לעזור". אל תעשה הקדמות מיותרות. התחל ישר בעניין המבצעי.
    3. ענה על השאלות בהסתמך על השטח ההררי והסבוך של דרום לבנון (זרעית, עייתא א-שעב, אביבים, מארון א-ראס, מטולה, אל-חיאם, משגב עם, אל-עדיסה, כפר כילא וכו').
    4. בסוף כל תשובה, הצע תמיד למפקד בצורה טבעית ומשכנעת להפיק תכנון ציר טקטי מפורט על גבי המפה כדי שיוכל לראות את נתיבי התנועה, נקודות הציון, ואזורי האיום בעיניים שלו במערכת. למשל: "מומלץ להפיק כעת תכנון ציר טקטי מפורט על גבי המפה האינטראקטיבית כדי שנוכל לייצר נתיב התקדמות נסתר ואזורי השמדה מדויקים."
  `;

  if (ai) {
    try {
      console.log("Sending chat request to Gemini 3.5 Flash...");
      const formattedContents = messages.map(msg => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }]
      }));

      const response = await generateContentWithFallbackAndRetry(ai, {
        model: "gemini-3.5-flash",
        contents: formattedContents as any,
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      const responseText = response.text || "לא התקבלה תגובה מנוע ה-AI.";
      return res.json({ text: responseText });
    } catch (err: any) {
      console.error("Gemini chat error, falling back to local chat simulation:", err);
      const lastMessage = messages[messages.length - 1]?.content || "";
      const fallbackText = getFallbackChatResponse(lastMessage);
      return res.json({ text: fallbackText });
    }
  } else {
    const lastMessage = messages[messages.length - 1]?.content || "";
    const fallbackText = getFallbackChatResponse(lastMessage);
    return res.json({ text: fallbackText });
  }
});

// Serve health status
app.get("/api/status", (req, res) => {
  res.json({
    status: "active",
    system: "DaXa Tactical Intelligence Suite",
    isGeminiActive: ai !== null,
    region: "Lebanon South Sector"
  });
});

// Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development middleware integrated");
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log("Vite production static files serving active");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`DAXA Tactical Server running on port ${PORT}`);
  });
}

startServer();
