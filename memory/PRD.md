# LeakStop — Money-Making Dashboard PRD (v2)

## Vision
A premium fintech mobile dashboard for the Indian middle class (7 LPA+) that visualises monthly wealth leakage and converts it into a ₹99/mo · ₹899/yr Razorpay subscription, with an AI advisor that speaks the user's language.

## Stack
- React Native Expo (file-based router) with web preview
- FastAPI + MongoDB
- Razorpay test-mode for INR billing (via WebView checkout)
- Emergent Universal LLM key powering Claude Sonnet 4.5 + Gemini 3 Flash advisor
- JWT email/password auth + Emergent-managed Google OAuth
- Expo Notifications for client-scheduled quarterly + FY-end reminders

## Screens
- `/index` — Splash + auth/onboarding redirect + Google session handler
- `/auth` — Email/password (signup + sign-in) + Google
- `/onboarding` — 3-step wizard (Income → Loans → Analyzing)
- `/dashboard` — Sticky LeakageMeter, stats, AI Advisor entry, 3 module cards, premium status
- `/loan` — Loan Arbitrage Engine
- `/cards` — Credit Card Optimizer
- `/tax` — Tax Predictor (FY 2026-27 New vs Old)
- `/advisor` — AI chat with model toggle (Claude/Gemini) + language toggle (8 languages)

## Backend Endpoints
- Public: `/api/market-rates`, `/api/cards`, `/api/cards/rank`, `/api/loan/refinance`, `/api/tax/calculate`, `/api/leakage`, `/api/profile`
- Auth: `/api/auth/register`, `/api/auth/login`, `/api/auth/google/session`, `/api/auth/me`, `/api/auth/logout`
- Authed user: `/api/me/profile`
- Advisor: `/api/advisor/chat` (model + language + leakage context)
- Razorpay: `/api/payments/order`, `/api/payments/verify`

## Push Notifications
- Local scheduled via `expo-notifications`: Q1/Q2/Q3 audits + March 25 FY warning + March 31 deadline.
- Requested via permission prompt; gracefully no-op on web.

## Languages supported
English, Hindi, Tamil, Telugu, Bengali, Marathi, Gujarati, Kannada.

## Subscription tiers
- Monthly: ₹99
- Yearly: ₹899 ("Best Value", ₹75/mo equivalent)

Razorpay test keys are present in `/app/backend/.env`. Verification uses HMAC-SHA256 on `order_id|payment_id` with the secret.
