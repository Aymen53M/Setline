import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View, type ScrollViewInstance } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ExerciseVisual, Eyebrow, Recommendation, COLORS } from "@/components/liftlog-ui";
import {
  DAY_META,
  normalizeWorkoutDay,
  getRecommendation,
  type Exercise,
  type WorkoutDay,
  type WorkoutDraft,
  type WorkoutSet,
} from "@/lib/workout-data";
import { useWorkoutStore } from "@/lib/workout-store";
import {
  completeWorkoutSet,
  createWorkoutDraft,
  getRestRemainingSeconds,
  getWorkoutElapsedSeconds,
  includeAndFocusWorkoutExercise,
  moveWorkoutExercise,
  setWorkoutExerciseIds,
  updateDraftSet,
} from "@/lib/workout-session";

const formatClock = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
};

export default function ActiveWorkoutScreen() {
  const params = useLocalSearchParams<{ day?: string; exerciseId?: string }>();
  const day = normalizeWorkoutDay(params.day) ?? "Push";
  const exerciseParam = Array.isArray(params.exerciseId) ? params.exerciseId[0] : params.exerciseId;
  const { ready, draft, programs, getExercise, latestWeight, latestPerformance, exercises, clearDraft } = useWorkoutStore();

  if (!ready) {
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.white }}><Text style={{ color: COLORS.muted, fontSize: 14 }}>Loading your workout…</Text></View>;
  }

  if (draft && draft.day !== day) {
    return <WorkoutConflict draft={draft} day={day} onDiscard={() => { void clearDraft().catch(() => undefined); }} />;
  }

  const startingExercises = exerciseParam
    ? [getExercise(exerciseParam)].filter((exercise): exercise is Exercise => Boolean(exercise))
    : (programs[day] ?? []).map((id) => getExercise(id)).filter((exercise): exercise is Exercise => Boolean(exercise));

  return (
    <ActiveWorkoutSession
      key={`${day}:${exerciseParam ?? "program"}`}
      day={day}
      initialDraft={draft?.day === day ? draft : null}
      focusExerciseId={exerciseParam}
      startingExercises={startingExercises}
      latestWeight={latestWeight}
      latestPerformance={latestPerformance}
      catalog={exercises}
      getExercise={getExercise}
    />
  );
}

function WorkoutConflict({ draft, day, onDiscard }: { draft: WorkoutDraft; day: WorkoutDay; onDiscard: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.white, justifyContent: "center", padding: 24 }}>
      <View style={{ backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 18, padding: 20 }}>
        <Eyebrow>Saved session</Eyebrow>
        <Text style={{ color: COLORS.ink, fontSize: 23, lineHeight: 29, fontWeight: "500", marginTop: 8 }}>You have an unfinished {DAY_META[draft.day].short} workout</Text>
        <Text style={{ color: COLORS.muted, fontSize: 14, lineHeight: 20, marginTop: 8 }}>Resume it to keep your progress, or discard that draft and start this {DAY_META[day].short} session.</Text>
        <Pressable onPress={() => router.replace({ pathname: "/workout/[day]", params: { day: draft.day } })} style={{ backgroundColor: COLORS.ink, borderRadius: 10, paddingVertical: 16, alignItems: "center", marginTop: 16 }}><Text style={{ color: COLORS.white, fontSize: 14, fontWeight: "500" }}>Resume {DAY_META[draft.day].short}</Text></Pressable>
        <Pressable onPress={onDiscard} style={{ backgroundColor: COLORS.soft, borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 8 }}><Text style={{ color: COLORS.ink, fontSize: 13, fontWeight: "500" }}>Discard and start {DAY_META[day].short}</Text></Pressable>
        <Pressable onPress={() => router.back()} style={{ alignItems: "center", paddingVertical: 12, marginTop: 4 }}><Text style={{ color: COLORS.muted, fontSize: 13 }}>Go back</Text></Pressable>
      </View>
    </View>
  );
}

function ActiveWorkoutSession({ day, initialDraft, focusExerciseId, startingExercises, latestWeight, latestPerformance, catalog, getExercise }: {
  day: WorkoutDay;
  initialDraft: WorkoutDraft | null;
  focusExerciseId?: string;
  startingExercises: Exercise[];
  latestWeight: (exerciseId: string) => number;
  latestPerformance: (exerciseId: string) => WorkoutSet[];
  catalog: Exercise[];
  getExercise: (id: string) => Exercise | undefined;
}) {
  const insets = useSafeAreaInsets();
  useKeepAwake();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const notifiedDeadlineRef = useRef<number | null>(null);
  const { history, saveDraft, completeWorkout } = useWorkoutStore();
  const [workout, setWorkout] = useState<WorkoutDraft>(() => {
    if (initialDraft) {
      return focusExerciseId
        ? includeAndFocusWorkoutExercise(initialDraft, focusExerciseId, getExercise, latestWeight, latestPerformance)
        : initialDraft;
    }
    return createWorkoutDraft(day, startingExercises, latestWeight, latestPerformance);
  });
  const workoutRef = useRef(workout);
  const [now, setNow] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [managerVisible, setManagerVisible] = useState(false);
  const [pickerIds, setPickerIds] = useState<string[]>([]);
  const [timerHapticsEnabled, setTimerHapticsEnabled] = useState(true);
  const meta = DAY_META[day];

  useEffect(() => {
    void saveDraft(workoutRef.current).catch(() => {
      setSaveError("Your workout draft could not be saved. Keep the app open and try again.");
    });
  }, [saveDraft]);

  const commitWorkout = (next: WorkoutDraft | ((current: WorkoutDraft) => WorkoutDraft)) => {
    const updated = typeof next === "function" ? next(workoutRef.current) : next;
    workoutRef.current = updated;
    setWorkout(updated);
    setSaveError("");
    void saveDraft(updated).catch(() => {
      setSaveError("Your workout draft could not be saved. Keep the app open and try again.");
    });
  };

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const deadline = workout.restDeadlineAt;
    if (deadline === null || workout.restMode === null) {
      notifiedDeadlineRef.current = null;
      return;
    }
    if (now >= deadline && notifiedDeadlineRef.current !== deadline) {
      notifiedDeadlineRef.current = deadline;
      if (timerHapticsEnabled) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      }
    }
  }, [now, timerHapticsEnabled, workout.restDeadlineAt, workout.restMode]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [workout.currentExerciseIndex]);

  const exerciseIds = workout.exerciseIds;
  const currentIndex = workout.currentExerciseIndex;
  const currentExerciseId = exerciseIds[currentIndex];
  const currentExercise = currentExerciseId
    ? workout.exerciseSnapshots[currentExerciseId] ?? getExercise(currentExerciseId)
    : undefined;
  const currentSets = workout.sets.filter((set) => set.exerciseId === currentExerciseId);
  const includedSets = workout.sets.filter((set) => exerciseIds.includes(set.exerciseId));
  const completedCount = includedSets.filter((set) => set.completed).length;
  const recordableSets = workout.sets.filter((set) => exerciseIds.includes(set.exerciseId) || set.completed);
  const recordableCompletedCount = recordableSets.filter((set) => set.completed).length;
  const elapsed = getWorkoutElapsedSeconds(workout, now);
  const rest = getRestRemainingSeconds(workout.restDeadlineAt, now);
  const restMode = workout.restMode;
  const nextId = exerciseIds[currentIndex + 1];
  const nextExercise = nextId ? workout.exerciseSnapshots[nextId] ?? getExercise(nextId) : undefined;
  const activeCatalogIds = new Set(catalog.map((exercise) => exercise.id));
  const retainedOptions = exerciseIds
    .filter((id) => !activeCatalogIds.has(id))
    .map((id) => workout.exerciseSnapshots[id] ?? getExercise(id))
    .filter((exercise): exercise is Exercise => Boolean(exercise));
  const pickerOptions = [...retainedOptions, ...catalog];
  const completionRatio = includedSets.length ? completedCount / includedSets.length : 0;
  const setRestSeconds = currentExercise?.restSeconds ?? 90;
  const exerciseRestSeconds = currentExercise?.supersetRestSeconds ?? currentExercise?.restSeconds ?? 180;

  const startRest = (mode: "set" | "exercise") => {
    const duration = mode === "set" ? setRestSeconds : exerciseRestSeconds;
    commitWorkout((current) => ({
      ...current,
      restDeadlineAt: Date.now() + duration * 1000,
      restMode: mode,
    }));
  };

  const stopRest = () => {
    commitWorkout((current) => ({ ...current, restDeadlineAt: null, restMode: null }));
  };

  const completeSet = (set: WorkoutSet) => {
    commitWorkout((current) => {
      const result = completeWorkoutSet(current, set.id);
      if (set.completed) return result.draft;
      const nextId = result.draft.exerciseIds[result.draft.currentExerciseIndex];
      const nextExercise = nextId
        ? result.draft.exerciseSnapshots[nextId] ?? getExercise(nextId)
        : undefined;
      const immediateSupersetSwitch = Boolean(
        currentExercise?.supersetGroup &&
        nextExercise?.supersetGroup === currentExercise.supersetGroup &&
        result.draft.currentExerciseIndex !== current.currentExerciseIndex &&
        !result.completedExercise,
      );
      if (immediateSupersetSwitch) {
        return { ...result.draft, restDeadlineAt: null, restMode: null };
      }
      const mode = result.completedExercise ? "exercise" : "set";
      const duration = currentExercise?.supersetRestSeconds ?? currentExercise?.restSeconds ?? (mode === "set" ? 90 : 180);
      return {
        ...result.draft,
        restDeadlineAt: Date.now() + duration * 1000,
        restMode: mode,
      };
    });
  };

  const patchSet = (setId: string, patch: Partial<WorkoutSet>) => {
    commitWorkout((current) => updateDraftSet(current, setId, patch));
  };

  const openExerciseManager = () => {
    setPickerIds([...exerciseIds]);
    setManagerVisible(true);
  };

  const saveExerciseSelection = () => {
    const updated = setWorkoutExerciseIds(workoutRef.current, pickerIds, getExercise, latestWeight, latestPerformance);
    commitWorkout(updated);
    setManagerVisible(false);
  };

  const togglePickerItem = (id: string) => {
    setPickerIds((current) => current.includes(id)
      ? current.filter((exerciseId) => exerciseId !== id)
      : [...current, id]);
  };

  const shiftPickerExercise = (id: string, direction: -1 | 1) => {
    setPickerIds((current) => {
      const index = current.indexOf(id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const reordered = [...current];
      [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
      return reordered;
    });
  };

  const saveSession = async () => {
    if (saving || recordableCompletedCount === 0) return;
    setSaving(true);
    setSaveError("");
    try {
      await completeWorkout({
        id: `workout-${workout.id}`,
        day,
        date: new Date().toISOString(),
        durationMinutes: Math.max(1, Math.round((Date.now() - new Date(workout.startedAt).getTime()) / 60000)),
        notes: workout.notes,
        sets: recordableSets,
      });
      router.replace("/(tabs)");
    } catch {
      setSaveError("Could not save this workout. Your draft is still available; try again.");
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.white }}>
      <View style={{ paddingTop: Math.max(insets.top, 16), paddingHorizontal: 24, paddingBottom: 16, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.line }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Leave workout" onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: COLORS.soft, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="close" size={18} color={COLORS.ink} />
          </Pressable>
          <View style={{ alignItems: "center" }}><Eyebrow>{meta.short}</Eyebrow><Text style={{ color: COLORS.ink, fontSize: 18, fontWeight: "500", marginTop: 4 }}>Session</Text></View>
          <View style={{ alignItems: "flex-end", minWidth: 70 }}>
            <Text style={{ color: COLORS.muted, fontSize: 11, fontWeight: "400" }}>Elapsed</Text>
            <Text style={{ color: COLORS.ink, fontSize: 20, lineHeight: 24, fontWeight: "500", fontVariant: ["tabular-nums"], marginTop: 4 }}>{formatClock(elapsed)}</Text>
          </View>
        </View>
        <View style={{ marginTop: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: "400" }}>{completedCount} of {includedSets.length} sets complete</Text>
            <Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: "400" }}>{exerciseIds.length} {exerciseIds.length === 1 ? "exercise" : "exercises"}</Text>
          </View>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: COLORS.soft, overflow: "hidden" }}>
            <View style={{ height: "100%", width: `${completionRatio * 100}%`, borderRadius: 2, backgroundColor: COLORS.ink }} />
          </View>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Manage exercises" onPress={openExerciseManager} style={{ minHeight: 44, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, paddingVertical: 8 }}>
          <Ionicons name="options-outline" size={18} color={COLORS.ink} />
          <Text style={{ color: COLORS.ink, fontSize: 13, fontWeight: "500" }}>Manage exercises</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator
        scrollEnabled
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <TimerPanel rest={rest} restMode={restMode} setRestSeconds={setRestSeconds} exerciseRestSeconds={exerciseRestSeconds} hapticsEnabled={timerHapticsEnabled} onToggleHaptics={() => setTimerHapticsEnabled((enabled) => !enabled)} onStart={startRest} onStop={stopRest} />

        {currentExercise ? (
          <View style={{ marginTop: 24 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: "400" }}>Exercise {currentIndex + 1} of {exerciseIds.length}</Text>
              <Text style={{ color: COLORS.ink, fontSize: 12, fontWeight: "400", fontVariant: ["tabular-nums"] }}>{currentSets.filter((set) => set.completed).length}/{currentSets.length} sets</Text>
            </View>
            <ExerciseVisual exercise={currentExercise} compact />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open movement demonstration and target muscles for ${currentExercise.name}`}
              onPress={() => router.push({ pathname: "/exercise/[id]", params: { id: currentExercise.id } })}
              style={{ minHeight: 44, flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 7, marginTop: 4, paddingHorizontal: 2 }}
            >
              <Ionicons name="play-circle-outline" size={17} color={COLORS.ink} />
              <Text style={{ color: COLORS.ink, fontSize: 12, fontWeight: "500" }}>Form demo & target muscles</Text>
            </Pressable>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ color: COLORS.ink, fontSize: 22, lineHeight: 28, fontWeight: "500" }}>{currentExercise.name}</Text>
                <Text style={{ color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 4 }}>{currentExercise.target} · {currentExercise.minReps}–{currentExercise.maxReps}{currentExercise.unit === "sec" ? " sec" : " reps"} · RIR {currentExercise.rirMin ?? 1}–{currentExercise.rirMax ?? 2}</Text>
              </View>
              <Pressable onPress={openExerciseManager} accessibilityRole="button" accessibilityLabel="Add or remove workout exercises" style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 9, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, paddingHorizontal: 12, paddingVertical: 12 }}>
                <Ionicons name="add" size={18} color={COLORS.ink} /><Text style={{ color: COLORS.ink, fontSize: 12, fontWeight: "400" }}>Edit list</Text>
              </Pressable>
            </View>

            <View style={{ marginTop: 12, padding: 14, borderRadius: 12, backgroundColor: COLORS.soft, gap: 8 }}>
              <Text style={{ color: COLORS.ink, fontSize: 12, fontWeight: "500" }}>Rest · {formatClock(currentExercise.restSeconds ?? 90)} between sets</Text>
              {currentExercise.supersetGroup ? <Text style={{ color: COLORS.ink, fontSize: 12, lineHeight: 18 }}>Superset: switch to the paired movement after each set, then rest {formatClock(currentExercise.supersetRestSeconds ?? 75)} before the next round.</Text> : null}
              <Text style={{ color: COLORS.muted, fontSize: 13, lineHeight: 19 }}>{currentExercise.instructions}</Text>
              <Text style={{ color: COLORS.muted, fontSize: 13, lineHeight: 19 }}>{currentExercise.technique}</Text>
              {currentExercise.tempo ? <Text style={{ color: COLORS.ink, fontSize: 12, lineHeight: 18 }}>Tempo · {currentExercise.tempo}</Text> : null}
              {currentExercise.alternative ? <Text style={{ color: COLORS.muted, fontSize: 12, lineHeight: 18 }}>Alternative · {currentExercise.alternative}</Text> : null}
              {currentExercise.planNote ? <Text style={{ color: COLORS.muted, fontSize: 12, lineHeight: 18 }}>{currentExercise.planNote}</Text> : null}
            </View>

            <View style={{ marginTop: 16, borderWidth: 1, borderColor: COLORS.line, borderRadius: 14, overflow: "hidden" }}>
              {currentSets.map((set) => <SetRow key={set.id} set={set} exercise={currentExercise} onPatch={patchSet} onComplete={() => completeSet(set)} />)}
            </View>
            {currentSets.length === 0 ? <Text style={{ color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 12 }}>No sets yet. Edit the exercise list to add it back to this session.</Text> : null}

            <View style={{ marginTop: 16 }}><Recommendation {...getRecommendation(currentExercise, history)} /></View>
          </View>
        ) : (
          <View style={{ alignItems: "center", paddingVertical: 28, paddingHorizontal: 16, backgroundColor: COLORS.soft, borderRadius: 16, marginTop: 24 }}>
            <Ionicons name="barbell-outline" size={18} color={COLORS.ink} />
            <Text style={{ color: COLORS.ink, fontSize: 18, lineHeight: 24, fontWeight: "500", marginTop: 12 }}>Your session is flexible</Text>
            <Text style={{ color: COLORS.muted, fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: 8 }}>Add an exercise from your library, or create a new one. You can change this list at any time.</Text>
            <Pressable accessibilityRole="button" onPress={openExerciseManager} style={{ minHeight: 44, justifyContent: "center", marginTop: 16, backgroundColor: COLORS.ink, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 }}><Text style={{ color: COLORS.white, fontSize: 13, fontWeight: "500" }}>Add exercises</Text></Pressable>
          </View>
        )}

        <Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: "400", marginTop: 24, marginBottom: 8 }}>Session note</Text>
        <TextInput value={workout.notes} onChangeText={(notes) => commitWorkout((current) => ({ ...current, notes }))} placeholder="How did the session feel?" placeholderTextColor={COLORS.muted} multiline style={{ minHeight: 84, borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, padding: 16, color: COLORS.ink, fontSize: 14, textAlignVertical: "top" }} />
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 12), backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.line }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous exercise" disabled={currentIndex <= 0} onPress={() => commitWorkout((current) => moveWorkoutExercise(current, -1))} style={{ width: 48, minHeight: 48, borderRadius: 10, backgroundColor: COLORS.soft, alignItems: "center", justifyContent: "center", opacity: currentIndex <= 0 ? 0.45 : 1 }}><Ionicons name="chevron-back" size={18} color={COLORS.ink} /></Pressable>
          <Pressable accessibilityRole="button" disabled={!nextExercise} onPress={() => commitWorkout((current) => moveWorkoutExercise(current, 1))} style={{ flex: 1, borderRadius: 10, backgroundColor: nextExercise ? COLORS.soft : COLORS.white, borderWidth: nextExercise ? 0 : 1, borderColor: COLORS.line, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, minHeight: 48 }}>
            <Text numberOfLines={1} style={{ color: COLORS.ink, fontSize: 13, fontWeight: "500" }}>{nextExercise ? `Next · ${nextExercise.name}` : "Last exercise · add another or save"}</Text>
          </Pressable>
        </View>
        {saveError ? <Text accessibilityRole="alert" style={{ color: COLORS.danger, fontSize: 12, textAlign: "center", marginTop: 8 }}>{saveError}</Text> : null}
        <Pressable accessibilityRole="button" disabled={saving || recordableCompletedCount === 0} onPress={() => void saveSession()} style={{ backgroundColor: recordableCompletedCount === 0 ? COLORS.soft : COLORS.ink, borderRadius: 10, paddingVertical: 16, alignItems: "center", marginTop: 8, opacity: saving ? 0.65 : 1 }}>
          <Text style={{ color: recordableCompletedCount === 0 ? COLORS.muted : COLORS.white, fontSize: 14, fontWeight: "500" }}>{saving ? "Saving…" : recordableCompletedCount === 0 ? "Complete a set to save" : `Save workout · ${recordableCompletedCount} sets`}</Text>
        </Pressable>
      </View>

      <Modal visible={managerVisible} animationType="slide" onRequestClose={() => setManagerVisible(false)}>
        <View style={{ flex: 1, backgroundColor: COLORS.white, paddingTop: Math.max(insets.top, 16) }}>
          <View style={{ paddingHorizontal: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: COLORS.line }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View><Eyebrow>Live session · {meta.short}</Eyebrow><Text style={{ color: COLORS.ink, fontSize: 24, lineHeight: 30, fontWeight: "500", marginTop: 4 }}>Manage exercises</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close workout exercise manager" onPress={() => setManagerVisible(false)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Ionicons name="close" size={18} color={COLORS.ink} /></Pressable>
            </View>
            <Text style={{ color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 8 }}>Reorder exercises if a station is busy. Completed set values stay with their exercise when you move or remove it.</Text>
            <Pressable accessibilityRole="button" onPress={() => { setManagerVisible(false); router.push("/exercise/editor"); }} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", marginTop: 8, paddingVertical: 8 }}><Ionicons name="add" size={18} color={COLORS.ink} /><Text style={{ color: COLORS.ink, fontSize: 13, fontWeight: "500" }}>Create an exercise</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 28 }}>
            <View>
              <Text style={{ color: COLORS.ink, fontSize: 15, fontWeight: "500" }}>Session order · {pickerIds.length}</Text>
              <Text style={{ color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 4, marginBottom: 10 }}>Use the arrows to move a station up or down. Your current place is preserved when you save.</Text>
              {pickerIds.map((id, index) => {
                const exercise = pickerOptions.find((item) => item.id === id);
                if (!exercise) return null;
                return (
                  <View key={`order-${id}`} style={{ minHeight: 58, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: COLORS.line, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 7 }}>
                    <Text style={{ color: COLORS.muted, fontSize: 12, fontVariant: ["tabular-nums"], width: 22 }}>{String(index + 1).padStart(2, "0")}</Text>
                    <Text numberOfLines={2} style={{ color: COLORS.ink, fontSize: 13, lineHeight: 18, fontWeight: "500", flex: 1 }}>{exercise.name}</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Move ${exercise.name} up`} accessibilityState={{ disabled: index === 0 }} disabled={index === 0} onPress={() => shiftPickerExercise(id, -1)} style={{ width: 40, height: 40, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.soft, opacity: index === 0 ? 0.4 : 1 }}>
                      <Ionicons name="chevron-up" size={18} color={COLORS.ink} />
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Move ${exercise.name} down`} accessibilityState={{ disabled: index === pickerIds.length - 1 }} disabled={index === pickerIds.length - 1} onPress={() => shiftPickerExercise(id, 1)} style={{ width: 40, height: 40, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.soft, opacity: index === pickerIds.length - 1 ? 0.4 : 1 }}>
                      <Ionicons name="chevron-down" size={18} color={COLORS.ink} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
            <Text style={{ color: COLORS.ink, fontSize: 15, fontWeight: "500", marginTop: 18, marginBottom: 10 }}>Exercise library</Text>
            {pickerOptions.map((exercise) => {
              const selected = pickerIds.includes(exercise.id);
              const archived = !catalog.some((item) => item.id === exercise.id);
              return (
                <Pressable key={exercise.id} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => togglePickerItem(exercise.id)} style={{ minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: selected ? COLORS.ink : COLORS.line, backgroundColor: selected ? COLORS.soft : COLORS.white, borderRadius: 12, padding: 16, marginBottom: 8 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: selected ? COLORS.ink : COLORS.soft }}><Ionicons name={selected ? "checkmark" : "add"} size={18} color={selected ? COLORS.white : COLORS.ink} /></View>
                  <View style={{ flex: 1 }}><Text style={{ color: COLORS.ink, fontSize: 14, fontWeight: "500" }}>{exercise.name}</Text><Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 4 }}>{exercise.target} · {exercise.sets} sets{archived ? " · archived" : ""}</Text></View>
                  <Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: "400" }}>{selected ? "In session" : archived ? "Remove" : "Add"}</Text>
                </Pressable>
              );
            })}
            {pickerOptions.length === 0 ? <Text style={{ color: COLORS.muted, textAlign: "center", marginTop: 32, fontSize: 14 }}>Your library is empty. Create an exercise to begin.</Text> : null}
          </ScrollView>
          <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 16), borderTopWidth: 1, borderTopColor: COLORS.line, flexDirection: "row", gap: 8 }}>
            <Pressable onPress={() => setManagerVisible(false)} style={{ flex: 1, backgroundColor: COLORS.soft, borderRadius: 10, paddingVertical: 16, alignItems: "center" }}><Text style={{ color: COLORS.ink, fontSize: 14, fontWeight: "500" }}>Cancel</Text></Pressable>
            <Pressable onPress={saveExerciseSelection} style={{ flex: 1, backgroundColor: COLORS.ink, borderRadius: 10, paddingVertical: 16, alignItems: "center" }}><Text style={{ color: COLORS.white, fontSize: 14, fontWeight: "500" }}>Save {pickerIds.length} exercises</Text></Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function TimerPanel({ rest, restMode, setRestSeconds, exerciseRestSeconds, hapticsEnabled, onToggleHaptics, onStart, onStop }: {
  rest: number;
  restMode: "set" | "exercise" | null;
  setRestSeconds: number;
  exerciseRestSeconds: number;
  hapticsEnabled: boolean;
  onToggleHaptics: () => void;
  onStart: (mode: "set" | "exercise") => void;
  onStop: () => void;
}) {
  const running = restMode !== null;
  return (
    <View style={{ backgroundColor: running ? COLORS.ink : COLORS.soft, borderRadius: 16, padding: 16 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View>
          <Text style={{ color: running ? "#C8C8C8" : COLORS.muted, fontSize: 12, fontWeight: "400" }}>{running ? "Recovery timer" : "Rest timer"}</Text>
          <Text style={{ color: running ? COLORS.white : COLORS.ink, fontSize: 14, lineHeight: 20, fontWeight: "500", marginTop: 4 }}>
            {running ? rest > 0 ? (restMode === "exercise" ? "Between exercises" : "Between sets") : "Recovery complete" : "Choose a recovery interval"}
          </Text>
        </View>
        {running ? <Pressable accessibilityRole="button" accessibilityLabel="Stop rest timer" onPress={onStop} style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" }}><Ionicons name="close" size={18} color={COLORS.white} /></Pressable> : <Ionicons name="timer-outline" size={18} color={COLORS.ink} />}
      </View>
      <Pressable accessibilityRole="switch" accessibilityLabel="Vibrate when the rest timer ends" accessibilityState={{ checked: hapticsEnabled }} onPress={onToggleHaptics} style={{ minHeight: 44, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 }}>
        <Ionicons name={hapticsEnabled ? "phone-portrait" : "phone-portrait-outline"} size={16} color={running ? COLORS.white : COLORS.ink} />
        <Text style={{ color: running ? COLORS.white : COLORS.ink, fontSize: 12, fontWeight: "400" }}>Vibrate on timer · {hapticsEnabled ? "On" : "Off"}</Text>
      </Pressable>
      {running ? (
        <View style={{ alignItems: "center", marginTop: 8 }}>
          <Text accessibilityRole="timer" style={{ color: COLORS.white, fontSize: 64, lineHeight: 72, fontWeight: "500", fontVariant: ["tabular-nums"] }}>{formatClock(rest)}</Text>
          <Pressable accessibilityRole="button" onPress={onStop} style={{ minHeight: 44, justifyContent: "center", backgroundColor: COLORS.white, borderRadius: 9, paddingHorizontal: 16, paddingVertical: 12, marginTop: 4 }}><Text style={{ color: COLORS.ink, fontSize: 13, fontWeight: "500" }}>{rest > 0 ? "Skip rest" : "Done"}</Text></Pressable>
        </View>
      ) : (
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          <TimerPreset label="Set rest" time={formatClock(setRestSeconds)} onPress={() => onStart("set")} />
          <TimerPreset label="Next exercise" time={formatClock(exerciseRestSeconds)} onPress={() => onStart("exercise")} />
        </View>
      )}
    </View>
  );
}

function TimerPreset({ label, time, onPress }: { label: string; time: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ flex: 1, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 11, padding: 12 }}>
      <Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: "400" }}>{label}</Text>
      <Text style={{ color: COLORS.ink, fontSize: 28, lineHeight: 32, fontWeight: "500", fontVariant: ["tabular-nums"], marginTop: 4 }}>{time}</Text>
      <Text style={{ color: COLORS.ink, fontSize: 12, fontWeight: "400", marginTop: 4 }}>Start timer</Text>
    </Pressable>
  );
}

function SetRow({ set, exercise, onPatch, onComplete }: {
  set: WorkoutSet;
  exercise: Exercise;
  onPatch: (id: string, patch: Partial<WorkoutSet>) => void;
  onComplete: () => void;
}) {
  return (
    <View style={{ padding: 12, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: set.completed ? COLORS.soft : COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.line }}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: set.completed }} accessibilityLabel={`${set.completed ? "Uncomplete" : "Complete"} ${exercise.name}, set ${set.setNumber}`} onPress={onComplete} style={{ width: 44, height: 44, borderRadius: 9, backgroundColor: set.completed ? COLORS.ink : COLORS.white, borderWidth: set.completed ? 0 : 1, borderColor: COLORS.line, alignItems: "center", justifyContent: "center" }}>
        {set.completed ? <Ionicons name="checkmark" size={18} color={COLORS.white} /> : <Text style={{ color: COLORS.ink, fontSize: 12, fontWeight: "500" }}>{set.setNumber}</Text>}
      </Pressable>
      <Field value={set.weight} onCommit={(value) => onPatch(set.id, { weight: value })} keyboardType="decimal-pad" label={exercise.unit === "sec" ? "Hold seconds" : "Weight in kg"} accessibleLabel={`${exercise.name}, set ${set.setNumber}, ${exercise.unit === "sec" ? "hold time in seconds" : "weight in kilograms"}`} />
      <Field value={set.reps} onCommit={(value) => onPatch(set.id, { reps: Math.round(value) })} keyboardType="number-pad" label={exercise.unit === "sec" ? "Seconds" : "Reps"} accessibleLabel={`${exercise.name}, set ${set.setNumber}, ${exercise.unit === "sec" ? "seconds" : "repetitions"}`} />
      <Field value={set.rir} onCommit={(value) => onPatch(set.id, { rir: Math.round(value) })} keyboardType="number-pad" label="RIR" accessibleLabel={`${exercise.name}, set ${set.setNumber}, reps in reserve`} />
    </View>
  );
}

function Field({ value, label, accessibleLabel, keyboardType, onCommit }: { value: number; label: string; accessibleLabel: string; keyboardType: "number-pad" | "decimal-pad"; onCommit: (value: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const parsed = Number(text.trim().replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) {
      setText(String(value));
      return;
    }
    onCommit(parsed);
  };

  return (
    <View style={{ flex: 1, minWidth: 44 }}>
      <TextInput value={text} onChangeText={setText} onBlur={commit} onSubmitEditing={commit} keyboardType={keyboardType} selectTextOnFocus accessibilityLabel={accessibleLabel} style={{ backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 8, textAlign: "center", color: COLORS.ink, fontSize: 16, fontWeight: "500", fontVariant: ["tabular-nums"] }} />
      <Text style={{ color: COLORS.muted, fontSize: 11, textAlign: "center", marginTop: 4, fontWeight: "400" }}>{label}</Text>
    </View>
  );
}
