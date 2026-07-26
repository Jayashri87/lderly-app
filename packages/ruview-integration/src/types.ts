export interface RuViewConfig {
  mqttHost: string;
  mqttPort?: number;
  mqttUsername?: string;
  mqttPassword?: string;
  mqttPrefix?: string;
  privacyMode?: boolean;
}

export interface VitalSigns {
  heartRate?: number;
  breathingRate?: number;
  presence: boolean;
  personCount: number;
  motionLevel: number;
  timestamp: Date;
}

export interface SensingUpdate {
  nodeId: string;
  vitalSigns: VitalSigns;
  timestamp: Date;
}

export interface HealthAlert {
  type: 'fall' | 'distress' | 'inactivity';
  nodeId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
}
