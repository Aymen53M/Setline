import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { ExerciseVisual, Eyebrow, Screen, COLORS } from "@/components/liftlog-ui";
import { type Exercise } from "@/lib/workout-data";
import { useWorkoutStore } from "@/lib/workout-store";

const filters = ["All", "Push", "Pull", "Legs", "Core"];
const familyForFilter: Record<string, Exercise["family"] | null> = {
  All: null,
  Push: "push",
  Pull: "pull",
  Legs: "legs",
  Core: "core",
};

export default function LibraryScreen() {
  const { exercises, deleteExercise, ready } = useWorkoutStore();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");

  const filtered = useMemo(
    () => exercises.filter((exercise) => {
      const text = `${exercise.name} ${exercise.target} ${exercise.equipment}`.toLowerCase();
      return text.includes(query.toLowerCase()) && (!familyForFilter[filter] || exercise.family === familyForFilter[filter]);
    }),
    [exercises, filter, query],
  );

  if (!ready) return <Screen><Eyebrow>Your training log</Eyebrow><Text style={{ color: COLORS.muted, fontSize: 14, marginTop: 12 }}>Loading your saved exercise library…</Text></Screen>;

  const removeExercise = (exercise: Exercise) => {
    const message = `Remove ${exercise.name} from your library and future programs? Its saved workout history will be kept.`;
    const remove = () => void deleteExercise(exercise.id).catch(() => undefined);
    if (Platform.OS === "web") {
      if ((globalThis as { confirm?: (text: string) => boolean }).confirm?.(message)) remove();
    } else {
      Alert.alert("Delete exercise?", message, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: remove },
      ]);
    }
  };

  return (
    <Screen>
      <Eyebrow>Your training log</Eyebrow>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginTop: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: COLORS.ink, fontSize: 30, fontWeight: "500" }}>Exercise library</Text>
          <Text style={{ color: COLORS.muted, fontSize: 14, marginTop: 4 }}>A working record of your movements</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Add exercise" onPress={() => router.push("/exercise/editor")} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.ink, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 }}>
          <Ionicons name="add" size={18} color={COLORS.white} />
          <Text style={{ color: COLORS.white, fontSize: 13, fontWeight: "500" }}>Add</Text>
        </Pressable>
      </View>

      <View style={{ minHeight: 44, marginTop: 24, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, paddingHorizontal: 12, flexDirection: "row", alignItems: "center" }}>
        <Ionicons name="search-outline" size={18} color={COLORS.muted} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Search exercises, muscles, equipment" placeholderTextColor={COLORS.muted} style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 8, color: COLORS.ink, fontSize: 14 }} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 12 }}>
        {filters.map((item) => (
          <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: filter === item }} onPress={() => setFilter(item)} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 9, borderWidth: 1, borderColor: filter === item ? COLORS.ink : COLORS.line, backgroundColor: filter === item ? COLORS.ink : COLORS.white }}>
            <Text style={{ color: filter === item ? COLORS.white : COLORS.muted, fontSize: 12, fontWeight: "500" }}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 28, marginBottom: 12 }}>
        <Text style={{ color: COLORS.ink, fontSize: 18, fontWeight: "500" }}>{filtered.length} movements</Text>
        <Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: "400" }}>{ready ? "Saved on this device" : "Loading library…"}</Text>
      </View>

      {filtered.map((exercise) => (
        <View key={exercise.id} style={{ borderWidth: 1, borderColor: COLORS.line, borderRadius: 14, overflow: "hidden", marginBottom: 12, backgroundColor: COLORS.white }}>
          <Pressable onPress={() => router.push({ pathname: "/exercise/[id]", params: { id: exercise.id } })} accessibilityRole="button" accessibilityLabel={`View ${exercise.name}`}>
            <ExerciseVisual exercise={exercise} compact />
            <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 }}>
              <Text style={{ color: COLORS.ink, fontSize: 16, fontWeight: "500" }}>{exercise.name}</Text>
              <Text style={{ color: COLORS.muted, fontSize: 13, fontWeight: "400", marginTop: 4 }}>{exercise.target} · {exercise.secondary}</Text>
              <Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: "400", marginTop: 8 }}>{exercise.equipment} · {exercise.sets} × {exercise.minReps}–{exercise.maxReps}{exercise.unit === "sec" ? " sec" : " reps"}</Text>
              <Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: "400", marginTop: 4 }}>RIR {exercise.rirMin ?? 1}–{exercise.rirMax ?? 2} · Rest {exercise.restSeconds ?? 90}s{exercise.supersetGroup ? " · Superset" : ""}</Text>
            </View>
          </Pressable>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8, paddingHorizontal: 12, paddingBottom: 12 }}>
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/exercise/editor", params: { id: exercise.id } })} style={{ minHeight: 44, justifyContent: "center", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 9, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white }}>
              <Ionicons name="create-outline" size={18} color={COLORS.ink} />
              <Text style={{ color: COLORS.ink, fontSize: 12, fontWeight: "500" }}>Edit</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${exercise.name}`} onPress={() => removeExercise(exercise)} style={{ minHeight: 44, justifyContent: "center", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 9, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white }}>
              <Ionicons name="trash-outline" size={18} color={COLORS.muted} />
              <Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: "500" }}>Delete</Text>
            </Pressable>
          </View>
        </View>
      ))}

      {ready && filtered.length === 0 ? <View style={{ alignItems: "center", paddingVertical: 40 }}><Text style={{ color: COLORS.ink, fontSize: 17, fontWeight: "500" }}>No exercises found</Text><Text style={{ color: COLORS.muted, fontSize: 13, marginTop: 8 }}>Try another search or add a movement</Text></View> : null}
    </Screen>
  );
}
