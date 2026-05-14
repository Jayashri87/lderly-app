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

export const dynamic = "force-dynamic";

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
      analyticsFunnelKpis: true,
      opsKpiApi: true,
      realtimeSlaExperience: true,
      dispatchIntelligenceApi: true,
      caregiverReassignmentApi: true,
      delayedAssignmentQueue: true,
      dispatchConflictDetection: true,
      backupCaregiverRecommendations: true,
      opsCommandDispatchUi: true,
      liveCaregiverAvailabilityBoard: true,
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
      monthlyNriReportApi: true,
      invoiceGstApi: true,
      caregiverPayoutApi: true,
      subscriptionPlanApi: true,
      medicationScheduleApi: true,
      medicationAdherenceApi: true,
      careRiskSummaryApi: true,
      fallRiskIndicators: true,
      missedCareDetection: true,
      emergencyReadinessScore: true,
      dementiaChronicConditionFlags: true,
      incidentReportApi: true,
      caretakerTrainingBadgeApi: true,
      caregiverReliabilityScoringApi: true,
      complaintLifecycleApi: true,
      refundLifecycleApi: true,
      emergencyCommandCenterApi: true,
      opsCommandCenterQueues: true,
      opsCommandCenterActions: true,
      emergencyQueueUi: true,
      incidentQueueUi: true,
      panicSosQueueUi: true,
      delayedBookingQueueUi: true,
      shadcnStylePrimitives: true,
      tanstackQueryProvider: true,
      posthogPrepared: true,
      microsoftClarityPrepared: true,
      lottiePrepared: true,
      sentrySdkPrepared: true,
      freeAiReassuranceApi: true,
      aiDailyCareSummaryUi: true,
      caregiverTrustProfileUi: true,
      caregiverTrustProfileApi: true,
      familyPermissionsUi: true,
      visitProofUi: true,
      visitProofApi: true,
      trustLedgerRatingUpdates: true,
      sameCaregiverRebookingUi: true,
      monthlyNriPreviewUi: true,
      awsScaleArchitecturePrepared: true,
      emergencyEscalationApi: true,
      partnerMarketplaceApi: true,
      partnerDispatchApi: true,
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
