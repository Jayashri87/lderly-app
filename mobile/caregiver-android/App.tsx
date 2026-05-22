import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { CaregiverApi, clearSession, readSession } from "./src/api";
import { CaregiverLocation } from "./src/backgroundLocation";
import { ActiveAssignment, AssignmentFeed, CaregiverSession } from "./src/types";

const demoBookingId = "replace-with-active-booking-id";

const statusCopy: Record<string, { label: string; detail: string; next: string }> = {
  searching: {
    label: "New request nearby",
    detail: "Review the care request and accept if you can reach on time.",
    next: "Accept request"
  },
  assigned: {
    label: "Care request assigned",
    detail: "Accept the request to confirm with the family.",
    next: "Accept request"
  },
  accepted: {
    label: "Accepted",
    detail: "Start navigation and share your live movement.",
    next: "Start navigation"
  },
  en_route: {
    label: "On the way",
    detail: "Live location is active. Mark arrived when you reach.",
    next: "Mark arrived"
  },
  arrived: {
    label: "Arrived",
    detail: "Ask the customer for OTP to begin the service.",
    next: "Start with OTP"
  },
  in_progress: {
    label: "Visit in progress",
    detail: "Complete the care tasks and mark done when finished.",
    next: "Complete visit"
  },
  completed: {
    label: "Visit completed",
    detail: "Waiting for family confirmation and ops closure.",
    next: "Completed"
  }
};

const compactId = (value: string) =>
  value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;

const minutesLeft = (expiresAt?: number, serverTime?: number) => {
  if (!expiresAt || !serverTime) {
    return "";
  }

  const minutes = Math.max(0, Math.ceil((expiresAt - serverTime) / 60000));
  return `${minutes} min left`;
};

export default function App() {
  const [session, setSession] = useState<CaregiverSession | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [bookingId, setBookingId] = useState(demoBookingId);
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("Ready.");
  const [busy, setBusy] = useState(false);
  const [feed, setFeed] = useState<AssignmentFeed | null>(null);
  const [online, setOnline] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);
  const [clock, setClock] = useState(0);

  const activeBooking = useMemo(() => {
    const active = feed?.bookings?.[0] || null;
    return active;
  }, [feed]);

  const activeOffer = useMemo(
    () => feed?.offers?.find((offer) => offer.status === "sent") || null,
    [feed]
  );

  const currentBookingId = activeBooking?.id || activeOffer?.bookingId || bookingId;
  const currentState = activeBooking?.status || (activeOffer ? "searching" : "idle");
  const offerExpired = Boolean(activeOffer?.expiresAt && activeOffer.expiresAt <= clock);
  const stateCopy = statusCopy[currentState] || {
    label: online ? "Online" : "Offline",
    detail: online ? "Waiting for nearby care requests." : "Go online to receive care requests.",
    next: online ? "Refresh requests" : "Go online"
  };

  const refreshFeed = useCallback(async (nextSession: CaregiverSession | null, loud = true) => {
    if (!nextSession) {
      return;
    }

    try {
      if (loud) {
        setMessage("Refreshing assignments...");
      }
      const nextFeed = await CaregiverApi.assignments(nextSession);
      setFeed(nextFeed);
      setOnline(Boolean(nextFeed.caretaker.available));
      setLastRefresh(Date.now());
      if (loud) {
        setMessage("Assignments updated.");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unable to load assignments";
      if (loud) {
        setMessage(errorMessage);
      }
    }
  }, []);

  useEffect(() => {
    readSession()
      .then((storedSession) => {
        setSession(storedSession);
        if (storedSession) {
          refreshFeed(storedSession, false);
        }
      })
      .catch(() => undefined);
  }, [refreshFeed]);

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!session) {
      return undefined;
    }

    const timer = setInterval(() => {
      refreshFeed(session, false);
    }, 15000);

    return () => clearInterval(timer);
  }, [refreshFeed, session]);

  const run = async (label: string, action: () => Promise<unknown>, refresh = true) => {
    if (busy) {
      return;
    }

    try {
      setBusy(true);
      setMessage(`${label}...`);
      await action();
      setMessage(`${label} done.`);
      if (refresh && session) {
        await refreshFeed(session, false);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Action failed";
      setMessage(errorMessage);
      Alert.alert("LDERLY Partner", errorMessage);
    } finally {
      setBusy(false);
    }
  };

  const toggleOnline = async (nextOnline: boolean) => {
    if (!session) {
      return;
    }

    setOnline(nextOnline);
    await run(nextOnline ? "Going online" : "Going offline", () =>
      CaregiverApi.updateAvailability(session, nextOnline, nextOnline ? "available" : "offline")
    );
  };

  const primaryAction = () => {
    if (!session) {
      return;
    }

    if (!online && currentState === "idle") {
      run("Going online", () => CaregiverApi.updateAvailability(session, true, "available"));
      return;
    }

    if (currentState === "searching" || currentState === "assigned") {
      if (offerExpired) {
        run("Refreshing request", () => refreshFeed(session));
        return;
      }
      run("Accept request", () => CaregiverApi.acceptBooking(session, currentBookingId));
      return;
    }

    if (currentState === "accepted") {
      run("Start navigation", async () => {
        await CaregiverLocation.start(currentBookingId);
        await CaregiverApi.updateStatus(session, currentBookingId, "en_route");
      });
      return;
    }

    if (currentState === "en_route") {
      run("Mark arrived", () => CaregiverApi.updateStatus(session, currentBookingId, "arrived"));
      return;
    }

    if (currentState === "arrived") {
      if (!otp.trim()) {
        Alert.alert("OTP required", "Enter the customer OTP to start the service.");
        return;
      }
      run("Start service", () => CaregiverApi.startService(session, currentBookingId, otp));
      return;
    }

    if (currentState === "in_progress") {
      run("Complete visit", async () => {
        await CaregiverLocation.stop();
        await CaregiverApi.updateStatus(session, currentBookingId, "completed");
      });
      return;
    }

    refreshFeed(session);
  };

  const rejectOffer = () => {
    if (!session || !activeOffer) {
      return;
    }

    Alert.alert("Reject care request?", "This request will move to another caregiver or ops review.", [
      {
        text: "Keep request",
        style: "cancel"
      },
      {
        text: "Reject",
        style: "destructive",
        onPress: () =>
          run("Reject request", () =>
            CaregiverApi.rejectBooking(session, activeOffer.bookingId, "Not available for this request")
          )
      }
    ]);
  };

  if (!session) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loginShell}>
          <Text style={styles.brand}>LDERLY PARTNER</Text>
          <Text style={styles.loginTitle}>Drive the care day</Text>
          <Text style={styles.loginSubtitle}>
            Sign in to receive nearby requests, navigate to families, start visits with OTP,
            and complete jobs.
          </Text>
          <View style={styles.panel}>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="Caretaker username"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              style={styles.input}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="#64748b"
              secureTextEntry
              style={styles.input}
            />
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() =>
                run(
                  "Signing in",
                  async () => {
                    const nextSession = await CaregiverApi.login(username, password);
                    setSession(nextSession);
                    await refreshFeed(nextSession, false);
                  },
                  false
                )
              }
            >
              <Text style={styles.primaryButtonText}>Sign in</Text>
            </TouchableOpacity>
          </View>
          <StatusMessage busy={busy} message={message} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.brand}>LDERLY PARTNER</Text>
            <Text style={styles.headerTitle}>
              {feed?.caretaker.name || session.username || "Caregiver"}
            </Text>
          </View>
          <View style={styles.onlineControl}>
            <Text style={styles.onlineText}>{online ? "Online" : "Offline"}</Text>
            <Switch
              value={online}
              onValueChange={toggleOnline}
              trackColor={{ false: "#334155", true: "#34d399" }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        <View style={styles.mapPanel}>
          <View style={styles.routeLine}>
            <View style={styles.routeDot} />
            <View style={styles.routePath} />
            <View style={[styles.routeDot, styles.routeDotEnd]} />
          </View>
          <View style={styles.mapTextBlock}>
            <Text style={styles.mapTitle}>{stateCopy.label}</Text>
            <Text style={styles.mapSubtitle}>{stateCopy.detail}</Text>
          </View>
          <View style={styles.etaPill}>
            <Text style={styles.etaValue}>
              {activeBooking?.tracking?.etaMinutes || activeOffer?.etaMinutes || "--"}
            </Text>
            <Text style={styles.etaLabel}>min ETA</Text>
          </View>
        </View>

        <AssignmentCard
          booking={activeBooking}
          offer={activeOffer}
          serverTime={clock}
          fallbackBookingId={bookingId}
          onBookingIdChange={setBookingId}
        />

        <FunnelCard state={currentState} offerExpired={offerExpired} hasOtp={Boolean(otp.trim())} />

        {currentState === "arrived" ? (
          <View style={styles.panel}>
            <Text style={styles.sectionLabel}>Customer OTP</Text>
            <TextInput
              value={otp}
              onChangeText={setOtp}
              placeholder="Enter 6-digit OTP"
              placeholderTextColor="#64748b"
              keyboardType="number-pad"
              style={styles.input}
            />
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.primaryButton, busy ? styles.disabledButton : null]}
          onPress={primaryAction}
          disabled={busy}
        >
          <Text style={styles.primaryButtonText}>{stateCopy.next}</Text>
        </TouchableOpacity>

        <View style={styles.actionGrid}>
          <SmallAction label="Refresh" onPress={() => refreshFeed(session)} />
          {activeOffer ? <SmallAction label="Reject" onPress={rejectOffer} /> : null}
          <SmallAction
            label="Panic SOS"
            danger
            onPress={() => Alert.alert("Panic SOS", "Emergency escalation is ready for ops.")}
          />
          <SmallAction
            label="Sign out"
            onPress={() =>
              run(
                "Signing out",
                async () => {
                  await CaregiverLocation.stop();
                  await clearSession();
                  setSession(null);
                  setFeed(null);
                },
                false
              )
            }
          />
        </View>

        <Progress booking={activeBooking} />
        <TrustStrip feed={feed} />
        <StatusMessage
          busy={busy}
          message={
            lastRefresh
              ? `${message} Last refresh ${new Date(lastRefresh).toLocaleTimeString()}`
              : message
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function AssignmentCard({
  booking,
  offer,
  serverTime,
  fallbackBookingId,
  onBookingIdChange
}: {
  booking: ActiveAssignment | null;
  offer: AssignmentFeed["offers"][number] | null;
  serverTime?: number;
  fallbackBookingId: string;
  onBookingIdChange: (value: string) => void;
}) {
  const service = booking?.serviceType || offer?.serviceType || "Care request";
  const customer = booking?.customerName || offer?.customerName || "Family";
  const destination =
    booking?.tracking?.destinationLabel || offer?.destinationLabel || "Care location";
  const distance = booking?.tracking?.distanceKm || offer?.distanceKm;
  const expiry = minutesLeft(offer?.expiresAt, serverTime);

  if (!booking && !offer) {
    return (
      <View style={styles.panel}>
        <Text style={styles.sectionLabel}>No active request</Text>
        <Text style={styles.emptyTitle}>Stay online for nearby jobs</Text>
        <Text style={styles.emptyText}>
          When a family books care in your area, the request will appear here with ETA,
          distance, service, and one accept action.
        </Text>
        <TextInput
          value={fallbackBookingId}
          onChangeText={onBookingIdChange}
          placeholder="Fallback booking ID"
          placeholderTextColor="#64748b"
          autoCapitalize="none"
          style={styles.input}
        />
      </View>
    );
  }

  return (
    <View style={styles.jobCard}>
      <View style={styles.jobHeader}>
        <View>
          <Text style={styles.jobBadge}>{offer ? "Incoming" : booking?.status}</Text>
          <Text style={styles.jobTitle}>{service}</Text>
        </View>
        <Text style={styles.jobPrice}>Care</Text>
      </View>
      <View style={styles.divider} />
      <InfoRow label="Family" value={customer} />
      <InfoRow label="Location" value={destination} />
      <InfoRow label="Booking" value={compactId(booking?.id || offer?.bookingId || "")} />
      <View style={styles.metricRow}>
        <Metric label="Distance" value={distance ? `${distance} km` : "--"} />
        <Metric label="ETA" value={`${booking?.tracking?.etaMinutes || offer?.etaMinutes || "--"} min`} />
        <Metric label="Offer" value={expiry || "Active"} />
      </View>
    </View>
  );
}

function Progress({ booking }: { booking: ActiveAssignment | null }) {
  const steps = ["accepted", "en_route", "arrived", "in_progress", "completed"];
  const activeIndex = Math.max(0, steps.indexOf(booking?.status || "accepted"));

  return (
    <View style={styles.panel}>
      <Text style={styles.sectionLabel}>Visit progress</Text>
      {steps.map((step, index) => (
        <View key={step} style={styles.progressRow}>
          <View style={[styles.progressDot, index <= activeIndex ? styles.progressDotActive : null]} />
          <Text style={[styles.progressText, index <= activeIndex ? styles.progressTextActive : null]}>
            {statusCopy[step]?.label || step}
          </Text>
        </View>
      ))}
    </View>
  );
}

function FunnelCard({
  state,
  offerExpired,
  hasOtp
}: {
  state: string;
  offerExpired: boolean;
  hasOtp: boolean;
}) {
  const steps = [
    {
      key: "offer",
      label: "Accept request",
      done: ["accepted", "en_route", "arrived", "in_progress", "completed"].includes(state),
      active: ["searching", "assigned"].includes(state)
    },
    {
      key: "navigation",
      label: "Share live location",
      done: ["en_route", "arrived", "in_progress", "completed"].includes(state),
      active: state === "accepted"
    },
    {
      key: "arrival",
      label: "Reach location",
      done: ["arrived", "in_progress", "completed"].includes(state),
      active: state === "en_route"
    },
    {
      key: "otp",
      label: "Verify customer OTP",
      done: ["in_progress", "completed"].includes(state),
      active: state === "arrived"
    },
    {
      key: "complete",
      label: "Complete visit",
      done: state === "completed",
      active: state === "in_progress"
    }
  ];

  return (
    <View style={styles.panel}>
      <Text style={styles.sectionLabel}>Care funnel</Text>
      {offerExpired ? <Text style={styles.warningText}>This request is no longer active. Refresh for the latest request.</Text> : null}
      {state === "arrived" && !hasOtp ? (
        <Text style={styles.warningText}>OTP is required before service can start.</Text>
      ) : null}
      {steps.map((step) => (
        <View key={step.key} style={styles.funnelRow}>
          <View
            style={[
              styles.funnelDot,
              step.done ? styles.funnelDotDone : null,
              step.active ? styles.funnelDotActive : null
            ]}
          >
            <Text style={styles.funnelDotText}>{step.done ? "✓" : step.active ? "!" : ""}</Text>
          </View>
          <Text
            style={[
              styles.funnelText,
              step.done || step.active ? styles.funnelTextActive : null
            ]}
          >
            {step.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function TrustStrip({ feed }: { feed: AssignmentFeed | null }) {
  return (
    <View style={styles.trustStrip}>
      <Metric label="Rating" value={feed?.caretaker.rating ? `${feed.caretaker.rating}` : "--"} dark />
      <Metric
        label="Punctual"
        value={feed?.caretaker.punctualityScore ? `${feed.caretaker.punctualityScore}%` : "--"}
        dark
      />
      <Metric
        label="Repeats"
        value={feed?.caretaker.repeatVisits ? `${feed.caretaker.repeatVisits}` : "--"}
        dark
      />
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function Metric({
  label,
  value,
  dark
}: {
  label: string;
  value: string;
  dark?: boolean;
}) {
  return (
    <View style={[styles.metric, dark ? styles.metricDark : null]}>
      <Text style={[styles.metricLabel, dark ? styles.metricLabelDark : null]}>{label}</Text>
      <Text style={[styles.metricValue, dark ? styles.metricValueDark : null]}>{value}</Text>
    </View>
  );
}

function SmallAction({
  label,
  onPress,
  danger
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity style={[styles.smallAction, danger ? styles.smallActionDanger : null]} onPress={onPress}>
      <Text style={[styles.smallActionText, danger ? styles.smallActionDangerText : null]}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatusMessage({ busy, message }: { busy: boolean; message: string }) {
  return (
    <View style={styles.statusMessage}>
      {busy ? <ActivityIndicator color="#34d399" /> : <View style={styles.livePulse} />}
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#050807"
  },
  content: {
    gap: 16,
    padding: 18,
    paddingBottom: 44
  },
  loginShell: {
    flex: 1,
    justifyContent: "center",
    gap: 18,
    padding: 22
  },
  brand: {
    color: "#8ff5c7",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 3,
    textTransform: "uppercase"
  },
  loginTitle: {
    color: "#ffffff",
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 46
  },
  loginSubtitle: {
    color: "#b6c4bd",
    fontSize: 16,
    lineHeight: 24
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 4
  },
  onlineControl: {
    alignItems: "center",
    backgroundColor: "#101917",
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  onlineText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800"
  },
  mapPanel: {
    minHeight: 220,
    overflow: "hidden",
    borderRadius: 34,
    backgroundColor: "#101917",
    padding: 20
  },
  routeLine: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.95
  },
  routeDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#34d399"
  },
  routeDotEnd: {
    backgroundColor: "#ffffff"
  },
  routePath: {
    width: 6,
    height: 112,
    borderRadius: 999,
    backgroundColor: "#34d399",
    marginVertical: 8
  },
  mapTextBlock: {
    maxWidth: "68%"
  },
  mapTitle: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 35
  },
  mapSubtitle: {
    color: "#b6c4bd",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8
  },
  etaPill: {
    position: "absolute",
    bottom: 18,
    right: 18,
    alignItems: "center",
    borderRadius: 24,
    backgroundColor: "#ffffff",
    paddingHorizontal: 18,
    paddingVertical: 14
  },
  etaValue: {
    color: "#07110f",
    fontSize: 30,
    fontWeight: "900"
  },
  etaLabel: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "800"
  },
  panel: {
    gap: 12,
    borderRadius: 28,
    backgroundColor: "#ffffff",
    padding: 18
  },
  jobCard: {
    gap: 14,
    borderRadius: 30,
    backgroundColor: "#ffffff",
    padding: 18
  },
  jobHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  jobBadge: {
    alignSelf: "flex-start",
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#dcfce7",
    color: "#166534",
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 5,
    textTransform: "uppercase"
  },
  jobTitle: {
    color: "#06130f",
    fontSize: 26,
    fontWeight: "900",
    lineHeight: 31,
    marginTop: 10
  },
  jobPrice: {
    color: "#06130f",
    fontSize: 16,
    fontWeight: "900"
  },
  divider: {
    height: 1,
    backgroundColor: "#e2e8f0"
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16
  },
  infoLabel: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: "700"
  },
  infoValue: {
    color: "#0f172a",
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "right"
  },
  metricRow: {
    flexDirection: "row",
    gap: 10
  },
  metric: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    padding: 12
  },
  metricDark: {
    backgroundColor: "#101917"
  },
  metricLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "800"
  },
  metricLabelDark: {
    color: "#8ba39a"
  },
  metricValue: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 4
  },
  metricValueDark: {
    color: "#ffffff"
  },
  sectionLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.5,
    textTransform: "uppercase"
  },
  emptyTitle: {
    color: "#06130f",
    fontSize: 24,
    fontWeight: "900"
  },
  emptyText: {
    color: "#475569",
    fontSize: 15,
    lineHeight: 22
  },
  input: {
    borderColor: "#dbeafe",
    borderRadius: 18,
    borderWidth: 1,
    color: "#0f172a",
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 13
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#34d399",
    borderRadius: 999,
    paddingVertical: 18
  },
  disabledButton: {
    opacity: 0.6
  },
  primaryButtonText: {
    color: "#052e22",
    fontSize: 18,
    fontWeight: "900"
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  smallAction: {
    flexGrow: 1,
    minWidth: "30%",
    alignItems: "center",
    borderColor: "rgba(255,255,255,.16)",
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 14
  },
  smallActionDanger: {
    backgroundColor: "#7f1d1d",
    borderColor: "#991b1b"
  },
  smallActionText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800"
  },
  smallActionDangerText: {
    color: "#fecaca"
  },
  progressRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingVertical: 5
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#cbd5e1"
  },
  progressDotActive: {
    backgroundColor: "#16a34a"
  },
  progressText: {
    color: "#94a3b8",
    fontSize: 15,
    fontWeight: "700"
  },
  progressTextActive: {
    color: "#0f172a"
  },
  funnelRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingVertical: 6
  },
  funnelDot: {
    alignItems: "center",
    justifyContent: "center",
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#e2e8f0"
  },
  funnelDotActive: {
    backgroundColor: "#facc15"
  },
  funnelDotDone: {
    backgroundColor: "#16a34a"
  },
  funnelDotText: {
    color: "#052e22",
    fontSize: 12,
    fontWeight: "900"
  },
  funnelText: {
    color: "#94a3b8",
    fontSize: 15,
    fontWeight: "800"
  },
  funnelTextActive: {
    color: "#0f172a"
  },
  warningText: {
    borderRadius: 16,
    backgroundColor: "#fef3c7",
    color: "#92400e",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  trustStrip: {
    flexDirection: "row",
    gap: 10
  },
  statusMessage: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 4
  },
  livePulse: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#34d399"
  },
  message: {
    color: "#b6c4bd",
    flex: 1,
    fontSize: 13,
    lineHeight: 19
  }
});
