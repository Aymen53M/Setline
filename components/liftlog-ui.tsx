import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Fragment, type RefObject } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance, type ViewStyle } from "react-native";
import Svg, { Circle, Line as SvgLine, Polyline } from "react-native-svg";
import { DAY_META, getMediaForExercise, MEDIA, type Exercise, type WorkoutDay } from "@/lib/workout-data";
import { getExerciseMediaSelection } from "@/lib/exercise-art";

// Visual review approach adapted under CC BY 4.0 from unslop by Damir Sokolovsky:
// https://github.com/heydamir/unslop
export const COLORS = {
  ink: "#111111",
  muted: "#666666",
  soft: "#F4F4F4",
  line: "#E5E5E5",
  white: "#FFFFFF",
  danger: "#414141",
};

export function Screen({ children, scroll = true, style, scrollRef }: { children: React.ReactNode; scroll?: boolean; style?: ViewStyle; scrollRef?: RefObject<ScrollViewInstance | null> }) {
  const content = <View style={[styles.screen, style]}>{children}</View>;
  return scroll ? <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>{content}</ScrollView> : content;
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? onAction ? <Pressable accessibilityRole="button" accessibilityLabel={action} onPress={onAction} style={styles.sectionAction}><Text style={styles.textAction}>{action}</Text></Pressable> : <Text style={styles.textAction}>{action}</Text> : null}
    </View>
  );
}

export function DayPill({ day, selected, onPress }: { day: WorkoutDay; selected?: boolean; onPress?: () => void }) {
  const meta = DAY_META[day];
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} style={[styles.dayPill, selected && styles.dayPillSelected]}>
      <Text style={[styles.dayPillLabel, selected && styles.dayPillLabelSelected]}>{meta.short}</Text>
      <Text style={[styles.dayPillMeta, selected && styles.dayPillMetaSelected]} numberOfLines={1}>{meta.muscles.split(" · ")[0]}</Text>
    </Pressable>
  );
}

export function ProgressBar({ value, color = COLORS.ink, label, right }: { value: number; color?: string; label: string; right?: string }) {
  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressHeader}><Text style={styles.progressLabel}>{label}</Text>{right ? <Text style={styles.progressRight}>{right}</Text> : null}</View>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }]} /></View>
    </View>
  );
}

export function MiniBars({ values, color = COLORS.ink, labels }: { values: number[]; color?: string; labels?: string[] }) {
  const max = Math.max(...values, 1);
  return (
    <View style={styles.barsWrap}>
      {values.map((value, index) => (
        <View style={styles.barColumn} key={`${value}-${index}`}>
          <View style={styles.barTrack}><View style={[styles.bar, { height: `${Math.max(value > 0 ? 4 : 0, (value / max) * 100)}%`, backgroundColor: color }]} /></View>
          {labels?.[index] ? <Text style={styles.barLabel}>{labels[index]}</Text> : null}
        </View>
      ))}
    </View>
  );
}

export function LineChart({ values, color = COLORS.ink, labels }: { values: number[]; color?: string; labels?: string[] }) {
  const width = 320;
  const height = 132;
  const padX = 10;
  const padY = 12;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = Math.max(max - min, 1);
  const points = values.map((value, index) => {
    const x = values.length <= 1 ? width / 2 : padX + (index / (values.length - 1)) * (width - padX * 2);
    const y = height - padY - ((value - min) / range) * (height - padY * 2);
    return { x, y };
  });
  const pointString = points.map((point) => `${point.x},${point.y}`).join(" ");
  return (
    <View style={styles.lineChartWrap}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <SvgLine x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} stroke={COLORS.line} strokeWidth="1" />
        <SvgLine x1={padX} y1={height / 2} x2={width - padX} y2={height / 2} stroke={COLORS.line} strokeWidth="1" strokeDasharray="4 5" />
        <SvgLine x1={padX} y1={padY} x2={width - padX} y2={padY} stroke={COLORS.line} strokeWidth="1" />
        <Polyline points={pointString} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((point, index) => <Circle key={`${point.x}-${point.y}-${index}`} cx={point.x} cy={point.y} r="3.5" fill={COLORS.white} stroke={color} strokeWidth="2" />)}
      </Svg>
      <View style={styles.lineChartLabels}>{(labels ?? values.map((_, index) => `${index + 1}`)).map((label, index) => <Text key={`${label}-${index}`} style={styles.barLabel}>{label}</Text>)}</View>
    </View>
  );
}

export function MultiLineChart({ series, labels }: { series: { label: string; values: number[]; color: string }[]; labels: string[] }) {
  const width = 320;
  const height = 150;
  const padX = 10;
  const padY = 14;
  const max = Math.max(...series.flatMap((item) => item.values), 1);
  const pointFor = (value: number, index: number, count: number) => ({
    x: count <= 1 ? width / 2 : padX + (index / (count - 1)) * (width - padX * 2),
    y: height - padY - (value / max) * (height - padY * 2),
  });
  return (
    <View style={styles.lineChartWrap}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <SvgLine x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} stroke={COLORS.line} strokeWidth="1" />
        <SvgLine x1={padX} y1={height / 2} x2={width - padX} y2={height / 2} stroke={COLORS.line} strokeWidth="1" strokeDasharray="3 6" />
        <SvgLine x1={padX} y1={padY} x2={width - padX} y2={padY} stroke={COLORS.line} strokeWidth="1" />
        {series.map((item) => {
          const points = item.values.map((value, index) => pointFor(value, index, item.values.length));
          return (
            <Fragment key={item.label}>
              <Polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={item.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {points.map((point, index) => <Circle key={`${item.label}-${index}`} cx={point.x} cy={point.y} r="3" fill={COLORS.white} stroke={item.color} strokeWidth="1.7" />)}
            </Fragment>
          );
        })}
      </Svg>
      <View style={styles.lineChartLabels}>{labels.map((label, index) => <Text key={`${label}-${index}`} style={styles.barLabel}>{label}</Text>)}</View>
    </View>
  );
}

export function ExerciseVisual({ exercise, compact = false }: { exercise: Exercise; compact?: boolean }) {
  const media = getMediaForExercise(exercise);
  const selection = getExerciseMediaSelection(exercise);
  const illustration = selection && (selection.isExact || !MEDIA[exercise.id as keyof typeof MEDIA]) ? selection : undefined;
  return (
    <View style={[styles.exerciseVisual, compact && styles.exerciseVisualCompact]}>
      {media ? (
        <Fragment><Image source={media} contentFit={illustration ? "contain" : "cover"} style={styles.exerciseImage} />{!illustration ? <View style={styles.imageShade} /> : null}</Fragment>
      ) : (
        <View style={styles.customVisual}>
          <Ionicons name="barbell-outline" size={18} color={COLORS.muted} />
          <Text style={styles.customVisualLabel}>Custom movement</Text>
        </View>
      )}
      <View style={styles.targetOverlay}>
        <Text style={[styles.targetLabel, illustration && styles.targetLabelIllustration, !media && styles.customTargetLabel]}>Target</Text>
        <Text numberOfLines={2} style={[styles.targetValue, illustration && styles.targetValueIllustration, !media && styles.customTargetValue]}>{exercise.target}</Text>
      </View>
    </View>
  );
}

export function ExerciseCard({ exercise, onPress }: { exercise: Exercise; onPress?: () => void }) {
  const restSeconds = exercise.restSeconds ?? 90;
  const restLabel = restSeconds >= 60 && restSeconds % 60 === 0
    ? `${restSeconds / 60} min rest`
    : `${restSeconds} sec rest`;
  const rirLabel = exercise.rirMin === exercise.rirMax
    ? `RIR ${exercise.rirMin ?? 1}`
    : `RIR ${exercise.rirMin ?? 1}–${exercise.rirMax ?? 2}`;
  return (
    <Pressable onPress={onPress} style={styles.exerciseCard}>
      <ExerciseVisual exercise={exercise} compact />
      <View style={styles.exerciseCardBody}>
        <View style={styles.exerciseCardTop}><Text style={styles.exerciseName}>{exercise.name}</Text><Ionicons name="chevron-forward" size={18} color={COLORS.muted} /></View>
        <Text style={styles.exerciseTarget}>{exercise.target} · {exercise.secondary}</Text>
        <View style={styles.exerciseMeta}><Text style={styles.exerciseMetaText}>{exercise.equipment}</Text><Text style={styles.exerciseMetaText}>{exercise.sets} × {exercise.minReps}–{exercise.maxReps}{exercise.unit === "sec" ? " sec" : " reps"}</Text></View>
        <View style={[styles.exerciseMeta, { marginTop: 8 }]}><Text style={styles.exerciseMetaText}>{rirLabel}</Text><Text style={styles.exerciseMetaText}>{restLabel}</Text></View>
        {exercise.supersetGroup ? <Text style={[styles.exerciseMetaText, { marginTop: 8 }]}>Superset · paired round-robin</Text> : null}
      </View>
    </Pressable>
  );
}

export function Recommendation({ label, detail }: { label: string; detail: string }) {
  return (
    <View style={styles.recommendation}>
      <View style={styles.recommendationCopy}><Text style={styles.recommendationLabel}>{label}</Text><Text style={styles.recommendationDetail}>{detail}</Text></View>
    </View>
  );
}

export const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.white },
  scrollContent: { paddingBottom: 112 },
  screen: { flex: 1, backgroundColor: COLORS.white, paddingHorizontal: 24, paddingTop: 24 },
  eyebrow: { color: COLORS.muted, fontSize: 12, fontWeight: "500" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 32, marginBottom: 12 },
  sectionTitle: { color: COLORS.ink, fontSize: 18, fontWeight: "500" },
  textAction: { color: COLORS.ink, fontSize: 13, fontWeight: "500" },
  sectionAction: { minHeight: 44, justifyContent: "center" },
  dayPill: { width: 80, minHeight: 72, borderRadius: 12, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, paddingHorizontal: 8, paddingVertical: 12, justifyContent: "space-between", marginRight: 4 },
  dayPillSelected: { backgroundColor: COLORS.ink, borderColor: COLORS.ink },
  dayPillLabel: { color: COLORS.ink, fontSize: 12, fontWeight: "500" },
  dayPillLabelSelected: { color: COLORS.white },
  dayPillMeta: { color: COLORS.muted, fontSize: 11, fontWeight: "400" },
  dayPillMetaSelected: { color: "#C7C7C7" },
  progressWrap: { marginBottom: 16 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  progressLabel: { color: COLORS.ink, fontSize: 13, fontWeight: "400" },
  progressRight: { color: COLORS.muted, fontSize: 12, fontWeight: "400", fontVariant: ["tabular-nums"] },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: COLORS.soft, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  barsWrap: { height: 124, flexDirection: "row", alignItems: "flex-end", gap: 8, paddingTop: 12 },
  barColumn: { flex: 1, alignItems: "center", height: "100%", justifyContent: "flex-end" },
  barTrack: { width: "100%", flex: 1, justifyContent: "flex-end", backgroundColor: COLORS.soft, borderRadius: 3, overflow: "hidden" },
  bar: { width: "100%", borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  barLabel: { marginTop: 8, color: COLORS.muted, fontSize: 11, fontWeight: "400", fontVariant: ["tabular-nums"] },
  lineChartWrap: { height: 160, paddingTop: 12 },
  lineChartLabels: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4 },
  exerciseVisual: { height: 184, borderRadius: 16, overflow: "hidden", backgroundColor: COLORS.soft, position: "relative" },
  exerciseVisualCompact: { height: 112, borderRadius: 16 },
  exerciseImage: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  imageShade: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.24)" },
  customVisual: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.soft, gap: 8 },
  customVisualLabel: { color: COLORS.muted, fontSize: 12, fontWeight: "400" },
  targetOverlay: { position: "absolute", left: 16, bottom: 16 },
  targetLabel: { color: "rgba(255,255,255,0.82)", fontSize: 11, fontWeight: "400" },
  customTargetLabel: { color: COLORS.muted },
  targetValue: { color: COLORS.white, fontSize: 20, lineHeight: 24, fontWeight: "500" },
  targetLabelIllustration: { color: COLORS.muted },
  targetValueIllustration: { color: COLORS.ink, fontSize: 13, lineHeight: 16 },
  customTargetValue: { color: COLORS.ink },
  exerciseCard: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 16, overflow: "hidden", marginBottom: 12, backgroundColor: COLORS.white },
  exerciseCardBody: { padding: 16 },
  exerciseCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  exerciseName: { color: COLORS.ink, fontSize: 16, fontWeight: "500", flex: 1 },
  exerciseTarget: { color: COLORS.muted, fontSize: 13, fontWeight: "400", marginTop: 4 },
  exerciseMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: 12, gap: 8 },
  exerciseMetaText: { color: COLORS.muted, fontSize: 12, fontWeight: "400", flexShrink: 1 },
  recommendation: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 14, backgroundColor: COLORS.white, padding: 16, flexDirection: "row", gap: 12, alignItems: "flex-start" },
  recommendationCopy: { flex: 1 },
  recommendationLabel: { color: COLORS.ink, fontSize: 14, fontWeight: "500" },
  recommendationDetail: { color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
});
