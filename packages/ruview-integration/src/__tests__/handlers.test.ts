import { describe, it, expect } from 'vitest';
import { isHealthAlert, isVitalSign } from '../src/handlers';

describe('Handlers', () => {
  describe('isHealthAlert', () => {
    it('should identify health alert entities', () => {
      expect(isHealthAlert('fall_detected')).toBe(true);
      expect(isHealthAlert('possible_distress')).toBe(true);
      expect(isHealthAlert('elderly_inactivity_anomaly')).toBe(true);
      expect(isHealthAlert('no_movement')).toBe(true);
    });

    it('should reject non-alert entities', () => {
      expect(isHealthAlert('heart_rate')).toBe(false);
      expect(isHealthAlert('breathing_rate')).toBe(false);
      expect(isHealthAlert('unknown')).toBe(false);
    });
  });

  describe('isVitalSign', () => {
    it('should identify vital sign entities', () => {
      expect(isVitalSign('heart_rate')).toBe(true);
      expect(isVitalSign('breathing_rate')).toBe(true);
      expect(isVitalSign('motion_level')).toBe(true);
      expect(isVitalSign('person_count')).toBe(true);
    });

    it('should reject non-vital entities', () => {
      expect(isVitalSign('fall_detected')).toBe(false);
      expect(isVitalSign('unknown')).toBe(false);
    });
  });
});
