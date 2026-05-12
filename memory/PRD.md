# Money-Making Dashboard (LeakStop) — PRD

## Vision
A premium fintech mobile dashboard for the Indian middle class (7 LPA+) that visualises monthly wealth leakage from inefficient loans, sub-optimal credit-card usage, and poor tax planning — and converts that anxiety into a ₹99/month subscription.

## Stack
- React Native Expo (file-based router) with web preview
- FastAPI backend (Python) with MongoDB
- Custom react-native-svg charts, @react-native-community/slider, expo-linear-gradient, @expo/vector-icons
- No authentication, no third-party integrations (paywall is UI mock as per scope)

## Modules
- **Onboarding wizard** (3-step): Income → Loans → Analyzing
- **Dashboard**: pulsing "Wealth Leakage Meter" hero + module entry cards
- **Module A — Loan Arbitrage**: current vs market-best EMI, refinance savings, area chart of interest paid over time, tenure & extra-EMI sliders, "Check Eligibility" CTA → paywall
- **Module B — Credit Card Optimizer**: ranks HDFC Regalia, ICICI Amazon Pay, Amex Platinum Travel, SBI SimplyClick, Axis Magnus, HDFC Millennia by net annual value for the selected category & monthly spend; rich gradient card visualisation
- **Module C — Tax Predictor (FY 2026-27)**: New vs Old regime side-by-side, "OPTIMAL" badge, leakage callout, ELSS gap recommendation
- **Paywall modal**: ₹99/mo & ₹899/yr ("BEST VALUE"), "Stop the leak. Pays for itself in 1 day."

## Backend Endpoints
- `GET /api/market-rates`
- `GET /api/cards`, `POST /api/cards/rank`
- `POST /api/loan/refinance` (returns EMIs, savings, prepay model, amortization series)
- `POST /api/tax/calculate` (New regime FY 2026-27 with std deduction ₹75k + rebate up to ₹12L; Old regime with 80C/80D/NPS)
- `POST /api/leakage` (combined monthly + annual leakage with breakdown)
- `POST /api/profile`, `GET /api/profile/{id}` (Mongo persistence, optional)

## Future Enhancements
- Razorpay/Stripe real payment integration
- Email-based user accounts & multi-device sync
- AI advisor chat using GPT-5/Claude for personalised recommendations
- Quarterly leakage audit notifications
