# RuView Dashboard Components

React components for displaying RuView vital signs in the Lderly dashboard.

## Components

### VitalSignsCard

Displays real-time vital signs for a single RuView node.

```tsx
import { VitalSignsCard } from '@/components/vitals';

export function Dashboard() {
  return <VitalSignsCard nodeId="living-room" />;
}
```

**Features:**
- Real-time heart rate, breathing rate, motion, and person count
- Auto-refresh every 2 seconds
- Presence indicator
- Responsive grid layout
- Connection status

### HealthAlertBanner

Displays critical health alerts (falls, distress, inactivity).

```tsx
import { HealthAlertBanner } from '@/components/vitals';

export function App() {
  return (
    <>
      <HealthAlertBanner />
      {/* rest of app */}
    </>
  );
}
```

### VitalsOverview

Display all connected RuView sensors on one page.

```tsx
import { VitalsOverview } from '@/components/vitals';

export function VitalsPage() {
  return <VitalsOverview refreshInterval={2000} />;
}
```

## Hooks

### useNodeVitals

Fetch vital signs for a specific node.

```tsx
const { data, isLoading } = useNodeVitals('bedroom');
```

### useAllVitals

Fetch vital signs from all connected nodes.

```tsx
const { data: vitals } = useAllVitals();
```

### usePresence

Check if any person is detected.

```tsx
const hasPresence = usePresence();
```

### useTotalPersonCount

Get total person count across all nodes.

```tsx
const totalPeople = useTotalPersonCount();
```

## Styling

All components use:
- Tailwind CSS for styling
- Slate color palette for consistency
- Gradient backgrounds for depth
- Lucide React icons

## Real-time Updates

Components automatically refetch every 2 seconds (configurable) to keep vital signs current.

## Example Dashboard

```tsx
'use client';

import { VitalsOverview, HealthAlertBanner } from '@/components/vitals';

export default function CaregiverrDashboard() {
  return (
    <>
      <HealthAlertBanner />
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-8">Family Health Monitor</h1>
        <VitalsOverview />
      </div>
    </>
  );
}
```
