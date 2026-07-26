# @lderly/ruview-integration

WiFi-based vital sign monitoring integration for Lderly using RuView sensors.

## Features

- 🫁 **Real-time Vital Signs**: Heart rate, breathing rate, presence detection
- 🚨 **Fall Detection**: Immediate alerts on potential falls
- 👥 **Multi-person Tracking**: Count and track multiple occupants
- 🏠 **Zone Occupancy**: Track movement between rooms
- 🔒 **Privacy-First**: Optional privacy mode to strip biometric data
- 📊 **Health Alerts**: Distress detection, inactivity monitoring

## Installation

```bash
pnpm add @lderly/ruview-integration
```

## Quick Start

```typescript
import { RuViewMQTTClient } from "@lderly/ruview-integration";

const client = new RuViewMQTTClient({
  mqttHost: "192.168.1.10",
  mqttPort: 1883,
  mqttUsername: "homeassistant",
  mqttPassword: process.env.MQTT_PASSWORD,
});

await client.connect();

client.onHealthAlert((alert) => {
  console.log("Alert:", alert);
});
```

## License

MIT
