import type { Meta, StoryObj } from "@storybook/react";
import { DashboardSkeletonGrid, LiveCareSkeleton } from "./SystemSkeletons";

const meta = {
  title: "System/Skeletons",
  parameters: {
    layout: "padded"
  }
} satisfies Meta;

export default meta;

type Story = StoryObj;

export const LiveCareLoading: Story = {
  render: () => <LiveCareSkeleton className="max-w-xl" />
};

export const DashboardLoading: Story = {
  render: () => <DashboardSkeletonGrid count={6} />
};
