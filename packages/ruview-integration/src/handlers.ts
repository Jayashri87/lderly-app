export function isHealthAlert(entityId: string): boolean {
  return ['fall_detected', 'possible_distress', 'elderly_inactivity_anomaly'].includes(entityId);
}

export function isVitalSign(entityId: string): boolean {
  return ['heart_rate', 'breathing_rate', 'motion_level', 'person_count'].includes(entityId);
}
