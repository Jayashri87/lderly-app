"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, HeartHandshake, ShieldCheck, UserRound } from "lucide-react";

const portalLinks = [
  {
    href: "/login",
    label: "Customer",
    description: "Family care app",
    icon: UserRound
  },
  {
    href: "/partner",
    label: "Partner",
    description: "Caregiver app",
    icon: HeartHandshake
  },
  {
    href: "/ops",
    label: "Admin",
    description: "Ops panel",
    icon: Building2
  },
  {
    href: "/superadmin",
    label: "Super Admin",
    description: "Owner access",
    icon: ShieldCheck
  }
];

export function PortalLoginSwitch({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="LDERLY portal login choices"
      className={
        compact
          ? "grid grid-cols-2 gap-2"
          : "grid grid-cols-2 gap-2 rounded-[1.5rem] border border-white/10 bg-white/[0.06] p-2 backdrop-blur"
      }
    >
      {portalLinks.map((portal) => {
        const Icon = portal.icon;
        const active = pathname === portal.href;

        return (
          <Link
            key={portal.href}
            href={portal.href}
            className={[
              "group flex min-h-16 items-center gap-3 rounded-2xl px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06130f]",
              compact
                ? active
                  ? "bg-[#06130f] text-white shadow-lg shadow-black/10"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                : active
                  ? "bg-white text-[#06130f] shadow-lg shadow-black/10"
                  : "bg-white/8 text-white/78 hover:bg-white/14"
            ].join(" ")}
          >
            <span
              className={[
                "grid h-9 w-9 shrink-0 place-items-center rounded-full",
                active
                  ? compact
                    ? "bg-emerald-300/20 text-emerald-100"
                    : "bg-emerald-100 text-emerald-700"
                  : compact
                    ? "bg-white text-emerald-700"
                    : "bg-white/10 text-emerald-100"
              ].join(" ")}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{portal.label}</span>
              <span
                className={
                  compact
                    ? active
                      ? "block text-xs text-white/75"
                      : "block text-xs text-slate-500"
                    : active
                      ? "block text-xs text-slate-500"
                      : "block text-xs text-white/65"
                }
              >
                {portal.description}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
