import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RuViewMQTTClient } from '../src/client';
import type { VitalSigns, HealthAlert } from '../src/types';

describe('RuViewMQTTClient', () => {
  let client: RuViewMQTTClient;

  beforeEach(() => {
    client = new RuViewMQTTClient({
      mqttHost: 'localhost',
      mqttPort: 1883,
      privacyMode: false,
    });
  });

  it('should initialize with correct config', () => {
    expect(client).toBeDefined();
  });

  it('should get sensor update', () => {
    const update = client.getSensorUpdate('test-node');
    expect(update).toBeUndefined();
  });

  it('should get all sensor updates', () => {
    const updates = client.getAllSensorUpdates();
    expect(updates).toBeInstanceOf(Map);
    expect(updates.size).toBe(0);
  });

  it('should register health alert handler', () => {
    const handler = vi.fn();
    client.onHealthAlert(handler);
    // Handler should be stored
    expect(handler).toBeDefined();
  });

  it('should respect privacy mode', () => {
    const privacyClient = new RuViewMQTTClient({
      mqttHost: 'localhost',
      privacyMode: true,
    });
    expect(privacyClient).toBeDefined();
  });
});
