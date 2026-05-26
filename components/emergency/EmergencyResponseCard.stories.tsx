import type { Meta, StoryObj } from "@storybook/react";
import { EmergencyResponseCard } from "./EmergencyResponseCard";

const meta = {
  title: "Emergency/EmergencyResponseCard",
  component: EmergencyResponseCard,
  args: {
    active: true,
    title: "Emergency team is reviewing now",
    description: "Ops is coordinating the response path and keeping the family informed.",
    steps: [
      { label: "Customer alert received", status: "done" },
      { label: "Ops team reviewing", status: "active" },
      { label: "Responder routing", status: "next" },
      { label: "Family update sent", status: "next" }
    ]
  }
} satisfies Meta<typeof EmergencyResponseCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Active: Story = {};
