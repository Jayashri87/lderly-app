import type { Meta, StoryObj } from "@storybook/react";
import { LiveOperationalDock } from "./LiveOperationalDock";

const meta = {
  title: "Realtime/LiveOperationalDock",
  component: LiveOperationalDock,
  args: {
    title: "Caregiver active now",
    subtitle: "Family and ops are receiving live status updates.",
    status: "live",
    signals: [
      { label: "ETA", value: "8 min" },
      { label: "Check-in", value: "1 min ago" },
      { label: "SLA", value: "Healthy" }
    ]
  }
} satisfies Meta<typeof LiveOperationalDock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
