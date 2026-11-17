import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DayPill, Eyebrow, ExerciseCard, Recommendation, Screen, SectionTitle, COLORS } from "@/components/liftlog-ui";
import { DAY_META, WORKOUT_DAYS, getRecommendation, type Exercise, type WorkoutDay } from "@/lib/workout-data";
import { useWorkoutStore } from "@/lib/workout-store";

export default function ProgramScreen() {
  const [selectedDay, setSelectedDay] = useState<WorkoutDay>("Push");
  const [editing, setEditing] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerIds, setPickerIds] = useState<string[]>([]);
  const insets = useSafeAreaInsets();
  const { history, exercises: catalog, programs, updateProgram, ready } = useWorkoutStore();
  const exerciseIds = programs[selectedDay] ?? [];
  const exercises = exerciseIds
    .map((id) => catalog.find((exercise) => exercise.id === id))
    .filter((exercise): exercise is Exercise => Boolean(exercise));
  const meta = DAY_META[selectedDay];
  const workingSets = exercises.reduce((sum, exercise) => sum + exercise.sets, 0);

  if (!ready) return <Screen><Eyebrow>Your system</Eyebrow><Text style={{ color: COLORS.muted, fontSize: 14, marginTop: 12 }}>Loading your saved programs…</Text></Screen>;

  const moveExercise = (exerciseId: string, direction: -1 | 1) => {
    const current = [...exerciseIds];
    const index = current.indexOf(exerciseId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return;
    [current[index], current[nextIndex]] = [current[nextIndex], current[index]];
    void updateProgram(selectedDay, current).catch(() => undefined);
  };

  const removeFromProgram = (exerciseId: string) => {
    void updateProgram(selectedDay, exerciseIds.filter((id) => id !== exerciseId)).catch(() => undefined);
  };

  const openPicker = () => {
    setPickerIds([...exerciseIds]);
    setPickerVisible(true);
  };

  const togglePickerExercise = (exerciseId: string) => {
    setPickerIds((current) => current.includes(exerciseId)
      ? current.filter((id) => id !== exerciseId)
      : [...current, exerciseId]);
  };

  const saveProgram = async () => {
    await updateProgram(selectedDay, pickerIds);
    setPickerVisible(false);
  };

  return (
    <Screen>
      <Eyebrow>Your system</Eyebrow>
      <View style={{ marginTop: 8 }}>
        <Text style={{ color: COLORS.ink, fontSize: 30, fontWeight: "500" }}>My program</Text>
        <Text style={{ color: COLORS.muted, fontSize: 14, marginTop: 4 }}>Set the order for each training day</Text>
      </View>

      <Pressable accessibilityRole="button" onPress={() => router.push("/program-guide")} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, marginTop: 16, borderWidth: 1, borderColor: COLORS.line, borderRadius: 10 }}>
        <Ionicons name="book-outline" size={18} color={COLORS.ink} />
        <Text style={{ color: COLORS.ink, fontSize: 13, fontWeight: "500", flex: 1 }}>Read the full plan and progression guide</Text>
        <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
      </Pressable>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 16 }}>
        {WORKOUT_DAYS.map((day) => <DayPill key={day} day={day} selected={selectedDay === day} onPress={() => setSelectedDay(day)} />)}
      </ScrollView>

      <View style={{ backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 14, padding: 16, marginBottom: 20 }}>
        <Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: "500" }}>{meta.eyebrow}</Text>
        <Text style={{ color: COLORS.ink, fontSize: 24, fontWeight: "500", marginTop: 4 }}>{meta.short}</Text>
        <Text style={{ color: COLORS.muted, fontSize: 13, fontWeight: "400", marginTop: 4 }}>{meta.muscles}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.line }}>
          <Ionicons name="time-outline" size={18} color={COLORS.muted} />
          <Text style={{ color: COLORS.ink, fontSize: 13, fontWeight: "400" }}>{exercises.length} exercises · {workingSets} working sets</Text>
        </View>
      </View>

      {exercises[0] ? <Recommendation {...getRecommendation(exercises[0], history)} /> : (
        <View style={{ padding: 16, backgroundColor: COLORS.soft, borderRadius: 12 }}>
          <Text style={{ color: COLORS.ink, fontSize: 14, fontWeight: "500" }}>This program is empty</Text>
          <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 4, lineHeight: 18 }}>Add movements here, or build a flexible session when you start</Text>
        </View>
      )}

      <SectionTitle title="Exercise order" action={editing ? "Done" : "Edit"} onAction={() => setEditing((value) => !value)} />
      {editing ? <Text style={{ color: COLORS.muted, fontSize: 12, lineHeight: 18, marginBottom: 12 }}>Changes save on this device. Reorder with the arrows or add and remove exercises.</Text> : null}
      {exercises.map((exercise, index) => (
        <View key={`${selectedDay}-${exercise.id}`}>
          <ExerciseCard
            exercise={exercise}
            onPress={() => router.push({ pathname: "/exercise/[id]", params: { id: exercise.id } })}
          />
          {editing ? (
            <View style={{ flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: -4, marginBottom: 16 }}>
              <OrderButton label="Move up" icon="chevron-up" disabled={index === 0} onPress={() => moveExercise(exercise.id, -1)} />
              <OrderButton label="Move down" icon="chevron-down" disabled={index === exercises.length - 1} onPress={() => moveExercise(exercise.id, 1)} />
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${exercise.name} from ${selectedDay}`} onPress={() => removeFromProgram(exercise.id)} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: COLORS.line, borderRadius: 8, paddingHorizontal: 12 }}>
                <Ionicons name="remove-circle-outline" size={18} color={COLORS.muted} />
                <Text style={{ color: COLORS.ink, fontSize: 12, fontWeight: "500" }}>Remove</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ))}

      {editing ? (
        <Pressable accessibilityRole="button" onPress={openPicker} style={{ minHeight: 48, borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, paddingHorizontal: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, marginTop: 4 }}>
          <Ionicons name="add-circle-outline" size={18} color={COLORS.ink} />
          <Text style={{ color: COLORS.ink, fontSize: 14, fontWeight: "500" }}>Add or choose exercises</Text>
        </Pressable>
      ) : null}

      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/workout/[day]", params: { day: selectedDay } })} style={{ minHeight: 52, justifyContent: "center", backgroundColor: COLORS.ink, borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 16 }}>
        <Text style={{ color: COLORS.white, fontSize: 15, fontWeight: "500" }}>Start {selectedDay}</Text>
      </Pressable>

      <Modal visible={pickerVisible} animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <View style={{ flex: 1, backgroundColor: COLORS.white, paddingTop: Math.max(insets.top, 16) }}>
          <View style={{ paddingHorizontal: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: COLORS.line }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View>
                <Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: "400" }}>Program builder · {meta.short}</Text>
                <Text style={{ color: COLORS.ink, fontSize: 24, fontWeight: "500", marginTop: 4 }}>Choose movements</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close exercise picker" onPress={() => setPickerVisible(false)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Ionicons name="close" size={18} color={COLORS.ink} /></Pressable>
            </View>
            <Text style={{ color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 8 }}>Tap to include or remove an exercise. Selected order follows the list below.</Text>
            <Pressable accessibilityRole="button" onPress={() => { setPickerVisible(false); router.push("/exercise/editor"); }} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", marginTop: 8 }}>
              <Ionicons name="add-circle-outline" size={18} color={COLORS.ink} />
              <Text style={{ color: COLORS.ink, fontSize: 13, fontWeight: "500" }}>Create a new exercise</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 28 }}>
            {catalog.map((exercise) => {
              const selected = pickerIds.includes(exercise.id);
              return (
                <Pressable key={exercise.id} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => togglePickerExercise(exercise.id)} style={{ minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: selected ? COLORS.ink : COLORS.line, backgroundColor: selected ? COLORS.soft : COLORS.white, borderRadius: 12, padding: 12, marginBottom: 8 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: selected ? "#E5E5E5" : COLORS.soft }}><Ionicons name={selected ? "checkmark" : "add"} size={18} color={COLORS.ink} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: COLORS.ink, fontSize: 14, fontWeight: "500" }}>{exercise.name}</Text>
                    <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 4 }}>{exercise.target} · {exercise.sets} sets</Text>
                  </View>
                  <Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: "400" }}>{selected ? "In program" : "Add"}</Text>
                </Pressable>
              );
            })}
            {catalog.length === 0 ? <Text style={{ color: COLORS.muted, textAlign: "center", marginTop: 32 }}>Create an exercise to begin your program</Text> : null}
          </ScrollView>
          <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 16), borderTopWidth: 1, borderTopColor: COLORS.line, flexDirection: "row", gap: 12 }}>
            <Pressable accessibilityRole="button" onPress={() => setPickerVisible(false)} style={{ minHeight: 48, flex: 1, backgroundColor: COLORS.soft, borderRadius: 10, paddingVertical: 12, alignItems: "center", justifyContent: "center" }}><Text style={{ color: COLORS.ink, fontSize: 14, fontWeight: "500" }}>Cancel</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => void saveProgram().catch(() => undefined)} style={{ minHeight: 48, flex: 1, backgroundColor: COLORS.ink, borderRadius: 10, paddingVertical: 12, alignItems: "center", justifyContent: "center" }}><Text style={{ color: COLORS.white, fontSize: 14, fontWeight: "500" }}>Save {pickerIds.length} exercises</Text></Pressable>
          </View>
        </View>
      </Modal>
      {!ready ? <Text style={{ color: COLORS.muted, fontSize: 12, textAlign: "center", marginTop: 12 }}>Loading your saved programs…</Text> : null}
    </Screen>
  );
}

function OrderButton({ label, icon, disabled, onPress }: { label: string; icon: "chevron-up" | "chevron-down"; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: disabled ? COLORS.soft : "#E5E5E5", alignItems: "center", justifyContent: "center" }}>
      <Ionicons name={icon} size={18} color={disabled ? COLORS.muted : COLORS.ink} />
    </Pressable>
  );
}
