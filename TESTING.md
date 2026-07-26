# RuView Integration - Test Suite

## Unit Tests

### MQTT Client Tests
```bash
cd packages/ruview-integration
pnpm test
```

- Client initialization
- Sensor data updates
- Health alert handlers
- Privacy mode

### Handler Tests
- Health alert detection
- Vital sign classification

### Type Validation
- VitalSigns structure
- HealthAlert structure
- RuViewConfig structure

## Integration Tests

### React Hooks
```bash
pnpm test lib/hooks
```

- `useNodeVitals()` - Fetch single sensor
- `useAllVitals()` - Fetch all sensors
- Query caching
- Refetch intervals

### Components
```bash
pnpm test components/vitals
```

- **VitalSignsCard**
  - Loading state
  - Error handling
  - Data display
  - Real-time updates

- **VitalsOverview**
  - Multiple sensor grid
  - Empty state
  - Connection status

- **HealthAlertBanner**
  - Alert display
  - Severity colors
  - Dismissal

## E2E Tests

### Setup
```bash
pnpm test:e2e
```

**Requires:**
- Running MQTT broker
- RuView publisher running
- API Gateway running

### Scenarios

1. **Health Monitoring Dashboard**
   - Load dashboard
   - Verify vitals displayed
   - Check real-time updates
   - Verify alert notifications

2. **Fall Detection**
   - Trigger fall event
   - Verify alert appears
   - Check notification sent
   - Verify alert clears after timeout

3. **Multi-Sensor Display**
   - Add multiple sensors
   - Verify all displayed
   - Check individual updates
   - Verify no cross-contamination

4. **Mobile Responsiveness**
   - Mobile view (375px)
   - Tablet view (768px)
   - Desktop view (1920px)
   - Verify component layout

## Running All Tests

```bash
# Unit tests
pnpm test

# With coverage
pnpm test:coverage

# E2E tests (requires Docker + running services)
pnpm test:e2e

# All tests
pnpm test:all
```

## Test Coverage Goals

- **Lines**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Statements**: > 80%

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Commits to main
- Scheduled daily

See `.github/workflows/test.yml`
