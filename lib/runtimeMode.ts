export type LderlyRuntimeMode = "demo" | "development" | "production" | "staging";

const knownModes = new Set<LderlyRuntimeMode>([
  "demo",
  "development",
  "production",
  "staging"
]);

export const getLderlyRuntimeMode = (): LderlyRuntimeMode => {
  const explicitMode =
    process.env.NEXT_PUBLIC_LDERLY_APP_MODE ||
    process.env.LDERLY_APP_MODE ||
    process.env.VERCEL_ENV;

  if (explicitMode && knownModes.has(explicitMode as LderlyRuntimeMode)) {
    return explicitMode as LderlyRuntimeMode;
  }

  return process.env.NODE_ENV === "production" ? "production" : "development";
};

export const isProductionRuntime = () => getLderlyRuntimeMode() === "production";

