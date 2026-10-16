DO $$ BEGIN
 CREATE TYPE "public"."ai_interaction_type" AS ENUM('coach_prompt', 'coach_response', 'mentor_prompt', 'mentor_response', 'code_generation', 'code_explanation', 'debugging_help');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."ai_provider" AS ENUM('openai', 'anthropic', 'local');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."assessment_status" AS ENUM('draft', 'published', 'archived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."difficulty" AS ENUM('beginner', 'intermediate', 'advanced');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."assignment_status" AS ENUM('invited', 'in_progress', 'submitted', 'evaluated', 'reviewed', 'expired', 'withdrawn');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."session_status" AS ENUM('not_started', 'in_progress', 'paused', 'submitted', 'expired');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."audit_event_type" AS ENUM('user_created', 'user_updated', 'user_deleted', 'login', 'logout', 'password_changed', 'email_changed', 'role_changed', 'organization_created', 'organization_updated', 'organization_deleted', 'membership_added', 'membership_removed', 'membership_role_changed', 'assessment_created', 'assessment_updated', 'assessment_published', 'assessment_archived', 'assignment_created', 'assignment_updated', 'assignment_withdrawn', 'session_started', 'session_submitted', 'session_expired', 'submission_received', 'evaluation_created', 'evaluation_updated', 'review_override', 'review_completed', 'feedback_released', 'practice_attempt_consumed', 'subscription_created', 'subscription_updated', 'subscription_canceled', 'payment_succeeded', 'payment_failed', 'webhook_received', 'api_key_created', 'api_key_revoked', 'security_settings_changed', 'data_export', 'data_deletion_request');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."audit_severity" AS ENUM('info', 'warning', 'critical');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."organization_role" AS ENUM('owner', 'admin', 'member', 'viewer');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."user_role" AS ENUM('candidate', 'recruiter', 'admin');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."user_session_status" AS ENUM('active', 'expired', 'revoked');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."billing_interval" AS ENUM('monthly', 'yearly');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'open', 'paid', 'void', 'uncollectible');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."payment_status" AS ENUM('pending', 'succeeded', 'failed', 'refunded', 'canceled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."subscription_status" AS ENUM('active', 'past_due', 'canceled', 'incomplete', 'trialing');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."evaluation_record_status" AS ENUM('awaiting_evaluation', 'ready_for_review', 'inconclusive', 'needs_attention', 'reviewed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."evaluation_status" AS ENUM('demonstrated', 'partially_demonstrated', 'not_demonstrated_in_available_evidence', 'inconclusive', 'invalid_assessment_evidence');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."evidence_sufficiency" AS ENUM('sufficient', 'partial', 'insufficient', 'invalid');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."review_action" AS ENUM('accepted', 'overridden', 'clarification_requested');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."reviewer_status" AS ENUM('pending', 'in_review', 'reviewed', 'needs_attention');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."evidence_integrity" AS ENUM('available', 'partial', 'unavailable', 'mismatch');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."evidence_provenance" AS ENUM('candidate_action', 'system_generated', 'unknown');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."evidence_type" AS ENUM('submitted_snapshot', 'earlier_snapshot', 'test_result', 'application_run', 'ai_coach_prompt', 'ai_coach_response', 'file_event', 'assessment_event', 'terminal_command');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."execution_status" AS ENUM('pending', 'running', 'completed', 'failed', 'timeout', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."file_type" AS ENUM('source', 'test', 'config', 'asset', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."test_run_status" AS ENUM('pending', 'running', 'completed', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."review_queue_status" AS ENUM('awaiting_evaluation', 'ready_for_review', 'in_review', 'reviewed', 'needs_attention');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."practice_task_status" AS ENUM('not_started', 'in_progress', 'completed', 'expired');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."notification_channel" AS ENUM('email', 'in_app', 'webhook');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."notification_status" AS ENUM('pending', 'sent', 'delivered', 'failed', 'read');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."notification_type" AS ENUM('assessment_invitation', 'assessment_started', 'assessment_submitted', 'assessment_expired', 'evaluation_completed', 'review_completed', 'feedback_available', 'deadline_reminder', 'payment_due', 'subscription_changed', 'system_announcement');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."integration_provider" AS ENUM('greenhouse', 'lever', 'workday', 'bamboohr', 'slack', 'teams', 'email', 'webhook', 'custom');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."integration_status" AS ENUM('active', 'inactive', 'error', 'pending_setup');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_interactions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"usage_record_id" uuid,
	"type" "ai_interaction_type" NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"explanation" text,
	"suggestion" jsonb,
	"model" varchar(100) NOT NULL,
	"provider" "ai_provider" NOT NULL,
	"tokens_used" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_provider_configs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" "ai_provider" NOT NULL,
	"api_key_encrypted" text,
	"default_model" varchar(100) NOT NULL,
	"fallback_models" jsonb DEFAULT '[]' NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"rate_limit_per_minute" integer DEFAULT 60 NOT NULL,
	"max_tokens_per_request" integer DEFAULT 4096 NOT NULL,
	"temperature" numeric(3, 2) DEFAULT '0.7' NOT NULL,
	"max_cost_per_month" numeric(10, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_provider_configs_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_usage_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"candidate_id" uuid,
	"session_id" uuid,
	"provider" "ai_provider" NOT NULL,
	"model" varchar(100) NOT NULL,
	"interaction_type" "ai_interaction_type" NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"estimated_cost" numeric(10, 6) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assessment_files" (
	"id" uuid PRIMARY KEY NOT NULL,
	"assessment_version_id" uuid NOT NULL,
	"path" varchar(500) NOT NULL,
	"language" varchar(50) NOT NULL,
	"content" text NOT NULL,
	"is_read_only" boolean DEFAULT false NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assessment_test_configs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"assessment_version_id" uuid NOT NULL,
	"test_command" varchar(255) DEFAULT 'npm test' NOT NULL,
	"run_command" varchar(255) DEFAULT 'npm run' NOT NULL,
	"timeout_seconds" integer DEFAULT 30 NOT NULL,
	"max_output_size" integer DEFAULT 1048576 NOT NULL,
	"hidden_test_files" jsonb DEFAULT '[]' NOT NULL,
	"public_test_files" jsonb DEFAULT '[]' NOT NULL,
	"environment_variables" jsonb DEFAULT '{}' NOT NULL,
	"resource_limits" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessment_test_configs_assessment_version_id_unique" UNIQUE("assessment_version_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assessment_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"assessment_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"role" varchar(100) NOT NULL,
	"skills" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"difficulty" "difficulty" DEFAULT 'intermediate' NOT NULL,
	"starter_files" jsonb DEFAULT '[]' NOT NULL,
	"test_config" jsonb DEFAULT '{}' NOT NULL,
	"instructions" text,
	"ai_policy" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"is_current" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assessments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"role" varchar(100) NOT NULL,
	"skills" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"difficulty" "difficulty" DEFAULT 'intermediate' NOT NULL,
	"status" "assessment_status" DEFAULT 'draft' NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rubric_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"assessment_version_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"criteria" jsonb DEFAULT '[]' NOT NULL,
	"total_points" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assessment_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"assignment_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"assessment_version_id" uuid NOT NULL,
	"status" "session_status" DEFAULT 'not_started' NOT NULL,
	"started_at" timestamp with time zone,
	"paused_at" timestamp with time zone,
	"resumed_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"time_remaining_seconds" integer,
	"total_paused_seconds" integer DEFAULT 0 NOT NULL,
	"current_file" varchar(500),
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "candidate_assignments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"assessment_id" uuid NOT NULL,
	"assessment_version_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"assigned_by" uuid NOT NULL,
	"status" "assignment_status" DEFAULT 'invited' NOT NULL,
	"deadline" timestamp with time zone,
	"started_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"withdrawn_at" timestamp with time zone,
	"withdrawn_reason" text,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session_state_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"previous_status" "session_status",
	"new_status" "session_status" NOT NULL,
	"triggered_by" uuid,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"event_type" "audit_event_type" NOT NULL,
	"severity" "audit_severity" DEFAULT 'info' NOT NULL,
	"description" text NOT NULL,
	"entity_type" varchar(100),
	"entity_id" uuid,
	"previous_state" jsonb,
	"new_state" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"request_id" varchar(255),
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "data_access_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"request_type" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"requested_data" jsonb DEFAULT '{}' NOT NULL,
	"response_data" jsonb,
	"processed_by" uuid,
	"processed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "data_retention_policies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"assessment_data_days" integer DEFAULT 2555 NOT NULL,
	"session_data_days" integer DEFAULT 2555 NOT NULL,
	"evidence_data_days" integer DEFAULT 2555 NOT NULL,
	"evaluation_data_days" integer DEFAULT 2555 NOT NULL,
	"audit_log_days" integer DEFAULT 2555 NOT NULL,
	"practice_data_days" integer DEFAULT 1095 NOT NULL,
	"billing_data_days" integer DEFAULT 2555 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp with time zone,
	"next_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "data_retention_policies_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "candidate_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"headline" varchar(255),
	"bio" text,
	"location" varchar(255),
	"timezone" varchar(50) DEFAULT 'UTC',
	"github_url" varchar(500),
	"linkedin_url" varchar(500),
	"portfolio_url" varchar(500),
	"skills" text DEFAULT '[]',
	"experience_years" integer,
	"preferred_roles" text DEFAULT '[]',
	"practice_attempts_used" integer DEFAULT 0 NOT NULL,
	"practice_attempts_limit" integer DEFAULT 3 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_memberships" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "organization_role" DEFAULT 'member' NOT NULL,
	"invited_by" uuid,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organizations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"logo_url" varchar(500),
	"website_url" varchar(500),
	"billing_email" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"settings" text DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"auth_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"role" "user_role" DEFAULT 'candidate' NOT NULL,
	"avatar_url" varchar(500),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_auth_id_unique" UNIQUE("auth_id"),
	CONSTRAINT "user_profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"status" "user_session_status" DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_transactions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"amount" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"description" text,
	"reference_id" uuid,
	"reference_type" varchar(50),
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"subscription_id" uuid,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"amount_due" integer NOT NULL,
	"amount_paid" integer DEFAULT 0 NOT NULL,
	"amount_remaining" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"invoice_number" varchar(50) NOT NULL,
	"issue_date" timestamp with time zone DEFAULT now() NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"stripe_invoice_id" varchar(255),
	"hosted_invoice_url" varchar(500),
	"invoice_pdf_url" varchar(500),
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_webhook_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"provider" varchar(50) DEFAULT 'stripe' NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"event_id" varchar(255) NOT NULL,
	"payload" jsonb NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_webhook_events_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"invoice_id" uuid,
	"amount" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"payment_method" varchar(50),
	"payment_method_details" jsonb DEFAULT '{}',
	"stripe_payment_intent_id" varchar(255),
	"stripe_charge_id" varchar(255),
	"failure_reason" text,
	"refunded_at" timestamp with time zone,
	"refund_amount" integer,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscription_plans" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"price_amount" integer NOT NULL,
	"price_currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"interval" "billing_interval" DEFAULT 'monthly' NOT NULL,
	"features" jsonb DEFAULT '{}' NOT NULL,
	"practice_attempts_included" integer DEFAULT 0 NOT NULL,
	"assessment_credits_included" integer DEFAULT 0 NOT NULL,
	"max_team_members" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_popular" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"stripe_price_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"status" "subscription_status" DEFAULT 'incomplete' NOT NULL,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp with time zone,
	"trial_start" timestamp with time zone,
	"trial_end" timestamp with time zone,
	"stripe_customer_id" varchar(255),
	"stripe_subscription_id" varchar(255),
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "candidate_feedback" (
	"id" uuid PRIMARY KEY NOT NULL,
	"evaluation_id" uuid NOT NULL,
	"feedback" jsonb DEFAULT '{}' NOT NULL,
	"is_available" boolean DEFAULT false NOT NULL,
	"released_at" timestamp with time zone,
	"released_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_feedback_evaluation_id_unique" UNIQUE("evaluation_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "evaluation_criteria" (
	"id" uuid PRIMARY KEY NOT NULL,
	"evaluation_id" uuid NOT NULL,
	"criterion_id" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"rubric" text NOT NULL,
	"weight" integer NOT NULL,
	"status" "evaluation_status" NOT NULL,
	"supported_score" integer,
	"sufficiency" "evidence_sufficiency" NOT NULL,
	"missing_evidence" jsonb DEFAULT '[]' NOT NULL,
	"explanation" text NOT NULL,
	"candidate_visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "evaluations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"previous_evaluation_id" uuid,
	"candidate_id" uuid NOT NULL,
	"candidate_name" varchar(255) NOT NULL,
	"organization_id" uuid NOT NULL,
	"organization_name" varchar(255) NOT NULL,
	"assignment_id" uuid NOT NULL,
	"assessment_id" uuid NOT NULL,
	"assessment_title" varchar(255) NOT NULL,
	"task_title" varchar(255) NOT NULL,
	"session_id" uuid NOT NULL,
	"submission_revision_id" uuid NOT NULL,
	"submission_timestamp" timestamp with time zone NOT NULL,
	"rubric_version" varchar(100) NOT NULL,
	"evaluator_version" varchar(100) NOT NULL,
	"evaluator_method" varchar(100) NOT NULL,
	"evaluated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"evidence_coverage" integer DEFAULT 0 NOT NULL,
	"aggregate_score" integer,
	"excluded_criteria" jsonb DEFAULT '[]' NOT NULL,
	"evaluation_status" "evaluation_record_status" DEFAULT 'awaiting_evaluation' NOT NULL,
	"limitations" jsonb DEFAULT '[]' NOT NULL,
	"conflicts" jsonb DEFAULT '[]' NOT NULL,
	"reviewer_status" "reviewer_status" DEFAULT 'pending' NOT NULL,
	"reviewer_outcome" varchar(50),
	"internal_reviewer_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finding_evidence_links" (
	"id" uuid PRIMARY KEY NOT NULL,
	"criterion_id" uuid NOT NULL,
	"evidence_id" uuid NOT NULL,
	"link_type" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "review_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"evaluation_id" uuid NOT NULL,
	"criterion_id" uuid NOT NULL,
	"action" "review_action" NOT NULL,
	"previous_status" "evaluation_status" NOT NULL,
	"new_status" "evaluation_status" NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"reviewer_name" varchar(255) NOT NULL,
	"reason" text NOT NULL,
	"evidence_ids" jsonb DEFAULT '[]' NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "activity_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"file" varchar(500),
	"revision_id" uuid,
	"result_id" uuid,
	"terminal_id" varchar(255),
	"detail" text NOT NULL,
	"provenance" "evidence_provenance" NOT NULL,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "code_revision_links" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"revision_id" uuid NOT NULL,
	"evidence_id" uuid NOT NULL,
	"link_type" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "evidence_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"candidate_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"assignment_id" uuid NOT NULL,
	"assessment_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"type" "evidence_type" NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"title" varchar(255) NOT NULL,
	"summary" text NOT NULL,
	"file" varchar(500),
	"revision_id" uuid,
	"source_event_id" varchar(255),
	"result_id" varchar(255),
	"content_ref" varchar(255) NOT NULL,
	"provenance" "evidence_provenance" NOT NULL,
	"integrity" "evidence_integrity" DEFAULT 'available' NOT NULL,
	"test_status" varchar(50),
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "execution_artifacts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"execution_run_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(50) NOT NULL,
	"storage_path" varchar(500) NOT NULL,
	"size_bytes" integer NOT NULL,
	"mime_type" varchar(100),
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "execution_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"revision_id" uuid NOT NULL,
	"type" varchar(50) DEFAULT 'run' NOT NULL,
	"command" text,
	"status" "execution_status" DEFAULT 'pending' NOT NULL,
	"exit_code" integer,
	"stdout" text,
	"stderr" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"duration_ms" integer,
	"resource_usage" jsonb DEFAULT '{}',
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session_files" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"path" varchar(500) NOT NULL,
	"language" varchar(50) NOT NULL,
	"content" text NOT NULL,
	"is_read_only" boolean DEFAULT false NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "test_results" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"execution_run_id" uuid NOT NULL,
	"revision_id" uuid NOT NULL,
	"test_suite" varchar(255),
	"test_name" varchar(255) NOT NULL,
	"status" varchar(50) NOT NULL,
	"duration_ms" integer,
	"output" text,
	"error" text,
	"criterion" varchar(255),
	"is_hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workspace_revisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"files" jsonb DEFAULT '[]' NOT NULL,
	"message" text,
	"is_snapshot" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "review_queue" (
	"id" uuid PRIMARY KEY NOT NULL,
	"evaluation_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"assignment_id" uuid NOT NULL,
	"status" "review_queue_status" DEFAULT 'awaiting_evaluation' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"assigned_reviewer_id" uuid,
	"submitted_at" timestamp with time zone NOT NULL,
	"evaluation_completed_at" timestamp with time zone,
	"review_started_at" timestamp with time zone,
	"review_completed_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_queue_evaluation_id_unique" UNIQUE("evaluation_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reviewer_decisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"evaluation_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"overall_outcome" varchar(50) NOT NULL,
	"criterion_decisions" jsonb DEFAULT '[]' NOT NULL,
	"notes" text,
	"is_final" boolean DEFAULT false NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reviewer_notes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"evaluation_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"note" text NOT NULL,
	"is_internal" boolean DEFAULT true NOT NULL,
	"criterion_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "practice_allowances" (
	"id" uuid PRIMARY KEY NOT NULL,
	"candidate_id" uuid NOT NULL,
	"free_attempts_used" integer DEFAULT 0 NOT NULL,
	"free_attempts_limit" integer DEFAULT 3 NOT NULL,
	"paid_attempts_purchased" integer DEFAULT 0 NOT NULL,
	"paid_attempts_used" integer DEFAULT 0 NOT NULL,
	"subscription_id" uuid,
	"last_reset_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "practice_allowances_candidate_id_unique" UNIQUE("candidate_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "practice_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"candidate_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"status" "practice_task_status" DEFAULT 'not_started' NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"duration_minutes" integer NOT NULL,
	"time_remaining_seconds" integer,
	"total_paused_seconds" integer DEFAULT 0 NOT NULL,
	"current_file" varchar(500),
	"files" jsonb DEFAULT '[]' NOT NULL,
	"revisions" jsonb DEFAULT '[]' NOT NULL,
	"run_history" jsonb DEFAULT '[]' NOT NULL,
	"test_runs" jsonb DEFAULT '[]' NOT NULL,
	"activity" jsonb DEFAULT '[]' NOT NULL,
	"coach_messages" jsonb DEFAULT '[]' NOT NULL,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "practice_tasks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"difficulty" varchar(20) NOT NULL,
	"skills" jsonb DEFAULT '[]' NOT NULL,
	"duration_minutes" integer NOT NULL,
	"starter_files" jsonb DEFAULT '[]' NOT NULL,
	"test_patterns" jsonb DEFAULT '[]' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "usage_ledger" (
	"id" uuid PRIMARY KEY NOT NULL,
	"candidate_id" uuid NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"event_id" uuid NOT NULL,
	"attempts_consumed" integer DEFAULT 0 NOT NULL,
	"description" text,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"subject" varchar(255),
	"body" text,
	"template_id" varchar(100),
	"template_data" jsonb DEFAULT '{}',
	"reference_id" uuid,
	"reference_type" varchar(50),
	"scheduled_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"failure_reason" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_templates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"name" varchar(100) NOT NULL,
	"type" "notification_type" NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"subject" varchar(255),
	"body_template" text NOT NULL,
	"variables" jsonb DEFAULT '[]' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "export_jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"format" varchar(20) DEFAULT 'json' NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"filters" jsonb DEFAULT '{}',
	"file_path" varchar(500),
	"file_size" integer,
	"expires_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "integration_connections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"name" varchar(255) NOT NULL,
	"status" "integration_status" DEFAULT 'pending_setup' NOT NULL,
	"config" jsonb DEFAULT '{}' NOT NULL,
	"credentials_encrypted" text,
	"sync_enabled" boolean DEFAULT true NOT NULL,
	"sync_frequency" varchar(50) DEFAULT 'daily' NOT NULL,
	"last_sync_at" timestamp with time zone,
	"last_sync_status" varchar(50),
	"last_sync_error" text,
	"field_mappings" jsonb DEFAULT '{}',
	"filters" jsonb DEFAULT '{}',
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "integration_sync_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"connection_id" uuid NOT NULL,
	"sync_type" varchar(50) NOT NULL,
	"status" varchar(50) NOT NULL,
	"records_processed" integer DEFAULT 0 NOT NULL,
	"records_created" integer DEFAULT 0 NOT NULL,
	"records_updated" integer DEFAULT 0 NOT NULL,
	"records_failed" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"response_status" integer,
	"response_body" text,
	"attempt" integer DEFAULT 1 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"is_success" boolean DEFAULT false NOT NULL,
	"error" text,
	"next_retry_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_endpoints" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"url" varchar(500) NOT NULL,
	"events" jsonb DEFAULT '[]' NOT NULL,
	"secret" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"retry_policy" jsonb DEFAULT '{}' NOT NULL,
	"last_triggered_at" timestamp with time zone,
	"last_status" varchar(50),
	"last_error" text,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_interactions" ADD CONSTRAINT "ai_interactions_session_id_assessment_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."assessment_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_interactions" ADD CONSTRAINT "ai_interactions_usage_record_id_ai_usage_records_id_fk" FOREIGN KEY ("usage_record_id") REFERENCES "public"."ai_usage_records"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_provider_configs" ADD CONSTRAINT "ai_provider_configs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_usage_records" ADD CONSTRAINT "ai_usage_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_usage_records" ADD CONSTRAINT "ai_usage_records_candidate_id_user_profiles_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_usage_records" ADD CONSTRAINT "ai_usage_records_session_id_assessment_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."assessment_sessions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_files" ADD CONSTRAINT "assessment_files_assessment_version_id_assessment_versions_id_fk" FOREIGN KEY ("assessment_version_id") REFERENCES "public"."assessment_versions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_test_configs" ADD CONSTRAINT "assessment_test_configs_assessment_version_id_assessment_versions_id_fk" FOREIGN KEY ("assessment_version_id") REFERENCES "public"."assessment_versions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_versions" ADD CONSTRAINT "assessment_versions_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessments" ADD CONSTRAINT "assessments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessments" ADD CONSTRAINT "assessments_created_by_user_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rubric_versions" ADD CONSTRAINT "rubric_versions_assessment_version_id_assessment_versions_id_fk" FOREIGN KEY ("assessment_version_id") REFERENCES "public"."assessment_versions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_sessions" ADD CONSTRAINT "assessment_sessions_assignment_id_candidate_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."candidate_assignments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_sessions" ADD CONSTRAINT "assessment_sessions_candidate_id_user_profiles_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_sessions" ADD CONSTRAINT "assessment_sessions_assessment_version_id_assessment_versions_id_fk" FOREIGN KEY ("assessment_version_id") REFERENCES "public"."assessment_versions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "candidate_assignments" ADD CONSTRAINT "candidate_assignments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "candidate_assignments" ADD CONSTRAINT "candidate_assignments_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "candidate_assignments" ADD CONSTRAINT "candidate_assignments_assessment_version_id_assessment_versions_id_fk" FOREIGN KEY ("assessment_version_id") REFERENCES "public"."assessment_versions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "candidate_assignments" ADD CONSTRAINT "candidate_assignments_candidate_id_user_profiles_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "candidate_assignments" ADD CONSTRAINT "candidate_assignments_assigned_by_user_profiles_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "session_state_events" ADD CONSTRAINT "session_state_events_session_id_assessment_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."assessment_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "session_state_events" ADD CONSTRAINT "session_state_events_triggered_by_user_profiles_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "data_access_requests" ADD CONSTRAINT "data_access_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "data_access_requests" ADD CONSTRAINT "data_access_requests_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "data_access_requests" ADD CONSTRAINT "data_access_requests_processed_by_user_profiles_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "data_retention_policies" ADD CONSTRAINT "data_retention_policies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_invited_by_user_profiles_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "candidate_feedback" ADD CONSTRAINT "candidate_feedback_evaluation_id_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "candidate_feedback" ADD CONSTRAINT "candidate_feedback_released_by_user_profiles_id_fk" FOREIGN KEY ("released_by") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "evaluation_criteria" ADD CONSTRAINT "evaluation_criteria_evaluation_id_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_previous_evaluation_id_evaluations_id_fk" FOREIGN KEY ("previous_evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_candidate_id_user_profiles_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_assignment_id_candidate_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."candidate_assignments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_session_id_assessment_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."assessment_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "finding_evidence_links" ADD CONSTRAINT "finding_evidence_links_criterion_id_evaluation_criteria_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."evaluation_criteria"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "finding_evidence_links" ADD CONSTRAINT "finding_evidence_links_evidence_id_evidence_records_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence_records"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "review_events" ADD CONSTRAINT "review_events_evaluation_id_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "review_events" ADD CONSTRAINT "review_events_criterion_id_evaluation_criteria_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."evaluation_criteria"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "review_events" ADD CONSTRAINT "review_events_reviewer_id_user_profiles_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_session_id_assessment_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."assessment_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_revision_id_workspace_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."workspace_revisions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_result_id_test_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."test_results"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "code_revision_links" ADD CONSTRAINT "code_revision_links_session_id_assessment_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."assessment_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "code_revision_links" ADD CONSTRAINT "code_revision_links_revision_id_workspace_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."workspace_revisions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "code_revision_links" ADD CONSTRAINT "code_revision_links_evidence_id_evidence_records_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence_records"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "evidence_records" ADD CONSTRAINT "evidence_records_candidate_id_user_profiles_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "evidence_records" ADD CONSTRAINT "evidence_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "evidence_records" ADD CONSTRAINT "evidence_records_assignment_id_candidate_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."candidate_assignments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "evidence_records" ADD CONSTRAINT "evidence_records_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "evidence_records" ADD CONSTRAINT "evidence_records_session_id_assessment_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."assessment_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "evidence_records" ADD CONSTRAINT "evidence_records_revision_id_workspace_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."workspace_revisions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "execution_artifacts" ADD CONSTRAINT "execution_artifacts_execution_run_id_execution_runs_id_fk" FOREIGN KEY ("execution_run_id") REFERENCES "public"."execution_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "execution_runs" ADD CONSTRAINT "execution_runs_session_id_assessment_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."assessment_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "execution_runs" ADD CONSTRAINT "execution_runs_revision_id_workspace_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."workspace_revisions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "session_files" ADD CONSTRAINT "session_files_session_id_assessment_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."assessment_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "test_results" ADD CONSTRAINT "test_results_session_id_assessment_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."assessment_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "test_results" ADD CONSTRAINT "test_results_execution_run_id_execution_runs_id_fk" FOREIGN KEY ("execution_run_id") REFERENCES "public"."execution_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "test_results" ADD CONSTRAINT "test_results_revision_id_workspace_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."workspace_revisions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workspace_revisions" ADD CONSTRAINT "workspace_revisions_session_id_assessment_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."assessment_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "review_queue" ADD CONSTRAINT "review_queue_evaluation_id_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "review_queue" ADD CONSTRAINT "review_queue_candidate_id_user_profiles_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "review_queue" ADD CONSTRAINT "review_queue_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "review_queue" ADD CONSTRAINT "review_queue_assignment_id_candidate_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."candidate_assignments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "review_queue" ADD CONSTRAINT "review_queue_assigned_reviewer_id_user_profiles_id_fk" FOREIGN KEY ("assigned_reviewer_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reviewer_decisions" ADD CONSTRAINT "reviewer_decisions_evaluation_id_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reviewer_decisions" ADD CONSTRAINT "reviewer_decisions_reviewer_id_user_profiles_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reviewer_notes" ADD CONSTRAINT "reviewer_notes_evaluation_id_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reviewer_notes" ADD CONSTRAINT "reviewer_notes_reviewer_id_user_profiles_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reviewer_notes" ADD CONSTRAINT "reviewer_notes_criterion_id_evaluation_criteria_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."evaluation_criteria"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "practice_allowances" ADD CONSTRAINT "practice_allowances_candidate_id_user_profiles_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_candidate_id_user_profiles_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "usage_ledger" ADD CONSTRAINT "usage_ledger_candidate_id_user_profiles_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_requested_by_user_profiles_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integration_sync_logs" ADD CONSTRAINT "integration_sync_logs_connection_id_integration_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."integration_connections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_endpoint_id_webhook_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."webhook_endpoints"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_interactions_session_idx_v2" ON "ai_interactions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_interactions_type_idx_v2" ON "ai_interactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_interactions_created_at_idx_v2" ON "ai_interactions" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_configs_org_idx" ON "ai_provider_configs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_configs_provider_idx" ON "ai_provider_configs" USING btree ("provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_org_idx" ON "ai_usage_records" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_candidate_idx" ON "ai_usage_records" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_session_idx" ON "ai_usage_records" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_created_at_idx" ON "ai_usage_records" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "assessment_files_version_path_idx" ON "assessment_files" USING btree ("assessment_version_id","path");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_files_version_idx" ON "assessment_files" USING btree ("assessment_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "test_configs_version_idx" ON "assessment_test_configs" USING btree ("assessment_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "assessment_versions_assessment_version_idx" ON "assessment_versions" USING btree ("assessment_id","version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_versions_assessment_idx" ON "assessment_versions" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_versions_current_idx" ON "assessment_versions" USING btree ("is_current");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessments_org_idx" ON "assessments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessments_status_idx" ON "assessments" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessments_created_by_idx" ON "assessments" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "rubric_versions_version_idx" ON "rubric_versions" USING btree ("assessment_version_id","version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rubric_versions_assessment_version_idx" ON "rubric_versions" USING btree ("assessment_version_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rubric_versions_current_idx" ON "rubric_versions" USING btree ("is_current");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_assignment_idx" ON "assessment_sessions" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_candidate_idx" ON "assessment_sessions" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_status_idx" ON "assessment_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_expires_at_idx" ON "assessment_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "assignments_org_candidate_idx" ON "candidate_assignments" USING btree ("organization_id","candidate_id","assessment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assignments_org_idx" ON "candidate_assignments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assignments_candidate_idx" ON "candidate_assignments" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assignments_assessment_idx" ON "candidate_assignments" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assignments_status_idx" ON "candidate_assignments" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assignments_deadline_idx" ON "candidate_assignments" USING btree ("deadline");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_events_session_idx" ON "session_state_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_events_type_idx" ON "session_state_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_events_created_at_idx" ON "session_state_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_org_idx" ON "audit_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_user_idx" ON "audit_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_type_idx" ON "audit_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_severity_idx" ON "audit_events" USING btree ("severity");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_entity_idx" ON "audit_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_created_at_idx" ON "audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_request_id_idx" ON "audit_events" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "data_access_requests_org_idx" ON "data_access_requests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "data_access_requests_user_idx" ON "data_access_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "data_access_requests_status_idx" ON "data_access_requests" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "retention_policies_org_idx" ON "data_retention_policies" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "candidate_profiles_user_idx" ON "candidate_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "org_memberships_org_user_idx" ON "organization_memberships" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_memberships_org_idx" ON "organization_memberships" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_memberships_user_idx" ON "organization_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_memberships_role_idx" ON "organization_memberships" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_slug_idx" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_active_idx" ON "organizations" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_profiles_auth_id_idx" ON "user_profiles" USING btree ("auth_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_profiles_email_idx" ON "user_profiles" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_profiles_role_idx" ON "user_profiles" USING btree ("role");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_profiles_active_idx" ON "user_profiles" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_sessions_user_idx" ON "user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_sessions_token_hash_idx" ON "user_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_sessions_status_idx" ON "user_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_sessions_expires_at_idx" ON "user_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_transactions_org_idx" ON "credit_transactions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_transactions_ref_idx" ON "credit_transactions" USING btree ("reference_id","reference_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_org_idx" ON "invoices" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_number_idx" ON "invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "webhook_events_event_id_idx" ON "payment_webhook_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_events_processed_idx" ON "payment_webhook_events" USING btree ("processed");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_org_idx" ON "payments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_invoice_idx" ON "payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plans_active_idx" ON "subscription_plans" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_org_idx" ON "subscriptions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_plan_idx" ON "subscriptions" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "candidate_feedback_evaluation_idx" ON "candidate_feedback" USING btree ("evaluation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "criteria_evaluation_idx" ON "evaluation_criteria" USING btree ("evaluation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "criteria_criterion_idx" ON "evaluation_criteria" USING btree ("criterion_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "evaluations_session_idx" ON "evaluations" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "evaluations_candidate_idx" ON "evaluations" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "evaluations_org_idx" ON "evaluations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "evaluations_status_idx" ON "evaluations" USING btree ("evaluation_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "evaluations_reviewer_status_idx" ON "evaluations" USING btree ("reviewer_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "finding_evidence_criterion_idx" ON "finding_evidence_links" USING btree ("criterion_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "finding_evidence_evidence_idx" ON "finding_evidence_links" USING btree ("evidence_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "review_events_evaluation_idx" ON "review_events" USING btree ("evaluation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "review_events_criterion_idx" ON "review_events" USING btree ("criterion_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "review_events_reviewer_idx" ON "review_events" USING btree ("reviewer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "review_events_timestamp_idx" ON "review_events" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_events_session_idx" ON "activity_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_events_type_idx" ON "activity_events" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_events_timestamp_idx" ON "activity_events" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "code_revision_links_revision_idx" ON "code_revision_links" USING btree ("revision_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "code_revision_links_evidence_idx" ON "code_revision_links" USING btree ("evidence_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "evidence_session_idx" ON "evidence_records" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "evidence_candidate_idx" ON "evidence_records" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "evidence_type_idx" ON "evidence_records" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "evidence_timestamp_idx" ON "evidence_records" USING btree ("timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "evidence_content_ref_idx" ON "evidence_records" USING btree ("content_ref");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "execution_artifacts_run_idx" ON "execution_artifacts" USING btree ("execution_run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "execution_runs_session_idx" ON "execution_runs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "execution_runs_revision_idx" ON "execution_runs" USING btree ("revision_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "execution_runs_status_idx" ON "execution_runs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "session_files_session_path_idx" ON "session_files" USING btree ("session_id","path");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_files_session_idx" ON "session_files" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "test_results_session_idx" ON "test_results" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "test_results_execution_run_idx" ON "test_results" USING btree ("execution_run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "test_results_revision_idx" ON "test_results" USING btree ("revision_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "test_results_status_idx" ON "test_results" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "revisions_session_number_idx" ON "workspace_revisions" USING btree ("session_id","revision_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "revisions_session_idx" ON "workspace_revisions" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "review_queue_evaluation_idx" ON "review_queue" USING btree ("evaluation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "review_queue_org_status_idx" ON "review_queue" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "review_queue_reviewer_idx" ON "review_queue" USING btree ("assigned_reviewer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "review_queue_priority_idx" ON "review_queue" USING btree ("priority");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "reviewer_decisions_evaluation_idx" ON "reviewer_decisions" USING btree ("evaluation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reviewer_decisions_reviewer_idx" ON "reviewer_decisions" USING btree ("reviewer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reviewer_notes_evaluation_idx" ON "reviewer_notes" USING btree ("evaluation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reviewer_notes_reviewer_idx" ON "reviewer_notes" USING btree ("reviewer_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "practice_allowances_candidate_idx" ON "practice_allowances" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "practice_sessions_candidate_idx" ON "practice_sessions" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "practice_sessions_task_idx" ON "practice_sessions" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "practice_sessions_status_idx" ON "practice_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "practice_tasks_active_idx" ON "practice_tasks" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "practice_tasks_order_idx" ON "practice_tasks" USING btree ("order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_ledger_candidate_idx" ON "usage_ledger" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_ledger_event_idx" ON "usage_ledger" USING btree ("event_type","event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_ledger_created_at_idx" ON "usage_ledger" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_org_idx" ON "notification_jobs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_idx" ON "notification_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_type_idx" ON "notification_jobs" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_status_idx" ON "notification_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_scheduled_at_idx" ON "notification_jobs" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_ref_idx" ON "notification_jobs" USING btree ("reference_id","reference_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "templates_org_idx" ON "notification_templates" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "templates_type_channel_idx" ON "notification_templates" USING btree ("type","channel");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "export_jobs_org_idx" ON "export_jobs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "export_jobs_status_idx" ON "export_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "integrations_org_idx" ON "integration_connections" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "integrations_provider_idx" ON "integration_connections" USING btree ("provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "integrations_status_idx" ON "integration_connections" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sync_logs_connection_idx" ON "integration_sync_logs" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sync_logs_status_idx" ON "integration_sync_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sync_logs_started_at_idx" ON "integration_sync_logs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_deliveries_endpoint_idx" ON "webhook_deliveries" USING btree ("endpoint_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_deliveries_event_idx" ON "webhook_deliveries" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_deliveries_success_idx" ON "webhook_deliveries" USING btree ("is_success");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_deliveries_next_retry_idx" ON "webhook_deliveries" USING btree ("next_retry_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhooks_org_idx" ON "webhook_endpoints" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhooks_active_idx" ON "webhook_endpoints" USING btree ("is_active");