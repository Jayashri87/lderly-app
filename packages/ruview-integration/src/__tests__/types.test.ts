import { describe, it, expect } from 'vitest';
import type { VitalSigns, HealthAlert, RuViewConfig } from '../src/types';

describe('Types', () => {
  describe('VitalSigns', () => {
    it('should create valid vital signs object', () => {
      const vitals: VitalSigns = {
        heartRate: 72,
        breathingRate: 16,
        presence: true,
        personCount: 1,
        motionLevel: 0.25,
        timestamp: new Date(),
      };
      expect(vitals.heartRate).toBe(72);
      expect(vitals.presence).toBe(true);
    });
  });

  describe('HealthAlert', () => {
    it('should create valid health alert', () => {
      const alert: HealthAlert = {
        type: 'fall',
        nodeId: 'bedroom',
        severity: 'critical',
        message: 'Fall detected',
        timestamp: new Date(),
      };
      expect(alert.type).toBe('fall');
      expect(alert.severity).toBe('critical');
    });
  });

  describe('RuViewConfig', () => {
    it('should create valid config', () => {
      const config: RuViewConfig = {
        mqttHost: 'localhost',
        mqttPort: 1883,
        mqttUsername: 'user',
        mqttPassword: 'pass',
        privacyMode: false,
      };
      expect(config.mqttHost).toBe('localhost');
    });
  });
});
