import { existsSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import {
  communicationReadiness,
  hasMessagingProviderConfig
} from "../../../../server/communicationProvider";
import { featureFlagReadiness } from "../../../../server/featureFlags";
import { hasFirebaseAdminConfig } from "../../../../server/firebaseAdmin";
import { GoogleWorkspaceProvider } from "../../../../server/googleWorkspaceProvider";
import { internalOpsReadiness } from "../../../../server/internalOpsProvider";
import { hasGeocodingConfig, hasGoogleRoutesConfig } from "../../../../server/locationProvider";
import {
  hasRazorpayConfig,
  hasRazorpayWebhookConfig,
  paymentMockFailClosed
} from "../../../../server/paymentProvider";
import { kycMockFailClosed } from "../../../../server/kycProvider";
import { mockProvidersFailClosed } from "../../../../server/mockProviderPolicy";
import {
  hasVoiceNoteStorageConfig,
  voiceNoteMockFailClosed
} from "../../../../server/voiceNoteProvider";
import { appCheckReadiness } from "../../../../server/appCheckProvider";

const hasEnv = (name: string) => Boolean(process.env[name]);
const hasAnyEnv = (names: string[]) => names.some((name) => hasEnv(name));
const rulesDeployed =
  process.env.FIREBASE_RULES_DEPLOYED === "true" ||
  existsSync(join(process.cwd(), ".firebase-rules-deployed.json"));
const googleWorkspaceReadiness = GoogleWorkspaceProvider.readiness();

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
      customerOtpSessionRoute: true,
      serverOwnedClientWrites: true,
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
      uberStyleTrackingPolish: true,
      arrivingSoonCustomerState: true,
      liveGpsFreshnessUi: true,
      animatedTrackingTimeline: true,
      monitoringSnapshotApi: true,
      monitoringHealthSnapshotApi: true,
      githubActionsCiPrepared: true,
      groupedCiSmokeRunner: true,
      featureFlags: featureFlagReadiness,
      firebaseAppCheckPrepared: true,
      firebaseAppCheckReadiness: appCheckReadiness,
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
      caretakerScopedFirebaseRulesPrepared: true,
      serverOwnedNotificationWrites: true,
      productionMockProvidersDisabled: mockProvidersFailClosed,
      paymentMockFailClosed,
      voiceNoteMockFailClosed,
      kycMockFailClosed,
      paymentCheckoutRoute: true,
      paymentConfirmRoute: true,
      razorpayConfigured: hasRazorpayConfig,
      razorpayWebhookConfigured: hasRazorpayWebhookConfig,
      notificationDispatchRoute: true,
      notificationRetryApi: true,
      notificationRetryPolicy: true,
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
      opsRecoveryApi: true,
      opsMaintenanceApi: true,
      opsBackupManifestApi: true,
      opsGoLiveReadinessApi: true,
      opsRunbookApi: true,
      auditRetentionPolicyApi: true,
      uploadSafetyApi: true,
      uploadMalwareScanPolicy: true,
      opsMaintenanceCronPrepared: existsSync(join(process.cwd(), "vercel.json")),
      opsMaintenanceCronConfigured: hasEnv("CRON_SECRET"),
      expiredLockCleanup: true,
      idempotencyRetentionCleanup: true,
      staleBookingRecovery: true,
      noShowDetection: true,
      recoveryAuditTrail: true,
      opsAuditViewerApi: true,
      opsAuditViewerUi: true,
      emergencyQueueUi: true,
      incidentQueueUi: true,
      panicSosQueueUi: true,
      delayedBookingQueueUi: true,
      shadcnStylePrimitives: true,
      tanstackQueryProvider: true,
      posthogPrepared: true,
      microsoftClarityPrepared: true,
      googleWorkspaceReadiness,
      googleSheetsLeadSync: googleWorkspaceReadiness.sheetsLeadsConfigured,
      googleCalendarOpsSync: googleWorkspaceReadiness.calendarOpsConfigured,
      googleDriveReportStorage: googleWorkspaceReadiness.driveRootConfigured,
      googleDocsMonthlyReports: googleWorkspaceReadiness.monthlyReportTemplateConfigured,
      lottiePrepared: true,
      sentrySdkPrepared: true,
      freeAiReassuranceApi: true,
      aiOpsSummaryApi: true,
      aiCaregiverNoteCleanupApi: true,
      aiAnomalySignals: true,
      aiMonthlyReportIntelligence: true,
      aiDailyCareSummaryUi: true,
      customerRetentionEngineApi: true,
      recurringCareNudgesUi: true,
      familyReassuranceDigestUi: true,
      continuityCareRecommendations: true,
      caregiverTrustProfileUi: true,
      caregiverTrustProfileApi: true,
      familyPermissionsUi: true,
      visitProofUi: true,
      visitProofApi: true,
      familyConfidenceScoreUi: true,
      visitProofTimelineUi: true,
      postVisitNextActionUi: true,
      trustLedgerRatingUpdates: true,
      sameCaregiverRebookingUi: true,
      monthlyNriPreviewUi: true,
      awsScaleArchitecturePrepared: true,
      emergencyEscalationApi: true,
      partnerMarketplaceApi: true,
      partnerDispatchApi: true,
      geocodingRoute: true,
      geocodingConfigured: hasGeocodingConfig,
      googleRoutesEtaApi: true,
      googleRoutesConfigured: hasGoogleRoutesConfig,
      liveRoutePolylineMap: true,
      smoothCaregiverMarkerMotion: true,
      trafficAwareEtaRefresh: true,
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
        ...(hasGoogleRoutesConfig ? [] : ["Google Routes API key for traffic-aware ETA"]),
        ...(googleWorkspaceReadiness.configured
          ? []
          : ["Google Workspace service account for Sheets, Calendar, Drive, Docs"]),
        ...(googleWorkspaceReadiness.sheetsLeadsConfigured
          ? []
          : ["Google Sheets lead spreadsheet ID"]),
        ...(googleWorkspaceReadiness.calendarOpsConfigured
          ? []
          : ["Google Calendar ops calendar ID"]),
        ...(googleWorkspaceReadiness.driveRootConfigured
          ? []
          : ["Google Drive root folder ID"]),
        ...(googleWorkspaceReadiness.monthlyReportTemplateConfigured
          ? []
          : ["Google Docs monthly report template ID"]),
        ...(hasAnyEnv(["SENTRY_DSN", "NEXT_PUBLIC_POSTHOG_KEY", "NEXT_PUBLIC_MIXPANEL_TOKEN"])
          ? []
          : ["Sentry/PostHog/Mixpanel production monitoring keys"]),
        ...(hasMessagingProviderConfig
          ? []
          : ["India communication provider: WhatsApp Business, MSG91, or Exotel"]),
        ...(internalOpsReadiness.slackConfigured ? [] : ["Slack ops webhook for internal alerts"]),
        ...(hasEnv("NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY")
          ? []
          : ["Firebase App Check reCAPTCHA Enterprise site key"]),
        ...(hasEnv("CRON_SECRET") ? [] : ["CRON_SECRET for automated ops maintenance"]),
        "Backend dependency: external Firebase RTDB export destination",
        "Backend dependency: FCM web push/VAPID production setup",
        "Backend dependency: payment reconciliation job",
        "Backend dependency: refund reconciliation workflow",
        "Backend dependency: caregiver payout bank-transfer integration",
        "Backend dependency: GST invoice PDF generation/storage",
        "Backend dependency: WhatsApp template approval and delivery webhooks",
        "Backend dependency: MSG91 OTP/SMS fallback",
        "Backend dependency: Exotel emergency calling",
        "Backend dependency: production route/ETA provider decision",
        "Backend dependency: upload malware scanning process",
        "Backend dependency: voice-note playback and retention policy",
        "Backend dependency: uptime monitoring for customer/partner/ops APIs",
        "Backend dependency: support-ticket provider decision",
        "Backend dependency: staging environment",
        "Backend dependency: domain/DNS split for app, partner, and ops"
      ]
    }
  });
}
