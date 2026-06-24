/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface RoutePoint {
  name: string;
  lat: number;
  lon: number;
  description: string;
}

export interface DangerZone {
  name: string;
  lat: number;
  lon: number;
  radius: number;
  threat: string;
  severity: "HIGH" | "CRITICAL" | "MEDIUM";
}

export interface Alert {
  id: string;
  type: "anti_tank" | "tunnel" | "encounter" | "terrorist" | "mine" | "uav";
  text: string;
  source: string;
  timestamp: string;
  recommendation: string;
  status?: "pending" | "resolved" | "active";
  lat?: number;
  lon?: number;
}

export interface BattlePlan {
  intelSummary: string;
  recommendedRoute: RoutePoint[];
  dangerZones: DangerZone[];
  alerts: Alert[];
  operationalSteps: string[];
}

export interface ActiveSkill {
  id: string;
  name: string;
  description: string;
  icon: string;
  sensorType: string;
  tacticalUse: string;
  enabled: boolean;
  accuracy: number;
}
