# RuView + Lderly Integration

## Overview

This integration brings WiFi-based vital sign monitoring to Lderly using RuView sensors. Non-intrusive health monitoring including heart rate, breathing rate, presence detection, and fall detection.

## Architecture

```
ESP32 Nodes
    ↓
RuView MQTT Publisher
    ↓
Mosquitto MQTT Broker
    ↓
@lderly/ruview-integration (MQTT Client)
    ↓
Lderly API Gateway → Firebase → Dashboard
```

## Getting Started

### 1. Deploy MQTT Broker

```bash
docker run -d --name mosquitto -p 1883:1883 eclipse-mosquitto
```

### 2. Flash ESP32-S3 with RuView Firmware

See: https://github.com/ruvnet/RuView#quick-start

### 3. Start RuView Sensing Server

```bash
docker run --rm --net=host \
  ruvnet/wifi-densepose:0.7.0 \
  --source esp32 \
  --mqtt --mqtt-host 192.168.1.10 \
  --mqtt-username homeassistant \
  --mqtt-password mypassword
```

### 4. Connect Lderly Integration

```typescript
// apps/api-gateway/src/ruview.ts
import { RuViewMQTTClient } from '@lderly/ruview-integration';

const ruviewClient = new RuViewMQTTClient({
  mqttHost: process.env.MQTT_HOST || 'localhost',
  mqttPort: 1883,
  mqttUsername: 'homeassistant',
  mqttPassword: process.env.MQTT_PASSWORD,
});

await ruviewClient.connect();

ruviewClient.onHealthAlert((alert) => {
  console.log('Health Alert:', alert);
  // Trigger notification, log to Firebase, etc.
});
```

## Features

✅ Real-time vital signs (HR, BR, motion, presence)  
✅ Fall detection with critical alerts  
✅ Multi-node support  
✅ Privacy mode (strips biometric data)  
✅ MQTT Home Assistant compatible  
✅ TypeScript types  

## Next Steps

- [ ] Create API endpoint `/api/vitals`
- [ ] Build dashboard component for vital signs display
- [ ] Add WebSocket real-time streaming
- [ ] Integrate fall alerts with notification service
- [ ] Add historical data logging to Firestore
- [ ] Create mobile app components for caregiver app

## References

- [RuView GitHub](https://github.com/ruvnet/RuView)
- [Home Assistant Integration Docs](https://github.com/ruvnet/RuView/blob/main/docs/integrations/home-assistant.md)
- [@lderly/ruview-integration Package](./packages/ruview-integration)
