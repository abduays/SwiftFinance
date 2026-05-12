// UI translations for module screens. Eight languages × ~30 keys.
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { storageGet, storageSet } from "./storage";
import { Lang, LANGS } from "./i18n";

type T = Record<string, string>;

const en: T = {
  dashboard_hi: "Hi",
  dashboard_live: "LIVE",
  dashboard_subtitle: "Your wealth audit",
  income: "INCOME",
  per_year: "/ year gross",
  debts_tracked: "DEBTS TRACKED",
  none: "none",
  advisor_title: "Ask the AI Advisor",
  advisor_sub: "Multilingual · Claude 4.5 + Gemini 3",
  money_modules: "Money-Making Modules",
  money_modules_sub: "Tap a card to fix the leak.",
  module_loan: "Loan Arbitrage Engine",
  module_loan_desc: "See how much you save by refinancing at today's best market rate.",
  module_cards: "Credit Card Optimizer",
  module_cards_desc: "Rank Indian cards by reward % for your spend category.",
  module_tax: "Tax-Saving Predictor",
  module_tax_desc: "Pick the right regime. Plug ELSS gaps before March 31.",
  upgrade_title: "Upgrade to Premium",
  upgrade_sub: "Detailed loan-switch plan + quarterly audits at ₹75/mo.",
  unlock: "Unlock",
  premium_active: "Premium Active",
  add_loan: "Add loan",
  on_best_rate: "On best rate",
  // onboarding
  income_eyebrow: "INCOME PROFILE",
  income_q: "What's your annual income?",
  income_help: "Used to compute your tax leakage. Stays on your device.",
  liabilities_eyebrow: "LIABILITIES",
  liabilities_q: "Select your active debts",
  liabilities_help: "We'll benchmark each against today's best market rate.",
  analyzing_eyebrow: "SCANNING",
  analyzing_q: "Analyzing wealth leakage…",
  continue: "Continue",
  reveal_leakage: "Reveal Leakage",
  estimated_leakage: "Estimated leakage",
  // leakage meter
  leakage_label: "WEALTH LEAKAGE DETECTED",
  leakage_sub: "draining out every year",
  // settings
  settings: "Settings",
  ui_language: "App language",
  whatsapp_audits: "WhatsApp audits",
  whatsapp_help: "Receive quarterly wealth audits on WhatsApp.",
  enable: "Enable",
  signed_in_as: "Signed in as",
  sign_out: "Sign out",
};

// Concise translations for non-English locales. Keys not present fall back to English.
const hi: T = {
  dashboard_hi: "नमस्ते",
  dashboard_live: "लाइव",
  dashboard_subtitle: "आपकी wealth audit",
  income: "आय",
  per_year: "/ साल",
  debts_tracked: "कर्ज दर्ज",
  none: "कोई नहीं",
  advisor_title: "AI सलाहकार से पूछें",
  advisor_sub: "Claude 4.5 + Gemini 3 · 8 भाषाएँ",
  money_modules: "पैसा बचाने वाले मॉड्यूल",
  money_modules_sub: "leakage रोकने के लिए टैप करें।",
  module_loan: "Loan Arbitrage Engine",
  module_loan_desc: "आज की best rate पर refinance करके कितना बचेगा देखें।",
  module_cards: "Credit Card Optimizer",
  module_cards_desc: "अपने खर्च की category के लिए best card चुनें।",
  module_tax: "Tax-Saving Predictor",
  module_tax_desc: "सही regime चुनें। 31 March से पहले ELSS में निवेश।",
  upgrade_title: "Premium लें",
  upgrade_sub: "Detailed loan-switch plan + quarterly audits — ₹75/मो",
  unlock: "Unlock",
  premium_active: "Premium चालू",
  add_loan: "Loan जोड़ें",
  on_best_rate: "Best rate पर",
  income_eyebrow: "आय का विवरण",
  income_q: "आपकी सालाना आय कितनी है?",
  income_help: "Tax leakage निकालने के लिए — आपके device पर ही रहेगा।",
  liabilities_eyebrow: "देनदारियाँ",
  liabilities_q: "अपने active loan चुनें",
  liabilities_help: "हर loan को market की best rate से compare करेंगे।",
  analyzing_eyebrow: "स्कैनिंग",
  analyzing_q: "Wealth leakage का विश्लेषण…",
  continue: "आगे",
  reveal_leakage: "Leakage दिखाओ",
  estimated_leakage: "अनुमानित leakage",
  leakage_label: "WEALTH LEAKAGE मिली",
  leakage_sub: "हर साल यूँही बह रहा है",
  settings: "Settings",
  ui_language: "App की भाषा",
  whatsapp_audits: "WhatsApp audits",
  whatsapp_help: "हर तिमाही wealth audit WhatsApp पर पाएं।",
  enable: "चालू करें",
  signed_in_as: "लॉग-इन है",
  sign_out: "साइन आउट",
};

const ta: T = {
  dashboard_hi: "வணக்கம்", dashboard_live: "நேரலை", dashboard_subtitle: "உங்கள் wealth audit",
  income: "வருமானம்", per_year: "/ ஆண்டு", debts_tracked: "கடன்கள்", none: "இல்லை",
  advisor_title: "AI ஆலோசகரை கேளுங்கள்", advisor_sub: "Claude 4.5 + Gemini 3",
  money_modules: "பணம் சேமிக்கும் modules", money_modules_sub: "leak-ஐ சரிசெய்ய தட்டவும்.",
  module_loan: "Loan Arbitrage Engine", module_loan_desc: "சிறந்த rate-இல் refinance செய்து சேமிக்கவும்.",
  module_cards: "Credit Card Optimizer", module_cards_desc: "உங்கள் செலவுக்கு சிறந்த card.",
  module_tax: "Tax-Saving Predictor", module_tax_desc: "சரியான regime + ELSS.",
  upgrade_title: "Premium பெறுங்கள்", upgrade_sub: "Detailed plan + audits — ₹75/மா",
  unlock: "Unlock", premium_active: "Premium செயல்பாட்டில்",
  income_eyebrow: "வருமான விவரம்", income_q: "உங்கள் ஆண்டு வருமானம் என்ன?",
  income_help: "Tax leakage கணக்கீட்டுக்கு — device-இல் மட்டுமே.",
  liabilities_eyebrow: "கடன்கள்", liabilities_q: "உங்கள் கடன்களை தேர்ந்தெடுக்கவும்",
  liabilities_help: "சிறந்த rate-உடன் ஒப்பீடு செய்வோம்.",
  analyzing_eyebrow: "ஸ்கேனிங்", analyzing_q: "Wealth leakage பகுப்பாய்வு…",
  continue: "அடுத்து", reveal_leakage: "Leakage காட்டு",
  estimated_leakage: "மதிப்பிட்ட leakage",
  leakage_label: "WEALTH LEAKAGE கண்டறியப்பட்டது",
  leakage_sub: "ஒவ்வொரு ஆண்டும் வெளியேறுகிறது",
  settings: "அமைப்புகள்", ui_language: "App மொழி", whatsapp_audits: "WhatsApp audits",
  whatsapp_help: "ஒவ்வொரு காலாண்டும் WhatsApp-இல் audit.",
  enable: "இயக்கு", signed_in_as: "உள்நுழைந்தது", sign_out: "வெளியேறு",
};

const te: T = {
  dashboard_hi: "హలో", dashboard_live: "లైవ్", dashboard_subtitle: "మీ wealth audit",
  income: "ఆదాయం", per_year: "/ సం.", debts_tracked: "రుణాలు", none: "ఏదీ లేదు",
  advisor_title: "AI సలహాదారుని అడగండి", advisor_sub: "Claude 4.5 + Gemini 3",
  money_modules: "డబ్బు ఆదా modules", money_modules_sub: "leak సరిచేయండి.",
  module_loan: "Loan Arbitrage Engine", module_loan_desc: "ఉత్తమ rate refinance చేయండి.",
  module_cards: "Credit Card Optimizer", module_cards_desc: "ఉత్తమ card ఎంచుకోండి.",
  module_tax: "Tax-Saving Predictor", module_tax_desc: "సరైన regime + ELSS.",
  upgrade_title: "Premium కొనుగోలు", upgrade_sub: "Detailed plan + audits — ₹75/నె",
  unlock: "Unlock", premium_active: "Premium పనిచేస్తోంది",
  income_eyebrow: "ఆదాయ వివరాలు", income_q: "మీ సంవత్సర ఆదాయం?",
  income_help: "Tax leakage లెక్క — device లోనే.",
  liabilities_eyebrow: "రుణాలు", liabilities_q: "మీ రుణాలను ఎంచుకోండి",
  liabilities_help: "ఉత్తమ rate తో పోలుస్తాం.",
  analyzing_eyebrow: "స్కానింగ్", analyzing_q: "Wealth leakage విశ్లేషణ…",
  continue: "ముందుకు", reveal_leakage: "Leakage చూపు",
  estimated_leakage: "అంచనా leakage",
  leakage_label: "WEALTH LEAKAGE కనుగొనబడింది",
  leakage_sub: "ప్రతి సంవత్సరం పోతోంది",
  settings: "సెట్టింగ్‌లు", ui_language: "App భాష", whatsapp_audits: "WhatsApp audits",
  whatsapp_help: "ప్రతి త్రైమాసికం WhatsApp ద్వారా.",
  enable: "ఎనేబుల్", signed_in_as: "లాగిన్ అయ్యారు", sign_out: "సైన్ అవుట్",
};

const bn: T = {
  dashboard_hi: "হ্যালো", dashboard_live: "লাইভ", dashboard_subtitle: "আপনার wealth audit",
  income: "আয়", per_year: "/ বছর", debts_tracked: "ঋণ", none: "নেই",
  advisor_title: "AI উপদেষ্টাকে জিজ্ঞাসা করুন", advisor_sub: "Claude 4.5 + Gemini 3",
  money_modules: "টাকা বাঁচানোর modules", money_modules_sub: "leak সারাতে ট্যাপ।",
  module_loan: "Loan Arbitrage Engine", module_loan_desc: "সেরা rate-এ refinance।",
  module_cards: "Credit Card Optimizer", module_cards_desc: "আপনার খরচের জন্য সেরা card।",
  module_tax: "Tax-Saving Predictor", module_tax_desc: "সঠিক regime + ELSS।",
  upgrade_title: "Premium নিন", upgrade_sub: "Detailed plan + audits — ₹৭৫/মাস",
  unlock: "Unlock", premium_active: "Premium সক্রিয়",
  income_eyebrow: "আয়ের বিবরণ", income_q: "আপনার বার্ষিক আয়?",
  income_help: "Tax leakage হিসাব — device-এই।",
  liabilities_eyebrow: "দায়", liabilities_q: "আপনার ঋণগুলি বাছুন",
  liabilities_help: "সেরা rate-এর সাথে তুলনা।",
  analyzing_eyebrow: "স্ক্যানিং", analyzing_q: "Wealth leakage বিশ্লেষণ…",
  continue: "পরবর্তী", reveal_leakage: "Leakage দেখাও",
  estimated_leakage: "আনুমানিক leakage",
  leakage_label: "WEALTH LEAKAGE শনাক্ত",
  leakage_sub: "প্রতি বছর বেরিয়ে যাচ্ছে",
  settings: "Settings", ui_language: "App ভাষা", whatsapp_audits: "WhatsApp audits",
  whatsapp_help: "প্রতি ত্রৈমাসিকে WhatsApp-এ।",
  enable: "চালু", signed_in_as: "লগ-ইন", sign_out: "সাইন আউট",
};

const mr: T = {
  dashboard_hi: "नमस्कार", dashboard_live: "लाईव्ह", dashboard_subtitle: "तुमची wealth audit",
  income: "उत्पन्न", per_year: "/ वर्ष", debts_tracked: "कर्ज", none: "नाही",
  advisor_title: "AI सल्लागार विचारा", advisor_sub: "Claude 4.5 + Gemini 3",
  money_modules: "पैसे वाचवणारे modules", money_modules_sub: "leak दुरुस्त करा.",
  module_loan: "Loan Arbitrage Engine", module_loan_desc: "उत्तम rate-वर refinance.",
  module_cards: "Credit Card Optimizer", module_cards_desc: "तुमच्या खर्चासाठी सर्वोत्तम card.",
  module_tax: "Tax-Saving Predictor", module_tax_desc: "योग्य regime + ELSS.",
  upgrade_title: "Premium घ्या", upgrade_sub: "Detailed plan + audits — ₹75/मा",
  unlock: "Unlock", premium_active: "Premium सक्रिय",
  income_eyebrow: "उत्पन्न प्रोफाइल", income_q: "तुमचे वार्षिक उत्पन्न?",
  income_help: "Tax leakage साठी — device वरच.",
  liabilities_eyebrow: "देयता", liabilities_q: "तुमची कर्जे निवडा",
  liabilities_help: "उत्तम rate-शी तुलना.",
  analyzing_eyebrow: "स्कॅनिंग", analyzing_q: "Wealth leakage विश्लेषण…",
  continue: "पुढे", reveal_leakage: "Leakage दाखवा",
  estimated_leakage: "अंदाजे leakage",
  leakage_label: "WEALTH LEAKAGE आढळली",
  leakage_sub: "दरवर्षी वाहत आहे",
  settings: "Settings", ui_language: "App भाषा", whatsapp_audits: "WhatsApp audits",
  whatsapp_help: "दर तिमाहीला WhatsApp वर.",
  enable: "सुरू", signed_in_as: "लॉग-इन", sign_out: "साइन आउट",
};

const gu: T = {
  dashboard_hi: "નમસ્તે", dashboard_live: "લાઈવ", dashboard_subtitle: "તમારી wealth audit",
  income: "આવક", per_year: "/ વર્ષ", debts_tracked: "લોન", none: "નથી",
  advisor_title: "AI સલાહકારને પૂછો", advisor_sub: "Claude 4.5 + Gemini 3",
  money_modules: "પૈસા બચાવતા modules", money_modules_sub: "leak ઠીક કરો.",
  module_loan: "Loan Arbitrage Engine", module_loan_desc: "ઉત્તમ rate પર refinance.",
  module_cards: "Credit Card Optimizer", module_cards_desc: "તમારા ખર્ચ માટે best card.",
  module_tax: "Tax-Saving Predictor", module_tax_desc: "યોગ્ય regime + ELSS.",
  upgrade_title: "Premium લો", upgrade_sub: "Detailed plan + audits — ₹75/મા",
  unlock: "Unlock", premium_active: "Premium સક્રિય",
  income_eyebrow: "આવક પ્રોફાઈલ", income_q: "તમારી વાર્ષિક આવક?",
  income_help: "Tax leakage માટે — device માં જ.",
  liabilities_eyebrow: "દેવાં", liabilities_q: "તમારી લોન પસંદ કરો",
  liabilities_help: "Best rate સાથે સરખામણી.",
  analyzing_eyebrow: "સ્કેનિંગ", analyzing_q: "Wealth leakage વિશ્લેષણ…",
  continue: "આગળ", reveal_leakage: "Leakage બતાવો",
  estimated_leakage: "અંદાજિત leakage",
  leakage_label: "WEALTH LEAKAGE મળી",
  leakage_sub: "દર વર્ષે વહી રહ્યું છે",
  settings: "Settings", ui_language: "App ભાષા", whatsapp_audits: "WhatsApp audits",
  whatsapp_help: "દર ત્રિમાસિક WhatsApp પર.",
  enable: "ચાલુ", signed_in_as: "લોગ-ઈન", sign_out: "સાઇન આઉટ",
};

const kn: T = {
  dashboard_hi: "ನಮಸ್ಕಾರ", dashboard_live: "ಲೈವ್", dashboard_subtitle: "ನಿಮ್ಮ wealth audit",
  income: "ಆದಾಯ", per_year: "/ ವರ್ಷ", debts_tracked: "ಸಾಲಗಳು", none: "ಇಲ್ಲ",
  advisor_title: "AI ಸಲಹೆಗಾರನನ್ನು ಕೇಳಿ", advisor_sub: "Claude 4.5 + Gemini 3",
  money_modules: "ಹಣ ಉಳಿಸುವ modules", money_modules_sub: "leak ಸರಿಪಡಿಸಿ.",
  module_loan: "Loan Arbitrage Engine", module_loan_desc: "ಉತ್ತಮ rate-ನಲ್ಲಿ refinance.",
  module_cards: "Credit Card Optimizer", module_cards_desc: "ನಿಮ್ಮ ಖರ್ಚಿಗೆ best card.",
  module_tax: "Tax-Saving Predictor", module_tax_desc: "ಸರಿಯಾದ regime + ELSS.",
  upgrade_title: "Premium ಪಡೆಯಿರಿ", upgrade_sub: "Detailed plan + audits — ₹75/ತಿಂಗಳು",
  unlock: "Unlock", premium_active: "Premium ಸಕ್ರಿಯ",
  income_eyebrow: "ಆದಾಯ ವಿವರ", income_q: "ನಿಮ್ಮ ವಾರ್ಷಿಕ ಆದಾಯ?",
  income_help: "Tax leakage ಗಾಗಿ — device-ನಲ್ಲೇ.",
  liabilities_eyebrow: "ಸಾಲಗಳು", liabilities_q: "ನಿಮ್ಮ ಸಾಲಗಳನ್ನು ಆಯ್ಕೆಮಾಡಿ",
  liabilities_help: "Best rate ಜೊತೆ ಹೋಲಿಕೆ.",
  analyzing_eyebrow: "ಸ್ಕ್ಯಾನಿಂಗ್", analyzing_q: "Wealth leakage ವಿಶ್ಲೇಷಣೆ…",
  continue: "ಮುಂದೆ", reveal_leakage: "Leakage ತೋರಿಸಿ",
  estimated_leakage: "ಅಂದಾಜು leakage",
  leakage_label: "WEALTH LEAKAGE ಪತ್ತೆ",
  leakage_sub: "ಪ್ರತಿ ವರ್ಷ ಹರಿಯುತ್ತಿದೆ",
  settings: "Settings", ui_language: "App ಭಾಷೆ", whatsapp_audits: "WhatsApp audits",
  whatsapp_help: "ಪ್ರತಿ ತ್ರೈಮಾಸಿಕ WhatsApp ನಲ್ಲಿ.",
  enable: "ಸಕ್ರಿಯಗೊಳಿಸಿ", signed_in_as: "ಲಾಗ್-ಇನ್", sign_out: "ಸೈನ್ ಔಟ್",
};

const DICT: Record<Lang, T> = { en, hi, ta, te, bn, mr, gu, kn };

const KEY = "leakstop_ui_lang_v1";

type LangCtx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  langName: string;
};

const Ctx = createContext<LangCtx | null>(null);

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    (async () => {
      const saved = await storageGet<Lang>(KEY, "en");
      if (saved) setLangState(saved);
    })();
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    storageSet(KEY, l);
  }, []);

  const t = useCallback(
    (key: string) => (DICT[lang] && DICT[lang][key]) || DICT.en[key] || key,
    [lang]
  );

  const langName = LANGS.find((l) => l.code === lang)?.name ?? "English";

  return <Ctx.Provider value={{ lang, setLang, t, langName }}>{children}</Ctx.Provider>;
}

export function useLang() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLang outside LangProvider");
  return ctx;
}
