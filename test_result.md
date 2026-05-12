#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Build a "Money-Making Dashboard" for Indian middle class to visualize money lost through
  inefficient loans, credit card misuse, and poor tax planning. Modules: A (Loan Arbitrage),
  B (Credit Card Optimizer), C (Tax-Saving Predictor). Monetization: Razorpay paywall.
  Current iteration: Rename brand "LeakStop" → "PaisaBachao", remove all fake/dummy/demo data
  and dummy buttons, stress-test all features.

backend:
  - task: "Brand rename + remove hardcoded card_leak constant in /api/leakage"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Renamed app to PaisaBachao in root endpoint, SYSTEM_TEMPLATE, WhatsApp welcome,
          subscription activation message. Replaced hardcoded `card_leak = 6000 * 4.5/100` with a
          real computation based on top credit-card net annual value at assumed avg spend (8% of
          net income / 12). Webhook + verify endpoints unchanged."
      - working: true
        agent: "testing"
        comment: "Verified: GET /api/ now returns {message: 'PaisaBachao API', version: '2.0'}.
          /api/leakage with income=12L + home loan returns breakdown
          {loans_monthly: 1789.35, tax_monthly: 13650.0, cards_monthly: 400.0}; cards_monthly is
          0 < x < 5000 and total reconciles within tolerance. Zero-income payload yields
          cards_monthly=0 (graceful, no fake leakage). 20× stress run with random incomes 5L–50L
          returned 200 with finite, non-negative numbers."

  - task: "Existing endpoints sanity (auth, leakage, refinance, cards/rank, tax, advisor, payments)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "No behavioural change beyond rename + card_leak computation. Verify auth flows
          (register/login/me), leakage breakdown structure (loans_monthly, tax_monthly,
          cards_monthly), refinance series, cards/rank ordering, tax regime comparison, advisor
          chat (Claude + Gemini), Razorpay order create + verify signature."
      - working: true
        agent: "testing"
        comment: "All 31 backend checks PASS (see /app/backend_test.py). Coverage:
          (1) Public — /, /market-rates, /cards (6 cards), /cards/rank for all 4 categories
          sorted desc by annual_net_value with full schema, invalid category→400, /loan/refinance
          (lifetime_save=₹4.29L, months_saved=68, switched_rate=8.4), /tax/calculate
          (new/old/optimal/elss_gap/elss_save), /leakage with real cards_monthly and zero-income
          graceful path.
          (2) Auth — register (qa_stress_*@paisabachao.in), duplicate→409, login, bad-pw→401,
          /auth/me with Bearer returns user sans password_hash.
          (3) Advisor — claude-sonnet-4-5/hi (1126 chars) and gemini-3-flash/en (2001 chars)
          both 200 with reply/session_id/model.
          (4) Razorpay — order monthly=9900, yearly=89900, invalid plan→400, verify with bogus
          sig→400, webhook with bogus sig→400.
          (5) Me-scoped — leakage-history POST+GET, whatsapp prefs POST+GET, outbox shows
          welcome message kind=welcome status=sent provider=mock.
          (6) Stress — 20× /api/leakage all 200, finite numbers.
          Note: pydantic EmailStr rejects '.test' TLD; tester switched to '.in' (test-only
          adjustment; not an app issue)."

frontend:
  - task: "Brand rebrand to PaisaBachao across splash, dashboard, auth, Razorpay, app.json"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/*, /app/frontend/src/*"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "app.json name/slug/scheme updated. Splash, auth header, dashboard header,
          terms text, Razorpay checkout brand all show PaisaBachao now."

  - task: "Dashboard ModuleCards use real computed metrics (no hardcoded 8.5L / 14,400)"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/dashboard.tsx, /app/frontend/src/store.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Added `breakdown` to AppState. Dashboard now derives loan/cards/tax module
          metrics from real breakdown returned by /api/leakage. Fixed dummy Unlock CTA to open
          PaywallModal instead of routing to /loan."

  - task: "Remove fake card number '8821' and rename misleading 'Apply for card' CTA"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/cards.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Card visual now shows masked dots (no fake 4-digit suffix); cardholder block
          replaced with NETWORK/issuer. CTA renamed to 'Unlock <card> guide' with lock icon."

  - task: "Remove fake onboarding 'Estimated leakage' bottom-bar number"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/onboarding.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Replaced the misleading `formatINR(Math.max(income*0.01, 4500))/mo` with an
          honest progress label (STEP n of 3). Onboarding also persists real breakdown after
          /api/leakage success and clears bogus 9500/114000 fallback values."

metadata:
  created_by: "main_agent"
  version: "2.1"
  test_sequence: 3
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Renamed product to PaisaBachao and removed all hardcoded/fake numbers from the dashboard
      module cards (loan "8.5L" lifetime, cards "+ ₹14,400/yr", tax floor 31200), card visual
      (•••• 8821), and onboarding bottom-bar estimated leakage. Backend /api/leakage now
      computes card_leak from real CREDIT_CARDS catalog using an 8%-of-income proxy spend,
      instead of `6000 * 4.5/100`. Please retest all backend endpoints — focus on /api/leakage
      breakdown values (loans_monthly, tax_monthly, cards_monthly) being non-zero and finite
      for both legacy and authenticated payloads, plus Razorpay order/verify flow.
  - agent: "testing"
    message: |
      Comprehensive backend regression complete: 31/31 PASS via /app/backend_test.py against
      EXPO_PUBLIC_BACKEND_URL/api. Brand rebrand verified (root message='PaisaBachao API').
      Real card_leak computation working — cards_monthly=400 for income=12L payload
      (previously hard-coded to 270). Zero-income payload returns cards_monthly=0 gracefully.
      All auth, advisor (Claude + Gemini), Razorpay (order/verify/webhook), and me-scoped
      (leakage-history, whatsapp prefs + outbox welcome) flows pass. 20× stress on /api/leakage
      with incomes 5L–50L all return 200 with finite numbers. Updated
      /app/memory/test_credentials.md with the freshly-registered qa_stress_*@paisabachao.in
      user. No regressions or stuck tasks. Backend is ready.