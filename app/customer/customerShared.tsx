import {
  HeartPulse,
  Pill,
  Sparkles,
  UserRound
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CareBooking } from "../../services/bookingService";
import type { CareJourney } from "../../services/journeyService";
import type { CareProfile, CareRecipientProfile } from "../../services/profileService";
import type { VisitReport } from "../../services/reportService";

export type TabKey = "home" | "journey" | "profile";
export type BookingStep = "need" | "service" | "duration" | "time" | "location" | "review";

export type RazorpayCheckoutOptions = {
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

export type RazorpayPaymentResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export type RazorpayWindow = Window & {
  Razorpay?: new (options: RazorpayCheckoutOptions) => { open: () => void };
};

export type RazorpayCheckout = {
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

export type Recipient = {
  name: string;
  displayName: string;
  shortName: string;
  avatar: string;
  age: number;
  status: string;
  tag: string;
  gradient: string;
};

export type CareNeed = {
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

export type DurationOption = {
  label: string;
  price: string;
  note: string;
  recommended?: boolean;
};

export type TimeOption = {
  label: string;
  detail: string;
};

export type LocationOption = {
  label: string;
  detail: string;
};

export type AiReassuranceInsight = {
  id: string;
  headline: string;
  summary: string;
  emotionalMessage: string;
  nextAction: string;
  createdAt: number;
};

export type CaregiverTrustProfile = {
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

export type VisitProof = {
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

export type CareRiskSummary = {
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

export type RetentionSummary = {
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

export type RecipientDetails = {
  fullName: string;
  age: string;
  phone: string;
  address: string;
  healthNotes: string;
  allergies: string;
  mobility: string;
  language: string;
};

export const recipients: Recipient[] = [
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

export const careNeeds: CareNeed[] = [
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

export const durationOptions: DurationOption[] = [
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

export const timeOptions: TimeOption[] = [
  { label: "Now", detail: "Find the earliest available caregiver" },
  { label: "Today later", detail: "Choose this for a same-day visit" },
  { label: "Tomorrow", detail: "Plan care for tomorrow" },
  { label: "Pick date/time", detail: "Schedule a specific slot" },
  { label: "Recurring", detail: "Set up repeated care" }
];

export const journeySteps = [
  "Request Received",
  "Caregiver Confirmed",
  "On The Way",
  "Arrived",
  "Care Started",
  "Care Completed"
];

export const reassuranceFeed = [
  "Care request received.",
  "Caregiver assignment will appear here.",
  "Live updates will begin after the service starts."
];

export const serviceExperienceFor = (serviceType?: string) => {
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

export const cleanServiceName = (serviceType?: string) =>
  (serviceType || "Care")
    .split(" for ")[0]
    .trim();

export const loadRazorpayScript = () =>
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

export const careStatusFor = ({
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

export const subscriptionKey = "lderly-care-subscription-started";
export const recipientDetailsKey = "lderly-recipient-details-v2";

export const emptyRecipientDetails: RecipientDetails = {
  fullName: "",
  age: "",
  phone: "",
  address: "",
  healthNotes: "",
  allergies: "",
  mobility: "",
  language: ""
};

export const readStoredRecipientDetails = () => {
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

export const detailsFromProfile = (
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

export const toCareRecipientProfile = (
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

