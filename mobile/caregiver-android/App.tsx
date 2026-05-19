import { useEffect, useState } from "react";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { CaregiverApi, clearSession, readSession } from "./src/api";
import { CaregiverLocation } from "./src/backgroundLocation";
import { CaregiverSession } from "./src/types";

const demoBookingId = "replace-with-active-booking-id";

export default function App() {
  const [session, setSession] = useState<CaregiverSession | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [bookingId, setBookingId] = useState(demoBookingId);
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("Ready for caregiver operations.");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    readSession().then(setSession).catch(() => undefined);
  }, []);

  const run = async (label: string, action: () => Promise<unknown>) => {
    if (busy) {
      return;
    }

    try {
      setBusy(true);
      setMessage(`${label}...`);
      await action();
      setMessage(`${label} completed.`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Action failed";
      setMessage(errorMessage);
      Alert.alert("LDERLY", errorMessage);
    } finally {
      setBusy(false);
    }
  };

  if (!session) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="light-content" />
        <View style={styles.card}>
          <Text style={styles.kicker}>LDERLY Caregiver</Text>
          <Text style={styles.title}>Sign in to start care operations</Text>
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
              run("Signing in", async () => {
                const nextSession = await CaregiverApi.login(username, password);
                setSession(nextSession);
              })
            }
          >
            <Text style={styles.primaryButtonText}>Sign in</Text>
          </TouchableOpacity>
          <Text style={styles.message}>{message}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>LDERLY Partner</Text>
        <Text style={styles.title}>Care visit control</Text>
        <Text style={styles.subtitle}>
          Accept assignments, share live GPS, start with OTP, and complete care.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>Active booking ID</Text>
          <TextInput
            value={bookingId}
            onChangeText={setBookingId}
            placeholder="Booking ID"
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            style={styles.input}
          />
          <Text style={styles.label}>Customer OTP</Text>
          <TextInput
            value={otp}
            onChangeText={setOtp}
            placeholder="Enter OTP at arrival"
            placeholderTextColor="#64748b"
            keyboardType="number-pad"
            style={styles.input}
          />
        </View>

        <ActionButton
          label="Accept booking"
          onPress={() =>
            run("Accept booking", () => CaregiverApi.acceptBooking(session, bookingId))
          }
        />
        <ActionButton
          label="Start background GPS"
          onPress={() => run("Start background GPS", () => CaregiverLocation.start(bookingId))}
        />
        <ActionButton
          label="Mark en route"
          onPress={() =>
            run("Mark en route", () =>
              CaregiverApi.updateStatus(session, bookingId, "en_route")
            )
          }
        />
        <ActionButton
          label="Mark arrived"
          onPress={() =>
            run("Mark arrived", () =>
              CaregiverApi.updateStatus(session, bookingId, "arrived")
            )
          }
        />
        <ActionButton
          label="Start service with OTP"
          onPress={() =>
            run("Start service", () => CaregiverApi.startService(session, bookingId, otp))
          }
        />
        <ActionButton
          label="Complete job"
          onPress={() =>
            run("Complete job", () =>
              CaregiverApi.updateStatus(session, bookingId, "completed")
            )
          }
        />
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() =>
            run("Signing out", async () => {
              await CaregiverLocation.stop();
              await clearSession();
              setSession(null);
            })
          }
        >
          <Text style={styles.secondaryButtonText}>Sign out</Text>
        </TouchableOpacity>

        <Text style={styles.message}>{message}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionButton({
  label,
  onPress
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.primaryButton} onPress={onPress}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#07110f"
  },
  content: {
    gap: 14,
    padding: 20,
    paddingBottom: 42
  },
  card: {
    gap: 12,
    borderRadius: 28,
    backgroundColor: "#f8fafc",
    padding: 18
  },
  kicker: {
    color: "#6ee7b7",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 3,
    marginTop: 18,
    textTransform: "uppercase"
  },
  title: {
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "800",
    lineHeight: 40,
    marginTop: 8
  },
  subtitle: {
    color: "#cbd5e1",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12
  },
  label: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "700"
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
    paddingVertical: 16
  },
  primaryButtonText: {
    color: "#052e22",
    fontSize: 16,
    fontWeight: "800"
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "rgba(255,255,255,.18)",
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 16
  },
  secondaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700"
  },
  message: {
    color: "#cbd5e1",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8
  }
});

