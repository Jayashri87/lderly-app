import { existsSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import {
  communicationReadiness,
  hasMessagingProviderConfig
} from "../../../../server/communicationProvider";
import { hasFirebaseAdminConfig } from "../../../../server/firebaseAdmin";
import { internalOpsReadiness } from "../../../../server/internalOpsProvider";
import { hasGeocodingConfig } from "../../../../server/locationProvider";
import {
  hasRazorpayConfig,
  hasRazorpayWebhookConfig
} from "../../../../server/paymentProvider";
import { hasVoiceNoteStorageConfig } from "../../../../server/voiceNoteProvider";

const hasEnv = (name: string) => Boolean(process.env[name]);
const hasAnyEnv = (names: string[]) => names.some((name) => hasEnv(name));
const rulesDeployed =
  process.env.FIREBASE_RULES_DEPLOYED === "true" ||
  existsSync(join(process.cwd(), ".firebase-rules-deployed.json"));

export async function GET() {
  return NextResponse.json({
    firebaseAdmin: {
      configured: hasFirebaseAdminConfig,
      mode: hasFirebaseAdminConfig ? "trusted-writes-active" : "client-fallback"
    },
    auth: {
      signedSessions: hasEnv("LDERLY_AUTH_SECRET"),
      adminCredentials: hasEnv("LDERLY_ADMIN_USERNAME") && hasEnv("LDERLY_ADMIN_PASSWORD"),
      caretakerCredentials:
        hasEnv("LDERLY_CARETAKER_USERNAME") && hasEnv("LDERLY_CARETAKER_PASSWORD"),
      customerCredentials:
        hasEnv("LDERLY_CUSTOMER_USERNAME") && hasEnv("LDERLY_CUSTOMER_PASSWORD")
    },
    productionReadiness: {
      trustedBookingRoutes: true,
      scopedNotificationReads: true,
      scopedReportReads: true,
      serverRoleSyncRoute: true,
      deviceSessionRegistry: true,
      logoutAllDevicesRoute: true,
      auditLogging: true,
      caretakerKycUploadRoute: true,
      caretakerKycReviewRoute: true,
      careProfileApi: true,
      familyAccessApi: true,
      pricingQuoteApi: true,
      supportTicketApi: true,
      complaintApi: true,
      refundRequestApi: true,
      lifecycleNotificationApi: true,
      indiaFirstCommunication: communicationReadiness,
      internalOpsAlertsApi: true,
      internalOpsReadiness,
      analyticsEventApi: true,
      opsKpiApi: true,
      monitoringSnapshotApi: true,
      firebaseAppCheckPrepared: true,
      firebaseAppCheckConfigured: hasEnv("NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY"),
      pwaManifest: true,
      legalPages: true,
      observabilityConfigured: hasAnyEnv([
        "SENTRY_DSN",
        "NEXT_PUBLIC_POSTHOG_KEY",
        "NEXT_PUBLIC_MIXPANEL_TOKEN"
      ]),
      securityHeadersProxy: true,
      errorBoundaries: true,
      stricterRulesPrepared: true,
      stricterRulesDeployed: rulesDeployed,
      paymentCheckoutRoute: true,
      paymentConfirmRoute: true,
      razorpayConfigured: hasRazorpayConfig,
      razorpayWebhookConfigured: hasRazorpayWebhookConfig,
      notificationDispatchRoute: true,
      pushTokenRegistrationApi: true,
      pushDispatchApi: true,
      messagingProviderConfigured: hasMessagingProviderConfig,
      caretakerAttendanceApi: true,
      shiftAnalyticsApi: true,
      familyReportAccessApi: true,
      aiReportSummaryApi: true,
      geocodingRoute: true,
      geocodingConfigured: hasGeocodingConfig,
      voiceNoteUploadRoute: true,
      voiceNoteStorageConfigured: hasVoiceNoteStorageConfig,
      firebaseRulesFile: true,
      pending: [
        ...(hasFirebaseAdminConfig ? [] : ["Firebase Admin service account"]),
        ...(hasFirebaseAdminConfig
          ? []
          : ["Firebase custom claims and server-owned role writes activation"]),
        ...(rulesDeployed ? [] : ["Deploy stricter Firebase rules after Admin activation"]),
        ...(hasRazorpayConfig && hasRazorpayWebhookConfig
          ? []
          : ["Razorpay keys and webhook secret"]),
        ...(hasVoiceNoteStorageConfig ? [] : ["Voice-note storage provider"]),
        ...(hasEnv("NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID")
          ? []
          : ["Google Maps production Map ID"]),
        ...(hasAnyEnv(["SENTRY_DSN", "NEXT_PUBLIC_POSTHOG_KEY", "NEXT_PUBLIC_MIXPANEL_TOKEN"])
          ? []
          : ["Sentry/PostHog/Mixpanel production monitoring keys"]),
        ...(hasMessagingProviderConfig
          ? []
          : ["India communication provider: WhatsApp Business, MSG91, or Exotel"]),
        ...(internalOpsReadiness.slackConfigured ? [] : ["Slack ops webhook for internal alerts"]),
        ...(hasEnv("NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY")
          ? []
          : ["Firebase App Check reCAPTCHA Enterprise site key"])
      ]
    }
  });
}
