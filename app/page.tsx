"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Check,
  ChevronRight,
  CircleHelp,
  HeartPulse,
  Home,
  Languages,
  LockKeyhole,
  MapPinned,
  MessageCircle,
  Mic,
  Phone,
  Pill,
  Repeat2,
  ShieldCheck,
  Sparkles,
  Star,
  UserRound,
  Users,
  WalletCards
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import LiveMap from "../components/LiveMap";
import { Badge } from "../components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { AuthService, SessionUser } from "../services/authService";
import {
  BookingRequestDetails,
  BookingService,
  CareBooking
} from "../services/bookingService";
import { HealthService, HealthSnapshot } from "../services/healthService";
import { CareProfile, ProfileService } from "../services/profileService";
import type { CareRecipientProfile } from "../services/profileService";
import { ReportService, VisitReport } from "../services/reportService";
import { CareJourney, JourneyService } from "../services/journeyService";
import { NotificationService } from "../services/notificationService";
import { trackProductEvent } from "../services/productAnalytics";

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
    recommendation: "Choose this for appointments, hospital attender support, lab work, or report follow-up."
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

const journeySteps = [
  "Request Received",
  "Caregiver Confirmed",
  "On The Way",
  "Arrived",
  "Care Started",
  "Care Completed"
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
      summary: [
        "Attender present",
        "Doctor round noted",
        "Meals supported",
        "Family updated"
      ],
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
      summary: [
        "Appointment checked",
        "Visit supported",
        "Report tracked",
        "Family updated"
      ],
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
      summary: [
        "Appointment confirmed",
        "Visit supported",
        "Notes captured",
        "Follow-up ready"
      ],
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
      summary: [
        "Schedule checked",
        "Medicine supported",
        "Timing shared",
        "Recovery noted"
      ],
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
      service.includes("birthday") ||
      service.includes("festival") ||
      service.includes("occasion");

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
      summary: [
        "Visit completed",
        "Walk supported",
        "Mood positive",
        "Family updated"
      ],
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
      summary: [
        "Support confirmed",
        "Meal checked",
        "Errand supported",
        "Family updated"
      ],
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

const cleanServiceName = (serviceType?: string) =>
  (serviceType || "Care")
    .split(" for ")[0]
    .trim();

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

const careStatusFor = ({
  booking,
  journey
}: {
  booking: CareBooking | null;
  journey: CareJourney | null;
}) => {
  if (journey && journey.status !== "idle") {
    const service = cleanServiceName(journey.serviceType);

    if (journey.status === "requested") {
      return `${service} requested`;
    }

    if (journey.status === "assigned") {
      return `Caregiver assigned for ${service}`;
    }

    if (journey.status === "accepted") {
      return `Caregiver confirmed for ${service}`;
    }

    if (journey.status === "en_route") {
      return `Caregiver is on the way`;
    }

    if (journey.status === "arrived") {
      return `Caregiver arrived`;
    }

    if (journey.status === "in_progress") {
      return `${service} in progress`;
    }

    if (journey.status === "completed") {
      return `${service} completed`;
    }

    if (journey.status === "escalated") {
      return `${service} escalated`;
    }

    return journey.summary;
  }

  if (booking && booking.status !== "none") {
    const service = cleanServiceName(booking.serviceType);

    if (booking.status === "requested") {
      return `${service} requested`;
    }

    if (booking.status === "assigned") {
      return `Caregiver assigned for ${service}`;
    }

    if (booking.status === "accepted") {
      return `Caregiver confirmed for ${service}`;
    }

    if (booking.status === "en_route") {
      return `Caregiver is on the way`;
    }

    if (booking.status === "arrived") {
      return `Caregiver arrived`;
    }

    if (booking.status === "in_progress") {
      return `${service} in progress`;
    }

    if (booking.status === "completed") {
      return `${service} completed`;
    }

    if (booking.status === "cancelled") {
      return `${service} cancelled`;
    }

    return `${service} updated`;
  }

  return "No active care";
};

const subscriptionKey = "lderly-care-subscription-started";
const recipientDetailsKey = "lderly-recipient-details-v2";

const emptyRecipientDetails: RecipientDetails = {
  fullName: "",
  age: "",
  phone: "",
  address: "",
  healthNotes: "",
  allergies: "",
  mobility: "",
  language: ""
};

const readStoredRecipientDetails = () => {
  if (typeof window === "undefined") {
    return {} as Record<string, RecipientDetails>;
  }

  try {
    return JSON.parse(
      window.localStorage.getItem(recipientDetailsKey) || "{}"
    ) as Record<string, RecipientDetails>;
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
  const [recipientDetails, setRecipientDetails] = useState<
    Record<string, RecipientDetails>
  >(readStoredRecipientDetails);
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
    () =>
      typeof window !== "undefined" &&
      window.localStorage.getItem(subscriptionKey) === "true"
  );
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentTermsBooking, setPaymentTermsBooking] = useState<CareBooking | null>(null);
  const [aiInsight, setAiInsight] = useState<AiReassuranceInsight | null>(null);
  const [caregiverTrust, setCaregiverTrust] = useState<CaregiverTrustProfile | null>(null);
  const [visitProof, setVisitProof] = useState<VisitProof | null>(null);
  const [careRisk, setCareRisk] = useState<CareRiskSummary | null>(null);
  const [retentionSummary, setRetentionSummary] = useState<RetentionSummary | null>(null);
  const lastStatusEventRef = useRef("");
  const lastStepEventRef = useRef("");
  const lastAiInsightRef = useRef("");

  const recipient =
    recipients.find((item) => item.name === recipientName) ?? recipients[0];
  const bookingIsFreshestActiveCare =
    Boolean(booking && booking.status !== "none") &&
    (!journey || journey.status === "idle" || (booking?.updatedAt ?? 0) >= journey.updatedAt);
  const visibleJourney = bookingIsFreshestActiveCare ? null : journey;
  const visibleBooking = booking;
  const activeCare =
    (visibleJourney && visibleJourney.status !== "idle") ||
    (visibleBooking && visibleBooking.status !== "none");
  const hasCareSubscription = careSubscriptionStarted;
  const currentService = cleanServiceName(
    bookingIsFreshestActiveCare
      ? visibleBooking?.serviceType
      : visibleJourney?.serviceType || visibleBooking?.serviceType || selectedService
  );
  const currentServiceExperience = serviceExperienceFor(currentService);
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
      eta:
        visibleBooking?.tracking?.etaMinutes ??
        visibleJourney?.eta ??
        null,
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
    JourneyService.requestService(
      { ...session, role: "customer" },
      reason
    );
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
      setPaymentMessage("Payment provider is not live. Your request is saved, but care will start after ops confirms payment.");
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

    const paymentVerified = await openRazorpayCheckout(nextBooking);

    if (paymentVerified) {
      completePaidBookingFlow();
    }
  };

  const requestPaymentWithTerms = (nextBooking: CareBooking) => {
    setPaymentMessage("");
    setPaymentTermsBooking(nextBooking);
    trackProductEvent("payment_terms_presented", {
      bookingId: nextBooking.id,
      service: nextBooking.serviceType,
      amount: nextBooking.payment.estimatedTotal
    });
  };

  const confirmBooking = async () => {
    if (!session) {
      router.replace("/signin");
      return;
    }

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
            : selectedLocation.detail
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
    trackProductEvent("booking_confirmed", {
      bookingId: nextBooking.id,
      recipient: recipient.shortName,
      need: selectedNeed.title,
      service: selectedService,
      duration: selectedDuration.label,
      time: selectedTime.label,
      location: selectedLocation.label
    });
    requestPaymentWithTerms(nextBooking);
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
  };

  const cancelActiveCare = () => {
    if (
      !visibleBooking ||
      !["searching", "assigned", "accepted"].includes(visibleBooking.status)
    ) {
      return;
    }

    trackProductEvent("customer_cancel_request_clicked", {
      bookingId: visibleBooking.id,
      service: visibleBooking.serviceType,
      status: visibleBooking.status
    });
    BookingService.cancelBooking("Family cancelled before service started", "customer");
    setPaymentMessage("Care request cancelled. We will keep the family updated.");
  };

  const rateLatestCare = () => {
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
    BookingService.rateBooking(5, "Family felt reassured after this visit");
    setPaymentMessage("Thank you. Your rating helps keep caregiver quality high.");
  };

  const navItems = useMemo(
    () => [
      { key: "home" as const, label: "Home", icon: Home },
      { key: "journey" as const, label: "Care", icon: MapPinned },
      { key: "profile" as const, label: "Profile", icon: UserRound }
    ],
    []
  );

  if (!authReady || !session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#06130f] px-6 text-white">
        <div className="text-center">
          <p className="text-sm uppercase tracking-[0.28em] text-emerald-200">
            LDERLY
          </p>
          <h1 className="mt-3 text-2xl font-semibold">Opening Home</h1>
          <Link
            href="/signin"
            className="mt-6 inline-flex rounded-full bg-white px-5 py-3 font-semibold text-[#07130f]"
          >
            Sign in
          </Link>
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
          window.localStorage.setItem(
            recipientDetailsKey,
            JSON.stringify(nextDetails)
          );
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
    <main className="h-dvh overflow-y-auto overscroll-contain bg-[#06130f] text-white">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,.22),transparent_34%),radial-gradient(circle_at_85%_10%,rgba(251,191,36,.14),transparent_26%),linear-gradient(180deg,#06130f,#08110f_46%,#050706)]" />
      <div className="relative z-10 mx-auto min-h-dvh max-w-md px-4 pb-28 pt-5 sm:max-w-lg">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-emerald-200">
              LDERLY
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Home</h1>
          </div>
          {hasCareSubscription && (
            <button
              onClick={requestImmediateCare}
              className="rounded-full bg-red-500 px-4 py-3 text-sm font-semibold shadow-xl shadow-red-500/25"
            >
              Immediate
            </button>
          )}
        </header>

        {paymentMessage && (
          <div className="mt-4 rounded-2xl border border-emerald-200/15 bg-emerald-200/10 px-4 py-3 text-sm text-emerald-50">
            {paymentMessage}
          </div>
        )}

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

        <RealtimeCareStrip
          activeCare={Boolean(activeCare)}
          service={currentService}
          recipient={recipient}
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
                  <SessionSummaryPreview
                    recipient={recipient}
                    reports={reports}
                  />
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
                  window.localStorage.setItem(
                    recipientDetailsKey,
                    JSON.stringify(nextDetails)
                  );
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

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#06130f]/90 px-4 pb-4 pt-2 backdrop-blur-xl">
        <div className="mx-auto grid max-w-md grid-cols-3 gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.key;

            return (
              <button
                key={item.key}
                onClick={() => selectTab(item.key, "bottom_nav")}
                className={`rounded-2xl px-3 py-3 text-xs transition ${
                  active ? "bg-white text-[#06130f]" : "text-white/55"
                }`}
              >
                <Icon className="mx-auto h-5 w-5" />
                <span className="mt-1 block">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

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
              location: location.label
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
        />
      )}

      {careOnWay && <CareOnWay recipient={recipient} />}
    </main>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="mt-6"
    >
      {children}
    </motion.div>
  );
}

function RecipientGate({ onSelect }: { onSelect: (recipient: string) => void }) {
  return (
    <main className="h-dvh overflow-y-auto overscroll-contain bg-[#06130f] text-white">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,.22),transparent_34%),radial-gradient(circle_at_85%_10%,rgba(251,191,36,.14),transparent_26%),linear-gradient(180deg,#06130f,#08110f_46%,#050706)]" />
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col px-4 py-6 pb-10">
        <p className="text-xs uppercase tracking-[0.28em] text-emerald-200">
          LDERLY
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">
          Who are we caring for today?
        </h1>
        <p className="mt-3 text-base leading-7 text-white/60">
          Choose a loved one so we can guide you to the right care.
        </p>

        <div className="mt-8 space-y-3">
          {recipients.map((recipient) => (
            <button
              key={recipient.name}
              onClick={() => onSelect(recipient.name)}
              className="flex w-full items-center gap-4 rounded-[1.75rem] bg-white p-4 text-left text-[#06130f] shadow-2xl shadow-black/15 transition active:scale-[0.99]"
            >
              <Avatar recipient={recipient} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-xl font-semibold">{recipient.displayName}</p>
                <p className="mt-1 text-sm text-slate-500">
                  Start care for {recipient.displayName}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-400" />
            </button>
          ))}
        </div>

        <div className="mt-auto rounded-[1.5rem] bg-white/10 p-4">
          <p className="text-sm font-semibold text-emerald-100">
            Care arrives on demand.
          </p>
          <p className="mt-1 text-sm text-white/50">
            Premium care coordination, built for families who need calm and clarity.
          </p>
        </div>
      </div>
    </main>
  );
}

function Avatar({
  recipient,
  size = "md"
}: {
  recipient: Recipient;
  size?: "md" | "lg";
}) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${recipient.gradient} font-bold text-[#06130f] ${
        size === "lg" ? "h-16 w-16 text-2xl" : "h-12 w-12 text-lg"
      }`}
    >
      {recipient.avatar}
    </div>
  );
}

function RecipientDetailsSetup({
  recipient,
  onBack,
  onSave
}: {
  recipient: Recipient;
  onBack: () => void;
  onSave: (details: RecipientDetails) => void;
}) {
  const [details, setDetails] = useState<RecipientDetails>({
    ...emptyRecipientDetails,
    fullName: ""
  });

  const updateDetail = (field: keyof RecipientDetails, value: string) => {
    setDetails((current) => ({ ...current, [field]: value }));
  };

  const canContinue = details.fullName.trim() && details.age.trim();

  return (
    <main className="h-dvh overflow-y-auto overscroll-contain bg-[#06130f] text-white">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,.22),transparent_34%),radial-gradient(circle_at_85%_10%,rgba(251,191,36,.14),transparent_26%),linear-gradient(180deg,#06130f,#08110f_46%,#050706)]" />
      <div className="relative z-10 mx-auto min-h-dvh max-w-md px-4 py-6 pb-28">
        <button onClick={onBack} className="rounded-full bg-white/10 px-4 py-2 text-sm">
          Back
        </button>
        <div className="mt-6">
          <Avatar recipient={recipient} size="lg" />
          <h1 className="mt-5 text-4xl font-semibold tracking-tight">
            Tell us about {recipient.displayName}
          </h1>
          <p className="mt-3 text-base leading-7 text-white/60">
            These details help us recommend the right care and brief the caregiver properly.
          </p>
        </div>

        <section className="mt-7 rounded-[2rem] bg-white p-4 text-[#06130f]">
          <p className="text-sm font-semibold text-emerald-700">Required basics</p>
          <div className="mt-4 space-y-3">
          <TextField
            autoComplete="name"
            label={`${recipient.displayName}'s name`}
            placeholder="Full name"
            value={details.fullName}
            onChange={(value) => updateDetail("fullName", value)}
          />
          <TextField
            inputMode="numeric"
            label="Age"
            placeholder="72"
            value={details.age}
            onChange={(value) => updateDetail("age", value)}
          />
          <TextField
            autoComplete="tel"
            inputMode="tel"
            label="Phone / primary contact"
            placeholder="+91 98765 43210"
            value={details.phone}
            onChange={(value) => updateDetail("phone", value)}
          />
          <TextField
            autoComplete="street-address"
            label="Care address"
            placeholder="Home, apartment, or landmark"
            value={details.address}
            onChange={(value) => updateDetail("address", value)}
          />
          </div>
        </section>

        <section className="mt-4 rounded-[2rem] bg-white/10 p-4">
          <p className="text-sm font-semibold text-emerald-100">
            Helpful for the caregiver
          </p>
          <p className="mt-1 text-sm text-white/50">
            Optional now. You can edit this later from Profile.
          </p>
          <div className="mt-4 space-y-3 rounded-[1.5rem] bg-white p-4 text-[#06130f]">
          <TextField
            label="Health notes"
            placeholder="BP, diabetes, recent surgery, routine needs"
            value={details.healthNotes}
            onChange={(value) => updateDetail("healthNotes", value)}
          />
          <TextField
            label="Allergies"
            placeholder="No known allergies"
            value={details.allergies}
            onChange={(value) => updateDetail("allergies", value)}
          />
          <TextField
            label="Mobility"
            placeholder="Walks independently, walker, wheelchair"
            value={details.mobility}
            onChange={(value) => updateDetail("mobility", value)}
          />
          <TextField
            label="Preferred language"
            placeholder="English, Hindi, Kannada..."
            value={details.language}
            onChange={(value) => updateDetail("language", value)}
          />
          </div>
        </section>

        <div className="fixed inset-x-0 bottom-0 z-20 bg-[#06130f]/90 px-4 pb-4 pt-3 backdrop-blur-xl">
          <button
            disabled={!canContinue}
            onClick={() => onSave(details)}
            className="mx-auto block w-full max-w-md rounded-full bg-white px-5 py-4 font-semibold text-[#06130f] disabled:opacity-45"
          >
            Continue
          </button>
        </div>
      </div>
    </main>
  );
}

function TextField({
  autoComplete,
  inputMode,
  label,
  placeholder,
  value,
  onChange
}: {
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <input
        autoComplete={autoComplete}
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-400"
      />
    </label>
  );
}

function CompactStatus({
  recipient,
  health,
  booking,
  journey,
  hasCareSubscription
}: {
  recipient: Recipient;
  health: HealthSnapshot | null;
  booking: CareBooking | null;
  journey: CareJourney | null;
  hasCareSubscription: boolean;
}) {
  const journeyActive = journey && journey.status !== "idle";
  const bookingActive = booking && booking.status !== "none";
  const careState = careStatusFor({ booking, journey });
  const medicineState =
    health?.medicineStatus === "completed"
      ? "Medicine completed"
      : health?.medicineStatus === "missed"
        ? "Medicine needs follow-up"
        : "Medicine schedule ready";
  const wellnessScore = health?.wellness === "watch" ? "84%" : "92%";

  return (
    <section className="rounded-[2rem] bg-white p-5 text-[#06130f] shadow-2xl shadow-black/20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-emerald-700">
            {hasCareSubscription ? `${recipient.shortName} Today` : "Care setup"}
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">
            {hasCareSubscription
              ? careState
              : `Let's find the right support for ${recipient.shortName}`}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {hasCareSubscription
              ? `Last checked 2 mins ago - ${medicineState}`
              : "Live status appears after the first care service is booked."}
          </p>
        </div>
        <Avatar recipient={recipient} />
      </div>
      {hasCareSubscription ? (
        <div className="mt-5 grid grid-cols-3 gap-2">
          <MiniMetric label="Mood" value={health?.wellness === "watch" ? "Watch" : "Positive"} />
          <MiniMetric label="Stable" value={wellnessScore} />
          <MiniMetric label="Care" value={journeyActive || bookingActive ? "Active" : "Completed"} />
        </div>
      ) : (
        <div className="mt-5 rounded-2xl bg-slate-100 p-4 text-sm text-slate-600">
          Once a service is subscribed or booked, this card will show caregiver status,
          medicine progress, mood, and care score.
        </div>
      )}
    </section>
  );
}

function RealtimeCareStrip({
  activeCare,
  service,
  recipient
}: {
  activeCare: boolean;
  service: string;
  recipient: Recipient;
}) {
  const status = activeCare
    ? `${service || "Care"} live for ${recipient.shortName}`
    : `Ready to arrange care for ${recipient.shortName}`;

  return (
    <section className="mt-4 overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/10 p-3 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <RealtimePulse />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">
            Realtime care system
          </p>
          <p className="mt-1 truncate text-sm text-white/70">{status}</p>
        </div>
        <span className="rounded-full bg-emerald-300 px-3 py-1 text-xs font-semibold text-[#06130f]">
          {activeCare ? "Live" : "Ready"}
        </span>
      </div>
    </section>
  );
}

function PrimaryCareCta({
  recipient,
  onBook
}: {
  recipient: Recipient;
  onBook: () => void;
}) {
  return (
    <section className="mt-5 rounded-[2rem] bg-gradient-to-br from-emerald-200 via-white to-amber-100 p-5 text-[#06130f] shadow-2xl shadow-black/20">
      <p className="text-sm font-semibold text-emerald-800">Primary action</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight">
        Get care for {recipient.shortName}
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Answer a few quick questions and we will guide you to the right support.
      </p>
      <button
        onClick={onBook}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[#06130f] px-5 py-4 font-semibold text-white"
      >
        Continue
        <ChevronRight className="h-5 w-5" />
      </button>
    </section>
  );
}

function QuickActions({
  activeCare,
  experience,
  onTrack,
  onBook,
  onRebook
}: {
  activeCare: boolean;
  experience: ReturnType<typeof serviceExperienceFor>;
  onTrack: () => void;
  onBook: () => void;
  onRebook: () => void;
}) {
  return (
    <section className="mt-5 grid grid-cols-2 gap-3">
      <button
        onClick={activeCare ? onTrack : onBook}
        className="rounded-[1.5rem] bg-white/10 p-4 text-left"
      >
        {activeCare ? (
          <MapPinned className="h-5 w-5 text-emerald-200" />
        ) : (
          <HeartPulse className="h-5 w-5 text-emerald-200" />
        )}
        <p className="mt-3 font-semibold">
          {activeCare ? experience.trackLabel : "Book care now"}
        </p>
        <p className="mt-1 text-sm text-white/45">
          {activeCare ? "Live updates ready" : "Start a guided request"}
        </p>
      </button>
      <button
        onClick={onRebook}
        className="rounded-[1.5rem] bg-white/10 p-4 text-left"
      >
        <Repeat2 className="h-5 w-5 text-emerald-200" />
        <p className="mt-3 font-semibold">{experience.rebookLabel}</p>
        <p className="mt-1 text-sm text-white/45">Request familiar support</p>
      </button>
    </section>
  );
}

function CareConfidence({
  recipient,
  health
}: {
  recipient: Recipient;
  health: HealthSnapshot | null;
}) {
  return (
    <section className="mt-5 rounded-[1.5rem] bg-white/10 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-white/50">Daily Care Score</p>
          <h3 className="mt-1 text-2xl font-semibold">
            {recipient.shortName} Today
          </h3>
        </div>
        <div className="rounded-full bg-emerald-300 px-4 py-2 font-semibold text-[#06130f]">
          {health?.wellness === "watch" ? "84%" : "92%"} Stable
        </div>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs text-white/55">
        {["Meals", "Medicine", "Vitals", "Activity"].map((item) => (
          <div key={item} className="rounded-2xl bg-white/10 px-2 py-3">
            <Check className="mx-auto mb-1 h-4 w-4 text-emerald-200" />
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

function MedicalRiskPanel({
  recipient,
  risk
}: {
  recipient: Recipient;
  risk: CareRiskSummary | null;
}) {
  const riskTone =
    risk?.riskLevel === "high"
      ? "bg-red-500/20 text-red-50"
      : risk?.riskLevel === "watch"
        ? "bg-amber-200/15 text-amber-50"
        : "bg-emerald-200/10 text-emerald-50";
  const signals = risk?.riskSignals?.length
    ? risk.riskSignals
    : ["No urgent medical risk signals", "Emergency contact readiness active"];

  return (
    <section className={`mt-5 rounded-[1.5rem] p-4 ${riskTone}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white/60">Medical readiness</p>
          <h3 className="mt-1 text-2xl font-semibold">
            {risk?.riskLevel === "high"
              ? `${recipient.shortName} needs attention`
              : risk?.riskLevel === "watch"
                ? `${recipient.shortName} is on watch`
                : `${recipient.shortName} looks stable`}
          </h3>
          <p className="mt-2 text-sm leading-6 text-white/60">
            {risk?.recommendations?.[0] ||
              "We combine medicines, vitals, profile flags, incidents, and emergency readiness into one care view."}
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#06130f]">
          {risk?.riskScore ?? 18}/100
        </span>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs text-white/65">
        <div className="rounded-2xl bg-white/10 p-3">
          Fall
          <p className="mt-1 font-semibold text-white">{risk?.fallRisk || "low"}</p>
        </div>
        <div className="rounded-2xl bg-white/10 p-3">
          Medicine
          <p className="mt-1 font-semibold text-white">{risk?.medicationRisk || "stable"}</p>
        </div>
        <div className="rounded-2xl bg-white/10 p-3">
          Vitals
          <p className="mt-1 font-semibold text-white">{risk?.vitalsRisk || "stable"}</p>
        </div>
        <div className="rounded-2xl bg-white/10 p-3">
          SOS
          <p className="mt-1 font-semibold text-white">{risk?.emergencyReadinessScore ?? 85}%</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {[...signals, ...(risk?.chronicConditionFlags || [])].slice(0, 5).map((signal) => (
          <span
            key={signal}
            className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70"
          >
            {signal}
          </span>
        ))}
      </div>
      {risk?.missedCareSignals?.length ? (
        <div className="mt-4 rounded-2xl bg-white/10 p-3 text-sm text-white/70">
          Missed-care signals: {risk.missedCareSignals.join(", ")}
        </div>
      ) : null}
    </section>
  );
}

function FamilyReassuranceSystem({
  recipient,
  health,
  booking,
  journey,
  reports,
  experience,
  aiInsight
}: {
  recipient: Recipient;
  health: HealthSnapshot | null;
  booking: CareBooking | null;
  journey: CareJourney | null;
  reports: VisitReport[];
  experience: ReturnType<typeof serviceExperienceFor>;
  aiInsight: AiReassuranceInsight | null;
}) {
  const activeService = cleanServiceName(journey?.serviceType || booking?.serviceType);
  const hasLiveCare = Boolean(
    (journey && journey.status !== "idle") || (booking && booking.status !== "none")
  );
  const latestReport = reports[0];
  const wellbeing =
    health?.wellness === "watch"
      ? `${recipient.shortName} needs a little attention`
      : `${recipient.shortName} looks okay right now`;
  const familyLine = latestReport
    ? latestReport.familySummary
    : hasLiveCare
      ? `${experience.feed[0]} Family updates are active.`
      : "Book a service and this becomes the realtime family care board.";

  return (
    <section className="mt-5 space-y-3">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[1.5rem] border border-white/10 bg-white/10 p-4 backdrop-blur-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-emerald-100">
              Family reassurance
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">
              {wellbeing}
            </h3>
            <p className="mt-2 text-sm leading-6 text-white/55">{familyLine}</p>
          </div>
          <RealtimePulse />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <TrustSignal label="Caregiver" value={hasLiveCare ? "Live" : "Ready"} />
          <TrustSignal label="Family" value="Updated" />
          <TrustSignal label="Emergency" value="Active" />
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-3">
        <InsightCard
          eyebrow="AI insight"
          title={
            aiInsight?.headline ||
            (health?.medicineStatus === "missed" ? "Medicine follow-up" : "Routine looks steady")
          }
          body={
            aiInsight?.summary ||
            (health?.medicineStatus === "missed"
              ? "Medicine support should be prioritized in the next visit."
              : `${activeService || experience.profilePreference} is aligned with the current care plan.`)
          }
          icon={Sparkles}
        />
        <InsightCard
          eyebrow="NRI updates"
          title="Family visibility on"
          body="WhatsApp, voice notes, and visit summaries are ready for remote family coordination."
          icon={MessageCircle}
        />
      </div>
      <AiDailyCareSummary
        recipient={recipient}
        insight={aiInsight}
        fallback={`${recipient.shortName}'s care plan is connected across family, caregiver, and ops.`}
      />
      <TrustVisibilityPanel recipient={recipient} hasLiveCare={hasLiveCare} />
    </section>
  );
}

function AiDailyCareSummary({
  recipient,
  insight,
  fallback
}: {
  recipient: Recipient;
  insight: AiReassuranceInsight | null;
  fallback: string;
}) {
  return (
    <section className="rounded-[1.5rem] bg-emerald-200/10 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-300 text-[#06130f]">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-emerald-100">AI daily care summary</p>
          <h3 className="mt-1 text-xl font-semibold">
            {insight?.headline || `${recipient.shortName}'s care looks organized`}
          </h3>
          <p className="mt-2 text-sm leading-6 text-white/60">
            {insight?.emotionalMessage || fallback}
          </p>
          <p className="mt-3 rounded-2xl bg-white/10 p-3 text-sm text-white/65">
            Next best action: {insight?.nextAction || "Keep the next care update visible for family."}
          </p>
        </div>
      </div>
    </section>
  );
}

function TrustVisibilityPanel({
  recipient,
  hasLiveCare
}: {
  recipient: Recipient;
  hasLiveCare: boolean;
}) {
  return (
    <Card className="bg-white/10">
      <CardHeader>
        <div>
          <CardTitle>Trust is visible</CardTitle>
          <CardDescription>
            Every visit keeps family, caregiver, and ops signals connected for {recipient.shortName}.
          </CardDescription>
        </div>
        <Badge variant={hasLiveCare ? "trust" : "default"}>{hasLiveCare ? "Live" : "Ready"}</Badge>
      </CardHeader>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {[
          "Verified caregiver",
          "Police verification",
          "Realtime timestamp",
          "Visit proof ready"
        ].map((item) => (
          <div key={item} className="rounded-2xl bg-white/10 p-3 text-white/70">
            <Check className="mb-1 h-4 w-4 text-emerald-200" />
            {item}
          </div>
        ))}
      </div>
    </Card>
  );
}

function CareContinuitySystem({
  summary,
  recipient,
  onBook,
  onRebook
}: {
  summary: RetentionSummary | null;
  recipient: Recipient;
  onBook: () => void;
  onRebook: () => void;
}) {
  const actions = summary?.actions?.length
    ? summary.actions
    : [
        {
          id: "fallback-weekly-care",
          title: "Build a weekly care rhythm",
          body: `Schedule familiar care for ${recipient.shortName} so family updates become predictable.`,
          cta: "Book next visit",
          kind: "recurring" as const,
          serviceType: "Parent Wellness Plan",
          priority: "recommended" as const
        }
      ];
  const primaryAction = actions[0];

  return (
    <section className="mt-5 rounded-[1.5rem] bg-white p-4 text-[#06130f]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Care continuity</p>
          <h3 className="mt-1 text-2xl font-semibold">
            {summary?.headline || `Keep ${recipient.shortName}'s care predictable`}
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {summary?.reassuranceLine ||
              "LDERLY will recommend the next best care action after every visit."}
          </p>
        </div>
        <div className="rounded-2xl bg-emerald-100 px-3 py-2 text-center">
          <p className="text-xs font-semibold text-emerald-800">Continuity</p>
          <p className="mt-1 text-xl font-semibold">{summary?.retentionScore ?? 72}%</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-2xl bg-slate-100 p-3">
          <p className="text-slate-500">Visits</p>
          <p className="mt-1 font-semibold">{summary?.completedVisits ?? 0}</p>
        </div>
        <div className="rounded-2xl bg-slate-100 p-3">
          <p className="text-slate-500">Plan</p>
          <p className="mt-1 font-semibold">{summary?.recurringActive ? "Active" : "Suggested"}</p>
        </div>
        <div className="rounded-2xl bg-slate-100 p-3">
          <p className="text-slate-500">Digest</p>
          <p className="mt-1 font-semibold">{summary?.familyDigestReady ? "Ready" : "Pending"}</p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {actions.slice(0, 3).map((action) => (
          <button
            key={action.id}
            onClick={action.kind === "rebook" ? onRebook : onBook}
            className="w-full rounded-3xl bg-slate-100 p-4 text-left transition hover:bg-slate-200"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{action.title}</p>
                <p className="mt-1 text-sm leading-5 text-slate-500">{action.body}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                  action.priority === "urgent"
                    ? "bg-red-100 text-red-700"
                    : action.priority === "recommended"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-white text-slate-600"
                }`}
              >
                {action.cta}
              </span>
            </div>
          </button>
        ))}
      </div>
      <button
        onClick={primaryAction.kind === "rebook" ? onRebook : onBook}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#06130f] px-4 py-3 text-sm font-semibold text-white"
      >
        <Repeat2 className="h-4 w-4" />
        {summary?.nextBestAction || primaryAction.cta}
      </button>
    </section>
  );
}

function TrustedCaregiverProfile({
  recipient,
  booking,
  journey,
  trustProfile,
  onRebook
}: {
  recipient: Recipient;
  booking: CareBooking | null;
  journey: CareJourney | null;
  trustProfile: CaregiverTrustProfile | null;
  onRebook: () => void;
}) {
  const assignedCaregiverName = trustProfile?.name || journey?.caretakerName || booking?.caretakerName || "";
  const caregiverName = assignedCaregiverName || "Caregiver matching after booking";
  const hasAssignedCaregiver = Boolean(
    assignedCaregiverName &&
      assignedCaregiverName !== "Assigning now" &&
      assignedCaregiverName !== "Best caregiver nearby"
  );
  const badges = trustProfile?.badges?.length
    ? trustProfile.badges
    : hasAssignedCaregiver
      ? ["ID verified", "Police checked", "Trained caregiver", "Visit history updating"]
      : ["ID verification", "Police check", "Training status", "Family rating"];

  return (
    <section className="mt-5 rounded-[1.5rem] bg-white p-4 text-[#06130f]">
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-200 to-sky-200 text-2xl font-bold">
          {hasAssignedCaregiver ? caregiverName.charAt(0) : "?"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-emerald-700">Verified caregiver profile</p>
          <h3 className="mt-1 text-2xl font-semibold">{caregiverName}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {hasAssignedCaregiver
              ? `Familiar caregiver for ${recipient.shortName}`
              : `Best available caregiver will be shown after matching`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {badges.slice(0, 4).map((signal) => (
              <span
                key={signal}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
              >
                {signal}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        <CaregiverTrustMetric label="Trust score" value={trustProfile ? `${trustProfile.trustScore}%` : "After match"} />
        <CaregiverTrustMetric label="Punctuality" value={trustProfile ? `${trustProfile.punctualityScore}%` : "After visit"} />
        <CaregiverTrustMetric
          label="Languages"
          value={trustProfile?.languages?.slice(0, 2).join(", ") || "Shown after match"}
        />
      </div>
      <button
        onClick={onRebook}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#06130f] px-4 py-3 text-sm font-semibold text-white"
      >
        <Repeat2 className="h-4 w-4" />
        {hasAssignedCaregiver ? "Rebook same caregiver" : "Book verified caregiver"}
      </button>
    </section>
  );
}

function CaregiverTrustMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-100 p-3">
      <p className="text-slate-500">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function SessionSummaryPreview({
  recipient,
  reports
}: {
  recipient: Recipient;
  reports: VisitReport[];
}) {
  const latestReport = reports[0];
  const summaryItems = latestReport
    ? [
        latestReport.vitalsSummary,
        latestReport.medicineSummary,
        latestReport.familySummary,
        latestReport.caregiverNote
      ]
    : [
        `No completed visit summary for ${recipient.shortName} yet.`,
        "Vitals, medicines, caregiver notes, and family handover will appear after the first visit."
      ];

  return (
    <section className="mt-5 rounded-[1.5rem] bg-white/10 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-emerald-100">Today&apos;s care summary</p>
          <h3 className="mt-1 text-2xl font-semibold">
            {latestReport ? "Family handover ready" : "Care summary appears after the visit"}
          </h3>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/60">
          {latestReport ? "Voice note" : "After visit"}
        </span>
      </div>
      <div className="mt-4 space-y-2">
        {summaryItems.slice(0, 4).map((item) => (
          <div key={item} className="flex items-start gap-3 rounded-2xl bg-white/10 p-3 text-sm">
            {latestReport ? (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" />
            ) : (
              <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-white/45" />
            )}
            <span className="text-white/70">{item}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function VisitProofSystem({
  recipient,
  reports,
  booking,
  journey,
  proof,
  onRebook
}: {
  recipient: Recipient;
  reports: VisitReport[];
  booking: CareBooking | null;
  journey: CareJourney | null;
  proof: VisitProof | null;
  onRebook: () => void;
}) {
  const latestReport = reports[0];
  const timestamp = latestReport?.completedAt || booking?.updatedAt || journey?.updatedAt || 0;
  const confidenceScore =
    proof?.confidenceScore ?? (latestReport ? 92 : booking?.status === "completed" ? 84 : 48);
  const completedChecks =
    proof?.completedChecks?.length
      ? proof.completedChecks
      : latestReport
        ? [
            latestReport.familySummary,
            latestReport.vitalsSummary,
            latestReport.medicineSummary
          ]
        : ["Care proof will unlock after the visit", "Family handover pending"];
  const proofTimeline =
    proof?.timeline?.length
      ? proof.timeline
      : [
          {
            label: booking ? "Request created" : "Request pending",
            at: booking?.createdAt || timestamp,
            verified: Boolean(booking)
          },
          {
            label: latestReport ? "Visit completed" : "Completion pending",
            at: latestReport?.completedAt || timestamp,
            verified: Boolean(latestReport)
          }
        ];
  const proofItems = proof
    ? [
        { label: "Timestamp", value: proof.timestampLabel },
        { label: "Vitals", value: proof.vitalsSummary },
        { label: "Medicine", value: proof.medicineSummary },
        { label: "GPS", value: proof.locationLabel }
      ]
    : latestReport
    ? [
        { label: "Completed", value: timestamp ? new Date(timestamp).toLocaleString() : "Verified after visit" },
        { label: "Vitals", value: latestReport.vitalsSummary },
        { label: "Medicine", value: latestReport.medicineSummary },
        { label: "GPS", value: booking?.tracking?.destinationLabel || journey?.destinationLabel || "Care location verified" }
      ]
    : [
        { label: "Timestamp", value: "Will verify when visit starts" },
        { label: "GPS", value: "Location proof pending" },
        { label: "Care notes", value: "Caregiver note pending" },
        { label: "Family proof", value: "Photo / voice note optional" }
      ];

  return (
    <section className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/10 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-emerald-100">Visit proof</p>
          <h3 className="mt-1 text-2xl font-semibold">
            {latestReport ? "Proof ready for family" : `Proof will appear for ${recipient.shortName}`}
          </h3>
          <p className="mt-2 text-sm leading-6 text-white/55">
            Timestamps, GPS, vitals, medicine status, caregiver notes, and optional media are kept together for family trust.
          </p>
        </div>
        <Badge variant={latestReport ? "trust" : "default"}>{latestReport ? "Verified" : "Pending"}</Badge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {proofItems.map((item) => (
          <div key={item.label} className="rounded-2xl bg-white/10 p-3">
            <p className="text-xs text-white/45">{item.label}</p>
            <p className="mt-1 text-sm font-semibold text-white/75">{item.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-3xl bg-white p-4 text-[#06130f]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-emerald-700">Family confidence</p>
            <h4 className="mt-1 text-3xl font-semibold">{confidenceScore}%</h4>
          </div>
          <div className="h-16 w-16 rounded-full bg-emerald-100 p-2">
            <div className="flex h-full w-full items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
              {confidenceScore >= 80 ? "Stable" : "Watch"}
            </div>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {completedChecks.slice(0, 3).map((item) => (
            <div key={item} className="flex items-start gap-2 rounded-2xl bg-slate-100 p-3 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              <span className="text-slate-600">{item}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {proofTimeline.slice(0, 4).map((item) => (
          <div key={`${item.label}-${item.at}`} className="flex items-center gap-3 rounded-2xl bg-white/10 p-3 text-sm">
            <span
              className={`h-3 w-3 rounded-full ${
                item.verified ? "bg-emerald-300" : "bg-white/20"
              }`}
            />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white/80">{item.label}</p>
              <p className="text-xs text-white/40">
                {item.at ? new Date(item.at).toLocaleString() : "Pending"}
              </p>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/55">
              {item.verified ? "Verified" : "Pending"}
            </span>
          </div>
        ))}
      </div>
      {proof?.proofSignals?.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {proof.proofSignals.map((signal) => (
            <span
              key={signal}
              className="rounded-full bg-emerald-200/15 px-3 py-1 text-xs font-semibold text-emerald-100"
            >
              {signal}
            </span>
          ))}
        </div>
      ) : null}
      <div className="mt-4 space-y-2">
        {(proof?.attachments || latestReport?.attachments || [
          { label: "Visit photo", status: "pending" as const },
          { label: "Voice summary", status: "pending" as const }
        ]).slice(0, 3).map((attachment) => (
          <div key={attachment.label} className="flex items-center justify-between rounded-2xl bg-white/10 px-3 py-2 text-sm">
            <span className="text-white/70">{attachment.label}</span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/60">
              {attachment.status === "not_required" ? "optional" : attachment.status}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-3xl bg-emerald-200/10 p-4">
        <p className="text-sm font-semibold text-emerald-100">Next best action</p>
        <p className="mt-2 text-sm leading-6 text-white/65">
          {proof?.nextBestAction ||
            (latestReport
              ? "Rate this visit and rebook the same caregiver if the experience felt familiar."
              : "Care proof and next action will appear after completion.")}
        </p>
        <p className="mt-2 text-xs text-white/45">
          {proof?.ratingPrompt || proof?.rebookPrompt || "Rating and rebooking unlock after visit proof is ready."}
        </p>
        <button
          onClick={onRebook}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-[#06130f]"
        >
          <Repeat2 className="h-4 w-4" />
          {proof?.rebookPrompt ? "Rebook familiar care" : "Plan next care"}
        </button>
      </div>
    </section>
  );
}

function NriMonthlyReportPreview({
  recipient,
  reports,
  aiInsight
}: {
  recipient: Recipient;
  reports: VisitReport[];
  aiInsight: AiReassuranceInsight | null;
}) {
  const reportReady = reports.length > 0;
  return (
    <section className="mt-5 rounded-[1.5rem] bg-white/10 p-4">
      <p className="text-sm font-semibold text-emerald-100">NRI family report</p>
      <h3 className="mt-1 text-2xl font-semibold">Monthly reassurance preview</h3>
      <p className="mt-2 text-sm leading-6 text-white/55">
        A family-ready summary can combine visits, medicines, vitals, caregiver notes, expenses, and care recommendations.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-white/60">
        <div className="rounded-2xl bg-white/10 p-3">{reports.length} visits</div>
        <div className="rounded-2xl bg-white/10 p-3">{reportReady ? "Care score ready" : "Care score after visit"}</div>
        <div className="rounded-2xl bg-white/10 p-3">{reportReady ? "PDF ready" : "PDF after visit"}</div>
      </div>
      <p className="mt-4 rounded-2xl bg-white/10 p-3 text-sm text-white/65">
        {aiInsight?.nextAction || `Next update: share ${recipient.shortName}'s weekly summary with family.`}
      </p>
    </section>
  );
}

function AccessibilityCareControls({ recipient }: { recipient: Recipient }) {
  return (
    <section className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/10 p-4">
      <p className="text-sm font-semibold text-emerald-100">Elder-friendly mode</p>
      <p className="mt-2 text-sm leading-6 text-white/55">
        Larger touch targets, calmer alerts, voice summaries, and family-first updates are ready for {recipient.shortName}.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-white/60">
        <div className="rounded-2xl bg-white/10 p-3">Large text</div>
        <div className="rounded-2xl bg-white/10 p-3">Voice notes</div>
        <div className="rounded-2xl bg-white/10 p-3">Family alerts</div>
      </div>
    </section>
  );
}

function RealtimePulse() {
  return (
    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-300/15">
      <span className="absolute h-8 w-8 animate-ping rounded-full bg-emerald-300/30" />
      <span className="relative h-3 w-3 rounded-full bg-emerald-200" />
    </div>
  );
}

function TrustSignal({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 p-3">
      <p className="text-xs text-white/45">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function InsightCard({
  eyebrow,
  title,
  body,
  icon: Icon
}: {
  eyebrow: string;
  title: string;
  body: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-[1.5rem] bg-white/10 p-4">
      <Icon className="h-5 w-5 text-emerald-200" />
      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/40">
        {eyebrow}
      </p>
      <p className="mt-2 font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-5 text-white/45">{body}</p>
    </div>
  );
}

function SmartRecommendation({
  experience,
  recipient,
  service,
  onBook
}: {
  experience: ReturnType<typeof serviceExperienceFor>;
  recipient: Recipient;
  service: string;
  onBook: () => void;
}) {
  return (
    <section className="mt-5 rounded-[1.5rem] bg-amber-200/15 p-4">
      <p className="text-sm font-semibold text-amber-100">
        Recommended for today
      </p>
      <p className="mt-2 text-sm leading-6 text-white/70">
        {`${service} is active for ${recipient.shortName}. ${experience.profilePreference}.`}
      </p>
      <button
        onClick={onBook}
        className="mt-4 rounded-full bg-white px-4 py-3 text-sm font-semibold text-[#06130f]"
      >
        Continue
      </button>
    </section>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-100 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function FirstTimeHome({
  details,
  recipient,
  onBook,
  onImmediate
}: {
  details: RecipientDetails;
  recipient: Recipient;
  onBook: () => void;
  onImmediate: () => void;
}) {
  return (
    <section className="rounded-[2rem] bg-gradient-to-br from-emerald-200 via-white to-amber-100 p-6 text-[#06130f] shadow-2xl shadow-black/20">
      <Avatar recipient={recipient} size="lg" />
      <p className="mt-6 text-sm font-semibold uppercase tracking-[0.16em] text-emerald-800">
        First care setup
      </p>
      <h2 className="mt-2 text-4xl font-semibold tracking-tight">
        Get care for {recipient.shortName}
      </h2>
      <p className="mt-3 text-base leading-7 text-slate-600">
        {`We have ${details.fullName || recipient.displayName}'s basics. Choose the first care need and LDERLY will guide you through the right service.`}
      </p>
      <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs text-slate-600">
        <div className="rounded-2xl bg-white/70 p-3">
          <ShieldCheck className="mx-auto mb-1 h-4 w-4 text-emerald-800" />
          Verified care
        </div>
        <div className="rounded-2xl bg-white/70 p-3">
          <MapPinned className="mx-auto mb-1 h-4 w-4 text-emerald-800" />
          Live tracking
        </div>
        <div className="rounded-2xl bg-white/70 p-3">
          <MessageCircle className="mx-auto mb-1 h-4 w-4 text-emerald-800" />
          Family updates
        </div>
      </div>
      <button
        onClick={onBook}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-[#06130f] px-5 py-4 font-semibold text-white"
      >
        Continue to care options
        <ChevronRight className="h-5 w-5" />
      </button>
      <button
        onClick={onImmediate}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-red-500 px-5 py-4 font-semibold text-white shadow-xl shadow-red-500/20"
      >
        Immediate Assistance
      </button>
    </section>
  );
}

function BookingFunnel({
  recipient,
  step,
  selectedNeed,
  selectedService,
  selectedDuration,
  selectedTime,
  selectedLocation,
  onClose,
  onNeed,
  onService,
  onDuration,
  onTime,
  onLocation,
  onBack,
  onConfirm
}: {
  recipient: Recipient;
  step: BookingStep;
  selectedNeed: CareNeed;
  selectedService: string;
  selectedDuration: DurationOption;
  selectedTime: TimeOption;
  selectedLocation: LocationOption;
  onClose: () => void;
  onNeed: (need: CareNeed) => void;
  onService: (service: string) => void;
  onDuration: (duration: DurationOption) => void;
  onTime: (time: TimeOption) => void;
  onLocation: (location: LocationOption) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const stepIndex = ["need", "service", "duration", "time", "location", "review"].indexOf(step);
  const stepLabel = `${stepIndex + 1} of 6`;
  const locationOptions: LocationOption[] = [
    {
      label: "Saved care address",
      detail: recipient.name ? "Use the address saved in care profile" : "Use saved address"
    },
    {
      label: "Hospital / clinic",
      detail: "Use this when care is needed at a medical location"
    },
    {
      label: "Lab / diagnostic center",
      detail: "Use this for tests or report collection"
    },
    {
      label: "Add another location",
      detail: "Enter a new address before final confirmation"
    }
  ];

  return (
    <div className="fixed inset-0 z-30 h-dvh overflow-y-auto overscroll-contain bg-[#06130f] text-white">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(45,212,191,.2),transparent_35%),linear-gradient(180deg,#06130f,#050706)]" />
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col px-4 py-5 pb-10">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="rounded-full bg-white/10 px-4 py-2 text-sm">
            Back
          </button>
          <button onClick={onClose} className="rounded-full bg-white/10 px-4 py-2 text-sm">
            Close
          </button>
        </div>
        <div className="mt-5 rounded-[1.5rem] bg-white/10 p-4">
          <div className="flex items-center gap-3">
            <Avatar recipient={recipient} />
            <div>
              <p className="text-sm font-semibold text-emerald-100">
                Step {stepLabel}
              </p>
              <p className="mt-1 text-sm text-white/55">
                Care for {recipient.displayName}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-6 gap-2">
          {["Help", "Service", "Duration", "When", "Where", "Review"].map((label, index) => (
            <div key={label}>
              <div
                className={`h-1.5 rounded-full ${
                  index <= stepIndex ? "bg-emerald-300" : "bg-white/15"
                }`}
              />
              <p className="mt-2 text-xs text-white/45">{label}</p>
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === "need" && (
            <FunnelScreen key="need">
              <h2 className="text-3xl font-semibold tracking-tight">
                What kind of support does {recipient.shortName} need today?
              </h2>
              <p className="mt-2 text-sm text-white/55">
                Choose the closest need. We will recommend the right service next.
              </p>
              <div className="mt-6 space-y-3">
                {careNeeds.map((need) => (
                  <NeedCard key={need.title} need={need} onClick={() => onNeed(need)} />
                ))}
              </div>
            </FunnelScreen>
          )}

          {step === "service" && (
            <FunnelScreen key="service">
              <h2 className="text-3xl font-semibold tracking-tight">
                Recommended care options
              </h2>
              <p className="mt-2 text-sm text-white/55">
                {selectedNeed.recommendation}
              </p>
              <div className="mt-6 space-y-3">
                {selectedNeed.serviceGroups
                  ? selectedNeed.serviceGroups.map((group) => (
                      <div key={group.title} className="rounded-[1.5rem] bg-white/10 p-3">
                        <p className="font-semibold">{group.title}</p>
                        <p className="mt-1 text-sm text-white/50">{group.subtitle}</p>
                        <div className="mt-3 space-y-2">
                          {group.services.map((service) => (
                            <SelectRow
                              key={service}
                              active={selectedService === service}
                              title={service}
                              subtitle={`For ${recipient.shortName}`}
                              onClick={() => onService(service)}
                            />
                          ))}
                        </div>
                      </div>
                    ))
                  : selectedNeed.services.map((service) => (
                      <SelectRow
                        key={service}
                        active={selectedService === service}
                        title={service}
                        subtitle={`For ${recipient.shortName}`}
                        onClick={() => onService(service)}
                      />
                    ))}
              </div>
            </FunnelScreen>
          )}

          {step === "duration" && (
            <FunnelScreen key="duration">
              <h2 className="text-3xl font-semibold tracking-tight">
                Choose duration
              </h2>
              <p className="mt-2 text-sm text-white/55">
                Availability and pricing are estimated before confirmation.
              </p>
              <div className="mt-6 space-y-3">
                {durationOptions.map((duration) => (
                  <SelectRow
                    key={duration.label}
                    active={selectedDuration.label === duration.label}
                    title={`${duration.label} - ${duration.price}`}
                    subtitle={
                      duration.recommended
                        ? `${duration.note} - Recommended`
                        : duration.note
                    }
                    onClick={() => onDuration(duration)}
                  />
                ))}
              </div>
            </FunnelScreen>
          )}

          {step === "time" && (
            <FunnelScreen key="time">
              <h2 className="text-3xl font-semibold tracking-tight">
                When do you need care?
              </h2>
              <p className="mt-2 text-sm text-white/55">
                Choose when the caregiver should be arranged.
              </p>
              <div className="mt-6 space-y-3">
                {timeOptions.map((time) => (
                  <SelectRow
                    key={time.label}
                    active={selectedTime.label === time.label}
                    title={time.label}
                    subtitle={time.detail}
                    onClick={() => onTime(time)}
                  />
                ))}
              </div>
            </FunnelScreen>
          )}

          {step === "location" && (
            <FunnelScreen key="location">
              <h2 className="text-3xl font-semibold tracking-tight">
                Where is care needed?
              </h2>
              <p className="mt-2 text-sm text-white/55">
                Confirm the place before we match a caregiver.
              </p>
              <div className="mt-6 space-y-3">
                {locationOptions.map((location) => (
                  <SelectRow
                    key={location.label}
                    active={selectedLocation.label === location.label}
                    title={location.label}
                    subtitle={location.detail}
                    onClick={() => onLocation(location)}
                  />
                ))}
              </div>
            </FunnelScreen>
          )}

          {step === "review" && (
            <FunnelScreen key="review">
              <section className="rounded-[2rem] bg-white p-5 text-[#06130f]">
                <h2 className="text-3xl font-semibold tracking-tight">
                  Review booking
                </h2>
                <div className="mt-5 space-y-3">
                  <MiniMetric label="Care for" value={recipient.displayName} />
                  <MiniMetric label="Service" value={selectedService} />
                  <MiniMetric label="Duration" value={selectedDuration.label} />
                  <MiniMetric label="When" value={selectedTime.label} />
                  <MiniMetric label="Where" value={selectedLocation.label} />
                </div>
                <div className="mt-5 rounded-2xl bg-slate-100 p-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Care estimate</span>
                    <span className="font-semibold">{selectedDuration.price}</span>
                  </div>
                  <div className="mt-2 flex justify-between gap-4">
                    <span className="text-slate-500">Coordination fee</span>
                    <span className="font-semibold">Included</span>
                  </div>
                  <div className="mt-3 border-t border-slate-200 pt-3 flex justify-between gap-4">
                    <span className="font-semibold">Estimated total</span>
                    <span className="font-semibold">{selectedDuration.price}</span>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2 text-xs text-emerald-800">
                  {[
                    "Verified caregivers",
                    "Family updates included",
                    "Support available",
                    "Trained attendants"
                  ].map((item) => (
                    <div key={item} className="rounded-2xl bg-emerald-50 p-3">
                      <Check className="mb-1 h-4 w-4" />
                      {item}
                    </div>
                  ))}
                </div>
                <button
                  onClick={onConfirm}
                  className="mt-5 w-full rounded-full bg-[#06130f] px-5 py-4 font-semibold text-white"
                >
                  Confirm Care
                </button>
              </section>
            </FunnelScreen>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function FunnelScreen({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="mt-7"
    >
      {children}
    </motion.div>
  );
}

function NeedCard({ need, onClick }: { need: CareNeed; onClick: () => void }) {
  const Icon = need.icon;

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-[1.5rem] bg-white p-4 text-left text-[#06130f]"
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-100">
        <Icon className="h-6 w-6 text-emerald-800" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{need.title}</p>
        <p className="mt-1 text-sm text-slate-500">{need.subtitle}</p>
      </div>
      <ChevronRight className="h-5 w-5 text-slate-400" />
    </button>
  );
}

function SelectRow({
  active,
  title,
  subtitle,
  onClick
}: {
  active: boolean;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-3xl p-4 text-left transition ${
        active ? "bg-white text-[#06130f]" : "bg-white/10 text-white"
      }`}
    >
      <div>
        <p className="font-semibold">{title}</p>
        <p className={`mt-1 text-sm ${active ? "text-slate-500" : "text-white/50"}`}>
          {subtitle}
        </p>
      </div>
      <ChevronRight className="h-5 w-5 opacity-60" />
    </button>
  );
}

function CareOnWay({ recipient }: { recipient: Recipient }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#06130f] p-6 text-white">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-300 text-[#06130f]">
          <Check className="h-10 w-10" />
        </div>
        <h2 className="mt-6 text-4xl font-semibold tracking-tight">
          Care is on the way
        </h2>
        <p className="mt-3 text-base leading-7 text-white/60">
          We have sent {recipient.shortName}&apos;s request to nearby verified caregivers. The Care screen will open automatically with assignment, ETA, OTP, and live updates.
        </p>
        <div className="mt-6 grid grid-cols-3 gap-2 text-xs text-white/65">
          {["Matching", "ETA", "OTP"].map((item) => (
            <div key={item} className="rounded-2xl bg-white/10 px-3 py-3">
              {item}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

function JourneyExperience({
  recipient,
  journey,
  booking,
  onImmediate,
  onCompletePayment,
  onVerifyCompletion,
  onCancelCare,
  onRateCare
}: {
  recipient: Recipient;
  journey: CareJourney | null;
  booking: CareBooking | null;
  onImmediate: () => void;
  onCompletePayment: () => void;
  onVerifyCompletion: () => void;
  onCancelCare: () => void;
  onRateCare: () => void;
}) {
  const [liveNow, setLiveNow] = useState(() => new Date().getTime());
  const bookingStatus = booking?.status ?? "none";
  const paymentPending = Boolean(
    booking &&
      booking.status !== "none" &&
      !["paid", "refunded"].includes(booking.payment?.status || "pending")
  );
  const status =
    journey?.status ??
    (bookingStatus === "none" || bookingStatus === "cancelled"
      ? "idle"
      : bookingStatus === "searching"
        ? "requested"
        : bookingStatus === "payment_settled" || bookingStatus === "report_generated"
          ? "completed"
        : bookingStatus);
  const activeMapJourney: CareJourney | null =
    journey ||
    (booking && booking.status !== "none"
      ? {
          id: booking.id,
          status:
            status === "idle" || status === "escalated"
              ? "requested"
              : status === "completed"
                ? "completed"
                : status,
          summary: booking.lifecycle.currentStep,
          serviceType: booking.serviceType,
          eta: booking.tracking?.etaMinutes || 0,
          customerId: booking.customerId,
          customerName: booking.customerName,
          caretakerId: booking.caretakerId,
          caretakerName: booking.caretakerName,
          priority: booking.matching.priority,
          destinationLabel: booking.tracking?.destinationLabel || "Care location",
          customerLocation: booking.tracking?.customerLocation || {
            lat: 12.9716,
            lng: 77.5946
          },
          caretakerLocation: booking.tracking?.caretakerLocation || {
            lat: 12.985,
            lng: 77.61
          },
          lastLocationAt: booking.tracking?.lastLocationAt,
          createdAt: booking.createdAt,
          updatedAt: booking.updatedAt,
          timeline: booking.timeline
        }
      : null);
  const activeService = cleanServiceName(journey?.serviceType || booking?.serviceType);
  const hasActiveService =
    (journey && journey.status !== "idle") || (booking && booking.status !== "none");
  const careStatus = careStatusFor({ booking, journey });
  const serviceExperience = serviceExperienceFor(activeService);
  const activeIndex =
    bookingStatus === "in_progress"
      ? 4
      : status === "completed"
      ? 5
      : status === "arrived"
        ? 3
        : status === "en_route"
          ? 2
          : status === "assigned" || status === "accepted"
            ? 1
            : 0;
  const currentStep = journeySteps[activeIndex];
  const nextStep = journeySteps[Math.min(activeIndex + 1, journeySteps.length - 1)];
  useEffect(() => {
    const interval = window.setInterval(() => setLiveNow(new Date().getTime()), 30000);
    return () => window.clearInterval(interval);
  }, []);

  const locationAgeMinutes = activeMapJourney?.lastLocationAt && liveNow
    ? Math.max(0, Math.round((liveNow - activeMapJourney.lastLocationAt) / 60000))
    : null;
  const liveTrackingState =
    status === "in_progress"
      ? "live"
      : status === "arrived"
      ? "arrived"
      : status === "en_route" && (activeMapJourney?.eta ?? 0) > 0 && (activeMapJourney?.eta ?? 0) <= 3
        ? "arriving_soon"
        : ["accepted", "en_route"].includes(status)
          ? "live"
          : "waiting";
  const liveTrackingCopy =
    status === "in_progress"
      ? "Care has started. Live updates will appear as tasks are completed."
      : liveTrackingState === "arrived"
      ? "Caregiver has reached the care location."
      : liveTrackingState === "arriving_soon"
        ? "Arriving soon. Keep the service OTP ready."
        : liveTrackingState === "live"
          ? "Live location is updating from the caregiver app."
          : "Tracking begins as soon as your caregiver is confirmed.";
  const freshnessLabel =
    locationAgeMinutes === null
      ? "Location pending"
      : locationAgeMinutes <= 0
        ? "Updated just now"
        : `Updated ${locationAgeMinutes} min ago`;
  const canCancelRequest = ["searching", "assigned", "accepted"].includes(bookingStatus);
  const canRateCare =
    ["payment_settled", "report_generated"].includes(bookingStatus) && !booking?.rating?.score;

  return (
    <section>
      {paymentPending && booking ? (
        <PaymentPendingCare
          booking={booking}
          recipient={recipient}
          onCompletePayment={onCompletePayment}
        />
      ) : null}

      {!hasActiveService && (
        <section className="rounded-[2rem] bg-white p-5 text-[#06130f]">
          <p className="text-sm font-medium text-emerald-700">Care</p>
          <h2 className="mt-2 text-2xl font-semibold">No active care yet</h2>
          <p className="mt-2 text-sm text-slate-500">
            Once you confirm a service, live updates for that exact service will appear here.
          </p>
        </section>
      )}

      {hasActiveService && !paymentPending && (
        <>
      <div className="rounded-[2rem] bg-white p-5 text-[#06130f]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-emerald-700">Live care</p>
            <h2 className="mt-2 text-2xl font-semibold">
              {status === "idle" ? "No active care" : careStatus}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {activeService} - ETA {activeMapJourney?.eta ?? 8} mins - {journey?.caretakerName || booking?.caretakerName || "Best caregiver nearby"}
            </p>
          </div>
          <ShieldCheck className="h-8 w-8 text-emerald-700" />
        </div>

        <div className="mt-5 flex items-center gap-3 rounded-2xl bg-slate-100 p-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white">
            {(journey?.caretakerName || booking?.caretakerName || "?").charAt(0)}
          </div>
          <div className="flex-1">
            <p className="font-semibold">
              {journey?.caretakerName || booking?.caretakerName || "Caregiver being matched"}
            </p>
            <p className="text-sm text-slate-500">
              {(journey?.caretakerName || booking?.caretakerName)
                ? "Verified caregiver - trained - trust profile updating"
                : "Verified caregiver details appear after assignment"}
            </p>
            {(journey?.caretakerName || booking?.caretakerName) ? (
              <p className="mt-1 text-xs text-emerald-700">
                Familiarity and visit history will update after each completed visit.
              </p>
            ) : (
              <p className="mt-1 text-xs text-emerald-700">
                We will show name, photo, ETA, and trust badges after assignment.
              </p>
            )}
          </div>
          <button
            onClick={() => {
              trackProductEvent("customer_caregiver_message_clicked", {
                bookingId: booking?.id || journey?.id || "",
                service: activeService
              });
              window.open("https://wa.me/919916960524?text=I%20need%20an%20update%20on%20my%20LDERLY%20care%20visit", "_blank");
            }}
            aria-label="Message caregiver"
            className="rounded-full bg-white p-3"
          >
            <MessageCircle className="h-5 w-5" />
          </button>
          <button
            onClick={() => {
              trackProductEvent("customer_caregiver_call_clicked", {
                bookingId: booking?.id || journey?.id || "",
                service: activeService
              });
              window.location.href = "tel:+919916960524";
            }}
            aria-label="Call caregiver"
            className="rounded-full bg-white p-3"
          >
            <Phone className="h-5 w-5" />
          </button>
        </div>
      </div>

      <LiveEtaCard
        eta={activeMapJourney?.eta ?? 8}
        currentStep={currentStep}
        nextStep={nextStep}
        activeIndex={activeIndex}
        liveTrackingState={liveTrackingState}
        liveTrackingCopy={liveTrackingCopy}
        freshnessLabel={freshnessLabel}
      />

      <CustomerCareFunnel booking={booking} status={status} />

      <section className="mt-5 rounded-[1.5rem] border border-emerald-200/15 bg-white p-4 text-[#06130f]">
        <p className="text-sm font-semibold text-emerald-700">Care security</p>
        {booking?.status === "arrived" ? (
          <>
            <h3 className="mt-1 text-2xl font-semibold">Share OTP after caregiver arrives</h3>
            <div className="mt-3 rounded-3xl bg-slate-100 px-5 py-4 text-center text-3xl font-semibold tracking-[0.35em]">
              {booking?.serviceStart?.otp || "------"}
            </div>
            <p className="mt-2 text-sm text-slate-500">
              This OTP starts the visit. Share it only after the caregiver is at the care location.
            </p>
          </>
        ) : booking?.status === "completed" && booking?.completion?.paymentReleaseStatus === "awaiting_customer" ? (
          <>
            <h3 className="mt-1 text-2xl font-semibold">Confirm the visit went well</h3>
            <p className="mt-2 text-sm text-slate-500">
              Review the visit notes, medicine/vitals, and family handover before confirming.
            </p>
            <button
              onClick={onVerifyCompletion}
              className="mt-4 w-full rounded-full bg-[#06130f] px-5 py-4 font-semibold text-white"
            >
              Confirm visit
            </button>
          </>
        ) : booking?.status === "payment_settled" ? (
          <>
            <h3 className="mt-1 text-2xl font-semibold">Visit confirmed</h3>
            <p className="mt-2 text-sm text-slate-500">
              Thank you. Your care summary is ready for family review.
            </p>
            {canRateCare ? (
              <button
                onClick={onRateCare}
                className="mt-4 w-full rounded-full bg-[#06130f] px-5 py-4 font-semibold text-white"
              >
                Rate this care 5/5
              </button>
            ) : null}
          </>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            OTP and visit confirmation controls appear at the right moment in the care journey.
          </p>
        )}
      </section>

      {canCancelRequest ? (
        <button
          onClick={onCancelCare}
          className="mt-4 w-full rounded-full border border-white/15 bg-white/10 px-5 py-4 text-sm font-semibold text-white"
        >
          Cancel this care request
        </button>
      ) : null}

      <div className="mt-5">
        <LiveMap journey={activeMapJourney} />
      </div>

      <section className="mt-6 rounded-[1.5rem] bg-white/10 p-4">
        <p className="font-semibold">Care progress</p>
        <div className="mt-4 grid grid-cols-6 gap-1">
          {journeySteps.map((step, index) => (
            <div
              key={step}
              className={`h-2 rounded-full transition-colors duration-500 ${
                index < activeIndex
                  ? "bg-emerald-300"
                  : index === activeIndex
                    ? "animate-pulse bg-amber-300"
                    : "bg-white/15"
              }`}
              title={step}
            />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-xs text-white/45">Now</p>
            <p className="mt-1 font-semibold">{currentStep}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-xs text-white/45">Next</p>
            <p className="mt-1 font-semibold">{nextStep}</p>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <p className="text-xl font-semibold">{serviceExperience.feedTitle}</p>
        <div className="mt-4 space-y-3">
          {serviceExperience.feed.slice(0, 3).map((item, index) => (
            <div key={item} className="rounded-3xl bg-white/10 p-4">
              <div className="flex items-start gap-3">
                {item.includes("Voice") ? (
                  <Mic className="mt-0.5 h-5 w-5 text-emerald-200" />
                ) : (
                  <Check className="mt-0.5 h-5 w-5 text-emerald-200" />
                )}
                <div>
                  <p className="text-sm">
                    {item.replace("Mom", recipient.shortName)}
                  </p>
                  <p className="mt-1 text-xs text-white/40">{index + 3} mins ago</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <button
        onClick={onImmediate}
        className="mt-6 w-full rounded-full bg-red-500 px-5 py-4 font-semibold shadow-xl shadow-red-500/20"
      >
        Immediate Assistance
      </button>
        </>
      )}
    </section>
  );
}

function PaymentPendingCare({
  booking,
  recipient,
  onCompletePayment
}: {
  booking: CareBooking;
  recipient: Recipient;
  onCompletePayment: () => void;
}) {
  return (
    <section className="rounded-[2rem] bg-white p-5 text-[#06130f]">
      <p className="text-sm font-semibold text-amber-700">Payment pending</p>
      <h2 className="mt-2 text-2xl font-semibold">Complete payment to start care</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        Your request for {recipient.shortName} is saved. Caregiver dispatch, live tracking,
        OTP, and family updates will start after payment is verified.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-2xl bg-slate-100 p-3">
          <p className="text-xs text-slate-500">Service</p>
          <p className="mt-1 font-semibold">{cleanServiceName(booking.serviceType)}</p>
        </div>
        <div className="rounded-2xl bg-slate-100 p-3">
          <p className="text-xs text-slate-500">Amount</p>
          <p className="mt-1 font-semibold">{booking.payment.estimatedTotal}</p>
        </div>
      </div>
      <button
        onClick={onCompletePayment}
        className="mt-5 w-full rounded-full bg-[#06130f] px-5 py-4 font-semibold text-white"
      >
        Complete payment
      </button>
      <button
        onClick={() =>
          window.open(
            "https://wa.me/919916960524?text=I%20need%20help%20completing%20my%20LDERLY%20payment",
            "_blank"
          )
        }
        className="mt-3 w-full rounded-full bg-slate-100 px-5 py-4 font-semibold"
      >
        Contact LDERLY
      </button>
    </section>
  );
}

function PaymentTermsModal({
  booking,
  onCancel,
  onAgree
}: {
  booking: CareBooking;
  onCancel: () => void;
  onAgree: () => void;
}) {
  const [accepted, setAccepted] = useState(false);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end bg-black/65 px-4 pb-4 backdrop-blur-sm sm:items-center sm:justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-terms-title"
    >
      <motion.section
        className="w-full max-w-md rounded-[2rem] bg-white p-5 text-[#06130f] shadow-2xl"
        initial={{ y: 32, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 32, opacity: 0 }}
      >
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700">
            <ShieldCheck size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Payment agreement
            </p>
            <h2 id="payment-terms-title" className="mt-1 text-2xl font-semibold">
              Review before payment
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              You are paying {booking.payment.estimatedTotal} for {cleanServiceName(booking.serviceType)}.
              Care dispatch starts only after payment is verified.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3 text-sm text-slate-600">
          {[
            "Caregiver assignment, ETA, and visit tracking start after successful payment.",
            "Cancellation and refund handling follows the LDERLY refund policy and depends on dispatch status.",
            "Service starts only after customer OTP verification at the care location.",
            "Emergency assistance coordinates support but does not replace hospital or ambulance emergency services.",
            "Visit proof, caregiver notes, and payment records may be used for service verification and support."
          ].map((item) => (
            <div key={item} className="flex gap-3 rounded-2xl bg-slate-50 p-3">
              <Check className="mt-0.5 shrink-0 text-emerald-600" size={16} />
              <p>{item}</p>
            </div>
          ))}
        </div>

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            className="mt-1 h-5 w-5 rounded border-slate-300 accent-[#06130f]"
          />
          <span>
            I agree to the{" "}
            <Link href="/legal/terms" className="font-semibold text-[#06130f] underline">
              Terms
            </Link>
            ,{" "}
            <Link href="/legal/refunds" className="font-semibold text-[#06130f] underline">
              Refund Policy
            </Link>
            , and payment authorization for this care request.
          </span>
        </label>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={onCancel}
            className="rounded-full bg-slate-100 px-4 py-4 font-semibold text-slate-700"
          >
            Not now
          </button>
          <button
            onClick={onAgree}
            disabled={!accepted}
            className="rounded-full bg-[#06130f] px-4 py-4 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Agree & pay
          </button>
        </div>
      </motion.section>
    </motion.div>
  );
}

function LiveEtaCard({
  eta,
  currentStep,
  nextStep,
  activeIndex,
  liveTrackingState,
  liveTrackingCopy,
  freshnessLabel
}: {
  eta: number;
  currentStep: string;
  nextStep: string;
  activeIndex: number;
  liveTrackingState: "arrived" | "arriving_soon" | "live" | "waiting";
  liveTrackingCopy: string;
  freshnessLabel: string;
}) {
  const isArrivingSoon = liveTrackingState === "arriving_soon";
  const isLive = liveTrackingState === "live" || isArrivingSoon;

  return (
    <section
      className={`mt-5 rounded-[1.5rem] border p-4 transition-colors ${
        isArrivingSoon
          ? "border-amber-200/30 bg-amber-200/15"
          : "border-emerald-200/15 bg-emerald-200/10"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-100">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isLive ? "animate-ping bg-emerald-300" : "bg-white/40"
              }`}
            />
            {isArrivingSoon ? "Arriving soon" : "Live ETA"}
          </p>
          <h3 className="mt-1 text-3xl font-semibold">
            {liveTrackingState === "arrived" ? "Arrived" : `${eta || 8} mins`}
          </h3>
          <p className="mt-1 text-sm text-white/60">{liveTrackingCopy}</p>
          <p className="mt-1 text-xs text-white/45">{freshnessLabel}</p>
        </div>
        <div
          className={`relative h-14 w-14 rounded-full ${
            isArrivingSoon ? "bg-amber-300/15" : "bg-emerald-300/15"
          }`}
        >
          <span
            className={`absolute inset-2 animate-ping rounded-full ${
              isArrivingSoon ? "bg-amber-300/25" : "bg-emerald-300/20"
            }`}
          />
          <span
            className={`absolute inset-5 rounded-full ${
              isArrivingSoon ? "bg-amber-200" : "bg-emerald-200"
            }`}
          />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-white/10 p-3">
          <p className="text-xs text-white/45">Now</p>
          <p className="mt-1 font-semibold">{currentStep}</p>
        </div>
        <div className="rounded-2xl bg-white/10 p-3">
          <p className="text-xs text-white/45">Next</p>
          <p className="mt-1 font-semibold">{nextStep}</p>
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(16, ((activeIndex + 1) / journeySteps.length) * 100)}%` }}
          className="h-full rounded-full bg-emerald-300"
        />
      </div>
    </section>
  );
}

function CustomerCareFunnel({
  booking,
  status
}: {
  booking: CareBooking | null;
  status: CareJourney["status"];
}) {
  const paymentReleased =
    booking?.status === "payment_settled" ||
    booking?.completion?.paymentReleaseStatus === "released";
  const steps = [
    {
      label: "Request sent",
      detail: "We are finding the right caregiver",
      done: Boolean(booking && booking.status !== "none"),
      active: status === "requested"
    },
    {
      label: "Caregiver confirmed",
      detail: booking?.caretakerName || "Our care team is coordinating",
      done: ["accepted", "en_route", "arrived", "in_progress", "completed"].includes(status),
      active: status === "assigned"
    },
    {
      label: "Track arrival",
      detail: `${booking?.tracking?.etaMinutes ?? 0} min ETA`,
      done: ["arrived", "in_progress", "completed"].includes(status),
      active: status === "accepted" || status === "en_route"
    },
    {
      label: "Share OTP",
      detail: booking?.status === "arrived" ? "OTP visible below" : "Shown only after arrival",
      done: ["in_progress", "completed"].includes(status),
      active: status === "arrived"
    },
    {
      label: "Visit complete",
      detail:
        booking?.completion?.paymentReleaseStatus === "awaiting_customer"
          ? "Please confirm the visit"
          : "Care summary will be ready",
      done: paymentReleased,
      active:
        status === "in_progress" ||
        (booking?.status === "completed" &&
          booking.completion?.paymentReleaseStatus === "awaiting_customer")
    }
  ];

  return (
    <section className="mt-5 rounded-[1.5rem] bg-white/10 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-emerald-100">Care progress</p>
          <h3 className="mt-1 text-2xl font-semibold">What is happening now</h3>
          <p className="mt-2 text-sm leading-6 text-white/55">
            We keep this updated as your caregiver is assigned, arrives, starts care, and completes the visit.
          </p>
        </div>
        <Badge variant="trust">Live</Badge>
      </div>
      <div className="mt-4 space-y-2">
        {steps.map((step) => (
          <div key={step.label} className="flex items-center gap-3 rounded-2xl bg-white/10 p-3">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                step.done
                  ? "bg-emerald-300 text-[#06130f]"
                  : step.active
                    ? "bg-amber-300 text-[#06130f]"
                    : "bg-white/10 text-white/40"
              }`}
            >
              {step.done ? <Check className="h-4 w-4" /> : step.active ? "!" : ""}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white/85">{step.label}</p>
              <p className="mt-0.5 text-xs text-white/45">{step.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProfilePanel({
  profile,
  recipient,
  details,
  reports,
  serviceExperience,
  onSelectRecipient,
  onEditDetails,
  onInviteFamily,
  onBook,
  onTrack,
  onSignOut
}: {
  profile: CareProfile | null;
  recipient: Recipient;
  details: RecipientDetails;
  reports: VisitReport[];
  serviceExperience: ReturnType<typeof serviceExperienceFor>;
  onSelectRecipient: () => void;
  onEditDetails: () => void;
  onInviteFamily: () => void;
  onBook: () => void;
  onTrack: () => void;
  onSignOut: () => void;
}) {
  const [profileActionMessage, setProfileActionMessage] = useState("");
  const runProfileAction = (label: string) => {
    trackProductEvent("profile_action_clicked", {
      label,
      recipient: recipient.shortName
    });

    if (["Family members", "Family access"].includes(label)) {
      onInviteFamily();
      setProfileActionMessage("Family access form opened. Add the person who should receive care updates.");
      return;
    }

    if (
      [
        "Care preference",
        "Medical readiness",
        "Medication list",
        "Preferred language",
        "Care address"
      ].includes(label)
    ) {
      onEditDetails();
      setProfileActionMessage("Care details reopened so the profile can be updated.");
      return;
    }

    if (label === "Recurring care" || label === "Payment methods") {
      onBook();
      setProfileActionMessage(
        label === "Recurring care"
          ? "Booking opened. Choose Recurring Care in duration to set up a plan."
          : "Booking opened. Payment is managed during booking review."
      );
      return;
    }

    if (label === "Trusted caregivers" || label === "Caregiver verification") {
      onTrack();
      setProfileActionMessage("Care tracking opened so caregiver trust details can be reviewed.");
      return;
    }

    if (
      label === "Refund support" ||
      label === "Help center" ||
      label === "WhatsApp updates" ||
      label === "Notifications"
    ) {
      window.open("https://wa.me/919916960524?text=I%20need%20LDERLY%20support", "_blank");
      setProfileActionMessage("Support opened on WhatsApp so ops can respond quickly.");
      return;
    }

    if (label === "Voice summaries") {
      onTrack();
      setProfileActionMessage("Care tracking opened. Voice summaries appear with visit updates.");
      return;
    }

    if (label === "Privacy and security") {
      window.open("/legal/privacy", "_blank");
      return;
    }

    window.open("https://wa.me/919916960524?text=I%20need%20help%20with%20my%20LDERLY%20profile", "_blank");
    setProfileActionMessage(`${label} support opened on WhatsApp.`);
  };
  const profileSections: Array<{
    title: string;
    rows: Array<{ icon: LucideIcon; label: string; value: string; action?: string }>;
  }> = [
    {
      title: "Care circle",
      rows: [
        {
          icon: Users,
          label: "Family members",
          value: "Mother, Father, Self / Others",
          action: "Manage"
        },
        {
          icon: Star,
          label: "Trusted caregivers",
          value: reports.length ? "Familiar caregivers appear after visits" : "Shown after first assigned visit",
          action: "View"
        },
        {
          icon: Repeat2,
          label: "Recurring care",
          value: "No recurring plan yet",
          action: "Set up"
        }
      ]
    },
    {
      title: "Care preferences",
      rows: [
        {
          icon: Sparkles,
          label: "Care preference",
          value: profile?.medicalNotes ?? serviceExperience.profilePreference,
          action: "Edit"
        },
        {
          icon: HeartPulse,
          label: "Medical readiness",
          value: `${details.allergies || profile?.allergies || "Allergies not set"} - ${details.mobility || "mobility pending"}`,
          action: "Review"
        },
        {
          icon: Pill,
          label: "Medication list",
          value:
            profile?.careRecipients?.[recipient.name]?.medicationList?.join(", ") ||
            "Add medicines and dosage timings",
          action: "Add"
        },
        {
          icon: Languages,
          label: "Preferred language",
          value: details.language || "Not set",
          action: "Edit"
        },
        {
          icon: MapPinned,
          label: "Care address",
          value: details.address || "Add address",
          action: "Edit"
        }
      ]
    },
    {
      title: "Payments and updates",
      rows: [
        {
          icon: WalletCards,
          label: "Payment methods",
          value: "UPI and cards",
          action: "Manage"
        },
        {
          icon: Users,
          label: "Family access",
          value: `${Object.keys(profile?.familyMembers || {}).length || 1} family member can monitor care`,
          action: "Invite"
        },
        {
          icon: MessageCircle,
          label: "WhatsApp updates",
          value: "Session updates enabled",
          action: "On"
        },
        {
          icon: Mic,
          label: "Voice summaries",
          value: "Caregiver voice notes enabled",
          action: "On"
        },
        {
          icon: Bell,
          label: "Notifications",
          value: "Family alerts enabled",
          action: "Manage"
        }
      ]
    },
    {
      title: "Support and safety",
      rows: [
        {
          icon: CircleHelp,
          label: "Help center",
          value: "Create ticket, complaint, or refund request",
          action: "Ready"
        },
        {
          icon: WalletCards,
          label: "Refund support",
          value: "Refund requests are reviewed by ops",
          action: "Request"
        },
        {
          icon: ShieldCheck,
          label: "Caregiver verification",
          value: "ID checked, trained, background verified",
          action: "Learn"
        },
        {
          icon: LockKeyhole,
          label: "Privacy and security",
          value: "Manage account and family access",
          action: "Manage"
        }
      ]
    }
  ];

  return (
    <section>
      <div className="rounded-[2rem] bg-white p-5 text-[#06130f]">
        <div className="flex items-start gap-4">
          <Avatar recipient={recipient} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-emerald-700">Care profile</p>
            <h2 className="mt-2 text-2xl font-semibold">
              {details.fullName || profile?.elderName || `${recipient.displayName} Profile`}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Age {details.age || "not set"} - {profile?.subscriptionPlan || "Premium"} care
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                Verified care profile
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {details.mobility || "Mobility not set"}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={onSelectRecipient}
            className="rounded-full bg-[#06130f] px-4 py-3 text-sm font-semibold text-white"
          >
            Change recipient
          </button>
          <button
            onClick={onEditDetails}
            className="rounded-full bg-slate-100 px-4 py-3 text-sm font-semibold"
          >
            Edit details
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <ProfileStat label="Plan" value={profile?.subscriptionPlan || "Premium"} />
        <ProfileStat label="Care score" value={reports.length ? "Ready" : "After visit"} />
        <ProfileStat label="Trusted visits" value={String(reports.length)} />
      </div>

      <FamilyPermissionsPanel profile={profile} onInviteFamily={onInviteFamily} />

      <section className="mt-6">
        <h3 className="mb-3 text-lg font-semibold">Care packages</h3>
        <div className="space-y-3">
          {Object.values(profile?.carePackages || {}).slice(0, 3).map((carePackage) => (
            <div key={carePackage.id} className="rounded-3xl bg-white/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{carePackage.name}</p>
                  <p className="mt-1 text-sm text-white/50">{carePackage.recommendedFor}</p>
                </div>
                <span className="rounded-full bg-emerald-300 px-3 py-1 text-xs font-semibold text-[#06130f]">
                  {carePackage.priceLabel}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {carePackage.included.map((item) => (
                  <span key={item} className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/60">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-6 space-y-6">
        {profileSections.map((section) => (
          <section key={section.title}>
            <h3 className="mb-3 text-lg font-semibold">{section.title}</h3>
            <div className="space-y-3">
              {section.rows.map((row) => (
                <ProfileRow key={row.label} row={row} onAction={() => runProfileAction(row.label)} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {profileActionMessage && (
        <p className="mt-4 rounded-2xl bg-white/10 px-4 py-3 text-sm text-white/70">
          {profileActionMessage}
        </p>
      )}

      <button
        onClick={onSignOut}
        className="mt-6 w-full rounded-full bg-white/10 px-5 py-4 font-semibold"
      >
        Sign out
      </button>
    </section>
  );
}

function FamilyPermissionsPanel({
  profile,
  onInviteFamily
}: {
  profile: CareProfile | null;
  onInviteFamily: () => void;
}) {
  const members = Object.values(profile?.familyMembers || {});
  const visibleMembers = members.length
    ? members
    : [
        {
          id: "primary-family",
          name: "Primary family member",
          relationship: "Family",
          phone: "Not shared",
          permissions: ["monitor", "alerts"] as Array<"monitor" | "alerts">,
          nriMode: true,
          updatedAt: 0
        }
      ];

  return (
    <section className="mt-6 rounded-[1.5rem] bg-white/10 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-emerald-100">Family permissions</p>
          <h3 className="mt-1 text-2xl font-semibold">Shared care visibility</h3>
          <p className="mt-2 text-sm leading-6 text-white/55">
            Invite siblings or NRI family members with monitor-only, alerts, approval, or payment permissions.
          </p>
        </div>
        <button
          onClick={onInviteFamily}
          className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#06130f]"
        >
          Invite
        </button>
      </div>
      <div className="mt-4 space-y-2">
        {visibleMembers.slice(0, 3).map((member) => (
          <div key={member.id} className="rounded-2xl bg-white/10 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{member.name}</p>
                <p className="mt-1 text-xs text-white/45">
                  {member.relationship} - {member.nriMode ? "NRI digest on" : "Local updates"}
                </p>
              </div>
              <span className="rounded-full bg-emerald-300/15 px-3 py-1 text-xs font-semibold text-emerald-100">
                {member.permissions.join(", ")}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProfileStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] bg-white/10 p-3">
      <p className="text-xs text-white/45">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function ProfileRow({
  row,
  onAction
}: {
  row: { icon: LucideIcon; label: string; value: string; action?: string };
  onAction: () => void;
}) {
  const Icon = row.icon;

  return (
    <button
      onClick={onAction}
      className="flex w-full items-center gap-4 rounded-3xl bg-white/10 p-4 text-left transition hover:bg-white/15"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10">
        <Icon className="h-5 w-5 text-emerald-200" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{row.label}</p>
        <p className="mt-1 text-sm text-white/50">{row.value}</p>
      </div>
      {row.action && (
        <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
          {row.action}
        </span>
      )}
    </button>
  );
}
