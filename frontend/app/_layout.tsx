import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/auth";
import { LangProvider } from "../src/translations";

export default function RootLayout() {
  return (
    <AuthProvider>
      <LangProvider>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "#060B19" },
              animation: "slide_from_right",
            }}
          />
        </SafeAreaProvider>
      </LangProvider>
    </AuthProvider>
  );
}
