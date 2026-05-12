// Schedules client-side push notifications (quarterly + FY-end reminders).
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationsPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

function nextOccurrence(month: number, day: number, hour = 9): Date {
  const now = new Date();
  const y = now.getFullYear();
  let d = new Date(y, month - 1, day, hour, 0, 0);
  if (d.getTime() <= now.getTime()) d = new Date(y + 1, month - 1, day, hour, 0, 0);
  return d;
}

const AUDITS = [
  { month: 6, day: 30, title: "Q1 Wealth Audit", body: "It's been 90 days. Run your PaisaBachao audit and stop fresh leaks." },
  { month: 9, day: 30, title: "Q2 Wealth Audit", body: "Half-year check-in. See how much you've actually saved." },
  { month: 12, day: 31, title: "Q3 Wealth Audit", body: "Year-end is near. Plug remaining leaks before March 31." },
  { month: 3, day: 25, title: "FY-End Tax Deadline", body: "Only 6 days left to invest in ELSS / NPS / 80C. Don't lose ₹46,800." },
  { month: 3, day: 31, title: "Last day of FY", body: "Today is the deadline. Open PaisaBachao & lock in your tax savings." },
];

export async function schedulePeriodicAudits() {
  try {
    if (Platform.OS === "web") return [];
    const ok = await ensureNotificationsPermission();
    if (!ok) return [];

    // Clear existing to avoid duplicates on every dashboard mount
    await Notifications.cancelAllScheduledNotificationsAsync();

    const ids: string[] = [];
    for (const a of AUDITS) {
      const when = nextOccurrence(a.month, a.day);
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: a.title,
          body: a.body,
          sound: true,
          data: { type: "audit", month: a.month, day: a.day },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: when,
        },
      });
      ids.push(id);
    }
    return ids;
  } catch (e) {
    console.warn("notification schedule failed", e);
    return [];
  }
}

export async function getScheduled() {
  if (Platform.OS === "web") return [];
  return await Notifications.getAllScheduledNotificationsAsync();
}
