import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
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
import { api, formatRelTime } from "../src/api";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

type RatesDoc = {
  rates: Record<string, number>;
  repo_rate: number;
  spreads: Record<string, number>;
  source: string;
  last_updated_at: string | null;
  last_checked_at: string | null;
};

type Card = {
  id: string;
  name: string;
  issuer: string;
  color: string;
  annual_fee: number;
  rewards: { grocery: number; travel: number; fuel: number; dining: number };
  highlight: string;
};

const blankCard = (): Card => ({
  id: "",
  name: "",
  issuer: "",
  color: "#1B3A6B",
  annual_fee: 0,
  rewards: { grocery: 1, travel: 1, fuel: 1, dining: 1 },
  highlight: "",
});

export default function AdminScreen() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);

  const [rates, setRates] = useState<RatesDoc | null>(null);
  const [repoInput, setRepoInput] = useState("");
  const [spreads, setSpreads] = useState({ home: "", car: "", personal: "" });

  const [cards, setCards] = useState<Card[]>([]);
  const [editing, setEditing] = useState<Card | null>(null);
  const [isNew, setIsNew] = useState(false);

  const adminFetch = useCallback(
    async (path: string, init?: RequestInit) => {
      const res = await fetch(`${BASE}/api${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": token,
          ...(init?.headers || {}),
        },
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`${res.status}: ${body}`);
      }
      return res.json();
    },
    [token]
  );

  const loadAll = useCallback(async () => {
    setBusy(true);
    try {
      const r = await api.marketRates();
      setRates(r);
      setRepoInput(String(r.repo_rate));
      setSpreads({
        home: String(r.spreads.home),
        car: String(r.spreads.car),
        personal: String(r.spreads.personal),
      });
      const c = await api.listCards();
      setCards(c as Card[]);
    } catch (e: any) {
      Alert.alert("Failed to load", String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }, []);

  const unlock = async () => {
    if (!token.trim()) return;
    setBusy(true);
    try {
      // Probe an admin endpoint to validate token
      await adminFetch("/admin/market-rates/refresh-now", { method: "POST" });
      setUnlocked(true);
      await loadAll();
    } catch (e: any) {
      Alert.alert("Invalid token", e?.message || "Could not authenticate");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (unlocked) loadAll();
  }, [unlocked, loadAll]);

  const saveRates = async () => {
    const repo = parseFloat(repoInput);
    const sp = {
      home: parseFloat(spreads.home),
      car: parseFloat(spreads.car),
      personal: parseFloat(spreads.personal),
    };
    if (!Number.isFinite(repo) || Object.values(sp).some((v) => !Number.isFinite(v))) {
      Alert.alert("Invalid", "All numeric fields must be filled");
      return;
    }
    setBusy(true);
    try {
      await adminFetch("/admin/market-rates", {
        method: "POST",
        body: JSON.stringify({ repo_rate: repo, spreads: sp }),
      });
      await loadAll();
      Alert.alert("Saved", "Market rates updated.");
    } catch (e: any) {
      Alert.alert("Save failed", String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const refreshFromRbi = async () => {
    setBusy(true);
    try {
      const r = await adminFetch("/admin/market-rates/refresh-now", { method: "POST" });
      await loadAll();
      Alert.alert(
        "Refreshed",
        `Source: ${r.source}\nRates: home ${r.rates?.home}% · car ${r.rates?.car}% · personal ${r.rates?.personal}%`
      );
    } catch (e: any) {
      Alert.alert("Refresh failed", String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const upsertCard = async () => {
    if (!editing) return;
    if (!editing.id.trim() || !editing.name.trim() || !editing.issuer.trim()) {
      Alert.alert("Missing", "id, name, issuer are required");
      return;
    }
    setBusy(true);
    try {
      await adminFetch("/admin/cards", {
        method: "POST",
        body: JSON.stringify(editing),
      });
      setEditing(null);
      await loadAll();
    } catch (e: any) {
      Alert.alert("Save failed", String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const deleteCard = (id: string) => {
    Alert.alert("Delete card?", `Remove ${id} from catalog`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await adminFetch(`/admin/cards/${id}`, { method: "DELETE" });
            await loadAll();
          } catch (e: any) {
            Alert.alert("Delete failed", String(e?.message || e));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  // -------- Lock screen --------
  if (!unlocked) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.bar}>
          <TouchableOpacity onPress={() => router.back()} testID="admin-back">
            <Ionicons name="chevron-back" size={26} color={COLORS.text_primary} />
          </TouchableOpacity>
          <Text style={styles.barTitle}>Admin Console</Text>
          <View style={{ width: 26 }} />
        </View>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1, justifyContent: "center", padding: SPACING.xl }}
        >
          <Ionicons name="lock-closed" size={36} color={COLORS.primary} style={{ alignSelf: "center" }} />
          <Text style={styles.lockTitle}>Restricted Area</Text>
          <Text style={styles.lockSub}>Enter the admin token to manage market rates and the card catalog.</Text>
          <TextInput
            value={token}
            onChangeText={setToken}
            placeholder="X-Admin-Token"
            placeholderTextColor={COLORS.text_muted}
            secureTextEntry
            autoCapitalize="none"
            style={styles.input}
            testID="admin-token-input"
          />
          <TouchableOpacity
            style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
            disabled={busy}
            onPress={unlock}
            testID="admin-unlock-btn"
          >
            {busy ? (
              <ActivityIndicator color="#060B19" />
            ) : (
              <>
                <Ionicons name="key" size={16} color="#060B19" />
                <Text style={styles.primaryBtnText}>Unlock</Text>
              </>
            )}
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // -------- Main admin --------
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.bar}>
        <TouchableOpacity onPress={() => router.back()} testID="admin-back">
          <Ionicons name="chevron-back" size={26} color={COLORS.text_primary} />
        </TouchableOpacity>
        <Text style={styles.barTitle}>Admin Console</Text>
        <TouchableOpacity onPress={() => setUnlocked(false)} testID="admin-lock">
          <Ionicons name="lock-closed" size={22} color={COLORS.text_secondary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ---------- Market rates ---------- */}
        <Text style={styles.section}>Market Rates</Text>
        {rates && (
          <View style={styles.card}>
            <Text style={styles.meta}>
              Source: <Text style={styles.metaStrong}>{rates.source}</Text> · updated {formatRelTime(rates.last_updated_at)}
            </Text>
            <View style={styles.row}>
              <Text style={styles.label}>RBI Repo (%)</Text>
              <TextInput
                value={repoInput}
                onChangeText={setRepoInput}
                keyboardType="decimal-pad"
                style={styles.numInput}
                testID="admin-repo-input"
              />
            </View>
            {(["home", "car", "personal"] as const).map((k) => (
              <View key={k} style={styles.row}>
                <Text style={styles.label}>Spread · {k} (%)</Text>
                <TextInput
                  value={spreads[k]}
                  onChangeText={(t) => setSpreads({ ...spreads, [k]: t })}
                  keyboardType="decimal-pad"
                  style={styles.numInput}
                  testID={`admin-spread-${k}`}
                />
              </View>
            ))}
            <View style={styles.divider} />
            <Text style={styles.metaStrong}>
              Derived: home {(parseFloat(repoInput) + parseFloat(spreads.home || "0")).toFixed(2)}% · car{" "}
              {(parseFloat(repoInput) + parseFloat(spreads.car || "0")).toFixed(2)}% · personal{" "}
              {(parseFloat(repoInput) + parseFloat(spreads.personal || "0")).toFixed(2)}%
            </Text>
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.primaryBtn} onPress={saveRates} disabled={busy} testID="admin-save-rates">
                <Ionicons name="save" size={16} color="#060B19" />
                <Text style={styles.primaryBtnText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ghostBtn} onPress={refreshFromRbi} disabled={busy} testID="admin-refresh-rbi">
                <Ionicons name="cloud-download" size={16} color={COLORS.primary} />
                <Text style={styles.ghostBtnText}>Refresh from RBI</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ---------- Cards ---------- */}
        <View style={styles.sectionHeader}>
          <Text style={styles.section}>Card Catalog ({cards.length})</Text>
          <TouchableOpacity
            onPress={() => {
              setEditing(blankCard());
              setIsNew(true);
            }}
            style={styles.addBtn}
            testID="admin-add-card"
          >
            <Ionicons name="add-circle" size={20} color={COLORS.primary} />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        {cards.map((c) => (
          <View key={c.id} style={styles.cardRow}>
            <View style={[styles.colorChip, { backgroundColor: c.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardName}>{c.name}</Text>
              <Text style={styles.cardMeta}>
                {c.issuer} · Fee ₹{c.annual_fee} · G{c.rewards.grocery} T{c.rewards.travel} F{c.rewards.fuel} D{c.rewards.dining}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setEditing(c);
                setIsNew(false);
              }}
              style={styles.iconBtn}
              testID={`admin-edit-${c.id}`}
            >
              <Ionicons name="create" size={20} color={COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteCard(c.id)} style={styles.iconBtn} testID={`admin-delete-${c.id}`}>
              <Ionicons name="trash" size={20} color="#E74C3C" />
            </TouchableOpacity>
          </View>
        ))}

        {busy && <ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.lg }} />}
      </ScrollView>

      {/* ---------- Card edit modal ---------- */}
      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{isNew ? "Add card" : "Edit card"}</Text>
              <TouchableOpacity onPress={() => setEditing(null)}>
                <Ionicons name="close" size={24} color={COLORS.text_primary} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: SPACING.lg }}>
              {editing && (
                <>
                  <Text style={styles.label}>ID (slug)</Text>
                  <TextInput
                    value={editing.id}
                    editable={isNew}
                    onChangeText={(t) => setEditing({ ...editing, id: t })}
                    style={[styles.input, !isNew && { opacity: 0.5 }]}
                    placeholder="e.g. hdfc_regalia"
                    placeholderTextColor={COLORS.text_muted}
                  />
                  <Text style={styles.label}>Name</Text>
                  <TextInput
                    value={editing.name}
                    onChangeText={(t) => setEditing({ ...editing, name: t })}
                    style={styles.input}
                    placeholderTextColor={COLORS.text_muted}
                  />
                  <Text style={styles.label}>Issuer</Text>
                  <TextInput
                    value={editing.issuer}
                    onChangeText={(t) => setEditing({ ...editing, issuer: t })}
                    style={styles.input}
                    placeholderTextColor={COLORS.text_muted}
                  />
                  <Text style={styles.label}>Color (hex)</Text>
                  <TextInput
                    value={editing.color}
                    onChangeText={(t) => setEditing({ ...editing, color: t })}
                    style={styles.input}
                    placeholder="#1B3A6B"
                    placeholderTextColor={COLORS.text_muted}
                  />
                  <Text style={styles.label}>Annual Fee (₹)</Text>
                  <TextInput
                    value={String(editing.annual_fee)}
                    onChangeText={(t) =>
                      setEditing({ ...editing, annual_fee: parseFloat(t) || 0 })
                    }
                    keyboardType="numeric"
                    style={styles.input}
                  />
                  {(["grocery", "travel", "fuel", "dining"] as const).map((k) => (
                    <View key={k}>
                      <Text style={styles.label}>Reward % · {k}</Text>
                      <TextInput
                        value={String(editing.rewards[k])}
                        onChangeText={(t) =>
                          setEditing({
                            ...editing,
                            rewards: { ...editing.rewards, [k]: parseFloat(t) || 0 },
                          })
                        }
                        keyboardType="decimal-pad"
                        style={styles.input}
                      />
                    </View>
                  ))}
                  <Text style={styles.label}>Highlight (marketing line)</Text>
                  <TextInput
                    value={editing.highlight}
                    onChangeText={(t) => setEditing({ ...editing, highlight: t })}
                    style={[styles.input, { height: 60 }]}
                    multiline
                    placeholderTextColor={COLORS.text_muted}
                  />
                </>
              )}
            </ScrollView>
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.ghostBtn} onPress={() => setEditing(null)}>
                <Text style={styles.ghostBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={upsertCard} disabled={busy} testID="admin-save-card">
                <Ionicons name="save" size={16} color="#060B19" />
                <Text style={styles.primaryBtnText}>{isNew ? "Add" : "Update"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    borderBottomColor: COLORS.border,
  },
  barTitle: { color: COLORS.text_primary, fontSize: 16, fontWeight: "700" },
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  section: {
    color: COLORS.text_primary,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: SPACING.md,
    marginTop: SPACING.md,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  meta: { color: COLORS.text_secondary, fontSize: 12, marginBottom: SPACING.md },
  metaStrong: { color: COLORS.text_primary, fontWeight: "700" },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.sm,
  },
  label: { color: COLORS.text_secondary, fontSize: 12, marginTop: SPACING.sm },
  numInput: {
    color: COLORS.text_primary,
    backgroundColor: COLORS.surface_highlight,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    width: 90,
    textAlign: "right",
    fontWeight: "700",
  },
  input: {
    color: COLORS.text_primary,
    backgroundColor: COLORS.surface_highlight,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    marginTop: 4,
    marginBottom: SPACING.sm,
  },
  btnRow: {
    flexDirection: "row",
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
  },
  primaryBtnText: { color: "#060B19", fontWeight: "800" },
  ghostBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderColor: COLORS.primary,
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
  },
  ghostBtnText: { color: COLORS.primary, fontWeight: "700" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  addBtnText: { color: COLORS.primary, fontWeight: "700" },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  colorChip: { width: 12, height: 32, borderRadius: 4 },
  cardName: { color: COLORS.text_primary, fontWeight: "700", fontSize: 14 },
  cardMeta: { color: COLORS.text_muted, fontSize: 11, marginTop: 2 },
  iconBtn: { padding: 8 },
  lockTitle: {
    color: COLORS.text_primary,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    marginTop: SPACING.md,
  },
  lockSub: {
    color: COLORS.text_secondary,
    textAlign: "center",
    marginVertical: SPACING.md,
    fontSize: 13,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    padding: SPACING.lg,
    maxHeight: "92%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  modalTitle: { color: COLORS.text_primary, fontSize: 18, fontWeight: "800" },
});
