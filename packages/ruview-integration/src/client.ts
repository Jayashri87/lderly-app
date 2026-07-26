import * as mqtt from 'mqtt';
import type { MqttClient } from 'mqtt';
import type { RuViewConfig, SensingUpdate, HealthAlert } from './types';

export class RuViewMQTTClient {
  private config: RuViewConfig;
  private client?: MqttClient;
  private sensorUpdates: Map<string, SensingUpdate> = new Map();
  private healthAlertHandlers: Array<(alert: HealthAlert) => void> = [];

  constructor(config: RuViewConfig) {
    this.config = {
      mqttPort: 1883,
      mqttPrefix: 'homeassistant',
      privacyMode: false,
      ...config,
    };
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const brokerUrl = `mqtt://${this.config.mqttHost}:${this.config.mqttPort}`;

      this.client = mqtt.connect(brokerUrl, {
        username: this.config.mqttUsername,
        password: this.config.mqttPassword,
      });

      this.client.on('connect', () => {
        console.log('[RuView] Connected to MQTT broker');
        this.subscribeToTopics();
        resolve();
      });

      this.client.on('message', (topic, payload) => {
        this.handleMessage(topic, payload.toString());
      });

      this.client.on('error', reject);
    });
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.client) {
        this.client.end(() => resolve());
      } else {
        resolve();
      }
    });
  }

  private subscribeToTopics(): void {
    const prefix = this.config.mqttPrefix || 'homeassistant';
    this.client?.subscribe(`${prefix}/#`);
  }

  private handleMessage(topic: string, payload: string): void {
    const parts = topic.split('/');
    if (parts[parts.length - 1] === 'state') {
      const nodeId = parts[2];
      const entityId = parts[3];
      this.updateSensorData(nodeId, entityId, payload);
    }
  }

  private updateSensorData(nodeId: string, entityId: string, value: string): void {
    let update = this.sensorUpdates.get(nodeId);
    if (!update) {
      update = {
        nodeId,
        vitalSigns: {
          presence: false,
          personCount: 0,
          motionLevel: 0,
          timestamp: new Date(),
        },
        timestamp: new Date(),
      };
    }

    const numValue = parseFloat(value);
    const boolValue = value === 'on' || value === 'true';

    switch (entityId) {
      case 'heart_rate':
        if (!this.config.privacyMode) update.vitalSigns.heartRate = numValue;
        break;
      case 'breathing_rate':
        if (!this.config.privacyMode) update.vitalSigns.breathingRate = numValue;
        break;
      case 'presence':
        update.vitalSigns.presence = boolValue;
        break;
      case 'person_count':
        update.vitalSigns.personCount = Math.round(numValue);
        break;
      case 'motion_level':
        update.vitalSigns.motionLevel = numValue / 100;
        break;
      case 'fall_detected':
        if (boolValue) {
          this.emitHealthAlert({
            type: 'fall',
            nodeId,
            severity: 'critical',
            message: 'Fall detected',
            timestamp: new Date(),
          });
        }
        break;
    }

    update.vitalSigns.timestamp = new Date();
    update.timestamp = new Date();
    this.sensorUpdates.set(nodeId, update);
  }

  private emitHealthAlert(alert: HealthAlert): void {
    this.healthAlertHandlers.forEach((handler) => handler(alert));
  }

  getSensorUpdate(nodeId: string): SensingUpdate | undefined {
    return this.sensorUpdates.get(nodeId);
  }

  getAllSensorUpdates(): Map<string, SensingUpdate> {
    return this.sensorUpdates;
  }

  onHealthAlert(handler: (alert: HealthAlert) => void): void {
    this.healthAlertHandlers.push(handler);
  }
}
