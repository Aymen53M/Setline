import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Image, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Eyebrow, MiniBars, Screen, SectionTitle, COLORS } from "@/components/liftlog-ui";
import { DAY_META, WEEK_SCHEDULE, getWorkoutDayMeta, totalVolume, type WorkoutDay } from "@/lib/workout-data";
import { useWorkoutStore } from "@/lib/workout-store";

const formatKg = (value: number) => `${Math.round(value).toLocaleString()} kg`;
const formatDate = (date: string) => new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const startOfDay = (value: number) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

function currentStreak(history: { date: string }[], now: number) {
  const days = new Set(history.map((workout) => startOfDay(new Date(workout.date).getTime())));
  let cursor = startOfDay(now);
  if (!days.has(cursor)) cursor -= 86400000;
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor -= 86400000;
  }
  return streak;
}

export default function DashboardScreen() {
  const { history, ready, bodyWeights, draft, clearDraft, addBodyWeight, deleteBodyWeight } = useWorkoutStore();
  const [now, setNow] = useState(() => Date.now());
  const [weightInput, setWeightInput] = useState("");
  const [weightUnit, setWeightUnit] = useState<"kg" | "lb">("kg");
  const [showWeightHistory, setShowWeightHistory] = useState(false);
  const [showDiscardConfirmation, setShowDiscardConfirmation] = useState(false);
  const discardDraft = () => setShowDiscardConfirmation(true);
  const confirmDiscardDraft = () => {
    setShowDiscardConfirmation(false);
    void clearDraft().catch(() => undefined);
  };
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);
  const week = useMemo(
    () => history.filter((workout) => {
      const age = now - new Date(workout.date).getTime();
      return age >= 0 && age < 7 * 86400000;
    }),
    [history, now],
  );
  const volume = totalVolume(week);
  const setCount = week.reduce((sum, workout) => sum + workout.sets.filter((set) => set.completed).length, 0);
  const streak = currentStreak(history, now);
  const nowDate = new Date(now);
  const scheduleIndex = (nowDate.getDay() + 6) % 7;
  const todayScheduleDay = WEEK_SCHEDULE[scheduleIndex]?.day;
  const upcoming = [...WEEK_SCHEDULE.slice(scheduleIndex), ...WEEK_SCHEDULE.slice(0, scheduleIndex)].find((slot) => slot.workout);
  const nextWorkout: WorkoutDay = upcoming?.workout ?? "Push";
  const dateLabel = nowDate.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  const recentSessions = useMemo(
    () => [...history].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3),
    [history],
  );
  const dailyVolumes = useMemo(() => {
    const today = new Date(startOfDay(now));
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(today);
      day.setDate(today.getDate() - (6 - index));
      const dayStart = day.getTime();
      const dayEnd = new Date(day);
      dayEnd.setDate(day.getDate() + 1);
      return totalVolume(history.filter((workout) => {
        const timestamp = new Date(workout.date).getTime();
        return timestamp >= dayStart && timestamp < dayEnd.getTime();
      }));
    });
  }, [history, now]);
  const dayLabels = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startOfDay(now));
    date.setDate(date.getDate() - (6 - index));
    return date.toLocaleDateString(undefined, { weekday: "narrow" });
  }), [now]);

  if (!ready) return <Screen><Eyebrow>{dateLabel}</Eyebrow><Text style={{ color: COLORS.muted, fontSize: 14, marginTop: 12 }}>Loading your training log…</Text></Screen>;

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
        <View>
          <Eyebrow>{dateLabel}</Eyebrow>
          <Text style={{ color: COLORS.ink, fontSize: 32, lineHeight: 38, fontWeight: "500", marginTop: 8 }}>Today</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 4 }}>
          <Image source={require("../../assets/images/icon.png")} style={{ width: 32, height: 32, borderRadius: 8 }} />
          <Text style={{ color: COLORS.ink, fontSize: 17, fontWeight: "600" }}>Setline</Text>
        </View>
      </View>
      <Text style={{ color: COLORS.muted, fontSize: 14, lineHeight: 20, marginTop: 8 }}>A clear record of every set and session</Text>

      {draft ? (
        <View style={{ marginTop: 24, backgroundColor: COLORS.ink, borderRadius: 18, padding: 20 }}>
          <Text style={{ color: "#C8C8C8", fontSize: 12, fontWeight: "400" }}>Workout in progress</Text>
          <Text style={{ color: COLORS.white, fontSize: 26, lineHeight: 32, fontWeight: "500", marginTop: 8 }}>{getWorkoutDayMeta(draft.day).short}</Text>
          <Text style={{ color: "#C8C8C8", fontSize: 13, lineHeight: 19, marginTop: 4 }}>
            {draft.sets.filter((set) => set.completed).length} sets logged · Your session is saved on this device
          </Text>
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/workout/[day]", params: { day: draft.day } })} style={{ marginTop: 16, backgroundColor: COLORS.white, borderRadius: 10, minHeight: 48, paddingVertical: 14, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: COLORS.ink, fontSize: 14, fontWeight: "500" }}>Resume workout</Text>
          </Pressable>
          {showDiscardConfirmation ? (
            <View style={{ marginTop: 8, padding: 12, borderRadius: 10, backgroundColor: COLORS.white }}>
              <Text style={{ color: COLORS.ink, fontSize: 13, fontWeight: "500" }}>Discard this unfinished workout?</Text>
              <Text style={{ color: COLORS.muted, fontSize: 12, lineHeight: 17, marginTop: 4 }}>Completed workout history will remain unchanged.</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                <Pressable accessibilityRole="button" onPress={() => setShowDiscardConfirmation(false)} style={{ flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: COLORS.soft }}>
                  <Text style={{ color: COLORS.ink, fontSize: 12, fontWeight: "500" }}>Keep workout</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={confirmDiscardDraft} style={{ flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: COLORS.ink }}>
                  <Text style={{ color: COLORS.white, fontSize: 12, fontWeight: "500" }}>Discard draft</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable accessibilityRole="button" accessibilityLabel="Discard unfinished workout" onPress={discardDraft} style={{ alignSelf: "center", minHeight: 44, justifyContent: "center", paddingHorizontal: 12, paddingVertical: 8 }}>
              <Text style={{ color: "#C8C8C8", fontSize: 12, fontWeight: "400" }}>Discard unfinished workout</Text>
            </Pressable>
          )}
        </View>
      ) : null}

      <View style={{ marginTop: 24, backgroundColor: COLORS.ink, borderRadius: 18, padding: 20 }}>
        <Text style={{ color: "#C8C8C8", fontSize: 12, fontWeight: "400" }}>Next session</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 8 }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ color: COLORS.white, fontSize: 28, lineHeight: 33, fontWeight: "500" }}>{DAY_META[nextWorkout].short}</Text>
            <Text style={{ color: "#C8C8C8", fontSize: 13, lineHeight: 19, marginTop: 4 }}>{DAY_META[nextWorkout].muscles}</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/workout/[day]", params: { day: nextWorkout } })} style={{ marginTop: 16, backgroundColor: COLORS.white, borderRadius: 10, paddingVertical: 16, alignItems: "center" }}>
          <Text style={{ color: COLORS.ink, fontSize: 14, fontWeight: "500" }}>Start {DAY_META[nextWorkout].short}</Text>
        </Pressable>
      </View>

      <SectionTitle title="Last 7 days" />
      <View style={{ borderWidth: 1, borderColor: COLORS.line, borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center" }}>
        <SummaryStat label="Sessions" value={String(week.length)} note="last 7 days" />
        <View style={{ width: 1, height: 44, backgroundColor: COLORS.line, marginHorizontal: 8 }} />
        <SummaryStat label="Sets" value={String(setCount)} note="completed" />
        <View style={{ width: 1, height: 44, backgroundColor: COLORS.line, marginHorizontal: 8 }} />
        <SummaryStat label="Streak" value={`${streak}d`} note="consecutive" />
      </View>

      <SectionTitle title="Body weight" action={`${bodyWeights.length} logged`} />
      <View style={{ borderWidth: 1, borderColor: COLORS.line, borderRadius: 16, padding: 16, backgroundColor: COLORS.white }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: "400" }}>Latest measurement</Text>
            <Text style={{ color: COLORS.ink, fontSize: 24, lineHeight: 30, fontWeight: "500", marginTop: 4 }}>
              {bodyWeights[0] ? `${bodyWeights[0].weight} ${bodyWeights[0].unit}` : "Not logged"}
            </Text>
            <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 4 }}>
              {bodyWeights[0] ? formatDate(bodyWeights[0].date) : "Add a measurement to track your trend"}
            </Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: 4, marginBottom: 4 }}>
              {(["kg", "lb"] as const).map((unit) => (
                <Pressable key={unit} accessibilityRole="radio" accessibilityLabel={`Log body weight in ${unit}`} accessibilityState={{ checked: weightUnit === unit }} onPress={() => setWeightUnit(unit)} style={{ minWidth: 34, minHeight: 32, borderRadius: 7, alignItems: "center", justifyContent: "center", backgroundColor: weightUnit === unit ? COLORS.ink : COLORS.soft }}>
                  <Text style={{ color: weightUnit === unit ? COLORS.white : COLORS.ink, fontSize: 11, fontWeight: "500" }}>{unit}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              accessibilityLabel={`Body weight in ${weightUnit}`}
              value={weightInput}
              onChangeText={setWeightInput}
              placeholder={weightUnit}
              placeholderTextColor={COLORS.muted}
              keyboardType="decimal-pad"
              style={{ width: 72, minHeight: 44, backgroundColor: COLORS.soft, borderColor: COLORS.line, borderWidth: 1, borderRadius: 9, paddingVertical: 12, paddingHorizontal: 8, textAlign: "center", color: COLORS.ink, fontSize: 14, fontWeight: "500" }}
            />
          </View>
          <Pressable accessibilityRole="button" onPress={async () => {
            const value = Number(weightInput.replace(",", "."));
            if (value > 0) {
              try {
                await addBodyWeight(value, weightUnit);
                setWeightInput("");
              } catch {
                // The store displays a persistent retry banner.
              }
            }
          }} style={{ minHeight: 44, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.ink, borderRadius: 9, paddingHorizontal: 16, paddingVertical: 12 }}>
            <Text style={{ color: COLORS.white, fontSize: 13, fontWeight: "500" }}>Log</Text>
          </Pressable>
        </View>
        {bodyWeights.length ? (
          <>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: showWeightHistory }} onPress={() => setShowWeightHistory((value) => !value)} style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start", marginTop: 8, paddingVertical: 8 }}>
              <Text style={{ color: COLORS.ink, fontSize: 12, fontWeight: "500" }}>{showWeightHistory ? "Hide measurement history" : `View measurement history · ${bodyWeights.length}`}</Text>
            </Pressable>
            {showWeightHistory ? bodyWeights.map((entry) => (
              <View key={entry.id} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: COLORS.line, gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: COLORS.ink, fontSize: 13, fontWeight: "500" }}>{entry.weight} {entry.unit}</Text>
                  <Text style={{ color: COLORS.muted, fontSize: 11, marginTop: 2 }}>{formatDate(entry.date)}{entry.note ? ` · ${entry.note}` : ""}</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={`Delete body weight ${entry.weight} ${entry.unit} from ${formatDate(entry.date)}`} onPress={() => {
                  const remove = () => void deleteBodyWeight(entry.id).catch(() => undefined);
                  const message = `Remove the ${entry.weight} ${entry.unit} measurement from ${formatDate(entry.date)}?`;
                  if (Platform.OS === "web") {
                    if ((globalThis as { confirm?: (text: string) => boolean }).confirm?.(message)) remove();
                  } else {
                    Alert.alert("Delete measurement?", message, [
                      { text: "Cancel", style: "cancel" },
                      { text: "Delete", style: "destructive", onPress: remove },
                    ]);
                  }
                }} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="trash-outline" size={17} color={COLORS.muted} />
                </Pressable>
              </View>
            )) : null}
          </>
        ) : null}
      </View>

      <SectionTitle title="Weekly schedule" action="Full plan" onAction={() => router.push("/program-guide")} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
        {WEEK_SCHEDULE.map((slot) => {
          const selected = slot.day === todayScheduleDay;
          return (
            <Pressable key={slot.day} accessibilityRole={slot.workout ? "button" : undefined} disabled={!slot.workout} onPress={() => slot.workout && router.push({ pathname: "/workout/[day]", params: { day: slot.workout } })} style={{ width: 128, minHeight: 104, borderRadius: 12, borderWidth: 1, borderColor: selected ? COLORS.ink : COLORS.line, padding: 12, backgroundColor: selected ? COLORS.ink : COLORS.white, marginRight: 8, justifyContent: "space-between" }}>
              <Text style={{ color: selected ? COLORS.white : COLORS.ink, fontSize: 12, fontWeight: "500" }}>{slot.day}</Text>
              <Text style={{ color: selected ? COLORS.white : COLORS.ink, fontSize: 14, fontWeight: "500", marginTop: 8 }}>{slot.workout ?? (slot.day === "Wed" ? "Recovery" : "Off")}</Text>
              <Text numberOfLines={2} style={{ color: selected ? "#C8C8C8" : COLORS.muted, fontSize: 11, lineHeight: 15, fontWeight: "400", marginTop: 4 }}>{slot.activity}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <SectionTitle title="Training volume" action="Last 7 days" />
      <View style={{ borderWidth: 1, borderColor: COLORS.line, borderRadius: 16, padding: 16 }}>
        <Text style={{ color: COLORS.ink, fontSize: 24, lineHeight: 31, fontWeight: "500", fontVariant: ["tabular-nums"] }}>{formatKg(volume)}</Text>
        <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 4 }}>Completed-set volume by day</Text>
        <MiniBars values={dailyVolumes} color={COLORS.ink} labels={dayLabels} />
      </View>

      <SectionTitle title="Recent sessions" action="View progress" onAction={() => router.push("/(tabs)/progress")} />
      {recentSessions.length ? (
        <View style={{ borderWidth: 1, borderColor: COLORS.line, borderRadius: 16, overflow: "hidden" }}>
          {recentSessions.map((workout, index) => {
            const completed = workout.sets.filter((set) => set.completed).length;
            return (
              <View key={workout.id} style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: index === recentSessions.length - 1 ? 0 : 1, borderBottomColor: COLORS.line }}>
                <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: COLORS.soft, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="barbell-outline" size={18} color={COLORS.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: COLORS.ink, fontSize: 14, fontWeight: "500" }}>{getWorkoutDayMeta(workout.day).short}</Text>
                  <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 4 }}>{formatDate(workout.date)} · {completed} completed sets</Text>
                </View>
                <Text style={{ color: COLORS.ink, fontSize: 12, fontWeight: "400", fontVariant: ["tabular-nums"] }}>{formatKg(totalVolume([workout]))}</Text>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={{ padding: 16, borderWidth: 1, borderColor: COLORS.line, borderRadius: 16 }}>
          <Text style={{ color: COLORS.ink, fontSize: 15, fontWeight: "500" }}>No completed sessions yet</Text>
          <Text style={{ color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 4 }}>Your saved workouts will appear here</Text>
        </View>
      )}
    </Screen>
  );
}

function SummaryStat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 4 }}>
      <Text style={{ color: COLORS.muted, fontSize: 11, fontWeight: "400" }}>{label}</Text>
      <Text style={{ color: COLORS.ink, fontSize: 24, lineHeight: 28, fontWeight: "500", fontVariant: ["tabular-nums"] }}>{value}</Text>
      <Text style={{ color: COLORS.muted, fontSize: 11, fontWeight: "400" }}>{note}</Text>
    </View>
  );
}
