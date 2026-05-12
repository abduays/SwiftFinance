// Cross-platform storage helper using AsyncStorage on mobile and localStorage on web.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export async function storageGet<T = any>(key: string, fallback: T | null = null): Promise<T | null> {
  try {
    const raw =
      Platform.OS === "web"
        ? (typeof localStorage !== "undefined" ? localStorage.getItem(key) : null)
        : await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function storageSet(key: string, value: any) {
  const raw = JSON.stringify(value);
  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, raw);
  } else {
    await AsyncStorage.setItem(key, raw);
  }
}

export async function storageDel(key: string) {
  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined") localStorage.removeItem(key);
  } else {
    await AsyncStorage.removeItem(key);
  }
}

// Leakage timeline helpers
export type Snapshot = {
  ts: number;
  monthly_leakage: number;
  annual_leakage: number;
  breakdown: { loans_monthly: number; tax_monthly: number; cards_monthly: number };
  annual_income: number;
  loans_count: number;
};

const HISTORY_KEY = "leakstop_leakage_history_v1";
const MAX = 60;

export async function appendSnapshot(s: Omit<Snapshot, "ts">): Promise<Snapshot[]> {
  const list = (await storageGet<Snapshot[]>(HISTORY_KEY, [])) || [];
  // Dedup: if the last snapshot is identical (within 60s) skip writing.
  const last = list[0];
  const next: Snapshot = { ...s, ts: Date.now() };
  if (
    last &&
    Math.abs(last.monthly_leakage - next.monthly_leakage) < 1 &&
    Math.abs(last.ts - next.ts) < 60_000
  ) {
    return list;
  }
  const updated = [next, ...list].slice(0, MAX);
  await storageSet(HISTORY_KEY, updated);
  return updated;
}

export async function getSnapshots(): Promise<Snapshot[]> {
  return (await storageGet<Snapshot[]>(HISTORY_KEY, [])) || [];
}

export async function clearSnapshots() {
  await storageDel(HISTORY_KEY);
}
