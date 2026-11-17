import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HapticTab } from "@/components/haptic-tab";
import { COLORS } from "@/components/liftlog-ui";

const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: "grid-outline",
  program: "list-outline",
  workout: "add-circle-outline",
  progress: "trending-up-outline",
  library: "barbell-outline",
};

const labels: Record<string, string> = {
  index: "Today",
  program: "Program",
  workout: "Train",
  progress: "Progress",
  library: "Library",
};

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.ink,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarButton: HapticTab,
        tabBarLabel: labels[route.name],
        tabBarStyle: {
          paddingTop: 8,
          paddingBottom: bottomPadding,
          height: 64 + bottomPadding,
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.line,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "500", marginBottom: 2 },
        tabBarIcon: ({ color }) => <Ionicons name={icons[route.name]} size={18} color={color as string} />,
      })}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="program" />
      <Tabs.Screen name="workout" />
      <Tabs.Screen name="progress" />
      <Tabs.Screen name="library" />
    </Tabs>
  );
}
