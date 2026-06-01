"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { HeartPulse, Pill, Sparkles, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LiveActivityTimeline, LiveSystemPanel } from "../components/system/LiveSystemPanel";
import { LiveOperationalDock } from "../components/realtime/LiveOperationalDock";
import { Skeleton } from "../components/ui/skeleton";
import { AuthService, SessionUser } from "../services/authService";
import { BookingRequestDetails, BookingService, CareBooking } from "../services/bookingService";
import { HealthService, HealthSnapshot } from "../services/healthService";
import { CareProfile, ProfileService } from "../services/profileService";
import type { CareRecipientProfile } from "../services/profileService";
import { ReportService, VisitReport } from "../services/reportService";
import { CareJourney, JourneyService } from "../services/journeyService";
import { NotificationService } from "../services/notificationService";
import { trackProductEvent } from "../services/productAnalytics";
import {
  AccessibilityCareControls,
  BookingFunnel,
  CareConfidence,
  CareContinuitySystem,
  CareOnWay,
  CompactStatus,
  FamilyReassuranceSystem,
  FirstTimeHome,
  JourneyExperience,
  MedicalRiskPanel,
  NriMonthlyReportPreview,
  PaymentTermsModal,
  PrimaryCareCta,
  ProfilePanel,
  QuickActions,
  RealtimeCareStrip,
  RecipientDetailsSetup,
  RecipientGate,
  Screen,
  SessionSummaryPreview,
  SmartRecommendation,
  TrustedCaregiverProfile,
  VisitProofSystem
} from "./customer/CustomerSections";
import { CustomerNavigation } from "./customer/navigation/CustomerNavigation";

type TabKey = "home" | "journey" | "profile";
type BookingStep = "need" | "service" | "duration" | "time" | "location" | "review";

type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: "INR";
  name: string;
  description: string;
  order_id: string;
  prefill?: {
    name?: string;
  };
  theme?: {
    color?: string;
  };
  handler: (response: RazorpayPaymentResponse) => void;
  modal?: {
    ondismiss?: () => void;
  };
};

type RazorpayPaymentResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayWindow = Window & {
  Razorpay?: new (options: RazorpayCheckoutOptions) => { open: () => void };
};

type RazorpayCheckout = {
  mode: "razorpay" | "mock";
  provider: "razorpay";
  orderId: string;
  keyId: string;
  amount: number;
  currency: "INR";
  customerName: string;
  description: string;
  mockCheckoutUrl?: string;
};

type Recipient = {
  name: string;
  displayName: string;
  shortName: string;
  avatar: string;
  age: number;
  status: string;
  tag: string;
  gradient: string;
};

type CareNeed = {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  services: string[];
  serviceGroups?: Array<{
    title: string;
    subtitle: string;
    services: string[];
  }>;
  recommendation: string;
};

type DurationOption = {
  label: string;
  price: string;
  note: string;
  recommended?: boolean;
};

type TimeOption = {
  label: string;
  detail: string;
};

type LocationOption = {
  label: string;
  detail: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
};

type AiReassuranceInsight = {
  id: string;
  headline: string;
  summary: string;
  emotionalMessage: string;
  nextAction: string;
  createdAt: number;
};

type CaregiverTrustProfile = {
  uid: string;
  name: string;
  status: string;
  trustScore: number;
  rating: number;
  punctualityScore: number;
  repeatVisits: number;
  yearsExperience: number;
  languages: string[];
  skills: string[];
  badges: string[];
  signals: string[];
};

type VisitProof = {
  bookingId: string;
  status: "pending" | "verified";
  serviceType: string;
  caretakerName: string;
  timestampLabel: string;
  locationLabel: string;
  gpsVerified: boolean;
  timestampVerified: boolean;
  reportReady: boolean;
  vitalsSummary: string;
  medicineSummary: string;
  familySummary: string;
  caregiverNote: string;
  proofSignals: string[];
  completedChecks?: string[];
  confidenceScore?: number;
  nextBestAction?: string;
  ratingPrompt?: string;
  rebookPrompt?: string;
  timeline?: Array<{
    label: string;
    at: number;
    verified: boolean;
  }>;
  attachments: VisitReport["attachments"];
};

type CareRiskSummary = {
  userId: string;
  recipientName: string;
  riskScore: number;
  riskLevel: "stable" | "watch" | "high";
  fallRisk: "low" | "medium" | "high";
  dementiaSupport: boolean;
  chronicConditionFlags: string[];
  medicationRisk: "stable" | "watch" | "missed";
  vitalsRisk: "stable" | "watch" | "high";
  openIncidents: number;
  emergencyReadinessScore: number;
  missedCareSignals: string[];
  riskSignals: string[];
  recommendations: string[];
  generatedAt: number;
};

type RetentionSummary = {
  id: string;
  recipientName: string;
  retentionScore: number;
  recurringActive: boolean;
  lastServiceType: string;
  preferredCaregiverName: string;
  completedVisits: number;
  familyDigestReady: boolean;
  headline: string;
  reassuranceLine: string;
  nextBestAction: string;
  actions: Array<{
    id: string;
    title: string;
    body: string;
    cta: string;
    kind: "rebook" | "recurring" | "family_digest" | "medical_followup";
    serviceType: string;
    priority: "normal" | "recommended" | "urgent";
  }>;
};

type RecipientDetails = {
  fullName: string;
  age: string;
  phone: string;
  address: string;
  healthNotes: string;
  allergies: string;
  mobility: string;
  language: string;
};

const recipients: Recipient[] = [
  {
    name: "Mother",
    displayName: "Mom",
    shortName: "Mom",
    avatar: "M",
    age: 72,
    status: "Doing well",
    tag: "Medicine completed",
    gradient: "from-rose-300 to-orange-200"
  },
  {
    name: "Father",
    displayName: "Dad",
    shortName: "Dad",
    avatar: "D",
    age: 76,
    status: "Stable",
    tag: "Walk due today",
    gradient: "from-sky-300 to-cyan-200"
  },
  {
    name: "Self / Others",
    displayName: "Self / Others",
    shortName: "Self",
    avatar: "+",
    age: 68,
    status: "Ready",
    tag: "Personal or family care",
    gradient: "from-emerald-300 to-teal-200"
  }
];

const careNeeds: CareNeed[] = [
  {
    title: "Health assistance",
    subtitle: "Doctor visits, hospital support, lab tests, and reports",
    icon: HeartPulse,
    services: [
      "Doctor Visit - Book Appointment",
      "Doctor Visit - Accompanied Visit",
      "Hospital Stay - Attender Support",
      "Lab Test - Book Appointment",
      "Lab Test - Visit Assistance",
      "Reports - Collect Report",
      "Doctor Follow-up - Visit With Reports",
      "Post-Consultation Medicine Pickup"
    ],
    serviceGroups: [
      {
        title: "Doctor Visit",
        subtitle: "Appointments, accompaniment, and follow-ups",
        services: [
          "Doctor Visit - Book Appointment",
          "Doctor Visit - Accompanied Visit",
          "Doctor Follow-up - Visit With Reports"
        ]
      },
      {
        title: "Hospital Stay",
        subtitle: "Attender support during admission or observation",
        services: [
          "Hospital Stay - Day Attender",
          "Hospital Stay - Overnight Attender",
          "Hospital Discharge Support"
        ]
      },
      {
        title: "Lab Tests",
        subtitle: "Booking, visit help, and report collection",
        services: [
          "Lab Test - Book Appointment",
          "Lab Test - Visit Assistance",
          "Reports - Collect Report"
        ]
      },
      {
        title: "After Visit",
        subtitle: "Practical help after doctor or lab work",
        services: [
          "Post-Consultation Medicine Pickup",
          "Share Reports With Family",
          "Care Coordinator Follow-up"
        ]
      }
    ],
    recommendation:
      "Choose this for appointments, hospital attender support, lab work, or report follow-up."
  },
  {
    title: "Medicine help",
    subtitle: "Medicine pickup, reminders, and recovery support",
    icon: Pill,
    services: ["Medicine Procurement", "Medicine Schedule", "Recovery Monitoring"],
    recommendation: "Medicine support recommended tonight."
  },
  {
    title: "Companionship",
    subtitle: "Conversation, walks, temple visits, and celebrations",
    icon: UserRound,
    services: [
      "Conversation",
      "Walks",
      "Temple Visit",
      "Birthday Celebration",
      "Special Occasion Celebration",
      "Festival Celebration"
    ],
    recommendation: "A gentle visit can help with companionship, walks, and daily reassurance."
  },
  {
    title: "Daily support",
    subtitle: "Meals, errands, and check-ins",
    icon: Sparkles,
    services: ["Meal Support", "Daily Errands"],
    recommendation: "Best when family wants a calm daily check-in."
  }
];

const durationOptions: DurationOption[] = [
  { label: "1 Hour", price: "Rs 399", note: "Quick nearby support" },
  {
    label: "Half Day",
    price: "Rs 1,499",
    note: "Best for doctor and lab visits",
    recommended: true
  },
  { label: "Full Day", price: "Rs 2,699", note: "Continuous day care" },
  { label: "Overnight", price: "Rs 3,499", note: "Evening to morning care" },
  { label: "Recurring Care", price: "Custom", note: "Weekly or monthly plan" }
];

const timeOptions: TimeOption[] = [
  { label: "Now", detail: "Find the earliest available caregiver" },
  { label: "Today later", detail: "Choose this for a same-day visit" },
  { label: "Tomorrow", detail: "Plan care for tomorrow" },
  { label: "Pick date/time", detail: "Schedule a specific slot" },
  { label: "Recurring", detail: "Set up repeated care" }
];

const reassuranceFeed = [
  "Care request received.",
  "Caregiver assignment will appear here.",
  "Live updates will begin after the service starts."
];

const serviceExperienceFor = (serviceType?: string) => {
  const service = cleanServiceName(serviceType).toLowerCase();

  if (service.includes("hospital")) {
    const overnight = service.includes("overnight");
    const discharge = service.includes("discharge");

    return {
      feedTitle: discharge
        ? "Hospital discharge updates"
        : overnight
          ? "Overnight attender updates"
          : "Hospital attender updates",
      feed: discharge
        ? [
            "Discharge timing checked with the hospital desk.",
            "Bills, medicines, and report documents are being coordinated.",
            "Caregiver is helping with exit formalities.",
            "Transport and home arrival support are being checked.",
            "Family discharge update shared.",
            "Voice note ready from the caregiver."
          ]
        : overnight
          ? [
              "Overnight attender checked in at the hospital.",
              "Night medication and nurse instructions reviewed.",
              "Patient comfort and water support checked.",
              "Doctor / nurse round notes will be shared if available.",
              "Morning handover update scheduled for family.",
              "Voice note ready from the overnight attender."
            ]
          : [
              "Day attender checked in at the hospital.",
              "Admission / observation desk support completed.",
              "Doctor round update noted.",
              "Meals and water support checked.",
              "Family update shared by the attender.",
              "Voice note ready from the attender."
            ],
      summary: ["Attender present", "Doctor round noted", "Meals supported", "Family updated"],
      note: "Attender note: The hospital stay is being monitored and family updates are active.",
      profilePreference: "Hospital attender updates, discharge support, and family coordination",
      trackLabel: "Track Hospital Support",
      rebookLabel: "Rebook Attender"
    };
  }

  if (service.includes("lab") || service.includes("report")) {
    const reportCollection = service.includes("collect report");
    const appointment = service.includes("book appointment");

    return {
      feedTitle: reportCollection
        ? "Report collection updates"
        : appointment
          ? "Lab appointment updates"
          : "Lab visit updates",
      feed: reportCollection
        ? [
            "Report availability checked with the lab.",
            "Caregiver is heading to collect the report.",
            "Lab receipt / patient details verified.",
            "Report collection status updated.",
            "Reports will be shared with family after collection.",
            "Coordinator note added for doctor follow-up."
          ]
        : appointment
          ? [
              "Preferred lab and time slot being checked.",
              "Lab appointment details confirmed.",
              "Test preparation instructions noted.",
              "Family will receive appointment confirmation.",
              "Visit support can be added if needed.",
              "Coordinator note added for the lab appointment."
            ]
          : [
              "Lab visit assistance confirmed.",
              "Caregiver is ready for pickup and visit support.",
              "Test instructions and documents checked.",
              "Sample collection / test visit status updated.",
              "Report collection window will be tracked.",
              "Family update shared after the lab visit."
            ],
      summary: ["Appointment checked", "Visit supported", "Report tracked", "Family updated"],
      note: "Caregiver note: Lab and report steps are being tracked for family visibility.",
      profilePreference: "Lab appointment, visit assistance, and report collection updates",
      trackLabel: "Track Lab Support",
      rebookLabel: "Rebook Lab Help"
    };
  }

  if (service.includes("doctor")) {
    const appointment = service.includes("book appointment");
    const followUp = service.includes("follow-up") || service.includes("reports");

    return {
      feedTitle: appointment
        ? "Doctor appointment updates"
        : followUp
          ? "Doctor follow-up updates"
          : "Doctor visit updates",
      feed: appointment
        ? [
            "Preferred doctor and time slot being checked.",
            "Appointment booking request submitted.",
            "Clinic confirmation will be shared with family.",
            "Health notes are ready for the visit.",
            "Reminder will be created before the appointment.",
            "Coordinator note added for appointment booking."
          ]
        : followUp
          ? [
              "Reports are ready for doctor review.",
              "Caregiver briefed with report and health notes.",
              "Follow-up appointment / visit support in progress.",
              "Doctor advice will be summarized for family.",
              "Prescription follow-up marked.",
              "Voice summary ready from the caregiver."
            ]
          : [
              "Doctor visit support confirmed.",
              "Caregiver briefed with health notes.",
              "Travel and clinic wait time being monitored.",
              "Consultation notes ready for family review.",
              "Prescription follow-up marked.",
              "Voice summary ready from the caregiver."
            ],
      summary: ["Appointment confirmed", "Visit supported", "Notes captured", "Follow-up ready"],
      note: "Caregiver note: Doctor visit details and follow-up points are ready for family review.",
      profilePreference: "Doctor visits, appointment support, and report follow-up",
      trackLabel: "Track Doctor Visit",
      rebookLabel: "Rebook Doctor Help"
    };
  }

  if (service.includes("medicine") || service.includes("recovery")) {
    const procurement = service.includes("procurement") || service.includes("pickup");
    const schedule = service.includes("schedule");

    return {
      feedTitle: procurement
        ? "Medicine pickup updates"
        : schedule
          ? "Medicine schedule updates"
          : "Recovery monitoring updates",
      feed: procurement
        ? [
            "Prescription details reviewed.",
            "Nearest pharmacy availability being checked.",
            "Medicine pickup is in progress.",
            "Bill and medicine details will be shared with family.",
            "Dosage timing noted after pickup.",
            "Voice summary ready from the caregiver."
          ]
        : schedule
          ? [
              "Medicine schedule reviewed.",
              "Dosage timing confirmed.",
              "Reminder support is being set up.",
              "Missed-dose follow-up will be tracked.",
              "Family update shared for medicine timing.",
              "Caregiver note added for the schedule."
            ]
          : [
              "Recovery monitoring support confirmed.",
              "Comfort and routine check completed.",
              "Medicine and rest timing reviewed.",
              "Vitals / wellness observation noted.",
              "Family update shared.",
              "Voice summary ready from the caregiver."
            ],
      summary: ["Schedule checked", "Medicine supported", "Timing shared", "Recovery noted"],
      note: "Caregiver note: Medicine support is aligned with the saved schedule.",
      profilePreference: "Medicine reminders, pickup, and recovery monitoring",
      trackLabel: "Track Medicine Help",
      rebookLabel: "Rebook Medicine Help"
    };
  }

  if (
    service.includes("temple") ||
    service.includes("birthday") ||
    service.includes("festival") ||
    service.includes("occasion") ||
    service.includes("conversation") ||
    service.includes("walk")
  ) {
    const temple = service.includes("temple");
    const celebration =
      service.includes("birthday") || service.includes("festival") || service.includes("occasion");

    return {
      feedTitle: temple
        ? "Temple visit updates"
        : celebration
          ? "Celebration visit updates"
          : "Companionship updates",
      feed: temple
        ? [
            "Caregiver arrived for temple visit support.",
            "Travel and waiting time are being monitored.",
            "Mobility and comfort checked during the visit.",
            "Family update shared after darshan.",
            "Return trip support in progress.",
            "Voice note ready from the caregiver."
          ]
        : celebration
          ? [
              "Caregiver arrived for the celebration visit.",
              "Occasion details and family preferences checked.",
              "Photos or celebration notes can be shared with family.",
              "Comfort and meal timing checked.",
              "Mood looked positive during the celebration.",
              "Voice note ready from the caregiver."
            ]
          : [
              "Caregiver arrived for the visit.",
              "Conversation and comfort check completed.",
              "Walk / outing support updated.",
              "Family update shared.",
              "Mood looked positive during the visit.",
              "Voice note ready from the caregiver."
            ],
      summary: ["Visit completed", "Walk supported", "Mood positive", "Family updated"],
      note: "Caregiver note: The visit felt calm, familiar, and reassuring.",
      profilePreference: "Companionship, walks, temple visits, and family occasions",
      trackLabel: "Track Visit",
      rebookLabel: "Rebook Companion"
    };
  }

  if (service.includes("meal") || service.includes("errand")) {
    return {
      feedTitle: "Daily support updates",
      feed: [
        "Daily support request confirmed.",
        "Caregiver briefed with home instructions.",
        "Meal / errand support in progress.",
        "Home check-in completed.",
        "Family update shared.",
        "Caregiver note added."
      ],
      summary: ["Support confirmed", "Meal checked", "Errand supported", "Family updated"],
      note: "Caregiver note: Daily support was completed as requested.",
      profilePreference: "Meal support, errands, and home check-ins",
      trackLabel: "Track Daily Support",
      rebookLabel: "Rebook Daily Help"
    };
  }

  return {
    feedTitle: "Care updates",
    feed: reassuranceFeed,
    summary: ["Request received", "Assignment pending", "Updates pending", "Family notified"],
    note: "Care updates will be shared with the family once the service starts.",
    profilePreference: "Care updates and family coordination",
    trackLabel: "Track Active Care",
    rebookLabel: "Rebook Previous Care"
  };
};

const cleanServiceName = (serviceType?: string) => (serviceType || "Care").split(" for ")[0].trim();

const loadRazorpayScript = () =>
  new Promise<boolean>((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }

    const razorpayWindow = window as RazorpayWindow;

    if (razorpayWindow.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

const subscriptionKey = "lderly-care-subscription-started";
const recipientDetailsKey = "lderly-recipient-details-v2";

const readStoredRecipientDetails = () => {
  if (typeof window === "undefined") {
    return {} as Record<string, RecipientDetails>;
  }

  try {
    return JSON.parse(window.localStorage.getItem(recipientDetailsKey) || "{}") as Record<
      string,
      RecipientDetails
    >;
  } catch {
    window.localStorage.removeItem(recipientDetailsKey);
    return {} as Record<string, RecipientDetails>;
  }
};

const detailsFromProfile = (
  profile: CareProfile | null,
  relationship: string
): RecipientDetails | null => {
  const details = profile?.careRecipients?.[relationship];

  if (!details) {
    return null;
  }

  return {
    fullName: details.fullName,
    age: details.age ? String(details.age) : "",
    phone: details.phone,
    address: details.address,
    healthNotes: details.healthNotes,
    allergies: details.allergies,
    mobility: details.mobility,
    language: details.language
  };
};

const toCareRecipientProfile = (
  details: RecipientDetails
): Omit<CareRecipientProfile, "relationship" | "updatedAt"> => ({
  fullName: details.fullName.trim(),
  age: Number(details.age) || 0,
  phone: details.phone.trim(),
  address: details.address.trim(),
  healthNotes: details.healthNotes.trim(),
  allergies: details.allergies.trim(),
  mobility: details.mobility.trim(),
  language: details.language.trim()
});

export default function CustomerApp() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [session, setSession] = useState<SessionUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [journey, setJourney] = useState<CareJourney | null>(null);
  const [booking, setBooking] = useState<CareBooking | null>(null);
  const [health, setHealth] = useState<HealthSnapshot | null>(null);
  const [profile, setProfile] = useState<CareProfile | null>(null);
  const [reports, setReports] = useState<VisitReport[]>([]);
  const [recipientName, setRecipientName] = useState("");
  const [recipientDetails, setRecipientDetails] = useState<Record<string, RecipientDetails>>(
    readStoredRecipientDetails
  );
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingStep, setBookingStep] = useState<BookingStep>("need");
  const [selectedNeed, setSelectedNeed] = useState<CareNeed>(careNeeds[0]);
  const [selectedService, setSelectedService] = useState(careNeeds[0].services[0]);
  const [selectedDuration, setSelectedDuration] = useState(durationOptions[1]);
  const [selectedTime, setSelectedTime] = useState(timeOptions[0]);
  const [selectedLocation, setSelectedLocation] = useState<LocationOption>({
    label: "Saved care address",
    detail: "Add address in profile details"
  });
  const [careOnWay, setCareOnWay] = useState(false);
  const [careSubscriptionStarted, setCareSubscriptionStarted] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(subscriptionKey) === "true"
  );
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentTermsBooking, setPaymentTermsBooking] = useState<CareBooking | null>(null);
  const [bookingConfirmBusy, setBookingConfirmBusy] = useState(false);
  const [aiInsight, setAiInsight] = useState<AiReassuranceInsight | null>(null);
  const [caregiverTrust, setCaregiverTrust] = useState<CaregiverTrustProfile | null>(null);
  const [visitProof, setVisitProof] = useState<VisitProof | null>(null);
  const [careRisk, setCareRisk] = useState<CareRiskSummary | null>(null);
  const [retentionSummary, setRetentionSummary] = useState<RetentionSummary | null>(null);
  const lastStatusEventRef = useRef("");
  const lastStepEventRef = useRef("");
  const lastAiInsightRef = useRef("");

  const recipient = recipients.find((item) => item.name === recipientName) ?? recipients[0];
  const bookingIsFreshestActiveCare =
    Boolean(booking && booking.status !== "none") &&
    (!journey || journey.status === "idle" || (booking?.updatedAt ?? 0) >= journey.updatedAt);
  const visibleJourney = bookingIsFreshestActiveCare ? null : journey;
  const visibleBooking = booking;
  const bookingLiveStatuses = new Set([
    "accepted",
    "en_route",
    "arrived",
    "in_progress",
    "completed",
    "payment_settled",
    "report_generated"
  ]);
  const caregiverActiveStatuses = new Set(["en_route", "arrived", "in_progress"]);
  const journeyLiveStatuses = new Set([
    "accepted",
    "en_route",
    "arrived",
    "in_progress",
    "completed",
    "escalated"
  ]);
  const activeCare =
    (visibleJourney ? journeyLiveStatuses.has(visibleJourney.status) : false) ||
    (visibleBooking ? bookingLiveStatuses.has(visibleBooking.status) : false);
  const caregiverIsActive =
    (visibleJourney ? caregiverActiveStatuses.has(visibleJourney.status) : false) ||
    (visibleBooking ? caregiverActiveStatuses.has(visibleBooking.status) : false);
  const caregiverHasAccepted =
    (visibleJourney ? journeyLiveStatuses.has(visibleJourney.status) : false) ||
    (visibleBooking ? bookingLiveStatuses.has(visibleBooking.status) : false);
  const hasCareSubscription = careSubscriptionStarted;
  const currentService = cleanServiceName(
    bookingIsFreshestActiveCare
      ? visibleBooking?.serviceType
      : visibleJourney?.serviceType || visibleBooking?.serviceType || selectedService
  );
  const currentServiceExperience = serviceExperienceFor(currentService);
  const customerLiveTone =
    visibleBooking?.sla?.status === "breached"
      ? "critical"
      : visibleBooking?.sla?.status === "watch"
        ? "watch"
        : activeCare
          ? "live"
          : "healthy";
  const activeRecipientDetails =
    recipientDetails[recipient.name] || detailsFromProfile(profile, recipient.name);

  useEffect(() => {
    return AuthService.subscribe((user) => {
      setSession(user);
      setAuthReady(true);

      if (!user) {
        router.replace("/signin");
      }
    });
  }, [router]);

  useEffect(() => {
    if (!session) {
      return;
    }

    let cancelled = false;

    fetch("/api/bookings", {
      method: "GET",
      cache: "no-store"
    })
      .then(async (response) => {
        if (cancelled || response.status !== 401) {
          return;
        }

        setPaymentMessage("Your session expired. Please sign in again.");
        await AuthService.signOut();
        router.replace("/signin");
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [router, session]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const customerSession: SessionUser = { ...session, role: "customer" };
    const unsubscribers = [
      JourneyService.subscribe(customerSession, setJourney),
      BookingService.subscribe(customerSession, setBooking),
      HealthService.subscribe(customerSession, setHealth),
      ProfileService.subscribe(customerSession, setProfile),
      ReportService.subscribe(customerSession, setReports)
    ];
    NotificationService.registerPushToken(
      customerSession,
      `web-demo-token-${customerSession.uid}`,
      "web"
    );

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [session]);

  useEffect(() => {
    if (!session || !recipientName) {
      return;
    }

    trackProductEvent("customer_screen_viewed", {
      screen: activeTab,
      recipient: recipient.shortName,
      activeCare: Boolean(activeCare),
      service: currentService
    });
  }, [activeCare, activeTab, currentService, recipient.shortName, recipientName, session]);

  useEffect(() => {
    if (!session || !bookingOpen) {
      return;
    }

    const eventKey = `${bookingStep}:${selectedNeed.title}:${selectedService}`;

    if (lastStepEventRef.current === eventKey) {
      return;
    }

    lastStepEventRef.current = eventKey;
    trackProductEvent("booking_funnel_step_viewed", {
      step: bookingStep,
      recipient: recipient.shortName,
      need: selectedNeed.title,
      service: selectedService,
      duration: selectedDuration.label,
      time: selectedTime.label
    });
  }, [
    bookingOpen,
    bookingStep,
    recipient.shortName,
    selectedDuration.label,
    selectedNeed.title,
    selectedService,
    selectedTime.label,
    session
  ]);

  useEffect(() => {
    if (!session || !activeCare) {
      return;
    }

    const status = visibleBooking?.status || visibleJourney?.status || "idle";
    const bookingId = visibleBooking?.id || visibleJourney?.id || "";
    const eventKey = `${bookingId}:${status}:${currentService}`;

    if (lastStatusEventRef.current === eventKey) {
      return;
    }

    lastStatusEventRef.current = eventKey;
    trackProductEvent("care_live_status_changed", {
      bookingId,
      status,
      service: currentService,
      recipient: recipient.shortName,
      eta: visibleBooking?.tracking?.etaMinutes ?? visibleJourney?.eta ?? null,
      sla: visibleBooking?.sla?.status || "not_started"
    });
  }, [
    activeCare,
    currentService,
    recipient.shortName,
    session,
    visibleBooking?.id,
    visibleBooking?.sla?.status,
    visibleBooking?.status,
    visibleBooking?.tracking?.etaMinutes,
    visibleJourney?.eta,
    visibleJourney?.id,
    visibleJourney?.status
  ]);

  useEffect(() => {
    if (!session || !recipientName || !activeRecipientDetails) {
      return;
    }

    const bookingId = visibleBooking?.id || visibleJourney?.id || "";
    const insightKey = `${recipient.name}:${currentService}:${bookingId}`;

    if (lastAiInsightRef.current === insightKey) {
      return;
    }

    lastAiInsightRef.current = insightKey;
    fetch("/api/ai/reassurance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        bookingId,
        serviceType: currentService,
        recipientName: activeRecipientDetails.fullName || recipient.displayName
      })
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { insight?: AiReassuranceInsight } | null) => {
        setAiInsight(payload?.insight || null);
      })
      .catch(() => setAiInsight(null));
  }, [
    activeRecipientDetails,
    currentService,
    recipient.displayName,
    recipient.name,
    recipientName,
    session,
    visibleBooking?.id,
    visibleJourney?.id
  ]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const caretakerId = visibleBooking?.caretakerId || visibleJourney?.caretakerId;

    if (!caretakerId) {
      const timeout = window.setTimeout(() => setCaregiverTrust(null), 0);
      return () => window.clearTimeout(timeout);
    }

    let cancelled = false;

    fetch(`/api/trust/caregiver/${encodeURIComponent(caretakerId)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { profile?: CaregiverTrustProfile } | null) => {
        if (!cancelled) {
          setCaregiverTrust(payload?.profile || null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCaregiverTrust(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session, visibleBooking?.caretakerId, visibleJourney?.caretakerId]);

  useEffect(() => {
    if (!session || !visibleBooking?.id) {
      const timeout = window.setTimeout(() => setVisitProof(null), 0);
      return () => window.clearTimeout(timeout);
    }

    let cancelled = false;

    fetch(`/api/reports/visit-proof?bookingId=${encodeURIComponent(visibleBooking.id)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { proof?: VisitProof } | null) => {
        if (!cancelled) {
          setVisitProof(payload?.proof || null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVisitProof(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reports.length, session, visibleBooking?.id, visibleBooking?.updatedAt]);

  useEffect(() => {
    if (!session || !recipientName) {
      const timeout = window.setTimeout(() => setCareRisk(null), 0);
      return () => window.clearTimeout(timeout);
    }

    let cancelled = false;

    fetch(`/api/care-risk/summary?relationship=${encodeURIComponent(recipient.name)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { summary?: CareRiskSummary } | null) => {
        if (!cancelled) {
          setCareRisk(payload?.summary || null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCareRisk(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    health?.medicineStatus,
    health?.updatedAt,
    profile?.updatedAt,
    recipient.name,
    recipientName,
    reports.length,
    session,
    visibleBooking?.id,
    visibleBooking?.sla?.status
  ]);

  useEffect(() => {
    if (!session || !recipientName || !hasCareSubscription) {
      const timeout = window.setTimeout(() => setRetentionSummary(null), 0);
      return () => window.clearTimeout(timeout);
    }

    let cancelled = false;

    fetch("/api/retention/summary", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        recipientName: activeRecipientDetails?.fullName || recipient.displayName
      })
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { summary?: RetentionSummary } | null) => {
        if (!cancelled) {
          setRetentionSummary(payload?.summary || null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRetentionSummary(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeRecipientDetails?.fullName,
    hasCareSubscription,
    recipient.displayName,
    recipientName,
    reports.length,
    session,
    visibleBooking?.id,
    visibleBooking?.status
  ]);

  const selectTab = (tab: TabKey, source: string) => {
    trackProductEvent("customer_navigation_selected", {
      from: activeTab,
      to: tab,
      source,
      service: currentService,
      activeCare: Boolean(activeCare)
    });
    setActiveTab(tab);
  };

  const openBooking = () => {
    trackProductEvent("booking_funnel_opened", {
      recipient: recipient.shortName,
      service: currentService
    });
    lastStepEventRef.current = "";
    setBookingStep("need");
    setBookingOpen(true);
  };

  const rebookPreviousCare = () => {
    const previousService =
      reports[0]?.serviceType?.split(" for ")[0] ||
      booking?.serviceType?.split(" for ")[0] ||
      "Companion Care";
    const matchedNeed =
      careNeeds.find((need) => need.services.includes(previousService)) ?? careNeeds[0];

    trackProductEvent("rebook_previous_care_started", {
      recipient: recipient.shortName,
      service: previousService,
      source: reports[0] ? "report" : booking ? "booking" : "default"
    });
    setSelectedNeed(matchedNeed);
    setSelectedService(previousService);
    setBookingStep("duration");
    setBookingOpen(true);
  };

  const requestImmediateCare = async () => {
    if (!session) {
      router.replace("/signin");
      return;
    }

    const reason = `Immediate Assistance for ${recipient.name}`;
    await fetch("/api/emergency/escalate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "create",
        reason,
        locationLabel: activeRecipientDetails?.address || "Care location",
        severity: "critical"
      })
    }).catch(() => undefined);
    JourneyService.requestService({ ...session, role: "customer" }, reason);
    trackProductEvent("immediate_assistance_requested", {
      recipient: recipient.shortName,
      service: reason,
      activeCare: Boolean(activeCare)
    });
    window.localStorage.setItem(subscriptionKey, "true");
    setCareSubscriptionStarted(true);
    selectTab("journey", "immediate_assistance");
  };

  const openRazorpayCheckout = async (nextBooking: CareBooking) => {
    setPaymentMessage("Preparing secure payment");
    trackProductEvent("payment_checkout_started", {
      bookingId: nextBooking.id,
      service: nextBooking.serviceType,
      amount: nextBooking.payment.estimatedTotal,
      mode: "razorpay"
    });

    let checkoutResponse: Response | null = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      checkoutResponse = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          bookingId: nextBooking.id
        })
      });

      if (checkoutResponse.ok || checkoutResponse.status !== 404) {
        break;
      }

      await new Promise((resolve) => window.setTimeout(resolve, 500));
    }

    if (!checkoutResponse?.ok) {
      setPaymentMessage("Payment could not start. Please try again.");
      return false;
    }

    const checkout = (await checkoutResponse.json()) as RazorpayCheckout;

    if (checkout.mode === "mock") {
      setPaymentMessage(
        "Payment provider is not live. Your request is saved, but care will start after ops confirms payment."
      );
      trackProductEvent("payment_mock_checkout_blocked", {
        bookingId: nextBooking.id,
        service: nextBooking.serviceType,
        mode: "mock"
      });
      return false;
    }

    const scriptReady = await loadRazorpayScript();
    const razorpayWindow = window as RazorpayWindow;

    const Razorpay = razorpayWindow.Razorpay;

    if (!scriptReady || !Razorpay) {
      setPaymentMessage("Payment window could not open. Try again.");
      return false;
    }

    let paymentVerified = false;

    await new Promise<void>((resolve) => {
      const razorpay = new Razorpay({
        key: checkout.keyId,
        amount: checkout.amount,
        currency: checkout.currency,
        name: "LDERLY",
        description: checkout.description,
        order_id: checkout.orderId,
        prefill: {
          name: checkout.customerName
        },
        theme: {
          color: "#06130f"
        },
        handler: async (response) => {
          const confirmResponse = await fetch("/api/payments/confirm", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              bookingId: nextBooking.id,
              ...response
            })
          });

          if (confirmResponse.ok) {
            BookingService.markPaymentPaid(response.razorpay_payment_id);
            setPaymentMessage("Payment confirmed");
            paymentVerified = true;
            trackProductEvent("payment_confirmed", {
              bookingId: nextBooking.id,
              service: nextBooking.serviceType,
              mode: "razorpay"
            });
          } else {
            setPaymentMessage("Payment could not be verified");
            trackProductEvent("payment_verification_failed", {
              bookingId: nextBooking.id,
              service: nextBooking.serviceType
            });
          }

          resolve();
        },
        modal: {
          ondismiss: () => {
            setPaymentMessage("Payment can be completed from Care");
            trackProductEvent("payment_modal_dismissed", {
              bookingId: nextBooking.id,
              service: nextBooking.serviceType
            });
            resolve();
          }
        }
      });

      razorpay.open();
    });

    return paymentVerified;
  };

  const completePaidBookingFlow = () => {
    window.localStorage.setItem(subscriptionKey, "true");
    setCareSubscriptionStarted(true);
    setBookingOpen(false);
    setCareOnWay(true);

    window.setTimeout(() => {
      setCareOnWay(false);
      selectTab("journey", "post_booking_auto_open");
    }, 1600);
  };

  const acceptPaymentTermsAndPay = async () => {
    if (!paymentTermsBooking) {
      return;
    }

    const nextBooking = paymentTermsBooking;
    setPaymentTermsBooking(null);
    trackProductEvent("payment_terms_accepted", {
      bookingId: nextBooking.id,
      service: nextBooking.serviceType,
      amount: nextBooking.payment.estimatedTotal
    });
    toast.loading("Opening secure payment", {
      id: `payment-${nextBooking.id}`,
      description: "Care dispatch starts after payment verification."
    });

    const paymentVerified = await openRazorpayCheckout(nextBooking);

    if (paymentVerified) {
      toast.success("Payment verified", {
        id: `payment-${nextBooking.id}`,
        description: "Care coordination is now starting."
      });
      completePaidBookingFlow();
    } else {
      toast.dismiss(`payment-${nextBooking.id}`);
    }
  };

  const requestPaymentWithTerms = (nextBooking: CareBooking) => {
    setPaymentMessage("");
    setPaymentTermsBooking(nextBooking);
    toast.message("Please review payment terms", {
      description: "Refunds, OTP start, and visit proof are shown before checkout."
    });
    trackProductEvent("payment_terms_presented", {
      bookingId: nextBooking.id,
      service: nextBooking.serviceType,
      amount: nextBooking.payment.estimatedTotal
    });
  };

  const confirmBooking = async () => {
    if (bookingConfirmBusy) {
      return;
    }

    if (!session) {
      router.replace("/signin");
      return;
    }

    setBookingConfirmBusy(true);
    setPaymentMessage("Saving your care request");

    try {
      const requestedFor =
        selectedTime.label === "Now"
          ? Date.now()
          : selectedTime.label === "Today later"
            ? Date.now() + 3 * 60 * 60 * 1000
            : selectedTime.label === "Tomorrow"
              ? Date.now() + 24 * 60 * 60 * 1000
              : Date.now() + 60 * 60 * 1000;
      const bookingDetails: BookingRequestDetails = {
        careFor: {
          relationship: recipient.name,
          displayName: activeRecipientDetails?.fullName || recipient.displayName
        },
        careNeed: selectedNeed.title,
        service: selectedService,
        duration: {
          label: selectedDuration.label,
          price: selectedDuration.price,
          note: selectedDuration.note
        },
        schedule: {
          label: selectedTime.label,
          detail: selectedTime.detail,
          requestedFor
        },
        location: {
          label: selectedLocation.label,
          detail:
            selectedLocation.label === "Saved care address"
              ? activeRecipientDetails?.address || selectedLocation.detail
              : selectedLocation.detail,
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
          placeId: selectedLocation.placeId
        },
        pricing: {
          careEstimate: selectedDuration.price,
          coordinationFee: "Included",
          estimatedTotal: selectedDuration.price
        },
        trust: [
          "Verified caregivers",
          "Family updates included",
          "Support available",
          "Trained attendants"
        ]
      };

      const nextBooking = BookingService.createBooking(
        { ...session, role: "customer" },
        selectedService,
        bookingDetails
      );
      const trustedBooking = await BookingService.persistBooking(nextBooking);

      if (!trustedBooking) {
        setPaymentMessage("We could not save this care request. Please try again.");
        return;
      }

      trackProductEvent("booking_confirmed", {
        bookingId: trustedBooking.id,
        recipient: recipient.shortName,
        need: selectedNeed.title,
        service: selectedService,
        duration: selectedDuration.label,
        time: selectedTime.label,
        location: selectedLocation.label
      });
      requestPaymentWithTerms(trustedBooking);
    } finally {
      setBookingConfirmBusy(false);
    }
  };

  const verifyCareCompletion = async () => {
    if (!visibleBooking || visibleBooking.status !== "completed") {
      return;
    }

    trackProductEvent("customer_completion_verified", {
      bookingId: visibleBooking.id,
      service: visibleBooking.serviceType
    });
    await BookingService.verifyCompletion(true, "Family verified service completion");
    setPaymentMessage("Visit confirmed. Payment release has been queued.");
  };

  const cancelActiveCare = async () => {
    if (!visibleBooking || !["searching", "assigned", "accepted"].includes(visibleBooking.status)) {
      return;
    }

    trackProductEvent("customer_cancel_request_clicked", {
      bookingId: visibleBooking.id,
      service: visibleBooking.serviceType,
      status: visibleBooking.status
    });
    try {
      await BookingService.cancelBooking("Family cancelled before service started", "customer");
      setPaymentMessage("Care request cancelled. We will keep the family updated.");
    } catch {
      setPaymentMessage("Cancellation could not be confirmed. Please contact LDERLY support.");
    }
  };

  const rateLatestCare = async () => {
    if (
      !visibleBooking ||
      !["payment_settled", "report_generated"].includes(visibleBooking.status) ||
      visibleBooking.rating?.score
    ) {
      return;
    }

    trackProductEvent("customer_quick_rating_clicked", {
      bookingId: visibleBooking.id,
      service: visibleBooking.serviceType,
      score: 5
    });
    await BookingService.rateBooking(5, "Family felt reassured after this visit");
    setPaymentMessage("Thank you. Your rating helps keep caregiver quality high.");
  };

  if (!authReady || !session) {
    return (
      <main className="lderly-shell">
        <div className="lderly-content mx-auto flex min-h-dvh max-w-md items-center px-5 text-white">
          <section className="glass-panel w-full rounded-[2rem] p-5">
            <p className="text-sm uppercase tracking-[0.28em] text-emerald-200">LDERLY</p>
            <h1 className="premium-title mt-3 text-3xl font-semibold">Opening Home</h1>
            <div className="mt-6 space-y-3">
              <Skeleton className="h-24 w-full rounded-[1.5rem]" />
              <div className="grid grid-cols-3 gap-2">
                <Skeleton className="h-16 rounded-2xl" />
                <Skeleton className="h-16 rounded-2xl" />
                <Skeleton className="h-16 rounded-2xl" />
              </div>
            </div>
            <Link
              href="/signin"
              className="motion-lift mt-6 inline-flex rounded-full bg-white px-5 py-3 font-semibold text-[#07130f]"
            >
              Sign in
            </Link>
          </section>
        </div>
      </main>
    );
  }

  if (!recipientName) {
    return (
      <RecipientGate
        onSelect={(nextRecipient) => {
          trackProductEvent("care_recipient_selected", {
            recipient: nextRecipient,
            source: "post_login_gate"
          });
          setRecipientName(nextRecipient);
          selectTab("home", "recipient_selected");
        }}
      />
    );
  }

  if (!activeRecipientDetails) {
    return (
      <RecipientDetailsSetup
        recipient={recipient}
        onBack={() => setRecipientName("")}
        onSave={(details) => {
          const nextDetails = {
            ...recipientDetails,
            [recipient.name]: details
          };

          setRecipientDetails(nextDetails);
          window.localStorage.setItem(recipientDetailsKey, JSON.stringify(nextDetails));
          ProfileService.saveCareRecipient(
            { ...session, role: "customer" },
            recipient.name,
            toCareRecipientProfile(details)
          );
          trackProductEvent("care_recipient_details_saved", {
            recipient: recipient.shortName,
            hasAddress: Boolean(details.address),
            hasHealthNotes: Boolean(details.healthNotes),
            hasEmergencyPhone: Boolean(details.phone)
          });
          selectTab("home", "recipient_details_saved");
        }}
      />
    );
  }

  return (
    <main className="lderly-shell">
      <div className="lderly-content mx-auto min-h-dvh max-w-md px-4 pb-28 pt-5 sm:max-w-lg">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-emerald-200">LDERLY</p>
            <h1 className="premium-title mt-1 text-3xl font-semibold tracking-tight">Home</h1>
          </div>
          {hasCareSubscription && (
            <button
              onClick={requestImmediateCare}
              className="motion-lift rounded-full bg-red-500 px-4 py-3 text-sm font-semibold shadow-xl shadow-red-500/25"
            >
              Immediate
            </button>
          )}
        </header>

        {paymentMessage && (
          <div className="trust-surface mt-4 rounded-2xl px-4 py-3 text-sm text-emerald-50">
            {paymentMessage}
          </div>
        )}

        <RealtimeCareStrip
          activeCare={Boolean(activeCare)}
          service={currentService}
          recipient={recipient}
        />

        {hasCareSubscription && (
          <LiveSystemPanel
            eyebrow="Active care monitoring"
            title={
              activeCare
                ? `${recipient.shortName}'s care is being watched right now`
                : `${recipient.shortName} is connected to LDERLY monitoring`
            }
            description={
              activeCare
                ? "Caregiver progress, ETA, medicine notes, and family updates refresh as the visit moves."
                : "When care is booked, this becomes the live operating layer for your family."
            }
            urgent={customerLiveTone === "critical"}
            signals={[
              {
                label: "Caregiver",
                value: caregiverIsActive
                  ? "Active now"
                  : caregiverHasAccepted
                    ? "Accepted"
                    : visibleBooking && visibleBooking.status !== "none"
                      ? "Being assigned"
                      : "Ready",
                tone: caregiverHasAccepted ? "live" : "healthy"
              },
              {
                label: "Check-in",
                value: visibleBooking?.tracking?.lastLocationAt
                  ? "Just updated"
                  : health?.updatedAt
                    ? "Recently checked"
                    : "2 mins ago",
                tone: customerLiveTone
              },
              {
                label: "Supervision",
                value: customerLiveTone === "critical" ? "Escalating" : "Monitoring",
                tone: customerLiveTone
              }
            ]}
            className="mt-5"
          />
        )}

        <LiveOperationalDock
          title={
            caregiverIsActive
              ? "Caregiver active now"
              : caregiverHasAccepted
                ? "Caregiver confirmed"
                : visibleBooking && visibleBooking.status !== "none"
                  ? "Finding the right caregiver"
                  : "LDERLY monitoring is ready"
          }
          subtitle={
            caregiverIsActive
              ? "Family reassurance, ETA, and service proof are connected."
              : caregiverHasAccepted
                ? "The visit has moved into live coordination."
                : visibleBooking && visibleBooking.status !== "none"
                  ? "Ops is coordinating assignment before live tracking starts."
                  : "Book care and live operational updates will stay visible here."
          }
          status={customerLiveTone}
          signals={[
            {
              label: "ETA",
              value: caregiverHasAccepted
                ? `${visibleBooking?.tracking?.etaMinutes ?? visibleJourney?.eta ?? 8} min`
                : "Pending"
            },
            {
              label: "Check-in",
              value: caregiverIsActive ? "Live" : caregiverHasAccepted ? "Confirmed" : "Not started"
            },
            { label: "Trust", value: "Supervised" }
          ]}
          className="mt-4"
        />

        <AnimatePresence mode="wait">
          {activeTab === "home" && (
            <Screen key="home">
              {!hasCareSubscription ? (
                <FirstTimeHome
                  details={activeRecipientDetails}
                  recipient={recipient}
                  onBook={openBooking}
                  onImmediate={requestImmediateCare}
                />
              ) : (
                <>
                  <CompactStatus
                    recipient={recipient}
                    health={health}
                    booking={visibleBooking}
                    journey={visibleJourney}
                    hasCareSubscription={hasCareSubscription}
                  />
                  <PrimaryCareCta recipient={recipient} onBook={openBooking} />
                  <QuickActions
                    activeCare={Boolean(activeCare)}
                    experience={currentServiceExperience}
                    onTrack={() => selectTab("journey", "quick_action_track")}
                    onBook={openBooking}
                    onRebook={rebookPreviousCare}
                  />
                  <CareConfidence recipient={recipient} health={health} />
                  <LiveActivityTimeline
                    items={[
                      {
                        label: activeCare
                          ? `${currentService || "Care visit"} is active`
                          : "Care team ready for the next visit",
                        time: activeCare ? "Live now" : "Standing by",
                        status: activeCare ? "monitored" : "ready"
                      },
                      {
                        label:
                          health?.medicineStatus === "missed"
                            ? "Medicine support needs attention"
                            : "Medicine plan is being tracked",
                        time: health?.updatedAt ? "recently" : "standing by",
                        status: health?.medicineStatus || "stable"
                      },
                      {
                        label: "Family reassurance feed connected",
                        time: "always on",
                        status: "visible"
                      }
                    ]}
                    className="mt-5"
                  />
                  <MedicalRiskPanel recipient={recipient} risk={careRisk} />
                  <FamilyReassuranceSystem
                    recipient={recipient}
                    health={health}
                    booking={visibleBooking}
                    journey={visibleJourney}
                    reports={reports}
                    experience={currentServiceExperience}
                    aiInsight={aiInsight}
                  />
                  <CareContinuitySystem
                    summary={retentionSummary}
                    recipient={recipient}
                    onBook={openBooking}
                    onRebook={rebookPreviousCare}
                  />
                  <TrustedCaregiverProfile
                    recipient={recipient}
                    booking={visibleBooking}
                    journey={visibleJourney}
                    trustProfile={caregiverTrust}
                    onRebook={rebookPreviousCare}
                  />
                  <SessionSummaryPreview recipient={recipient} reports={reports} />
                  <VisitProofSystem
                    recipient={recipient}
                    reports={reports}
                    booking={visibleBooking}
                    journey={visibleJourney}
                    proof={visitProof}
                    onRebook={rebookPreviousCare}
                  />
                  <NriMonthlyReportPreview
                    recipient={recipient}
                    reports={reports}
                    aiInsight={aiInsight}
                  />
                  <AccessibilityCareControls recipient={recipient} />
                  <SmartRecommendation
                    experience={currentServiceExperience}
                    recipient={recipient}
                    service={currentService}
                    onBook={openBooking}
                  />
                </>
              )}
            </Screen>
          )}

          {activeTab === "journey" && (
            <Screen key="journey">
              <JourneyExperience
                recipient={recipient}
                journey={visibleJourney}
                booking={visibleBooking}
                onImmediate={requestImmediateCare}
                onCompletePayment={() => visibleBooking && requestPaymentWithTerms(visibleBooking)}
                onVerifyCompletion={verifyCareCompletion}
                onCancelCare={cancelActiveCare}
                onRateCare={rateLatestCare}
              />
            </Screen>
          )}

          {activeTab === "profile" && (
            <Screen key="profile">
              <ProfilePanel
                profile={profile}
                recipient={recipient}
                details={activeRecipientDetails}
                reports={reports}
                serviceExperience={currentServiceExperience}
                onSelectRecipient={() => {
                  trackProductEvent("care_recipient_switch_started", {
                    currentRecipient: recipient.shortName
                  });
                  setRecipientName("");
                }}
                onEditDetails={() => {
                  const nextDetails = { ...recipientDetails };
                  delete nextDetails[recipient.name];
                  setRecipientDetails(nextDetails);
                  window.localStorage.setItem(recipientDetailsKey, JSON.stringify(nextDetails));
                  ProfileService.removeCareRecipient(
                    { ...session, role: "customer" },
                    recipient.name
                  );
                  trackProductEvent("care_recipient_details_edit_started", {
                    recipient: recipient.shortName
                  });
                }}
                onInviteFamily={() => {
                  trackProductEvent("family_member_invited", {
                    recipient: recipient.shortName,
                    source: "profile"
                  });
                  window.open(
                    "https://wa.me/919916960524?text=I%20want%20to%20add%20a%20family%20member%20to%20LDERLY%20care%20updates",
                    "_blank"
                  );
                }}
                onBook={openBooking}
                onTrack={() => selectTab("journey", "profile_action_track")}
                onSignOut={async () => {
                  await AuthService.signOut();
                  router.replace("/signin");
                }}
              />
            </Screen>
          )}
        </AnimatePresence>
      </div>

      <CustomerNavigation
        activeTab={activeTab}
        onTabChange={(tab) => selectTab(tab, "bottom_nav")}
      />

      {bookingOpen && (
        <BookingFunnel
          recipient={recipient}
          step={bookingStep}
          selectedNeed={selectedNeed}
          selectedService={selectedService}
          selectedDuration={selectedDuration}
          selectedTime={selectedTime}
          selectedLocation={selectedLocation}
          onClose={() => {
            trackProductEvent("booking_funnel_closed", {
              step: bookingStep,
              recipient: recipient.shortName,
              service: selectedService
            });
            setBookingOpen(false);
          }}
          onNeed={(need) => {
            trackProductEvent("booking_need_selected", {
              recipient: recipient.shortName,
              need: need.title
            });
            setSelectedNeed(need);
            setSelectedService(need.services[0]);
            setBookingStep("service");
          }}
          onService={(service) => {
            trackProductEvent("booking_service_selected", {
              recipient: recipient.shortName,
              need: selectedNeed.title,
              service
            });
            setSelectedService(service);
            setBookingStep("duration");
          }}
          onDuration={(duration) => {
            trackProductEvent("booking_duration_selected", {
              recipient: recipient.shortName,
              service: selectedService,
              duration: duration.label,
              price: duration.price
            });
            setSelectedDuration(duration);
            setBookingStep("time");
          }}
          onTime={(time) => {
            trackProductEvent("booking_time_selected", {
              recipient: recipient.shortName,
              service: selectedService,
              time: time.label
            });
            setSelectedTime(time);
            setBookingStep("location");
          }}
          onLocation={(location) => {
            trackProductEvent("booking_location_selected", {
              recipient: recipient.shortName,
              service: selectedService,
              location: location.label,
              hasCoordinates:
                typeof location.latitude === "number" && typeof location.longitude === "number"
            });
            setSelectedLocation(location);
            setBookingStep("review");
          }}
          onBack={() => {
            if (bookingStep === "service") {
              setBookingStep("need");
            } else if (bookingStep === "duration") {
              setBookingStep("service");
            } else if (bookingStep === "time") {
              setBookingStep("duration");
            } else if (bookingStep === "location") {
              setBookingStep("time");
            } else if (bookingStep === "review") {
              setBookingStep("location");
            } else {
              setBookingOpen(false);
            }
          }}
          onConfirm={confirmBooking}
          confirmBusy={bookingConfirmBusy}
        />
      )}

      {careOnWay && <CareOnWay recipient={recipient} />}
      <AnimatePresence>
        {paymentTermsBooking && (
          <PaymentTermsModal
            booking={paymentTermsBooking}
            onCancel={() => {
              trackProductEvent("payment_terms_dismissed", {
                bookingId: paymentTermsBooking.id,
                service: paymentTermsBooking.serviceType
              });
              setPaymentTermsBooking(null);
            }}
            onAgree={acceptPaymentTermsAndPay}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
