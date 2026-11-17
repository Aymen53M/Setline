CREATE TABLE `bodyMetrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`measuredAt` timestamp NOT NULL,
	`bodyWeight` decimal(8,2),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bodyMetrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `exercises` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(120) NOT NULL,
	`name` varchar(160) NOT NULL,
	`muscleGroup` varchar(80) NOT NULL,
	`secondaryMuscles` text,
	`equipment` varchar(120) NOT NULL,
	`instructions` text NOT NULL,
	`technique` text NOT NULL,
	`repRange` varchar(32) NOT NULL,
	`mediaPath` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `exercises_id` PRIMARY KEY(`id`),
	CONSTRAINT `exercises_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `programExercises` (
	`id` int AUTO_INCREMENT NOT NULL,
	`programId` int NOT NULL,
	`exerciseId` int NOT NULL,
	`trainingDay` varchar(40) NOT NULL,
	`prescribedSets` int NOT NULL,
	`minReps` int NOT NULL,
	`maxReps` int NOT NULL,
	`startingWeight` decimal(8,2),
	`exerciseOrder` int NOT NULL,
	CONSTRAINT `programExercises_id` PRIMARY KEY(`id`),
	CONSTRAINT `program_exercises_unique_idx` UNIQUE(`programId`,`exerciseId`,`trainingDay`)
);
--> statement-breakpoint
CREATE TABLE `trainingPrograms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trainingPrograms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workoutSets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workoutId` int NOT NULL,
	`exerciseId` int NOT NULL,
	`setNumber` int NOT NULL,
	`weight` decimal(8,2) NOT NULL DEFAULT '0',
	`reps` int NOT NULL,
	`rir` int NOT NULL DEFAULT 2,
	`completed` boolean NOT NULL DEFAULT false,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workoutSets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workouts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`trainingDay` varchar(40) NOT NULL,
	`startedAt` timestamp NOT NULL,
	`completedAt` timestamp,
	`duration` int,
	`notes` text,
	`clientKey` varchar(120) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workouts_id` PRIMARY KEY(`id`),
	CONSTRAINT `workouts_client_key_idx` UNIQUE(`userId`,`clientKey`)
);
--> statement-breakpoint
ALTER TABLE `bodyMetrics` ADD CONSTRAINT `bodyMetrics_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `programExercises` ADD CONSTRAINT `programExercises_programId_trainingPrograms_id_fk` FOREIGN KEY (`programId`) REFERENCES `trainingPrograms`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `programExercises` ADD CONSTRAINT `programExercises_exerciseId_exercises_id_fk` FOREIGN KEY (`exerciseId`) REFERENCES `exercises`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trainingPrograms` ADD CONSTRAINT `trainingPrograms_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workoutSets` ADD CONSTRAINT `workoutSets_workoutId_workouts_id_fk` FOREIGN KEY (`workoutId`) REFERENCES `workouts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workoutSets` ADD CONSTRAINT `workoutSets_exerciseId_exercises_id_fk` FOREIGN KEY (`exerciseId`) REFERENCES `exercises`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workouts` ADD CONSTRAINT `workouts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `body_metrics_user_date_idx` ON `bodyMetrics` (`userId`,`measuredAt`);--> statement-breakpoint
CREATE INDEX `exercises_muscle_idx` ON `exercises` (`muscleGroup`);--> statement-breakpoint
CREATE INDEX `program_exercises_day_idx` ON `programExercises` (`programId`,`trainingDay`);--> statement-breakpoint
CREATE INDEX `programs_user_idx` ON `trainingPrograms` (`userId`);--> statement-breakpoint
CREATE INDEX `workout_sets_workout_idx` ON `workoutSets` (`workoutId`);--> statement-breakpoint
CREATE INDEX `workout_sets_exercise_idx` ON `workoutSets` (`exerciseId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `workouts_user_date_idx` ON `workouts` (`userId`,`startedAt`);