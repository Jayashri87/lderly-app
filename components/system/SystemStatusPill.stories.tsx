import type { Meta, StoryObj } from "@storybook/react";
import { SystemStatusPill } from "./SystemStatusPill";

const meta = {
  title: "System/Status Pill",
  component: SystemStatusPill,
  parameters: {
    layout: "centered"
  }
} satisfies Meta<typeof SystemStatusPill>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Live: Story = {
  args: {
    label: "Monitoring",
    status: "live",
    pulse: true
  }
};

export const Emergency: Story = {
  args: {
    label: "Escalating",
    status: "critical",
    pulse: true
  }
};
