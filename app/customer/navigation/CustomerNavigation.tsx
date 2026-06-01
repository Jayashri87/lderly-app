"use client";

import { Home, MapPinned, UserRound } from "lucide-react";
import { SystemStatusPill } from "../../../components/system/SystemStatusPill";

export type CustomerTabKey = "home" | "journey" | "profile";

type CustomerNavigationProps = {
  activeTab: CustomerTabKey;
  onTabChange: (tab: CustomerTabKey) => void;
};

const navItems = [
  { key: "home" as const, label: "Home", icon: Home },
  { key: "journey" as const, label: "Care", accessibleLabel: "Care Journey", icon: MapPinned },
  { key: "profile" as const, label: "Profile", icon: UserRound }
];

export function CustomerNavigation({ activeTab, onTabChange }: CustomerNavigationProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 px-4 pb-4 pt-2" aria-label="Main navigation">
      <div className="glass-panel mx-auto grid max-w-md grid-cols-3 gap-2 rounded-[2rem] p-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.key;
          const label = item.accessibleLabel || item.label;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onTabChange(item.key)}
              aria-current={active ? "page" : undefined}
              aria-label={label}
              className={`rounded-2xl px-3 py-3 text-xs transition focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-[#06130f] ${
                active ? "bg-white text-[#06130f]" : "text-white/55"
              }`}
            >
              <Icon className="mx-auto h-5 w-5" aria-hidden="true" />
              <span className="mt-1 block font-medium">{item.label}</span>
              {active ? (
                <span className="mt-2 flex justify-center">
                  <SystemStatusPill label="live" status="live" pulse />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
