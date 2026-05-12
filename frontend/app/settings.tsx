import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { COLORS, RADIUS, SPACING } from "../src/theme";
import { LANGS, Lang } from "../src/i18n";
import { useLang } from "../src/translations";
import { useAuth, authedFetch } from "../src/auth";
import { store } from "../src/store";
import { clearSnapshots } from "../src/storage";

export default function Settings() {
  const router = useRouter();
  const { user, token, logout } = useAuth();
  const { lang, setLang, t } = useLang();

  const [enabled, setEnabled] = useState(false);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [outbox, setOutbox] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      if (!token) return;
      try {
        const prefs = (await authedFetch("/me/whatsapp", {}, token)) as any;
        setEnabled(!!prefs?.enabled);
        if (prefs?.phone) setPhone(prefs.phone);
        const ob = (await authedFetch("/me/whatsapp/outbox", {}, token)) as any[];
        setOutbox(ob ?? []);
      } catch (e) {
        console.warn("settings load failed", e);
      }
    })();
  }, [token]);

  const save = async (nextEnabled: boolean, nextPhone: string) => {
    if (!token) return;
    if (nextEnabled && !/^\+?\d{10,15}$/.test(nextPhone.replace(/\s+/g, ""))) {
      Alert.alert("Phone number", "Use E.164 format e.g. +919999988887");
      return;
    }
    setBusy(true);
    try {
      await authedFetch("/me/whatsapp", {
        method: "POST",
        body: JSON.stringify({ enabled: nextEnabled, phone: nextEnabled ? nextPhone : null }),
      }, token);
      const ob = (await authedFetch("/me/whatsapp/outbox", {}, token)) as any[];
      setOutbox(ob ?? []);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.bar}>
        <TouchableOpacity onPress={() => router.back()} testID="settings-back">
          <Ionicons name="chevron-back" size={26} color={COLORS.text_primary} />
        </TouchableOpacity>
        <Text style={styles.barTitle}>{t("settings")}</Text>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} testID="settings-screen">
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{t("signed_in_as")}</Text>
                <Text style={styles.value}>{user?.email}</Text>
                <Text style={styles.sub}>{user?.name}</Text>
              </View>
              <TouchableOpacity
                style={styles.outBtn}
                testID="sign-out-btn"
                onPress={async () => {
                  await logout();
                  store.reset();
                  await clearSnapshots();
                  router.replace("/auth");
                }}
              >
                <Text style={styles.outText}>{t("sign_out")}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* UI language */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("ui_language")}</Text>
            <View style={styles.langGrid}>
              {LANGS.map((l) => {
                const active = l.code === lang;
                return (
                  <Pressable
                    key={l.code}
                    onPress={() => setLang(l.code as Lang)}
                    style={[styles.langChip, active && styles.langChipActive]}
                    testID={`ui-lang-${l.code}`}
                  >
                    <Text
                      style={[
                        styles.langText,
                        active && { color: COLORS.text_primary, fontWeight: "800" },
                      ]}
                    >
                      {l.name}
                    </Text>
                    {active && <Ionicons name="checkmark" size={14} color={COLORS.primary} />}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* WhatsApp */}
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{t("whatsapp_audits")}</Text>
                <Text style={styles.sub}>{t("whatsapp_help")}</Text>
              </View>
              <Switch
                testID="whatsapp-toggle"
                value={enabled}
                onValueChange={(v) => {
                  setEnabled(v);
                  if (!v) save(false, phone);
                }}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor="#fff"
              />
            </View>
            {enabled && (
              <View style={styles.phoneRow}>
                <View style={styles.phoneInputWrap}>
                  <Text style={styles.phoneCC}>🇮🇳 +91</Text>
                  <TextInput
                    testID="whatsapp-phone"
                    value={phone.replace("+91", "")}
                    onChangeText={(v) => setPhone("+91" + v.replace(/\D/g, ""))}
                    placeholder="98765 43210"
                    placeholderTextColor={COLORS.text_muted}
                    keyboardType="phone-pad"
                    style={styles.phoneInput}
                  />
                </View>
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={() => save(true, phone)}
                  disabled={busy}
                  testID="whatsapp-save"
                >
                  {busy ? (
                    <ActivityIndicator color="#060B19" />
                  ) : (
                    <Text style={styles.saveText}>{t("enable")}</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
            {outbox.length > 0 && (
              <View style={styles.outbox} testID="whatsapp-outbox">
                <Text style={styles.label}>RECENT MESSAGES</Text>
                {outbox.slice(0, 3).map((m, i) => (
                  <View key={i} style={styles.outItem}>
                    <Ionicons name="logo-whatsapp" size={14} color={COLORS.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.outMsg}>{m.message}</Text>
                      <Text style={styles.outMeta}>
                        {new Date(m.created_at).toLocaleString("en-IN")} ·{" "}
                        <Text style={{ color: COLORS.primary }}>{m.status}</Text>
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
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
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  row: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  cardTitle: { color: COLORS.text_primary, fontSize: 16, fontWeight: "700" },
  label: { color: COLORS.text_muted, fontSize: 10, letterSpacing: 1.2, fontWeight: "700" },
  value: { color: COLORS.text_primary, fontWeight: "700", fontSize: 14, marginTop: 4 },
  sub: { color: COLORS.text_secondary, fontSize: 12, marginTop: 4 },
  outBtn: {
    backgroundColor: "rgba(255,59,48,0.08)",
    borderColor: COLORS.danger,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  outText: { color: COLORS.danger, fontSize: 12, fontWeight: "700" },
  langGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: SPACING.md },
  langChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.surface_highlight,
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  langChipActive: {
    backgroundColor: "rgba(16,185,129,0.08)",
    borderColor: COLORS.primary,
  },
  langText: { color: COLORS.text_secondary, fontSize: 13, fontWeight: "600" },
  phoneRow: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.md },
  phoneInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.surface_highlight,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  phoneCC: { color: COLORS.text_secondary, fontWeight: "700" },
  phoneInput: { flex: 1, color: COLORS.text_primary, fontSize: 15, fontWeight: "600", paddingVertical: 6 },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { color: "#060B19", fontWeight: "800" },
  outbox: { marginTop: SPACING.md, gap: SPACING.sm },
  outItem: {
    flexDirection: "row",
    gap: SPACING.sm,
    backgroundColor: COLORS.surface_highlight,
    borderRadius: RADIUS.sm,
    padding: 10,
    alignItems: "flex-start",
  },
  outMsg: { color: COLORS.text_primary, fontSize: 12, lineHeight: 17 },
  outMeta: { color: COLORS.text_muted, fontSize: 10, marginTop: 4 },
});
