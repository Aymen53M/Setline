import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { Alert, Platform, Pressable, Text, View } from "react-native";
import { COLORS, Eyebrow, Screen } from "@/components/liftlog-ui";
import { useWorkoutStore } from "@/lib/workout-store";

const dateLabel = (value: string) => new Date(value).toLocaleString(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default function WorkoutHistoryDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { history, ready, exercises, archivedExercises, deleteWorkout } = useWorkoutStore();
  const workout = history.find((record) => record.id === id);
  const exerciseById = useMemo(() => new Map(
    [...archivedExercises, ...exercises].map((exercise) => [exercise.id, exercise]),
  ), [archivedExercises, exercises]);

  if (!ready) return <Screen><Text style={{ color: COLORS.muted, fontSize: 14 }}>Loading workout history…</Text></Screen>;
  if (!workout) {
    return (
      <Screen>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="arrow-back" size={18} color={COLORS.ink} /><Text style={{ color: COLORS.ink }}>Back to progress</Text>
        </Pressable>
        <Text style={{ color: COLORS.ink, fontSize: 24, fontWeight: "500", marginTop: 24 }}>Workout not found</Text>
        <Text style={{ color: COLORS.muted, fontSize: 14, lineHeight: 21, marginTop: 8 }}>It may have been deleted from your history.</Text>
      </Screen>
    );
  }

  const groups = new Map<string, typeof workout.sets>();
  for (const set of workout.sets) {
    const current = groups.get(set.exerciseId) ?? [];
    current.push(set);
    groups.set(set.exerciseId, current);
  }
  const completedCount = workout.sets.filter((set) => set.completed).length;

  const removeWorkout = () => {
    const remove = () => {
      void deleteWorkout(workout.id).then(() => router.back()).catch(() => undefined);
    };
    const message = "Delete this historical workout? This cannot be undone.";
    if (Platform.OS === "web") {
      if ((globalThis as { confirm?: (text: string) => boolean }).confirm?.(message)) remove();
    } else {
      Alert.alert("Delete workout?", message, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: remove },
      ]);
    }
  };

  return (
    <Screen style={{ paddingBottom: 36 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to progress" onPress={() => router.back()} style={{ minHeight: 44, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name="arrow-back" size={18} color={COLORS.ink} /><Text style={{ color: COLORS.ink, fontSize: 13, fontWeight: "500" }}>Progress</Text>
      </Pressable>
      <View style={{ marginTop: 18 }}><Eyebrow>Saved workout</Eyebrow></View>
      <Text style={{ color: COLORS.ink, fontSize: 30, lineHeight: 36, fontWeight: "500", marginTop: 8 }}>{workout.day}</Text>
      <Text style={{ color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 6 }}>{dateLabel(workout.date)}</Text>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 20 }}>
        <Summary label="Completed sets" value={`${completedCount}/${workout.sets.length}`} />
        <Summary label="Duration" value={`${workout.durationMinutes} min`} />
      </View>
      {workout.notes ? <View style={{ marginTop: 16, borderRadius: 12, backgroundColor: COLORS.soft, padding: 14 }}><Text style={{ color: COLORS.ink, fontSize: 12, fontWeight: "500" }}>Session note</Text><Text style={{ color: COLORS.muted, fontSize: 13, lineHeight: 20, marginTop: 6 }}>{workout.notes}</Text></View> : null}

      {Array.from(groups, ([exerciseId, sets], index) => {
        const exercise = exerciseById.get(exerciseId);
        const name = sets.find((set) => set.exerciseNameSnapshot)?.exerciseNameSnapshot ?? exercise?.name ?? `Archived exercise (${exerciseId})`;
        const unit = exercise?.unit === "sec" ? "sec" : "kg";
        return (
          <View key={exerciseId} style={{ borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, overflow: "hidden", marginTop: 14 }}>
            <View style={{ padding: 14, backgroundColor: COLORS.soft }}>
              <Text style={{ color: COLORS.muted, fontSize: 11, fontWeight: "500" }}>EXERCISE {String(index + 1).padStart(2, "0")}</Text>
              <Text style={{ color: COLORS.ink, fontSize: 16, fontWeight: "500", marginTop: 5 }}>{name}</Text>
              {sets[0]?.exerciseTargetSnapshot ? <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 4 }}>{sets[0].exerciseTargetSnapshot}</Text> : null}
            </View>
            {sets.map((set) => (
              <View key={set.id} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: COLORS.line }}>
                <View style={{ width: 28, height: 28, borderRadius: 7, alignItems: "center", justifyContent: "center", backgroundColor: set.completed ? COLORS.ink : COLORS.soft }}>
                  {set.completed ? <Ionicons name="checkmark" size={15} color={COLORS.white} /> : <Text style={{ color: COLORS.muted, fontSize: 11 }}>{set.setNumber}</Text>}
                </View>
                <Text style={{ width: 48, color: COLORS.muted, fontSize: 12 }}>Set {set.setNumber}</Text>
                <Text style={{ flex: 1, color: COLORS.ink, fontSize: 12, fontVariant: ["tabular-nums"] }}>{set.weight} {unit} · {set.reps} {exercise?.unit === "sec" ? "sec" : "reps"} · RIR {set.rir}</Text>
                <Text style={{ color: COLORS.muted, fontSize: 11 }}>{set.completed ? "Done" : "Skipped"}</Text>
              </View>
            ))}
          </View>
        );
      })}

      <Pressable accessibilityRole="button" accessibilityLabel="Delete this workout from history" onPress={removeWorkout} style={{ minHeight: 48, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, marginTop: 24, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: COLORS.line }}>
        <Ionicons name="trash-outline" size={17} color={COLORS.muted} /><Text style={{ color: COLORS.muted, fontSize: 13, fontWeight: "500" }}>Delete workout</Text>
      </Pressable>
    </Screen>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <View style={{ flex: 1, minHeight: 76, justifyContent: "space-between", padding: 12, borderWidth: 1, borderColor: COLORS.line, borderRadius: 10 }}><Text style={{ color: COLORS.muted, fontSize: 11 }}>{label}</Text><Text style={{ color: COLORS.ink, fontSize: 18, fontWeight: "500" }}>{value}</Text></View>;
}
