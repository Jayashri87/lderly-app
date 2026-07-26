# RuView + Lderly Integration - Complete Guide

## ✅ Implementation Status

### Phase 1: Core Integration (COMPLETE)
- ✅ @lderly/ruview-integration MQTT client package
- ✅ API Gateway vitals endpoints
- ✅ Health alert system
- ✅ TypeScript types

### Phase 2: Dashboard (COMPLETE)
- ✅ VitalSignsCard component
- ✅ HealthAlertBanner component  
- ✅ VitalsOverview component
- ✅ React Query hooks
- ✅ Real-time components

### Phase 3: Setup & Documentation (COMPLETE)
- ✅ Environment configuration
- ✅ Integration guide
- ✅ API documentation
- ✅ Component documentation

---

## 🚀 Quick Start

### 1. Environment Setup

```bash
cp .env.ruview.example .env.local
```

Update `.env.local`:
```env
MQTT_HOST=192.168.1.10
MQTT_PORT=1883
MQTT_USERNAME=homeassistant
MQTT_PASSWORD=your_password
```

### 2. Start MQTT Broker

```bash
docker run -d -p 1883:1883 eclipse-mosquitto
```

### 3. Deploy RuView

```bash
docker run --rm --net=host \
  ruvnet/wifi-densepose:0.7.0 \
  --source esp32 \
  --mqtt --mqtt-host 192.168.1.10 \
  --mqtt-username homeassistant \
  --mqtt-password your_password
```

### 4. Start Lderly

```bash
pnpm install
pnpm dev
```

---

## 📊 Components

### VitalSignsCard
Display vital signs for a single sensor.

```tsx
import { VitalSignsCard } from '@/components/vitals';

export function Page() {
  return <VitalSignsCard nodeId="living-room" />;
}
```

### VitalsOverview  
Display all sensors in a grid.

```tsx
import { VitalsOverview } from '@/components/vitals';

export function Page() {
  return <VitalsOverview />;
}
```

### RealtimeVitals
Real-time updates component.

```tsx
import { RealtimeVitals } from '@/components/vitals';

export function Page() {
  return <RealtimeVitals />;
}
```

---

## 🔌 API Endpoints

```bash
GET /api/vitals              # All sensors
GET /api/vitals/:nodeId      # Single sensor
GET /health                  # Health check
GET /metrics                 # Performance metrics
```

---

## 📝 Commits

1. **bab2dae** - RuView integration package & documentation
2. **b649a05** - API Gateway vitals endpoints
3. **8aa9b1d** - Dashboard components (UI)
4. **{next}** - WebSocket & environment setup

---

## 📚 References

- [RuView GitHub](https://github.com/ruvnet/RuView)
- [Home Assistant Integration](https://github.com/ruvnet/RuView/blob/main/docs/integrations/home-assistant.md)
- [Package Documentation](./packages/ruview-integration/README.md)
- [Component Documentation](./components/vitals/README.md)

---

## 🎯 Next Steps

- [ ] Create PR from `feature/ruview-integration` to `main`
- [ ] Deploy to staging environment
- [ ] Test with real RuView hardware
- [ ] Add Firebase historical logging
- [ ] Build mobile app components
- [ ] Create deployment runbook

