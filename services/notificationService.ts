import { onValue, ref, update } from "firebase/database";
import { db } from "../firebase";
import { SessionUser } from "./authService";

export type CareNotification = {
  id: string;
  userId: string;
  role: SessionUser["role"] | "all";
  title: string;
  body: string;
  priority: "normal" | "urgent" | "critical";
  channel: "in_app" | "whatsapp" | "sms" | "voice";
  deliveryStatus: "pending" | "queued" | "sent" | "failed";
  read: boolean;
  createdAt: number;
};

const storageKey = "lderly-notifications";
const now = () => Date.now();

let localNotifications: CareNotification[] = [
  {
    id: "notification-welcome",
    userId: "all",
    role: "all",
    title: "LDERLY ready",
    body: "Realtime care dashboard is active.",
    priority: "normal",
    channel: "in_app",
    deliveryStatus: "sent",
    read: false,
    createdAt: now()
  }
];

const localSubscribers = new Set<(notifications: CareNotification[]) => void>();
const canUseStorage = () => typeof window !== "undefined";

const readLocalNotifications = () => {
  if (!canUseStorage()) {
    return localNotifications;
  }

  const storedNotifications = window.localStorage.getItem(storageKey);

  if (!storedNotifications) {
    return localNotifications;
  }

  try {
    localNotifications = JSON.parse(storedNotifications) as CareNotification[];
  } catch {
    window.localStorage.removeItem(storageKey);
  }

  return localNotifications;
};

const writeLocalNotifications = (notifications: CareNotification[]) => {
  localNotifications = notifications;

  if (canUseStorage()) {
    window.localStorage.setItem(storageKey, JSON.stringify(notifications));
  }

  localSubscribers.forEach((callback) => callback(notifications));
};

const visibleFor = (session: SessionUser, notification: CareNotification) =>
  notification.role === "all" ||
  notification.role === session.role ||
  notification.userId === session.uid ||
  session.role === "admin";

export const NotificationService = {
  subscribe(
    session: SessionUser,
    callback: (notifications: CareNotification[]) => void
  ) {
    callback(readLocalNotifications().filter((item) => visibleFor(session, item)));
    localSubscribers.add((notifications) => {
      callback(notifications.filter((item) => visibleFor(session, item)));
    });

    if (!db) {
      return () => undefined;
    }

    const notificationsRef =
      session.role === "admin"
        ? ref(db, "notifications/byId")
        : ref(db, `notifications/byUser/${session.uid}`);
    const unsubscribe = onValue(
      notificationsRef,
      (snapshot) => {
        const records = snapshot.val() as Record<string, CareNotification> | null;
        const nextNotifications = records
          ? Object.values(records).sort((a, b) => b.createdAt - a.createdAt)
          : readLocalNotifications();
        writeLocalNotifications(nextNotifications);
      },
      () => {
        callback(readLocalNotifications().filter((item) => visibleFor(session, item)));
      }
    );

    return () => {
      unsubscribe();
    };
  },

  create(
    notification: Omit<
      CareNotification,
      "id" | "createdAt" | "read" | "channel" | "deliveryStatus"
    > & {
      id?: string;
      channel?: CareNotification["channel"];
      deliveryStatus?: CareNotification["deliveryStatus"];
    }
  ) {
    const id = notification.id || `notification-${now()}`;
    const nextNotification: CareNotification = {
      ...notification,
      id,
      channel: notification.channel || "in_app",
      deliveryStatus: notification.deliveryStatus || "queued",
      read: false,
      createdAt: now()
    };
    const nextNotifications = [nextNotification, ...readLocalNotifications()].slice(
      0,
      20
    );

    writeLocalNotifications(nextNotifications);

    if (!db) {
      return;
    }

    const updates: Record<string, CareNotification> = {
      [`notifications/byId/${id}`]: nextNotification
    };

    if (nextNotification.userId && nextNotification.userId !== "all") {
      updates[`notifications/byUser/${nextNotification.userId}/${id}`] =
        nextNotification;
    }

    if (nextNotification.role !== "all") {
      updates[`notifications/byRole/${nextNotification.role}/${id}`] =
        nextNotification;
    }

    if (nextNotification.role === "all") {
      updates[`notifications/byRole/customer/${id}`] = nextNotification;
      updates[`notifications/byRole/caretaker/${id}`] = nextNotification;
      updates[`notifications/byRole/admin/${id}`] = nextNotification;
    }

    update(ref(db), updates).catch(() => {
      writeLocalNotifications(nextNotifications);
    });
  },

  markAllRead() {
    writeLocalNotifications(
      readLocalNotifications().map((notification) => ({
        ...notification,
        read: true
      }))
    );
  }
};
