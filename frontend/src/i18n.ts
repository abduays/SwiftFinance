// i18n strings (UI labels for the screens). For AI advisor language, language code is sent to backend.
export type Lang = "en" | "hi" | "ta" | "te" | "bn" | "mr" | "gu" | "kn";

export const LANGS: { code: Lang; name: string }[] = [
  { code: "en", name: "English" },
  { code: "hi", name: "हिन्दी" },
  { code: "ta", name: "தமிழ்" },
  { code: "te", name: "తెలుగు" },
  { code: "bn", name: "বাংলা" },
  { code: "mr", name: "मराठी" },
  { code: "gu", name: "ગુજરાતી" },
  { code: "kn", name: "ಕನ್ನಡ" },
];

export const ADVISOR_PROMPTS: Record<Lang, string[]> = {
  en: [
    "Explain my wealth leakage in simple terms",
    "How can I save tax under new regime?",
    "Should I prepay home loan or invest in mutual funds?",
    "Which credit card is best for my spend?",
  ],
  hi: [
    "मेरी wealth leakage समझाइए",
    "नई tax regime में टैक्स कैसे बचाऊं?",
    "Home loan जल्दी चुकाऊं या mutual fund में invest करूं?",
    "मेरे खर्च के लिए कौन सा credit card अच्छा है?",
  ],
  ta: ["எனது wealth leakage-ஐ எளிமையாக விளக்கவும்", "புதிய tax regime-இல் வரியை எப்படி குறைப்பது?", "Home loan-ஐ முதலில் கட்டுவதா அல்லது mutual fund-இல் investment செய்வதா?", "என் செலவுக்கு எந்த credit card சிறந்தது?"],
  te: ["నా wealth leakage సులభంగా వివరించండి", "క్రొత్త tax regime లో పన్ను ఎలా ఆదా చేయాలి?", "Home loan ముందుగా చెల్లించాలా లేదా mutual fund లో పెట్టుబడి పెట్టాలా?", "నా ఖర్చుకు ఏ credit card ఉత్తమం?"],
  bn: ["আমার wealth leakage সহজভাবে বুঝিয়ে দিন", "নতুন tax regime-এ ট্যাক্স কীভাবে বাঁচাবো?", "Home loan আগে শোধ করব নাকি mutual fund-এ বিনিয়োগ?", "আমার খরচের জন্য কোন credit card সেরা?"],
  mr: ["माझी wealth leakage सोप्या भाषेत समजावा", "नवीन tax regime मध्ये कर कसा वाचवायचा?", "Home loan आधी फेडावा की mutual fund मध्ये गुंतवणूक?", "माझ्या खर्चासाठी कोणते credit card सर्वोत्तम?"],
  gu: ["મારી wealth leakage સરળ રીતે સમજાવો", "નવી tax regime માં ટેક્સ કેવી રીતે બચાવવો?", "Home loan પહેલા ભરું કે mutual fund માં રોકાણ?", "મારા ખર્ચ માટે કયું credit card શ્રેષ્ઠ?"],
  kn: ["ನನ್ನ wealth leakage ಅನ್ನು ಸುಲಭವಾಗಿ ವಿವರಿಸಿ", "ಹೊಸ tax regime ನಲ್ಲಿ ತೆರಿಗೆ ಹೇಗೆ ಉಳಿಸುವುದು?", "Home loan ಮೊದಲು ತೀರಿಸಬೇಕೋ ಅಥವಾ mutual fund ನಲ್ಲಿ ಹೂಡಿಕೆ?", "ನನ್ನ ಖರ್ಚಿಗೆ ಯಾವ credit card ಉತ್ತಮ?"],
};
