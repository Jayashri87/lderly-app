import type { Meta, StoryObj } from "@storybook/react";
import { useOperationalHeartbeat } from "./useOperationalHeartbeat";

function HeartbeatPreview() {
  const heartbeat = useOperationalHeartbeat(2000);

  return (
    <div className="glass-panel magic-monitoring-frame rounded-[1.5rem] p-5 text-white">
      <p className="text-sm font-semibold text-emerald-100">Operational heartbeat</p>
      <p className="mt-3 text-2xl font-semibold">{heartbeat.label}</p>
      <p className="mt-2 text-sm text-white/55">Beat {heartbeat.beat}</p>
    </div>
  );
}

const meta = {
  title: "Realtime/Operational Heartbeat",
  component: HeartbeatPreview,
  parameters: {
    layout: "centered"
  }
} satisfies Meta<typeof HeartbeatPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Active: Story = {};
