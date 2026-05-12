// Lightweight global store using React's useSyncExternalStore.
import { useSyncExternalStore } from "react";

export type Loan = {
  loan_type: "home" | "car" | "personal";
  amount: number;
  rate: number;
  tenure_months: number;
};

export type AppState = {
  onboarded: boolean;
  annual_income: number;
  loans: Loan[];
  investments_80c: number;
  investments_80d: number;
  investments_nps: number;
  monthly_leakage: number;
  annual_leakage: number;
};

const DEFAULTS: AppState = {
  onboarded: false,
  annual_income: 1200000,
  loans: [
    { loan_type: "home", amount: 3500000, rate: 9.2, tenure_months: 240 },
  ],
  investments_80c: 50000,
  investments_80d: 15000,
  investments_nps: 0,
  monthly_leakage: 0,
  annual_leakage: 0,
};

let state: AppState = { ...DEFAULTS };
const listeners = new Set<() => void>();

export const store = {
  get: () => state,
  set: (patch: Partial<AppState>) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  },
  reset: () => {
    state = { ...DEFAULTS };
    listeners.forEach((l) => l());
  },
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useAppStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => selector(state),
    () => selector(state)
  );
}
