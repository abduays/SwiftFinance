const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

async function post<T>(path: string, body: any): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json();
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

export type LoanInput = {
  loan_type: "home" | "car" | "personal";
  amount: number;
  rate: number;
  tenure_months: number;
};

export const api = {
  marketRates: () => get<{
    rates: Record<string, number>;
    repo_rate: number;
    spreads: Record<string, number>;
    source: string;
    last_updated_at: string | null;
    last_checked_at: string | null;
  }>("/market-rates"),
  listCards: () => get<any[]>("/cards"),
  rankCards: (category: string, monthly_spend: number) =>
    post<any[]>("/cards/rank", { category, monthly_spend }),
  refinance: (payload: LoanInput & { extra_emi?: number }) =>
    post<any>("/loan/refinance", { extra_emi: 0, ...payload }),
  tax: (payload: {
    annual_income: number;
    investments_80c?: number;
    investments_80d?: number;
    investments_nps?: number;
  }) => post<any>("/tax/calculate", payload),
  leakage: (payload: any) => post<any>("/leakage", payload),
};

export const formatRelTime = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mon = Math.floor(day / 30);
  return `${mon}mo ago`;
};

export const formatINR = (n: number) => {
  const sign = n < 0 ? "-" : "";
  n = Math.abs(Math.round(n));
  const s = n.toString();
  // Indian numbering: last 3 digits then 2-digit groups
  if (s.length <= 3) return `${sign}₹${s}`;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  const withCommas = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${sign}₹${withCommas},${last3}`;
};

export const formatLakhs = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `₹${(n / 1000).toFixed(1)} K`;
  return formatINR(n);
};
