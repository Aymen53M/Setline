import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Platform, Pressable, Text, View } from "react-native";
import { DayPill, Eyebrow, Screen, SectionTitle, COLORS } from "@/components/liftlog-ui";
import { DAY_META, WEEK_SCHEDULE, WORKOUT_DAYS, getWorkoutDayMeta, type Exercise, type WorkoutDay } from "@/lib/workout-data";
import { useWorkoutStore } from "@/lib/workout-store";

const days: WorkoutDay[] = [...WORKOUT_DAYS];

function nextScheduledWorkout(): WorkoutDay {
  const index = (new Date().getDay() + 6) % 7;
  return [...WEEK_SCHEDULE.slice(index), ...WEEK_SCHEDULE.slice(0, index)].find((slot) => slot.workout)?.workout ?? "Push";
}

export default function StartWorkoutScreen() {
  const [selectedDay, setSelectedDay] = useState<WorkoutDay>(nextScheduledWorkout);
  const { draft, clearDraft, programs, exercises, ready } = useWorkoutStore();
  const programExercises = (programs[selectedDay] ?? [])
    .map((id) => exercises.find((exercise) => exercise.id === id))
    .filter((exercise): exercise is Exercise => Boolean(exercise));
  const workingSets = programExercises.reduce((sum, exercise) => sum + exercise.sets, 0);

  if (!ready) return <Screen><Text style={{ color: COLORS.muted, fontSize: 14 }}>Loading your saved workout…</Text></Screen>;

  const beginWorkout = () => {
    if (!draft || draft.day === selectedDay) {
      router.push({ pathname: "/workout/[day]", params: { day: selectedDay } });
      return;
    }
    const message = `You have an unfinished ${draft.day} draft. Starting ${selectedDay} will discard it. Continue?`;
    const discardAndStart = async () => {
      try {
        await clearDraft();
        router.push({ pathname: "/workout/[day]", params: { day: selectedDay } });
      } catch {
        // Keep the unfinished session and let the store retry banner explain the failure.
      }
    };
    if (Platform.OS === "web") {
      if ((globalThis as { confirm?: (text: string) => boolean }).confirm?.(message)) discardAndStart();
    } else {
      Alert.alert("Unfinished workout", message, [
        { text: "Keep draft", style: "cancel" },
        { text: "Discard and start", style: "destructive", onPress: discardAndStart },
      ]);
    }
  };

  return (
    <Screen>
      <Eyebrow>Training log</Eyebrow>
      <Text style={{ color: COLORS.ink, fontSize: 31, fontWeight: "500", marginTop: 8 }}>Start workout</Text>
      <Text style={{ color: COLORS.muted, fontSize: 14, lineHeight: 20, marginTop: 8 }}>Pick a session. Your last recorded load will be ready when you are.</Text>
      <Pressable accessibilityRole="button" onPress={() => router.push("/program-guide")} style={{ minHeight: 44, alignSelf: "flex-start", justifyContent: "center", marginTop: 8 }}>
        <Text style={{ color: COLORS.ink, fontSize: 13, fontWeight: "500" }}>Read the full plan, progression and recovery guide</Text>
      </Pressable>

      <SectionTitle title="Choose your day" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {days.map((day) => <DayPill key={day} day={day} selected={selectedDay === day} onPress={() => setSelectedDay(day)} />)}
      </View>

      <View style={{ marginTop: 24, borderWidth: 1, borderColor: COLORS.line, borderRadius: 14, padding: 16, backgroundColor: COLORS.white }}>
        <Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: "400" }}>{DAY_META[selectedDay].eyebrow}</Text>
        <Text style={{ color: COLORS.ink, fontSize: 25, fontWeight: "500", marginTop: 4 }}>{DAY_META[selectedDay].short}</Text>
        <Text style={{ color: COLORS.muted, fontSize: 13, fontWeight: "400", marginTop: 4 }}>{DAY_META[selectedDay].muscles}</Text>
        <Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: "400", marginTop: 8 }}>Plan target: about {DAY_META[selectedDay].durationMinutes} min · {DAY_META[selectedDay].plannedSets} working sets</Text>
        <View style={{ marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.line, flexDirection: "row", gap: 24 }}>
          <View><Text style={{ color: COLORS.ink, fontSize: 22, fontWeight: "500" }}>{programExercises.length}</Text><Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: "400", marginTop: 2 }}>Exercises</Text></View>
          <View><Text style={{ color: COLORS.ink, fontSize: 22, fontWeight: "500" }}>{workingSets}</Text><Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: "400", marginTop: 2 }}>Working sets</Text></View>
        </View>
      </View>

      {draft ? (
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/workout/[day]", params: { day: draft.day } })} style={{ minHeight: 68, marginTop: 16, borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: COLORS.soft, alignItems: "center", justifyContent: "center" }}><Ionicons name="return-down-forward-outline" size={18} color={COLORS.ink} /></View>
          <View style={{ flex: 1 }}><Text style={{ color: COLORS.ink, fontSize: 14, fontWeight: "500" }}>Resume {getWorkoutDayMeta(draft.day).short}</Text><Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 4 }}>{draft.exerciseIds.length} exercises · Draft saved automatically</Text></View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
        </Pressable>
      ) : null}

      <Pressable accessibilityRole="button" onPress={beginWorkout} style={{ minHeight: 52, marginTop: 20, backgroundColor: COLORS.ink, borderRadius: 12, paddingVertical: 16, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: COLORS.white, fontSize: 15, fontWeight: "500" }}>{programExercises.length ? `Begin ${selectedDay}` : `Build a ${selectedDay} session`}</Text>
      </Pressable>
      {!ready ? <Text style={{ color: COLORS.muted, fontSize: 12, textAlign: "center", marginTop: 12 }}>Loading your saved program…</Text> : null}

      <View style={{ marginTop: 20, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, flexDirection: "row", gap: 12 }}>
        <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.muted} />
        <View style={{ flex: 1 }}><Text style={{ color: COLORS.ink, fontSize: 14, fontWeight: "500" }}>Your history stays intact</Text><Text style={{ color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 4 }}>Every saved session becomes a new dated record. Nothing gets replaced.</Text></View>
      </View>
    </Screen>
  );
}
