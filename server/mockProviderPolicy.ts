const productionMocksExplicitlyAllowed =
  process.env.LDERLY_ALLOW_PRODUCTION_MOCKS === "true";

export const isProductionRuntime =
  process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

export const allowMockProviders =
  !isProductionRuntime || productionMocksExplicitlyAllowed;

export const mockProvidersFailClosed =
  isProductionRuntime && !productionMocksExplicitlyAllowed;

export const assertMockProviderAllowed = (provider: string) => {
  if (!allowMockProviders) {
    throw new Error(
      `${provider} mock provider is disabled in production. Configure the real provider or set LDERLY_ALLOW_PRODUCTION_MOCKS=true for a controlled non-production drill.`
    );
  }
};
