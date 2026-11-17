# Supplied Training Program Implementation Plan

## Goal and source

Replace Setline’s starter Push / Pull / Legs & Abs / Full Body defaults with the user-supplied four-day Push / Pull / Lower / Upper plan, and make the full plan usable as an in-app reference. Source: `/home/ubuntu/upload/Yourtrainingprogram_Push_Pull_Lower_Upper.html` (user-provided; no external research or new backend is needed).

Implement the plan as local-first program data. The canonical week is Monday Push, Tuesday Pull, Wednesday recovery/no lifting, Thursday Lower, Friday Upper, Saturday/Sunday off. Lifting time is 7:30 pm. Tuesday and Wednesday include two easy 25-minute commute rides (about 13 km/day); extra weekday rides are occasional. The four sessions target 15, 13, 16, and 17 working sets and approximately 50, 45, 55, and 50 minutes respectively.

The four sessions and their ordered prescriptions are:

- **Push:** incline dumbbell press 3×6–10 (RIR 1–2, 2–3 min); machine shoulder press 2×8–12 (1–2, 2 min); pec deck 2×10–15 (0–1, 90 sec); cable lateral raise 3×12–20 (0–1) paired with overhead cable triceps extension 3×8–15 (0–1, 60–90 sec after each pair); pain-free leg extension 2×12–15 (1–2, 90 sec).
- **Pull:** full-stretch lat pulldown 3×6–10 (1–2, 2 min); chest-supported machine row 3×8–12 (1–2, 2 min); incline dumbbell curl 3×8–12 (0–1) paired with reverse pec deck 2×12–20 (0–1, 60–90 sec after each pair); forward-lean seated leg curl 2×8–12 (0–1, 90 sec).
- **Lower:** pain-free-depth leg press 3×8–12 (1–2, 2–3 min); Romanian deadlift 3×6–10 (RIR 2, 2–3 min); 3-second-lowering leg extension 3×10–15 (0–1, 90 sec); seated leg curl 2×8–12 (0–1, 90 sec); hip abduction 2×12–20 (0–1) paired with standing calf raise 2×10–15 (0–1, 60–90 sec after each pair); cable crunch 1×10–15 (0–1).
- **Upper:** machine chest press 3×6–10 (1–2) paired with close/neutral-grip pulldown 3×8–12 (1–2, 90–120 sec after each pair); cable lateral raise 3×12–20 (0–1) paired with wide-grip seated cable row 2×10–12 (RIR 1, 60–90 sec after each pair); cable/EZ-bar curl 2×10–15 (0–1) paired with overhead triceps extension 2×10–15 (0–1, 60–90 sec after each pair); cable crunch 2×10–15 (0–1, 60 sec).

For every exercise, preserve the source’s target/assisting muscles, equipment, alternatives, movement-specific cues, set/rep range, RIR, rest interval, and superset membership. Do not invent starting loads. The only numeric tempo is the Lower leg-extension three-second eccentric; the general tempo remains controlled lowering, a brief stretched-position pause, and pain-free full range.

## Broader plan content

Add an in-app, scrollable Plan guide linked from Program. In addition to the broader source content, visibly render every ordered exercise prescription with its targets/assists, equipment, instructions, technique, sets/reps, RIR, rest, superset partner, alternative, tempo and plan notes. The guide also contains the source’s intake snapshot (181 cm; 80–82 kg; age 25–26; about one month of training; full gym; 6–7 hours sleep; 80–120 g current protein; stated knee symptoms; commute details), training priorities, five program principles, warm-up ramps, global effort/rest/tempo/superset instructions, weekly fractional volume table and rationale, double progression and load increments, first-six-week baseline/target/retest phases, conditional easy-week rules, stall/readiness/extra-ride/knee decision rules, scheduling rationale and exceptions, cut/excluded movements and techniques, nutrition/recovery targets and examples, Week 0 testing protocol, logging templates, Week 6 success/adjustment criteria, source evidence and its stated caveats, and the source disclaimer. Present the profile and nutrition information as the user-provided plan’s reference—not as new measurements or logs. Do not prepopulate body-weight history or fabricate workout records. Retain the supplied caveat that this is not medical advice and that knee guidance is load management, not a diagnosis.

## Interpretation recorded in the app

The source uses repeated superset letters and references such as “4B” inconsistently. Use adjacent exercise pairs identified by the prose as the practical pairing: Push lateral raise + overhead triceps extension; Pull incline curl + reverse pec deck; Lower hip abduction + calf raise; Upper chest press + pulldown, lateral raise + row, curl + overhead triceps extension. Document this interpretation in the guide. Pull has three curl sets but two reverse-fly sets; pair the first two sets and perform the third curl set as an unmatched solo set. The plan’s “2–3 build-up sets” sentence lists three ramp steps; preserve all three steps and state the source-count ambiguity in the guide.

## Data safety and migration

Keep workout, program, and guide data on-device; do not write personal plan details to the managed database. Migrate only the app’s previous default routines to the new defaults, using the previous built-in exercise-ID lists to detect unchanged starter programs. Preserve a user-edited routine’s order and membership when its stored list differs from the prior default; preserve custom and user-edited built-in exercise definitions, deliberate built-in deletions, archived exercises, saved history, completed workout sets, and in-progress drafts. Map the old active-session day names `Legs & Abs` and `Full Body` to `Lower` and `Upper` for resumable drafts, while retaining the original labels on historical records. Apply the new prescriptions to defaults without generating false logged values.

## UI and implementation structure

Reuse Setline’s existing monochrome visual system and Expo Router / React Native patterns. Make programming information visible on the routine cards, exercise details, and active session; have the live session show each exercise’s target RIR/rest/cue/alternative and follow the inferred superset pair with back-to-back progression and pair-rest timing. Keep manual previous/next controls and user edits to routine order and exercise membership.

- `lib/training-plan.ts`: one structured source of truth for the split, weekday schedule, exercise prescriptions, guide sections, volume, progression, decisions, nutrition, testing, evidence, and caveats.
- `lib/workout-data.ts`: current day types, plan-backed exercise catalogue/default routine IDs, optional prescription fields, and legacy historical-day compatibility.
- `lib/workout-store.tsx` / `lib/workout-session.ts`: safe AsyncStorage migration, preservation of customized programs/drafts/history, and automatic superset sequencing/rest behavior.
- `app/program-guide.tsx`: the complete read-only program guide, linked from the Program tab.
- `app/(tabs)/index.tsx`, `workout.tsx`, and `program.tsx`: updated week display, four-day selectors, new default program, and guide entry point.
- `app/workout/[day].tsx`, `app/exercise/[id].tsx`, `app/exercise/editor.tsx`, and shared UI: expose imported exercise metadata and use programmed rest/RIR while keeping existing exercise CRUD, history, timers, and manual controls.

No dependency, API, database, authentication, or publishing changes are required. Continue using the existing Mobile ports (Metro 8081 and API 3000) and save the deliverable through the project’s canonical checkpoint workflow without publishing.
