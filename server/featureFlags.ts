const enabledByDefault = new Set([
  "analytics",
  "caregiverDispatch",
  "emergencyCommand",
  "familyReports",
  "partnerMarketplace",
  "retention",
  "trustProfiles"
]);

const readFlag = (name: string) => {
  const envName = `LDERLY_FEATURE_${name
    .replace(/([A-Z])/g, "_$1")
    .toUpperCase()}`;
  const value = process.env[envName];

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return enabledByDefault.has(name);
};

export const featureFlags = {
  analytics: readFlag("analytics"),
  aiAssistance: readFlag("aiAssistance"),
  caregiverDispatch: readFlag("caregiverDispatch"),
  emergencyCommand: readFlag("emergencyCommand"),
  familyReports: readFlag("familyReports"),
  partnerMarketplace: readFlag("partnerMarketplace"),
  retention: readFlag("retention"),
  trustProfiles: readFlag("trustProfiles"),
  voiceNotes: readFlag("voiceNotes")
};

export const featureFlagReadiness = {
  configured: true,
  stagedRolloutReady: true,
  enabled: featureFlags,
  disabledCount: Object.values(featureFlags).filter((value) => !value).length
};

export const isFeatureEnabled = (name: keyof typeof featureFlags) => featureFlags[name];
