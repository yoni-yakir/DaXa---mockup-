/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from "react";
import { APIProvider, Map, AdvancedMarker, Pin, useMap } from "@vis.gl/react-google-maps";
import { RoutePoint, DangerZone, Alert } from "../types";

const API_KEY =
  (process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  "").trim();

const isAizaKey = API_KEY.startsWith("AIzaSy");
const hasValidKey = Boolean(API_KEY) && API_KEY !== "YOUR_API_KEY" && isAizaKey;
const isMistakenlyMapId = Boolean(API_KEY) && !isAizaKey && (API_KEY.includes("E4U5L") || API_KEY.endsWith("=") || API_KEY.length < 35);


// Helper component to center and zoom on a focused alert
function MapFocusController({ focusedAlert }: { focusedAlert: Alert | null }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !focusedAlert || !focusedAlert.lat || !focusedAlert.lon) return;
    
    // Pan to target alert coordinates
    map.panTo({ lat: focusedAlert.lat, lng: focusedAlert.lon });
    map.setZoom(16);
  }, [map, focusedAlert]);

  return null;
}

// Draw recommended battle path polyline
function TacticalPathOverlay({ path }: { path: RoutePoint[] }) {
  const map = useMap();
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map || !path || path.length === 0) {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
      return;
    }

    // Clear old line
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
    }

    const coordinates = path.map(pt => ({ lat: pt.lat, lng: pt.lon }));

    polylineRef.current = new google.maps.Polyline({
      path: coordinates,
      geodesic: true,
      strokeColor: "#06b6d4", // Teal glow
      strokeOpacity: 0.9,
      strokeWeight: 5,
      map: map,
    });

    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
      }
    };
  }, [map, path]);

  return null;
}

// Draw threat / danger zones
function TacticalDangerZones({ zones }: { zones: DangerZone[] }) {
  const map = useMap();
  const circlesRef = useRef<google.maps.Circle[]>([]);

  useEffect(() => {
    if (!map) return;

    // Clear existing
    circlesRef.current.forEach(c => c.setMap(null));
    circlesRef.current = [];

    if (!zones || zones.length === 0) return;

    zones.forEach(zone => {
      const color = zone.severity === "CRITICAL" ? "#ef4444" : "#f59e0b"; // Red vs Amber
      const circle = new google.maps.Circle({
        center: { lat: zone.lat, lng: zone.lon },
        radius: zone.radius,
        strokeColor: color,
        strokeOpacity: 0.75,
        strokeWeight: 2,
        fillColor: color,
        fillOpacity: 0.15,
        map: map,
      });
      circlesRef.current.push(circle);
    });

    return () => {
      circlesRef.current.forEach(c => c.setMap(null));
    };
  }, [map, zones]);

  return null;
}

// Draw dynamic topographic elevation contour circles on top of Satellite/Dark view
function TopographyContours({ showTopography }: { showTopography: boolean }) {
  const map = useMap();
  const contourCirclesRef = useRef<google.maps.Circle[]>([]);

  // High elevation peaks in South Lebanon to draw tactical contour lines around
  const peakCenters = [
    { name: "הר מארון א-ראס (915מ')", lat: 33.105, lon: 35.424, baseElevation: 915, steps: [100, 200, 300] },
    { name: "רכס בינת ג'בייל (770מ')", lat: 33.121, lon: 35.433, baseElevation: 770, steps: [150, 300] },
    { name: "רמת אל-חיאם (750מ')", lat: 33.315, lon: 35.610, baseElevation: 750, steps: [120, 240, 360] },
    { name: "גבעת עייתא א-שעב (670מ')", lat: 33.111, lon: 35.302, baseElevation: 670, steps: [130, 260] }
  ];

  useEffect(() => {
    if (!map) return;

    // Clear old contours
    contourCirclesRef.current.forEach(c => c.setMap(null));
    contourCirclesRef.current = [];

    if (!showTopography) return;

    peakCenters.forEach(peak => {
      peak.steps.forEach((radius, idx) => {
        const elevation = peak.baseElevation - (idx * 30);
        const circle = new google.maps.Circle({
          center: { lat: peak.lat, lng: peak.lon },
          radius: radius,
          strokeColor: "#10b981", // Emerald green military topo color
          strokeOpacity: 0.45,
          strokeWeight: 1,
          fillColor: "transparent",
          fillOpacity: 0,
          clickable: false,
          map: map
        });
        contourCirclesRef.current.push(circle);
      });
    });

    return () => {
      contourCirclesRef.current.forEach(c => c.setMap(null));
    };
  }, [map, showTopography]);

  return null;
}

interface TacticalGoogleMapProps {
  mapStyle: "dark" | "satellite" | "radar";
  recommendedRoute: RoutePoint[];
  dangerZones: DangerZone[];
  customMarkers: any[];
  friendlyBases: any[];
  enemyTowns: any[];
  alerts: Alert[];
  destination: string;
  drawToolActive: boolean;
  onMapClick: (lat: number, lon: number) => void;
  selectedMapNode: any;
  onSelectNode: (node: any) => void;
  focusedAlert: Alert | null;
  showTopography: boolean;
  onMapReady?: (map: google.maps.Map) => void;
}

export default function TacticalGoogleMap({
  mapStyle,
  recommendedRoute,
  dangerZones,
  customMarkers,
  friendlyBases,
  enemyTowns,
  alerts,
  destination,
  drawToolActive,
  onMapClick,
  selectedMapNode,
  onSelectNode,
  focusedAlert,
  showTopography,
  onMapReady
}: TacticalGoogleMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);

  // Determine Google Maps style mode
  const getMapTypeId = () => {
    if (mapStyle === "satellite") {
      return "hybrid"; // Hybrid offers satellite with street names for military GPS overlays
    }
    return "roadmap"; // Styled in dark mode later
  };

  // Modern Dark styled map configuration (IDF high contrast tactical style)
  const darkMapStyles: google.maps.MapTypeStyle[] = [
    { elementType: "geometry", stylers: [{ color: "#0b0f19" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#0b0f19" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#475569" }] },
    {
      featureType: "administrative",
      elementType: "geometry",
      stylers: [{ color: "#1e293b" }]
    },
    {
      featureType: "poi",
      elementType: "labels.text.fill",
      stylers: [{ color: "#06b6d4" }]
    },
    {
      featureType: "road",
      elementType: "geometry",
      stylers: [{ color: "#1e293b" }]
    },
    {
      featureType: "road",
      elementType: "geometry.stroke",
      stylers: [{ color: "#0f172a" }]
    },
    {
      featureType: "road",
      elementType: "labels.text.fill",
      stylers: [{ color: "#475569" }]
    },
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ color: "#020617" }]
    },
    {
      featureType: "water",
      elementType: "labels.text.fill",
      stylers: [{ color: "#1e293b" }]
    }
  ];

  // Adjust center based on destination/route
  const getDefaultCenter = () => {
    if (recommendedRoute && recommendedRoute.length > 0) {
      // Find midpoint
      const midIdx = Math.floor(recommendedRoute.length / 2);
      return { lat: recommendedRoute[midIdx].lat, lng: recommendedRoute[midIdx].lon };
    }
    return { lat: 33.105, lng: 35.424 }; // Center of Southern Lebanon sector
  };

  if (!hasValidKey) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-slate-950 border border-slate-800 rounded-lg h-full text-center">
        <div className="max-w-md space-y-4">
          <div className="p-3 bg-red-950/40 border border-red-500/20 text-red-400 rounded-lg font-mono text-2xs inline-block mb-2">
            🔑 GOOGLE_MAPS_PLATFORM_KEY {isMistakenlyMapId ? "MAPPED TO MAP_ID (ERROR)" : "REQUIRED"}
          </div>
          <h3 className="text-md font-bold text-slate-100">נדרש מפתח מפות Google Maps חיות</h3>
          
          {isMistakenlyMapId ? (
            <div className="bg-amber-950/40 border border-amber-500/30 p-4 rounded-lg text-right text-2xs space-y-3">
              <p className="text-amber-400 font-bold font-sans">⚠️ שים לב: הזנת את מזהה המפה (Map ID) שלך במקום מפתח ה-API!</p>
              <p className="text-slate-300 leading-relaxed font-sans">
                הערך שהזנת <code>{API_KEY}</code> הוא <strong>מזהה המפה (Map ID)</strong> שקיבלת מ-Google.
                מפתח ה-API האמיתי (API Key) של Google Maps הוא מחרוזת ארוכה יותר שתמיד מתחילה באותיות <code className="text-teal-400">AIzaSy</code>.
              </p>
              <div className="border-t border-amber-500/20 pt-2 text-3xs text-slate-400 font-mono">
                אנא החלף את הערך בהגדרות (Secrets) במפתח ה-API האמיתי שמתחיל ב-<code>AIzaSy</code>.
              </div>
            </div>
          ) : (
            <p className="text-2xs text-slate-400 leading-relaxed text-right space-y-2">
              על מנת להציג מפות לוויין טקטיות מלאות בזמן אמת וקואורדינטות GPS פעילות של דרום לבנון ל-MVP, הגדר את ה-API Key שלך:
            </p>
          )}

          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded text-right text-3xs font-mono text-slate-400 space-y-2 leading-relaxed">
            <div>1. השג מפתח API של Google Maps:</div>
            <a 
              href="https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-teal-400 underline block text-center my-1 hover:text-teal-300"
            >
              הרשמה לקבלת מפתח API חופשי
            </a>
            <div>2. לחץ על גלגל השיניים (Settings) בצד ימין למעלה.</div>
            <div>3. בחר בלשונית <b>Secrets</b>.</div>
            <div>4. הוסף מפתח בשם <b>GOOGLE_MAPS_PLATFORM_KEY</b> והזן את הערך שקיבלת (המתחיל ב-<code>AIzaSy</code>).</div>
          </div>
          <p className="text-3xs text-amber-500 font-mono">המערכת תיבנה מחדש ותתחבר באופן אוטומטי ללא צורך ברענון.</p>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={API_KEY} version="weekly">
      <div className="w-full h-full relative" style={{ minHeight: "350px" }}>
        <Map
          mapId="E4U5Ljk_L2sy9SY8LT2T6ieCYuU="
          defaultCenter={getDefaultCenter()}
          defaultZoom={13}
          mapTypeId={getMapTypeId()}
          gestureHandling="greedy"
          disableDefaultUI={true}
          styles={mapStyle === "dark" || mapStyle === "radar" ? darkMapStyles : undefined}
          internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
          onClick={(ev) => {
            if (drawToolActive && ev.detail.latLng) {
              onMapClick(ev.detail.latLng.lat, ev.detail.latLng.lng);
            }
          }}
          style={{ width: "100%", height: "100%" }}
        >
          {/* Path and Circle layers */}
          <TacticalPathOverlay path={recommendedRoute} />
          <TacticalDangerZones zones={dangerZones} />
          <TopographyContours showTopography={showTopography} />
          <MapFocusController focusedAlert={focusedAlert} />

          {/* Friendly base markers */}
          {friendlyBases.map((base, idx) => (
            <AdvancedMarker
              key={`friendly-${idx}`}
              position={{ lat: base.lat, lng: base.lon }}
              onClick={() => onSelectNode({ ...base, isFriendly: true })}
            >
              <Pin background="#0284c7" borderColor="#38bdf8" glyphColor="#fff" scale={0.8} />
            </AdvancedMarker>
          ))}

          {/* Enemy towns markers */}
          {enemyTowns.map((town, idx) => {
            const isTarget = destination === town.id;
            return (
              <AdvancedMarker
                key={`enemy-${idx}`}
                position={{ lat: town.lat, lng: town.lon }}
                onClick={() => onSelectNode({ ...town, isFriendly: false })}
              >
                <Pin 
                  background={isTarget ? "#ef4444" : "#991b1b"} 
                  borderColor={isTarget ? "#fca5a5" : "#b91c1c"} 
                  glyphColor="#fff" 
                  scale={isTarget ? 1.0 : 0.75} 
                />
              </AdvancedMarker>
            );
          })}

          {/* Custom Commander POI markers */}
          {customMarkers.map((marker, idx) => (
            <AdvancedMarker
              key={`custom-${idx}`}
              position={{ lat: marker.lat, lng: marker.lon }}
              onClick={() => onSelectNode({ ...marker, isFriendly: false, threat: "סימון מפקד טקטי" })}
            >
              <Pin background="#d97706" borderColor="#fbbf24" glyphColor="#fff" scale={0.75} />
            </AdvancedMarker>
          ))}

          {/* Live Alerts Markers */}
          {alerts.map((alert) => {
            if (!alert.lat || !alert.lon) return null;
            return (
              <AdvancedMarker
                key={`alert-mark-${alert.id}`}
                position={{ lat: alert.lat, lng: alert.lon }}
                onClick={() => onSelectNode({ 
                  name: alert.source, 
                  isFriendly: false, 
                  description: alert.text,
                  threat: alert.recommendation
                })}
              >
                <div className="relative flex items-center justify-center">
                  <span className="absolute inline-flex h-6 w-6 rounded-full bg-red-500/40 animate-ping" />
                  <Pin background="#f43f5e" borderColor="#ffffff" glyphColor="#fff" scale={0.85} />
                </div>
              </AdvancedMarker>
            );
          })}
        </Map>

        {/* Dynamic topographic contour helper panel inside Google Maps */}
        {showTopography && (
          <div className="absolute top-4 left-4 z-10 bg-slate-950/90 border border-emerald-500/30 p-2 rounded-md font-mono text-4xs text-emerald-400 shadow-xl space-y-1">
            <div className="flex items-center space-x-reverse space-x-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold">שכבת תבליט טופוגרפי פעילה</span>
            </div>
            <div>• קווי מתאר ירוקים: חתכי גובה (מרווח 30מ')</div>
            <div>• זיהוי שיפועים ומדרונות לתכנון אש שטוחה</div>
          </div>
        )}
      </div>
    </APIProvider>
  );
}
