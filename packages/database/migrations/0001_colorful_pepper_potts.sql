DO $$ BEGIN
 CREATE TYPE "public"."challenge_status" AS ENUM('offered', 'in_progress', 'submitted', 'verified', 'failed', 'expired', 'revoked');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."skill_status" AS ENUM('demonstrated', 'partially_demonstrated', 'not_demonstrated_in_available_evidence', 'not_assessed', 'inconclusive');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."submission_kind" AS ENUM('assessment', 'verification_followup');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."submission_status" AS ENUM('completed', 'failed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "challenge_templates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" varchar(100) NOT NULL,
	"organization_id" uuid,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"skill_key" varchar(100) NOT NULL,
	"target_criterion_id" varchar(100) NOT NULL,
	"prompt" text NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"entry_file" varchar(500) NOT NULL,
	"export_name" varchar(100) NOT NULL,
	"private_tests" jsonb DEFAULT '[]' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "skill_assessments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"evaluation_id" uuid,
	"organization_id" uuid NOT NULL,
	"criterion_id" varchar(100) NOT NULL,
	"skill_key" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"status" "skill_status" DEFAULT 'not_assessed' NOT NULL,
	"original_status" "skill_status" DEFAULT 'not_assessed' NOT NULL,
	"evidence_ids" jsonb DEFAULT '[]' NOT NULL,
	"explanation" text DEFAULT '' NOT NULL,
	"last_challenge_id" uuid,
	"history" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "submissions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"submission_version" integer NOT NULL,
	"kind" "submission_kind" DEFAULT 'assessment' NOT NULL,
	"challenge_id" uuid,
	"candidate_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"assignment_id" uuid NOT NULL,
	"assessment_id" uuid NOT NULL,
	"assessment_version_id" uuid NOT NULL,
	"revision_id" uuid NOT NULL,
	"files" jsonb DEFAULT '[]' NOT NULL,
	"idempotency_key" varchar(255),
	"status" "submission_status" DEFAULT 'completed' NOT NULL,
	"test_summary" jsonb DEFAULT '{}',
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification_challenges" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"assignment_id" uuid NOT NULL,
	"assessment_id" uuid NOT NULL,
	"assessment_version_id" uuid NOT NULL,
	"evaluation_id" uuid,
	"template_id" uuid NOT NULL,
	"template_key" varchar(100) NOT NULL,
	"criterion_id" varchar(100) NOT NULL,
	"skill_key" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"prompt" text NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"entry_file" varchar(500) NOT NULL,
	"export_name" varchar(100) NOT NULL,
	"private_tests" jsonb DEFAULT '[]' NOT NULL,
	"status" "challenge_status" DEFAULT 'offered' NOT NULL,
	"trigger_evidence_id" uuid,
	"trigger_summary" text DEFAULT '' NOT NULL,
	"original_status" "skill_status" NOT NULL,
	"follow_up_submission_id" uuid,
	"result_status" "skill_status",
	"passed_tests" integer DEFAULT 0 NOT NULL,
	"total_tests" integer DEFAULT 0 NOT NULL,
	"offered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "challenge_templates" ADD CONSTRAINT "challenge_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "skill_assessments" ADD CONSTRAINT "skill_assessments_session_id_assessment_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."assessment_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "skill_assessments" ADD CONSTRAINT "skill_assessments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "submissions" ADD CONSTRAINT "submissions_session_id_assessment_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."assessment_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "submissions" ADD CONSTRAINT "submissions_candidate_id_user_profiles_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "submissions" ADD CONSTRAINT "submissions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "submissions" ADD CONSTRAINT "submissions_assignment_id_candidate_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."candidate_assignments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "submissions" ADD CONSTRAINT "submissions_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "submissions" ADD CONSTRAINT "submissions_assessment_version_id_assessment_versions_id_fk" FOREIGN KEY ("assessment_version_id") REFERENCES "public"."assessment_versions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "submissions" ADD CONSTRAINT "submissions_revision_id_workspace_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."workspace_revisions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "verification_challenges" ADD CONSTRAINT "verification_challenges_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "verification_challenges" ADD CONSTRAINT "verification_challenges_session_id_assessment_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."assessment_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "verification_challenges" ADD CONSTRAINT "verification_challenges_assignment_id_candidate_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."candidate_assignments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "verification_challenges" ADD CONSTRAINT "verification_challenges_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "verification_challenges" ADD CONSTRAINT "verification_challenges_assessment_version_id_assessment_versions_id_fk" FOREIGN KEY ("assessment_version_id") REFERENCES "public"."assessment_versions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "verification_challenges" ADD CONSTRAINT "verification_challenges_template_id_challenge_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."challenge_templates"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "challenge_templates_key_idx" ON "challenge_templates" USING btree ("key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "challenge_templates_skill_idx" ON "challenge_templates" USING btree ("skill_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "skill_assessments_session_criterion_idx" ON "skill_assessments" USING btree ("session_id","criterion_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "skill_assessments_session_idx" ON "skill_assessments" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "submissions_session_version_idx" ON "submissions" USING btree ("session_id","submission_version");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "submissions_idempotency_idx" ON "submissions" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "submissions_session_idx" ON "submissions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "submissions_candidate_idx" ON "submissions" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "submissions_kind_idx" ON "submissions" USING btree ("kind");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "verification_challenges_session_template_idx" ON "verification_challenges" USING btree ("session_id","template_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verification_challenges_session_idx" ON "verification_challenges" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verification_challenges_org_idx" ON "verification_challenges" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verification_challenges_status_idx" ON "verification_challenges" USING btree ("status");