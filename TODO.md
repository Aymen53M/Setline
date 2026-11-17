# TODO

- [x] Rebuild Setline’s default programs and configurations from the supplied “Your training program: Push / Pull / Lower / Upper + commute” HTML and include the plan’s stated data in the app.
  - Use Monday Push (15 sets, about 50 min), Tuesday Pull (13 sets, about 45 min), Thursday Lower (16 sets, about 55 min), and Friday Upper (17 sets, about 50 min); show Wednesday as recovery/no lifting with two easy 25-minute commute rides, Tuesday as two easy 25-minute commute rides, occasional additional weekday rides, lifting at 7:30 pm, and Saturday/Sunday off.
  - Configure all 25 listed exercise prescriptions in their listed session order with the supplied sets, rep ranges, RIR targets, rest intervals, primary/assisting muscles, alternatives, specific technique cues, and intended superset pairings; preserve the pain-free-depth/range instructions and three-second Lower leg-extension lowering. Do not invent starting weights.
  - Include the supplied intake snapshot and goals, five training principles, warm-up ramps, effort/rest/tempo/superset guidance, weekly fractional volume and rationale, double-progression increments and examples, Week 0–6 phases, conditional easy-week guidance, stall/readiness/riding/knee decision rules, scheduling rationale, removed/excluded movements and techniques, nutrition/recovery targets, Week 0 testing/logging guidance, Week 6 retest criteria, evidence references and caveats, and the source disclaimer in a readable in-app plan guide; render the complete ordered exercise-by-exercise prescription matrix there as well.
  - Record the source’s ambiguities rather than silently presenting them as explicit: adjacent supersets are the app’s interpretation of inconsistent A/B/C labels, Tuesday’s third curl set is unmatched after two paired rounds, and the “2–3 build-up sets” instruction lists three ramp steps.
  - Migrate only unchanged starter routines to the new defaults; preserve user-customized routines, custom and user-edited built-in exercise definitions, deliberate built-in deletions, active workout drafts, completed set data and historical workout records. Map old active-day names `Legs & Abs` and `Full Body` for draft resumption while retaining accurate historical labels. Do not fabricate workout history or body-weight records from the source profile.

- [ ] Deliver an installable Android APK for Setline.
  - Build the supplied Expo project into an installable Android APK.
  - Preserve the existing app identity and user data.
  - Provide the completed APK as the project deliverable, with no public website deployment.

- [x] Make the exercise library fully editable while keeping workout history intact.
  - Add the possibility to edit, add and delete any exercise.
  - Persist exercise-library changes on-device, including edits to built-in exercises and deliberate built-in deletions across app restarts and migrations.
  - Keep historical workout records readable when an exercise is renamed or deleted.

- [x] Make programmed routines and active workouts flexible and navigable.
  - Persist exercise additions, removals and ordering in each workout program.
  - When a user sets up a full workout program, automatically pass to the next programmed exercise after completing the current exercise’s planned sets.
  - Keep manual next/previous exercise navigation available during a workout.
  - Allow exercises to be added to or removed from within an active workout.
  - While a workout is in progress, allow the user to reorder its exercises when equipment or stations are unavailable; save the chosen order in the active draft without losing completed set values.
  - When a completed workout is saved, use each exercise’s most recent completed performance (including per-set weight, reps, RIR and notes when present) as the starting values for that exercise next time; create fresh unchecked sets and preserve historical records.
  - Make the active workout vertically scrollable so all exercise details, sets and controls can be reached.
  - Preserve the in-progress workout draft and completed-set data when navigating, adding/removing exercises, and returning to a session.

- [x] Improve workout timer visibility.
  - Make the timing counters much bigger and easier to see during a workout.

- [x] Redesign the app UI as a premium, minimalistic black-and-white experience.
  - Apply the requested black-and-white visual design consistently across the app.
  - Make the UI visually attractive and easy for users to read and use.
  - Keep the existing product features and content; do not change what LiftLog does.
  - Use saved training records for history-derived metrics and show honest empty states when no workouts are saved.
  - Keep key workout timers highly visible.

- [x] Preserve and resume an active workout through tab switches, phone locks, app backgrounding and accidental app closure.
  - Persist entered set values, completed sets, notes, selected exercise order and current exercise while a workout is in progress.
  - Keep an in-progress workout draft when the user switches to another app tab, locks the phone or backgrounds the app; clear the draft only when the user completes it or confirms discard.
  - Restore a saved workout on return or app relaunch, with a clear resume path from both the Dashboard and the Start workout tab.
  - Restore the elapsed workout clock from its original start time.
  - Persist the recovery timer's absolute deadline and mode so its remaining time is recalculated accurately after backgrounding or relaunch, and show when the timer has elapsed.

- [x] Rebrand the app as Setline.
  - Show the new name, “Setline,” as the app’s native display name and in user-facing brand text.
  - Create a distinctive monochrome Setline mark and apply it consistently to the launcher, Android adaptive icon, splash screen and web favicon.
  - Preserve the existing Android package ID, iOS bundle ID, Expo slug/scheme and local storage keys so existing installs and saved workout data are not orphaned.
