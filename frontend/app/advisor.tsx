import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { COLORS, RADIUS, SPACING } from "../src/theme";
import { useAppStore } from "../src/store";
import { LANGS, ADVISOR_PROMPTS, Lang } from "../src/i18n";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

type Msg = { role: "user" | "assistant"; text: string };
type Model = "claude-sonnet-4-5" | "gemini-3-flash";

const MODEL_LABELS: Record<Model, { name: string; sub: string; icon: any }> = {
  "claude-sonnet-4-5": { name: "Claude 4.5", sub: "Deeper reasoning", icon: "sparkles" },
  "gemini-3-flash": { name: "Gemini 3", sub: "Faster replies", icon: "flash" },
};

export default function AdvisorScreen() {
  const router = useRouter();
  // IMPORTANT: select primitives separately to avoid returning a fresh object
  // every render (which breaks useSyncExternalStore -> infinite re-render loop).
  const income = useAppStore((s) => s.annual_income);
  const loans = useAppStore((s) => s.loans);
  const leakage_monthly = useAppStore((s) => s.monthly_leakage);
  const leakage_annual = useAppStore((s) => s.annual_leakage);
  const investments_80c = useAppStore((s) => s.investments_80c);
  const investments_80d = useAppStore((s) => s.investments_80d);
  const investments_nps = useAppStore((s) => s.investments_nps);
  const profile = useMemo(
    () => ({ income, loans, leakage_monthly, leakage_annual, investments_80c, investments_80d, investments_nps }),
    [income, loans, leakage_monthly, leakage_annual, investments_80c, investments_80d, investments_nps]
  );

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [lang, setLang] = useState<Lang>("en");
  const [model, setModel] = useState<Model>("claude-sonnet-4-5");
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showLangs, setShowLangs] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const prompts = useMemo(() => ADVISOR_PROMPTS[lang], [lang]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    setMsgs((m) => [...m, { role: "user", text }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch(`${BASE}/api/advisor/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          model,
          language: lang,
          session_id: sessionId,
          context: profile,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Advisor failed");
      setSessionId(data.session_id);
      setMsgs((m) => [...m, { role: "assistant", text: data.reply }]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      setMsgs((m) => [
        ...m,
        { role: "assistant", text: `⚠️ ${e?.message ?? "Failed to reach advisor."}` },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const activeLang = LANGS.find((l) => l.code === lang) || LANGS[0];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.bar}>
        <TouchableOpacity onPress={() => router.back()} testID="advisor-back">
          <Ionicons name="chevron-back" size={26} color={COLORS.text_primary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.barTitle}>AI Advisor</Text>
          <Text style={styles.barSub}>{MODEL_LABELS[model].name} · {activeLang.name}</Text>
        </View>
        <TouchableOpacity onPress={() => setShowLangs((v) => !v)} testID="lang-btn">
          <Ionicons name="globe" size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {showLangs && (
        <View style={styles.langSheet} testID="lang-sheet">
          {LANGS.map((l) => (
            <Pressable
              key={l.code}
              onPress={() => {
                setLang(l.code);
                setShowLangs(false);
              }}
              style={[styles.langItem, l.code === lang && styles.langItemActive]}
              testID={`lang-${l.code}`}
            >
              <Text
                style={[
                  styles.langItemText,
                  l.code === lang && { color: COLORS.primary, fontWeight: "800" },
                ]}
              >
                {l.name}
              </Text>
              {l.code === lang && <Ionicons name="checkmark" size={16} color={COLORS.primary} />}
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.modelRow}>
        {(Object.keys(MODEL_LABELS) as Model[]).map((m) => {
          const active = m === model;
          const meta = MODEL_LABELS[m];
          return (
            <Pressable
              key={m}
              onPress={() => setModel(m)}
              style={[styles.modelChip, active && styles.modelChipActive]}
              testID={`model-${m}`}
            >
              <Ionicons
                name={meta.icon}
                size={14}
                color={active ? COLORS.primary : COLORS.text_secondary}
              />
              <View>
                <Text
                  style={[
                    styles.modelName,
                    active && { color: COLORS.text_primary },
                  ]}
                >
                  {meta.name}
                </Text>
                <Text style={styles.modelSub}>{meta.sub}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          testID="advisor-thread"
        >
          {msgs.length === 0 && (
            <View style={styles.empty}>
              <View style={styles.brainBadge}>
                <Ionicons name="sparkles" size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.emptyTitle}>
                Your personal{"\n"}wealth advisor
              </Text>
              <Text style={styles.emptySub}>
                Ask anything about taxes, loans, cards or budgeting. I&apos;ll reply in {activeLang.name}.
              </Text>

              <View style={styles.suggestionWrap}>
                {prompts.map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => send(p)}
                    style={styles.suggestion}
                    testID="suggestion-chip"
                  >
                    <Ionicons name="arrow-up-circle" size={16} color={COLORS.primary} />
                    <Text style={styles.suggestionText}>{p}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {msgs.map((m, i) => (
            <View
              key={i}
              style={[
                styles.bubble,
                m.role === "user" ? styles.bubbleUser : styles.bubbleAssistant,
              ]}
              testID={`msg-${m.role}`}
            >
              <Text
                style={[
                  styles.bubbleText,
                  m.role === "user" && { color: "#060B19" },
                ]}
              >
                {m.text}
              </Text>
            </View>
          ))}

          {busy && (
            <View style={[styles.bubble, styles.bubbleAssistant, { flexDirection: "row", gap: 8 }]}>
              <ActivityIndicator color={COLORS.primary} />
              <Text style={styles.bubbleText}>Thinking…</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            testID="advisor-input"
            placeholder={`Ask in ${activeLang.name}…`}
            placeholderTextColor={COLORS.text_muted}
            style={styles.composerInput}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => send(input)}
            multiline
          />
          <TouchableOpacity
            testID="advisor-send"
            style={[styles.send, !input.trim() && { opacity: 0.4 }]}
            disabled={!input.trim() || busy}
            onPress={() => send(input)}
          >
            <Ionicons name="arrow-up" size={20} color="#060B19" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  barTitle: { color: COLORS.text_primary, fontWeight: "700", fontSize: 16 },
  barSub: { color: COLORS.text_muted, fontSize: 11, fontWeight: "600", marginTop: 2 },
  langSheet: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.sm,
  },
  langItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
  },
  langItemActive: { backgroundColor: "rgba(16,185,129,0.06)" },
  langItemText: { color: COLORS.text_primary, fontSize: 15, fontWeight: "600" },
  modelRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  modelChip: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
  },
  modelChipActive: { borderColor: COLORS.primary, backgroundColor: "rgba(16,185,129,0.08)" },
  modelName: { color: COLORS.text_secondary, fontWeight: "700", fontSize: 13 },
  modelSub: { color: COLORS.text_muted, fontSize: 10 },
  scroll: { padding: SPACING.lg, paddingBottom: 24 },
  empty: { alignItems: "flex-start", marginTop: SPACING.md },
  brainBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(16,185,129,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: COLORS.text_primary,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -1,
    marginTop: SPACING.md,
    lineHeight: 34,
  },
  emptySub: {
    color: COLORS.text_secondary,
    fontSize: 14,
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  suggestionWrap: { gap: SPACING.sm, alignSelf: "stretch" },
  suggestion: {
    flexDirection: "row",
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  suggestionText: { color: COLORS.text_primary, fontSize: 13, flex: 1 },
  bubble: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    maxWidth: "90%",
  },
  bubbleUser: {
    alignSelf: "flex-end",
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { color: COLORS.text_primary, fontSize: 14, lineHeight: 21 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: SPACING.md,
    gap: SPACING.sm,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  composerInput: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    color: COLORS.text_primary,
    fontSize: 15,
    maxHeight: 120,
  },
  send: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
