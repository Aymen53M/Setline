import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { router, type Href } from "expo-router";
import { Alert, Platform, Pressable, Text, View } from "react-native";
import { Eyebrow, MultiLineChart, ProgressBar, Recommendation, Screen, SectionTitle, COLORS } from "@/components/liftlog-ui";
import { EXERCISES, getRecommendation, muscleGroups, totalVolume } from "@/lib/workout-data";
import { useWorkoutStore } from "@/lib/workout-store";

const filters = ["7d", "30d", "3mo", "6mo", "1y", "All"];
const maxWeightMuscles = ["All muscles", "Chest", "Shoulders", "Triceps", "Back", "Biceps", "Quads", "Hamstrings", "Glutes", "Calves", "Abs"];
const muscleAliases: Record<string, string[]> = {
  Chest: ["chest"], Shoulders: ["shoulder", "delt"], Triceps: ["tricep"], Back: ["back", "lat"],
  Biceps: ["bicep", "brachialis"], Quads: ["quad", "quadriceps", "knee"], Quadriceps: ["quad", "quadriceps", "knee"],
  Hamstrings: ["hamstring"], Glutes: ["glute"], Calves: ["calf"], Abs: ["ab", "core"],
};
const graphiteSeries = ["#111111", "#555555", "#777777", "#999999", "#B0B0B0", "#666666", "#888888", "#A0A0A0", "#777777", "#999999"];

const startOfWeek = (date: Date) => {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const mondayOffset = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - mondayOffset);
  return copy;
};

const weekKey = (date: string) => {
  const start = startOfWeek(new Date(date));
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
};

export default function ProgressScreen() {
  const { history, deleteWorkout, exercises, archivedExercises, ready } = useWorkoutStore();
  const [filter, setFilter] = useState("30d");
  const [selectedMuscle, setSelectedMuscle] = useState("Chest");
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [referenceTime, setReferenceTime] = useState(0);
  useEffect(() => {
    setReferenceTime(Date.now());
    const interval = setInterval(() => setReferenceTime(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);
  const allExercises = useMemo(() => {
    const byId = new Map(EXERCISES.map((exercise) => [exercise.id, exercise]));
    for (const exercise of archivedExercises) byId.set(exercise.id, exercise);
    for (const exercise of exercises) byId.set(exercise.id, exercise);
    return Array.from(byId.values());
  }, [archivedExercises, exercises]);
  const exerciseById = useMemo(() => new Map(allExercises.map((exercise) => [exercise.id, exercise])), [allExercises]);
  const chest = exerciseById.get("machine-chest-press") ?? EXERCISES.find((exercise) => exercise.name === "Machine Chest Press")!;
  const bestLoadedSet = history
    .flatMap((workout) => workout.sets.filter((set) => set.completed && set.weight > 0).map((set) => ({ set, date: workout.date })))
    .filter(({ set }) => exerciseById.get(set.exerciseId)?.unit !== "sec")
    .sort((left, right) => right.set.weight - left.set.weight || right.date.localeCompare(left.date))[0];
  const bestWeight = bestLoadedSet?.set.weight ?? null;
  const bestExerciseName = bestLoadedSet
    ? bestLoadedSet.set.exerciseNameSnapshot ?? exerciseById.get(bestLoadedSet.set.exerciseId)?.name ?? "Exercise"
    : null;

  const filteredWorkouts = useMemo(() => {
    const daysByFilter: Record<string, number> = { "7d": 7, "30d": 30, "3mo": 90, "6mo": 180, "1y": 365 };
    const cutoff = daysByFilter[filter];
    return history
      .filter((workout) => {
        if (!cutoff || !referenceTime) return true;
        const age = referenceTime - new Date(workout.date).getTime();
        return age >= 0 && age <= cutoff * 86400000;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filter, history, referenceTime]);

  const maxWeightChart = useMemo(() => {
    const weeks = Array.from(new Set(filteredWorkouts.map((workout) => weekKey(workout.date))));
    const selected = selectedMuscle === "All muscles" ? maxWeightMuscles.slice(1) : [selectedMuscle];
    const series = selected.map((muscle, index) => {
      const values = weeks.map((week) => {
        const weights = filteredWorkouts
          .filter((workout) => weekKey(workout.date) === week)
          .flatMap((workout) => workout.sets.filter((set) => {
            const exercise = exerciseById.get(set.exerciseId);
            const text = `${set.exerciseTargetSnapshot ?? exercise?.target ?? ""} ${set.exerciseSecondarySnapshot ?? exercise?.secondary ?? ""}`.toLowerCase();
            return set.completed && (muscleAliases[muscle] ?? []).some((alias) => text.includes(alias));
          }).map((set) => set.weight));
        return Math.max(0, ...weights);
      });
      return { label: muscle, color: graphiteSeries[index % graphiteSeries.length], values };
    });
    return {
      labels: weeks.map((week) => new Date(`${week}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })),
      series: weeks.length ? series : [],
    };
  }, [exerciseById, filteredWorkouts, selectedMuscle]);

  const muscleSetCounts = useMemo(
    () => muscleGroups.map((muscle) => {
      const aliases = muscleAliases[muscle] ?? [muscle.toLowerCase()];
      const count = filteredWorkouts.reduce((total, workout) => total + workout.sets.reduce((setTotal, set) => {
        if (!set.completed) return setTotal;
        const exercise = exerciseById.get(set.exerciseId);
        const primary = (set.exerciseTargetSnapshot ?? exercise?.target ?? "").toLowerCase();
        const assisting = (set.exerciseSecondarySnapshot ?? exercise?.secondary ?? "").toLowerCase();
        if (aliases.some((alias) => primary.includes(alias))) return setTotal + 1;
        if (aliases.some((alias) => assisting.includes(alias))) return setTotal + 0.5;
        return setTotal;
      }, 0), 0);
      return { muscle, count: Math.round(count * 10) / 10 };
    }),
    [exerciseById, filteredWorkouts],
  );
  const maxMuscle = Math.max(...muscleSetCounts.map((item) => item.count), 1);

  if (!ready) return <Screen><Eyebrow>The long view</Eyebrow><Text style={{ color: COLORS.muted, fontSize: 14, marginTop: 12 }}>Loading your saved progress…</Text></Screen>;

  return (
    <Screen>
      <Eyebrow>The long view</Eyebrow>
      <Text style={{ color: COLORS.ink, fontSize: 30, fontWeight: "500", marginTop: 8 }}>Progress</Text>
      <Text style={{ color: COLORS.muted, fontSize: 14, marginTop: 4 }}>Actual completed sets, kept over time</Text>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 24 }}>
        <View style={{ flex: 1, borderRadius: 12, borderWidth: 1, borderColor: COLORS.line, padding: 12, minHeight: 100, justifyContent: "space-between" }}>
          <Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: "400" }}>All-time volume</Text>
          <Text style={{ color: COLORS.ink, fontSize: 24, fontWeight: "500", fontVariant: ["tabular-nums"] }}>{totalVolume(history) === 0 ? "0" : `${Math.round(totalVolume(history) / 100) / 10}k`}</Text>
          <Text style={{ color: COLORS.muted, fontSize: 11 }}>kg moved</Text>
        </View>
        <View style={{ flex: 1, borderRadius: 12, borderWidth: 1, borderColor: COLORS.line, padding: 12, minHeight: 100, justifyContent: "space-between" }}>
          <Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: "400" }}>Best load</Text>
          <Text style={{ color: COLORS.ink, fontSize: 24, fontWeight: "500", fontVariant: ["tabular-nums"] }}>{bestWeight === null ? "—" : `${bestWeight} kg`}</Text>
          <Text style={{ color: COLORS.muted, fontSize: 11 }} numberOfLines={1}>{bestWeight === null ? "No loaded sets yet" : bestExerciseName}</Text>
        </View>
      </View>

      <SectionTitle title="Weekly maximum weight" action={selectedMuscle === "All muscles" ? "All muscles" : selectedMuscle} />
      <View style={{ borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, padding: 12 }}>
        <Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: "400" }}>Choose one muscle or compare all</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {maxWeightMuscles.map((muscle) => (
            <Pressable key={muscle} onPress={() => setSelectedMuscle(muscle)} accessibilityRole="button" accessibilityState={{ selected: selectedMuscle === muscle }} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: selectedMuscle === muscle ? COLORS.ink : COLORS.soft }}>
              <Text style={{ color: selectedMuscle === muscle ? COLORS.white : COLORS.ink, fontSize: 12, fontWeight: "500" }}>{muscle}</Text>
            </Pressable>
          ))}
        </View>
        {maxWeightChart.labels.length ? (
          <>
            <View style={{ marginTop: 16 }}><MultiLineChart series={maxWeightChart.series} labels={maxWeightChart.labels} /></View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
              {maxWeightChart.series.map((item) => <View key={item.label} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color }} /><Text style={{ color: COLORS.muted, fontSize: 11, fontWeight: "400" }}>{item.label}</Text></View>)}
            </View>
          </>
        ) : (
          <View style={{ minHeight: 108, justifyContent: "center", alignItems: "center", marginTop: 12, borderTopWidth: 1, borderColor: COLORS.line }}>
            <Text style={{ color: COLORS.muted, fontSize: 13 }}>No completed sets in this period</Text>
          </View>
        )}
        <Text style={{ color: COLORS.muted, fontSize: 11, marginTop: 12 }}>Highest completed-set load per week · {filter}</Text>
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
        {filters.map((item) => <Pressable key={item} onPress={() => setFilter(item)} accessibilityRole="button" accessibilityState={{ selected: filter === item }} style={{ minHeight: 44, flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 8, borderRadius: 8, backgroundColor: filter === item ? COLORS.ink : COLORS.soft }}><Text style={{ color: filter === item ? COLORS.white : COLORS.muted, fontSize: 11, fontWeight: "500" }}>{item}</Text></Pressable>)}
      </View>

      <SectionTitle title="Next move" />
      <Recommendation {...getRecommendation(chest, history)} />
      <SectionTitle title="Muscle set estimate" action={filter} />
      <View style={{ borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, padding: 12 }}>
        <Text style={{ color: COLORS.muted, fontSize: 12, lineHeight: 18, marginBottom: 14 }}>Selected period · direct sets count as 1, assisting muscles as 0.5.</Text>
        {muscleSetCounts.map((item) => <ProgressBar key={item.muscle} label={item.muscle} right={`${item.count} sets`} value={(item.count / maxMuscle) * 100} color={COLORS.ink} />)}
      </View>

      <SectionTitle title="Session history" action={history.length > 5 ? (showAllHistory ? "Show latest 5" : `View all ${history.length}`) : undefined} onAction={history.length > 5 ? () => setShowAllHistory((value) => !value) : undefined} />
      <View style={{ borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, overflow: "hidden" }}>
        {history.slice(0, showAllHistory ? history.length : 5).map((workout, index, visibleHistory) => (
          <View key={workout.id} style={{ padding: 12, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: index === visibleHistory.length - 1 ? 0 : 1, borderBottomColor: COLORS.line }}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Open ${workout.day} workout details`} onPress={() => router.push({ pathname: "/history/[id]", params: { id: workout.id } } as unknown as Href)} style={{ flex: 1, minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: COLORS.soft, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: COLORS.ink, fontSize: 12, fontWeight: "500" }}>{new Date(workout.date).getDate()}</Text>
                <Text style={{ color: COLORS.muted, fontSize: 11, fontWeight: "400" }}>{new Date(workout.date).toLocaleDateString(undefined, { month: "short" })}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: COLORS.ink, fontSize: 14, fontWeight: "500" }}>{workout.day}</Text>
                <Text style={{ color: COLORS.muted, fontSize: 11, marginTop: 4 }}>{workout.sets.filter((set) => set.completed).length} completed sets · {Math.round(totalVolume([workout]))} kg volume</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.muted} />
            </Pressable>
            <Pressable onPress={() => confirmDelete(() => void deleteWorkout(workout.id).catch(() => undefined))} accessibilityRole="button" accessibilityLabel={`Delete ${workout.day} workout`} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Ionicons name="trash-outline" size={18} color={COLORS.muted} /></Pressable>
          </View>
        ))}
        {history.length === 0 ? <Text style={{ color: COLORS.muted, fontSize: 13, padding: 16 }}>No sessions saved yet</Text> : null}
      </View>
    </Screen>
  );

  function confirmDelete(onConfirm: () => void) {
    const message = "Delete this historical workout? This cannot be undone.";
    if (Platform.OS === "web") {
      if ((globalThis as { confirm?: (text: string) => boolean }).confirm?.(message)) onConfirm();
    } else {
      Alert.alert("Delete workout?", message, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: onConfirm },
      ]);
    }
  }
}
