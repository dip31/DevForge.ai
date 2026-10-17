-- =============================================================================
-- DevForge.ai — Complete Database Schema
-- PostgreSQL 15+ / Supabase
--
-- Modules:
--   01  Identity & Organizations
--   02  Assessment Management
--   03  Assignments & Sessions
--   04  Workspace & Execution
--   05  Evidence Collection
--   06  Evaluation Engine
--   07  Reports & Human Review
--   08  Practice & Entitlements
--   09  Billing & Payments
--   10  AI Assistance
--   11  Notifications
--   12  Audit & Compliance
--   13  External Integrations
--
-- Notes:
--   • Authentication is managed by Supabase Auth (auth.users).
--     Application identity lives in user_profiles, linked by auth_id (JWT sub).
--   • All monetary amounts are integer minor units (cents) + currency code.
--   • All timestamps are TIMESTAMPTZ (UTC).
--   • Run against DATABASE_MIGRATION_URL (direct connection, not pooler).
--   • Idempotent: all statements use IF NOT EXISTS / DO $$ EXCEPTION $$.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- MODULE 01 — IDENTITY & ORGANIZATIONS
-- =============================================================================

DO $$ BEGIN CREATE TYPE user_role AS ENUM ('candidate','recruiter','admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE organization_role AS ENUM ('owner','admin','member','viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE user_session_status AS ENUM ('active','expired','revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- user_profiles: one row per Supabase Auth user, created on first login
-- auth_id = auth.users.id (JWT "sub" claim)
-- All application FKs reference user_profiles.id
CREATE TABLE IF NOT EXISTS user_profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id     UUID        NOT NULL UNIQUE,
  email       VARCHAR(255) NOT NULL UNIQUE,
  name        VARCHAR(255) NOT NULL,
  role        user_role   NOT NULL DEFAULT 'candidate',
  avatar_url  VARCHAR(500),
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_auth_id_idx ON user_profiles (auth_id);
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_email_idx   ON user_profiles (email);
CREATE        INDEX IF NOT EXISTS user_profiles_role_idx    ON user_profiles (role);
CREATE        INDEX IF NOT EXISTS user_profiles_active_idx  ON user_profiles (is_active);

CREATE TABLE IF NOT EXISTS candidate_profiles (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID        NOT NULL UNIQUE REFERENCES user_profiles(id) ON DELETE CASCADE,
  headline                VARCHAR(255),
  bio                     TEXT,
  location                VARCHAR(255),
  timezone                VARCHAR(50) DEFAULT 'UTC',
  github_url              VARCHAR(500),
  linkedin_url            VARCHAR(500),
  portfolio_url           VARCHAR(500),
  skills                  TEXT DEFAULT '[]',
  experience_years        INTEGER,
  preferred_roles         TEXT DEFAULT '[]',
  practice_attempts_used  INTEGER NOT NULL DEFAULT 0,
  practice_attempts_limit INTEGER NOT NULL DEFAULT 3,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS candidate_profiles_user_idx ON candidate_profiles (user_id);

CREATE TABLE IF NOT EXISTS organizations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  slug          VARCHAR(100) NOT NULL UNIQUE,
  description   TEXT,
  logo_url      VARCHAR(500),
  website_url   VARCHAR(500),
  billing_email VARCHAR(255),
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  settings      TEXT        DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_idx   ON organizations (slug);
CREATE        INDEX IF NOT EXISTS organizations_active_idx ON organizations (is_active);

CREATE TABLE IF NOT EXISTS organization_memberships (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID              NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID              NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role            organization_role NOT NULL DEFAULT 'member',
  invited_by      UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  invited_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS org_memberships_org_user_idx ON organization_memberships (organization_id, user_id);
CREATE        INDEX IF NOT EXISTS org_memberships_org_idx       ON organization_memberships (organization_id);
CREATE        INDEX IF NOT EXISTS org_memberships_user_idx      ON organization_memberships (user_id);
CREATE        INDEX IF NOT EXISTS org_memberships_role_idx      ON organization_memberships (role);

-- legacy audit sessions — live sessions managed by Supabase Auth
CREATE TABLE IF NOT EXISTS user_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  token_hash       VARCHAR(255) NOT NULL UNIQUE,
  ip_address       VARCHAR(45),
  user_agent       TEXT,
  status           user_session_status NOT NULL DEFAULT 'active',
  expires_at       TIMESTAMPTZ NOT NULL,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE        INDEX IF NOT EXISTS user_sessions_user_idx       ON user_sessions (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS user_sessions_token_hash_idx ON user_sessions (token_hash);
CREATE        INDEX IF NOT EXISTS user_sessions_status_idx     ON user_sessions (status);
CREATE        INDEX IF NOT EXISTS user_sessions_expires_at_idx ON user_sessions (expires_at);

-- =============================================================================
-- MODULE 02 — ASSESSMENT MANAGEMENT
-- =============================================================================

DO $$ BEGIN CREATE TYPE assessment_status AS ENUM ('draft','published','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE difficulty AS ENUM ('beginner','intermediate','advanced');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS assessments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID              NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title            VARCHAR(255)      NOT NULL,
  description      TEXT              NOT NULL,
  role             VARCHAR(100)      NOT NULL,
  skills           TEXT              NOT NULL,
  duration_minutes INTEGER           NOT NULL,
  difficulty       difficulty        NOT NULL DEFAULT 'intermediate',
  status           assessment_status NOT NULL DEFAULT 'draft',
  is_public        BOOLEAN           NOT NULL DEFAULT FALSE,
  created_by       UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at     TIMESTAMPTZ,
  archived_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS assessments_org_idx        ON assessments (organization_id);
CREATE INDEX IF NOT EXISTS assessments_status_idx     ON assessments (status);
CREATE INDEX IF NOT EXISTS assessments_created_by_idx ON assessments (created_by);

-- immutable once published
CREATE TABLE IF NOT EXISTS assessment_versions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id    UUID        NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  version          INTEGER     NOT NULL,
  title            VARCHAR(255) NOT NULL,
  description      TEXT        NOT NULL,
  role             VARCHAR(100) NOT NULL,
  skills           TEXT        NOT NULL,
  duration_minutes INTEGER     NOT NULL,
  difficulty       difficulty  NOT NULL DEFAULT 'intermediate',
  starter_files    JSONB       NOT NULL DEFAULT '[]',
  test_config      JSONB       NOT NULL DEFAULT '{}',
  instructions     TEXT,
  ai_policy        TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at     TIMESTAMPTZ,
  is_current       BOOLEAN     NOT NULL DEFAULT FALSE,
  UNIQUE (assessment_id, version)
);
CREATE UNIQUE INDEX IF NOT EXISTS assessment_versions_assessment_version_idx ON assessment_versions (assessment_id, version);
CREATE        INDEX IF NOT EXISTS assessment_versions_assessment_idx          ON assessment_versions (assessment_id);
CREATE        INDEX IF NOT EXISTS assessment_versions_current_idx             ON assessment_versions (is_current);

-- immutable once published
CREATE TABLE IF NOT EXISTS rubric_versions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_version_id UUID    NOT NULL REFERENCES assessment_versions(id) ON DELETE CASCADE,
  version               INTEGER NOT NULL,
  criteria              JSONB   NOT NULL DEFAULT '[]',
  total_points          INTEGER NOT NULL DEFAULT 100,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_current            BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (assessment_version_id, version)
);
CREATE UNIQUE INDEX IF NOT EXISTS rubric_versions_version_idx            ON rubric_versions (assessment_version_id, version);
CREATE        INDEX IF NOT EXISTS rubric_versions_assessment_version_idx ON rubric_versions (assessment_version_id);
CREATE        INDEX IF NOT EXISTS rubric_versions_current_idx            ON rubric_versions (is_current);

CREATE TABLE IF NOT EXISTS assessment_files (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_version_id UUID        NOT NULL REFERENCES assessment_versions(id) ON DELETE CASCADE,
  path                  VARCHAR(500) NOT NULL,
  language              VARCHAR(50)  NOT NULL,
  content               TEXT         NOT NULL,
  is_read_only          BOOLEAN      NOT NULL DEFAULT FALSE,
  is_hidden             BOOLEAN      NOT NULL DEFAULT FALSE,
  sort_order            INTEGER      NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (assessment_version_id, path)
);
CREATE UNIQUE INDEX IF NOT EXISTS assessment_files_version_path_idx ON assessment_files (assessment_version_id, path);
CREATE        INDEX IF NOT EXISTS assessment_files_version_idx       ON assessment_files (assessment_version_id);

CREATE TABLE IF NOT EXISTS assessment_test_configs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_version_id UUID         NOT NULL UNIQUE REFERENCES assessment_versions(id) ON DELETE CASCADE,
  test_command          VARCHAR(255) NOT NULL DEFAULT 'npm test',
  run_command           VARCHAR(255) NOT NULL DEFAULT 'npm run',
  timeout_seconds       INTEGER      NOT NULL DEFAULT 30,
  max_output_size       INTEGER      NOT NULL DEFAULT 1048576,
  hidden_test_files     JSONB        NOT NULL DEFAULT '[]',
  public_test_files     JSONB        NOT NULL DEFAULT '[]',
  environment_variables JSONB        NOT NULL DEFAULT '{}',
  resource_limits       JSONB        NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS test_configs_version_idx ON assessment_test_configs (assessment_version_id);

-- =============================================================================
-- MODULE 03 — ASSIGNMENTS & SESSIONS
-- =============================================================================

DO $$ BEGIN CREATE TYPE assignment_status AS ENUM (
  'invited','in_progress','submitted','evaluated','reviewed','expired','withdrawn');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE session_status AS ENUM (
  'not_started','in_progress','paused','submitted','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS candidate_assignments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID              NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assessment_id         UUID              NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  assessment_version_id UUID              NOT NULL REFERENCES assessment_versions(id) ON DELETE CASCADE,
  candidate_id          UUID              NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  assigned_by           UUID              NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  status                assignment_status NOT NULL DEFAULT 'invited',
  deadline              TIMESTAMPTZ,
  started_at            TIMESTAMPTZ,
  submitted_at          TIMESTAMPTZ,
  expires_at            TIMESTAMPTZ,
  withdrawn_at          TIMESTAMPTZ,
  withdrawn_reason      TEXT,
  metadata              JSONB DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, candidate_id, assessment_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS assignments_org_candidate_idx ON candidate_assignments (organization_id, candidate_id, assessment_id);
CREATE        INDEX IF NOT EXISTS assignments_org_idx            ON candidate_assignments (organization_id);
CREATE        INDEX IF NOT EXISTS assignments_candidate_idx      ON candidate_assignments (candidate_id);
CREATE        INDEX IF NOT EXISTS assignments_assessment_idx     ON candidate_assignments (assessment_id);
CREATE        INDEX IF NOT EXISTS assignments_status_idx         ON candidate_assignments (status);
CREATE        INDEX IF NOT EXISTS assignments_deadline_idx       ON candidate_assignments (deadline);

CREATE TABLE IF NOT EXISTS assessment_sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id         UUID           NOT NULL UNIQUE REFERENCES candidate_assignments(id) ON DELETE CASCADE,
  candidate_id          UUID           NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  assessment_version_id UUID           NOT NULL REFERENCES assessment_versions(id) ON DELETE CASCADE,
  status                session_status NOT NULL DEFAULT 'not_started',
  started_at            TIMESTAMPTZ,
  paused_at             TIMESTAMPTZ,
  resumed_at            TIMESTAMPTZ,
  submitted_at          TIMESTAMPTZ,
  expires_at            TIMESTAMPTZ,
  time_remaining_seconds INTEGER,
  total_paused_seconds  INTEGER     NOT NULL DEFAULT 0,
  current_file          VARCHAR(500),
  metadata              JSONB       DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS sessions_assignment_idx ON assessment_sessions (assignment_id);
CREATE        INDEX IF NOT EXISTS sessions_candidate_idx  ON assessment_sessions (candidate_id);
CREATE        INDEX IF NOT EXISTS sessions_status_idx     ON assessment_sessions (status);
CREATE        INDEX IF NOT EXISTS sessions_expires_at_idx ON assessment_sessions (expires_at);

CREATE TABLE IF NOT EXISTS session_state_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID           NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
  event_type      VARCHAR(50)    NOT NULL,
  previous_status session_status,
  new_status      session_status NOT NULL,
  triggered_by    UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS session_events_session_idx    ON session_state_events (session_id);
CREATE INDEX IF NOT EXISTS session_events_type_idx       ON session_state_events (event_type);
CREATE INDEX IF NOT EXISTS session_events_created_at_idx ON session_state_events (created_at);

-- =============================================================================
-- MODULE 04 — WORKSPACE & EXECUTION
-- =============================================================================

DO $$ BEGIN CREATE TYPE file_type AS ENUM ('source','test','config','asset','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE execution_status AS ENUM ('pending','running','completed','failed','timeout','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE test_run_status AS ENUM ('pending','running','completed','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS workspace_revisions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID    NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  files           JSONB   NOT NULL DEFAULT '[]',
  message         TEXT,
  is_snapshot     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, revision_number)
);
CREATE UNIQUE INDEX IF NOT EXISTS revisions_session_number_idx ON workspace_revisions (session_id, revision_number);
CREATE        INDEX IF NOT EXISTS revisions_session_idx         ON workspace_revisions (session_id);

CREATE TABLE IF NOT EXISTS session_files (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID        NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
  path         VARCHAR(500) NOT NULL,
  language     VARCHAR(50)  NOT NULL,
  content      TEXT         NOT NULL,
  is_read_only BOOLEAN      NOT NULL DEFAULT FALSE,
  is_deleted   BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, path)
);
CREATE UNIQUE INDEX IF NOT EXISTS session_files_session_path_idx ON session_files (session_id, path);
CREATE        INDEX IF NOT EXISTS session_files_session_idx       ON session_files (session_id);

CREATE TABLE IF NOT EXISTS execution_runs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID             NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
  revision_id    UUID             NOT NULL REFERENCES workspace_revisions(id) ON DELETE CASCADE,
  type           VARCHAR(50)      NOT NULL DEFAULT 'run',
  command        TEXT,
  status         execution_status NOT NULL DEFAULT 'pending',
  exit_code      INTEGER,
  stdout         TEXT,
  stderr         TEXT,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at   TIMESTAMPTZ,
  duration_ms    INTEGER,
  resource_usage JSONB DEFAULT '{}',
  error          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS execution_runs_session_idx  ON execution_runs (session_id);
CREATE INDEX IF NOT EXISTS execution_runs_revision_idx ON execution_runs (revision_id);
CREATE INDEX IF NOT EXISTS execution_runs_status_idx   ON execution_runs (status);

CREATE TABLE IF NOT EXISTS test_results (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID        NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
  execution_run_id UUID        NOT NULL REFERENCES execution_runs(id) ON DELETE CASCADE,
  revision_id      UUID        NOT NULL REFERENCES workspace_revisions(id) ON DELETE CASCADE,
  test_suite       VARCHAR(255),
  test_name        VARCHAR(255) NOT NULL,
  status           VARCHAR(50)  NOT NULL,
  duration_ms      INTEGER,
  output           TEXT,
  error            TEXT,
  criterion        VARCHAR(255),
  is_hidden        BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS test_results_session_idx       ON test_results (session_id);
CREATE INDEX IF NOT EXISTS test_results_execution_run_idx ON test_results (execution_run_id);
CREATE INDEX IF NOT EXISTS test_results_revision_idx      ON test_results (revision_id);
CREATE INDEX IF NOT EXISTS test_results_status_idx        ON test_results (status);

CREATE TABLE IF NOT EXISTS execution_artifacts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_run_id UUID         NOT NULL REFERENCES execution_runs(id) ON DELETE CASCADE,
  name             VARCHAR(255) NOT NULL,
  type             VARCHAR(50)  NOT NULL,
  storage_path     VARCHAR(500) NOT NULL,
  size_bytes       INTEGER      NOT NULL,
  mime_type        VARCHAR(100),
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS execution_artifacts_run_idx ON execution_artifacts (execution_run_id);

-- =============================================================================
-- MODULE 05 — EVIDENCE COLLECTION
-- =============================================================================

DO $$ BEGIN CREATE TYPE evidence_type AS ENUM (
  'submitted_snapshot','earlier_snapshot','test_result','application_run',
  'ai_coach_prompt','ai_coach_response','file_event','assessment_event','terminal_command');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE evidence_integrity AS ENUM ('available','partial','unavailable','mismatch');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE evidence_provenance AS ENUM ('candidate_action','system_generated','unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS evidence_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id    UUID               NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  organization_id UUID               NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assignment_id   UUID               NOT NULL REFERENCES candidate_assignments(id) ON DELETE CASCADE,
  assessment_id   UUID               NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  session_id      UUID               NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
  type            evidence_type      NOT NULL,
  timestamp       TIMESTAMPTZ        NOT NULL,
  title           VARCHAR(255)       NOT NULL,
  summary         TEXT               NOT NULL,
  file            VARCHAR(500),
  revision_id     UUID REFERENCES workspace_revisions(id) ON DELETE SET NULL,
  source_event_id VARCHAR(255),
  result_id       VARCHAR(255),
  content_ref     VARCHAR(255)       NOT NULL UNIQUE,
  provenance      evidence_provenance NOT NULL,
  integrity       evidence_integrity  NOT NULL DEFAULT 'available',
  test_status     VARCHAR(50),
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE        INDEX IF NOT EXISTS evidence_session_idx     ON evidence_records (session_id);
CREATE        INDEX IF NOT EXISTS evidence_candidate_idx   ON evidence_records (candidate_id);
CREATE        INDEX IF NOT EXISTS evidence_type_idx        ON evidence_records (type);
CREATE        INDEX IF NOT EXISTS evidence_timestamp_idx   ON evidence_records (timestamp);
CREATE UNIQUE INDEX IF NOT EXISTS evidence_content_ref_idx ON evidence_records (content_ref);

CREATE TABLE IF NOT EXISTS activity_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID               NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
  type        VARCHAR(50)        NOT NULL,
  timestamp   TIMESTAMPTZ        NOT NULL,
  file        VARCHAR(500),
  revision_id UUID REFERENCES workspace_revisions(id) ON DELETE SET NULL,
  result_id   UUID REFERENCES test_results(id) ON DELETE SET NULL,
  terminal_id VARCHAR(255),
  detail      TEXT               NOT NULL,
  provenance  evidence_provenance NOT NULL,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS activity_events_session_idx   ON activity_events (session_id);
CREATE INDEX IF NOT EXISTS activity_events_type_idx      ON activity_events (type);
CREATE INDEX IF NOT EXISTS activity_events_timestamp_idx ON activity_events (timestamp);

CREATE TABLE IF NOT EXISTS code_revision_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID        NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
  revision_id UUID        NOT NULL REFERENCES workspace_revisions(id) ON DELETE CASCADE,
  evidence_id UUID        NOT NULL REFERENCES evidence_records(id) ON DELETE CASCADE,
  link_type   VARCHAR(50) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS code_revision_links_revision_idx ON code_revision_links (revision_id);
CREATE INDEX IF NOT EXISTS code_revision_links_evidence_idx ON code_revision_links (evidence_id);

-- =============================================================================
-- MODULE 06 — EVALUATION ENGINE
-- =============================================================================

DO $$ BEGIN CREATE TYPE evaluation_status AS ENUM (
  'demonstrated','partially_demonstrated',
  'not_demonstrated_in_available_evidence','inconclusive','invalid_assessment_evidence');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE evidence_sufficiency AS ENUM ('sufficient','partial','insufficient','invalid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE evaluation_record_status AS ENUM (
  'awaiting_evaluation','ready_for_review','inconclusive','needs_attention','reviewed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE reviewer_status AS ENUM ('pending','in_review','reviewed','needs_attention');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE review_action AS ENUM ('accepted','overridden','clarification_requested');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS evaluations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version                 INTEGER                  NOT NULL DEFAULT 1,
  previous_evaluation_id  UUID REFERENCES evaluations(id) ON DELETE SET NULL,
  candidate_id            UUID                     NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  candidate_name          VARCHAR(255)             NOT NULL,
  organization_id         UUID                     NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  organization_name       VARCHAR(255)             NOT NULL,
  assignment_id           UUID                     NOT NULL REFERENCES candidate_assignments(id) ON DELETE CASCADE,
  assessment_id           UUID                     NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  assessment_title        VARCHAR(255)             NOT NULL,
  task_title              VARCHAR(255)             NOT NULL,
  session_id              UUID                     NOT NULL UNIQUE REFERENCES assessment_sessions(id) ON DELETE CASCADE,
  submission_revision_id  UUID                     NOT NULL,
  submission_timestamp    TIMESTAMPTZ              NOT NULL,
  rubric_version          VARCHAR(100)             NOT NULL,
  evaluator_version       VARCHAR(100)             NOT NULL,
  evaluator_method        VARCHAR(100)             NOT NULL,
  evaluated_at            TIMESTAMPTZ              NOT NULL DEFAULT NOW(),
  evidence_coverage       INTEGER                  NOT NULL DEFAULT 0,
  aggregate_score         INTEGER,
  excluded_criteria       JSONB                    NOT NULL DEFAULT '[]',
  evaluation_status       evaluation_record_status NOT NULL DEFAULT 'awaiting_evaluation',
  limitations             JSONB                    NOT NULL DEFAULT '[]',
  conflicts               JSONB                    NOT NULL DEFAULT '[]',
  reviewer_status         reviewer_status          NOT NULL DEFAULT 'pending',
  reviewer_outcome        VARCHAR(50),
  internal_reviewer_notes TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS evaluations_session_idx         ON evaluations (session_id);
CREATE        INDEX IF NOT EXISTS evaluations_candidate_idx       ON evaluations (candidate_id);
CREATE        INDEX IF NOT EXISTS evaluations_org_idx             ON evaluations (organization_id);
CREATE        INDEX IF NOT EXISTS evaluations_status_idx          ON evaluations (evaluation_status);
CREATE        INDEX IF NOT EXISTS evaluations_reviewer_status_idx ON evaluations (reviewer_status);

CREATE TABLE IF NOT EXISTS evaluation_criteria (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id     UUID                 NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  criterion_id      VARCHAR(100)         NOT NULL,
  name              VARCHAR(255)         NOT NULL,
  description       TEXT                 NOT NULL,
  rubric            TEXT                 NOT NULL,
  weight            INTEGER              NOT NULL,
  status            evaluation_status    NOT NULL,
  supported_score   INTEGER,
  sufficiency       evidence_sufficiency NOT NULL,
  missing_evidence  JSONB                NOT NULL DEFAULT '[]',
  explanation       TEXT                 NOT NULL,
  candidate_visible BOOLEAN              NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS criteria_evaluation_idx ON evaluation_criteria (evaluation_id);
CREATE INDEX IF NOT EXISTS criteria_criterion_idx  ON evaluation_criteria (criterion_id);

CREATE TABLE IF NOT EXISTS finding_evidence_links (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  criterion_id UUID        NOT NULL REFERENCES evaluation_criteria(id) ON DELETE CASCADE,
  evidence_id  UUID        NOT NULL REFERENCES evidence_records(id) ON DELETE CASCADE,
  link_type    VARCHAR(50) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS finding_evidence_criterion_idx ON finding_evidence_links (criterion_id);
CREATE INDEX IF NOT EXISTS finding_evidence_evidence_idx  ON finding_evidence_links (evidence_id);

-- immutable override audit trail — never delete rows
CREATE TABLE IF NOT EXISTS review_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id   UUID              NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  criterion_id    UUID              NOT NULL REFERENCES evaluation_criteria(id) ON DELETE CASCADE,
  action          review_action     NOT NULL,
  previous_status evaluation_status NOT NULL,
  new_status      evaluation_status NOT NULL,
  reviewer_id     UUID              NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  reviewer_name   VARCHAR(255)      NOT NULL,
  reason          TEXT              NOT NULL,
  evidence_ids    JSONB             NOT NULL DEFAULT '[]',
  timestamp       TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS review_events_evaluation_idx ON review_events (evaluation_id);
CREATE INDEX IF NOT EXISTS review_events_criterion_idx  ON review_events (criterion_id);
CREATE INDEX IF NOT EXISTS review_events_reviewer_idx   ON review_events (reviewer_id);
CREATE INDEX IF NOT EXISTS review_events_timestamp_idx  ON review_events (timestamp);

CREATE TABLE IF NOT EXISTS candidate_feedback (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID        NOT NULL UNIQUE REFERENCES evaluations(id) ON DELETE CASCADE,
  feedback      JSONB       NOT NULL DEFAULT '{}',
  is_available  BOOLEAN     NOT NULL DEFAULT FALSE,
  released_at   TIMESTAMPTZ,
  released_by   UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS candidate_feedback_evaluation_idx ON candidate_feedback (evaluation_id);

-- =============================================================================
-- MODULE 07 — REPORTS & HUMAN REVIEW
-- =============================================================================

DO $$ BEGIN CREATE TYPE review_queue_status AS ENUM (
  'awaiting_evaluation','ready_for_review','in_review','reviewed','needs_attention');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS review_queue (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id           UUID                NOT NULL UNIQUE REFERENCES evaluations(id) ON DELETE CASCADE,
  candidate_id            UUID                NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  organization_id         UUID                NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assignment_id           UUID                NOT NULL REFERENCES candidate_assignments(id) ON DELETE CASCADE,
  status                  review_queue_status NOT NULL DEFAULT 'awaiting_evaluation',
  priority                INTEGER             NOT NULL DEFAULT 0,
  assigned_reviewer_id    UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  submitted_at            TIMESTAMPTZ         NOT NULL,
  evaluation_completed_at TIMESTAMPTZ,
  review_started_at       TIMESTAMPTZ,
  review_completed_at     TIMESTAMPTZ,
  metadata                JSONB DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS review_queue_evaluation_idx ON review_queue (evaluation_id);
CREATE        INDEX IF NOT EXISTS review_queue_org_status_idx ON review_queue (organization_id, status);
CREATE        INDEX IF NOT EXISTS review_queue_reviewer_idx   ON review_queue (assigned_reviewer_id);
CREATE        INDEX IF NOT EXISTS review_queue_priority_idx   ON review_queue (priority);

CREATE TABLE IF NOT EXISTS reviewer_notes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID    NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  reviewer_id   UUID    NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  note          TEXT    NOT NULL,
  is_internal   BOOLEAN NOT NULL DEFAULT TRUE,
  criterion_id  UUID REFERENCES evaluation_criteria(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS reviewer_notes_evaluation_idx ON reviewer_notes (evaluation_id);
CREATE INDEX IF NOT EXISTS reviewer_notes_reviewer_idx   ON reviewer_notes (reviewer_id);

CREATE TABLE IF NOT EXISTS reviewer_decisions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id       UUID         NOT NULL UNIQUE REFERENCES evaluations(id) ON DELETE CASCADE,
  reviewer_id         UUID         NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  overall_outcome     VARCHAR(50)  NOT NULL,
  criterion_decisions JSONB        NOT NULL DEFAULT '[]',
  notes               TEXT,
  is_final            BOOLEAN      NOT NULL DEFAULT FALSE,
  decided_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS reviewer_decisions_evaluation_idx ON reviewer_decisions (evaluation_id);
CREATE        INDEX IF NOT EXISTS reviewer_decisions_reviewer_idx   ON reviewer_decisions (reviewer_id);

-- =============================================================================
-- MODULE 08 — PRACTICE & ENTITLEMENTS
-- =============================================================================

DO $$ BEGIN CREATE TYPE practice_task_status AS ENUM ('not_started','in_progress','completed','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS practice_tasks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            VARCHAR(255) NOT NULL,
  description      TEXT         NOT NULL,
  difficulty       VARCHAR(20)  NOT NULL,
  skills           JSONB        NOT NULL DEFAULT '[]',
  duration_minutes INTEGER      NOT NULL,
  starter_files    JSONB        NOT NULL DEFAULT '[]',
  test_patterns    JSONB        NOT NULL DEFAULT '[]',
  is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
  sort_order       INTEGER      NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS practice_tasks_active_idx ON practice_tasks (is_active);
CREATE INDEX IF NOT EXISTS practice_tasks_order_idx  ON practice_tasks (sort_order);

CREATE TABLE IF NOT EXISTS practice_sessions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id           UUID                 NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  task_id                UUID                 NOT NULL,
  status                 practice_task_status NOT NULL DEFAULT 'not_started',
  attempt_number         INTEGER              NOT NULL DEFAULT 1,
  started_at             TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  completed_at           TIMESTAMPTZ,
  duration_minutes       INTEGER              NOT NULL,
  time_remaining_seconds INTEGER,
  total_paused_seconds   INTEGER              NOT NULL DEFAULT 0,
  current_file           VARCHAR(500),
  files                  JSONB NOT NULL DEFAULT '[]',
  revisions              JSONB NOT NULL DEFAULT '[]',
  run_history            JSONB NOT NULL DEFAULT '[]',
  test_runs              JSONB NOT NULL DEFAULT '[]',
  activity               JSONB NOT NULL DEFAULT '[]',
  coach_messages         JSONB NOT NULL DEFAULT '[]',
  metadata               JSONB DEFAULT '{}',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS practice_sessions_candidate_idx ON practice_sessions (candidate_id);
CREATE INDEX IF NOT EXISTS practice_sessions_task_idx      ON practice_sessions (task_id);
CREATE INDEX IF NOT EXISTS practice_sessions_status_idx    ON practice_sessions (status);

CREATE TABLE IF NOT EXISTS practice_allowances (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id            UUID    NOT NULL UNIQUE REFERENCES user_profiles(id) ON DELETE CASCADE,
  free_attempts_used      INTEGER NOT NULL DEFAULT 0,
  free_attempts_limit     INTEGER NOT NULL DEFAULT 3,
  paid_attempts_purchased INTEGER NOT NULL DEFAULT 0,
  paid_attempts_used      INTEGER NOT NULL DEFAULT 0,
  subscription_id         UUID,
  last_reset_at           TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS practice_allowances_candidate_idx ON practice_allowances (candidate_id);

CREATE TABLE IF NOT EXISTS usage_ledger (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id      UUID        NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  event_type        VARCHAR(50) NOT NULL,
  event_id          UUID        NOT NULL,
  attempts_consumed INTEGER     NOT NULL DEFAULT 0,
  description       TEXT,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS usage_ledger_candidate_idx  ON usage_ledger (candidate_id);
CREATE INDEX IF NOT EXISTS usage_ledger_event_idx      ON usage_ledger (event_type, event_id);
CREATE INDEX IF NOT EXISTS usage_ledger_created_at_idx ON usage_ledger (created_at);

-- =============================================================================
-- MODULE 09 — BILLING & PAYMENTS
-- =============================================================================

DO $$ BEGIN CREATE TYPE subscription_status AS ENUM ('active','past_due','canceled','incomplete','trialing');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE billing_interval AS ENUM ('monthly','yearly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE invoice_status AS ENUM ('draft','open','paid','void','uncollectible');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE payment_status AS ENUM ('pending','succeeded','failed','refunded','canceled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS subscription_plans (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                        VARCHAR(100) NOT NULL,
  description                 TEXT,
  price_amount                INTEGER      NOT NULL,  -- minor units (cents)
  price_currency              VARCHAR(3)   NOT NULL DEFAULT 'USD',
  interval                    billing_interval NOT NULL DEFAULT 'monthly',
  features                    JSONB        NOT NULL DEFAULT '{}',
  practice_attempts_included  INTEGER      NOT NULL DEFAULT 0,
  assessment_credits_included INTEGER      NOT NULL DEFAULT 0,
  max_team_members            INTEGER      NOT NULL DEFAULT 1,
  is_active                   BOOLEAN      NOT NULL DEFAULT TRUE,
  is_popular                  BOOLEAN      NOT NULL DEFAULT FALSE,
  sort_order                  INTEGER      NOT NULL DEFAULT 0,
  stripe_price_id             VARCHAR(255),
  created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS plans_active_idx ON subscription_plans (is_active);

CREATE TABLE IF NOT EXISTS subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID                NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id               UUID                NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  status                subscription_status NOT NULL DEFAULT 'incomplete',
  current_period_start  TIMESTAMPTZ         NOT NULL,
  current_period_end    TIMESTAMPTZ         NOT NULL,
  cancel_at_period_end  BOOLEAN             NOT NULL DEFAULT FALSE,
  canceled_at           TIMESTAMPTZ,
  trial_start           TIMESTAMPTZ,
  trial_end             TIMESTAMPTZ,
  stripe_customer_id    VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  metadata              JSONB DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_org_idx    ON subscriptions (organization_id);
CREATE        INDEX IF NOT EXISTS subscriptions_plan_idx   ON subscriptions (plan_id);
CREATE        INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions (status);

CREATE TABLE IF NOT EXISTS invoices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID           NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id   UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  status            invoice_status NOT NULL DEFAULT 'draft',
  amount_due        INTEGER        NOT NULL,  -- cents
  amount_paid       INTEGER        NOT NULL DEFAULT 0,
  amount_remaining  INTEGER        NOT NULL,
  currency          VARCHAR(3)     NOT NULL DEFAULT 'USD',
  invoice_number    VARCHAR(50)    NOT NULL UNIQUE,
  issue_date        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  due_date          TIMESTAMPTZ    NOT NULL,
  paid_at           TIMESTAMPTZ,
  voided_at         TIMESTAMPTZ,
  stripe_invoice_id VARCHAR(255),
  hosted_invoice_url VARCHAR(500),
  invoice_pdf_url   VARCHAR(500),
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE        INDEX IF NOT EXISTS invoices_org_idx    ON invoices (organization_id);
CREATE        INDEX IF NOT EXISTS invoices_status_idx ON invoices (status);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_number_idx ON invoices (invoice_number);

CREATE TABLE IF NOT EXISTS payments (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID           NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id              UUID REFERENCES invoices(id) ON DELETE SET NULL,
  amount                  INTEGER        NOT NULL,  -- cents
  currency                VARCHAR(3)     NOT NULL DEFAULT 'USD',
  status                  payment_status NOT NULL DEFAULT 'pending',
  payment_method          VARCHAR(50),
  payment_method_details  JSONB DEFAULT '{}',
  stripe_payment_intent_id VARCHAR(255),
  stripe_charge_id        VARCHAR(255),
  failure_reason          TEXT,
  refunded_at             TIMESTAMPTZ,
  refund_amount           INTEGER,
  metadata                JSONB DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS payments_org_idx     ON payments (organization_id);
CREATE INDEX IF NOT EXISTS payments_invoice_idx ON payments (invoice_id);
CREATE INDEX IF NOT EXISTS payments_status_idx  ON payments (status);

-- idempotent webhook processing — event_id must be unique
CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     VARCHAR(50)  NOT NULL DEFAULT 'stripe',
  event_type   VARCHAR(100) NOT NULL,
  event_id     VARCHAR(255) NOT NULL UNIQUE,
  payload      JSONB        NOT NULL,
  processed    BOOLEAN      NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error        TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS webhook_events_event_id_idx ON payment_webhook_events (event_id);
CREATE        INDEX IF NOT EXISTS webhook_events_processed_idx ON payment_webhook_events (processed);

CREATE TABLE IF NOT EXISTS credit_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type            VARCHAR(50) NOT NULL,
  amount          INTEGER     NOT NULL,
  balance_after   INTEGER     NOT NULL,
  description     TEXT,
  reference_id    UUID,
  reference_type  VARCHAR(50),
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS credit_transactions_org_idx ON credit_transactions (organization_id);
CREATE INDEX IF NOT EXISTS credit_transactions_ref_idx ON credit_transactions (reference_id, reference_type);

-- =============================================================================
-- MODULE 10 — AI ASSISTANCE
-- =============================================================================

DO $$ BEGIN CREATE TYPE ai_provider AS ENUM ('openai','anthropic','local');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE ai_interaction_type AS ENUM (
  'coach_prompt','coach_response','mentor_prompt','mentor_response',
  'code_generation','code_explanation','debugging_help');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS ai_usage_records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID               NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  candidate_id     UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  session_id       UUID REFERENCES assessment_sessions(id) ON DELETE SET NULL,
  provider         ai_provider        NOT NULL,
  model            VARCHAR(100)       NOT NULL,
  interaction_type ai_interaction_type NOT NULL,
  prompt_tokens    INTEGER            NOT NULL DEFAULT 0,
  completion_tokens INTEGER           NOT NULL DEFAULT 0,
  total_tokens     INTEGER            NOT NULL DEFAULT 0,
  estimated_cost   NUMERIC(10,6)      NOT NULL DEFAULT 0,  -- USD
  currency         VARCHAR(3)         NOT NULL DEFAULT 'USD',
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ai_usage_org_idx        ON ai_usage_records (organization_id);
CREATE INDEX IF NOT EXISTS ai_usage_candidate_idx  ON ai_usage_records (candidate_id);
CREATE INDEX IF NOT EXISTS ai_usage_session_idx    ON ai_usage_records (session_id);
CREATE INDEX IF NOT EXISTS ai_usage_created_at_idx ON ai_usage_records (created_at);

CREATE TABLE IF NOT EXISTS ai_interactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID               NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
  usage_record_id UUID REFERENCES ai_usage_records(id) ON DELETE SET NULL,
  type            ai_interaction_type NOT NULL,
  role            VARCHAR(20)        NOT NULL,
  content         TEXT               NOT NULL,
  explanation     TEXT,
  suggestion      JSONB,
  model           VARCHAR(100)       NOT NULL,
  provider        ai_provider        NOT NULL,
  tokens_used     INTEGER            NOT NULL DEFAULT 0,
  latency_ms      INTEGER,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ai_interactions_session_idx    ON ai_interactions (session_id);
CREATE INDEX IF NOT EXISTS ai_interactions_type_idx       ON ai_interactions (type);
CREATE INDEX IF NOT EXISTS ai_interactions_created_at_idx ON ai_interactions (created_at);

CREATE TABLE IF NOT EXISTS ai_provider_configs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID        NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  provider              ai_provider NOT NULL,
  api_key_encrypted     TEXT,        -- encrypted at rest; never store plaintext
  default_model         VARCHAR(100) NOT NULL,
  fallback_models       JSONB        NOT NULL DEFAULT '[]',
  is_enabled            BOOLEAN      NOT NULL DEFAULT TRUE,
  rate_limit_per_minute INTEGER      NOT NULL DEFAULT 60,
  max_tokens_per_request INTEGER     NOT NULL DEFAULT 4096,
  temperature           NUMERIC(3,2) NOT NULL DEFAULT 0.7,
  max_cost_per_month    NUMERIC(10,2),
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS ai_configs_org_idx      ON ai_provider_configs (organization_id);
CREATE        INDEX IF NOT EXISTS ai_configs_provider_idx ON ai_provider_configs (provider);

-- =============================================================================
-- MODULE 11 — NOTIFICATIONS
-- =============================================================================

DO $$ BEGIN CREATE TYPE notification_type AS ENUM (
  'assessment_invitation','assessment_started','assessment_submitted','assessment_expired',
  'evaluation_completed','review_completed','feedback_available','deadline_reminder',
  'payment_due','subscription_changed','system_announcement');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE notification_channel AS ENUM ('email','in_app','webhook');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE notification_status AS ENUM ('pending','sent','delivered','failed','read');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS notification_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID                NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID                NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  type            notification_type   NOT NULL,
  channel         notification_channel NOT NULL,
  status          notification_status NOT NULL DEFAULT 'pending',
  subject         VARCHAR(255),
  body            TEXT,
  template_id     VARCHAR(100),
  template_data   JSONB DEFAULT '{}',
  reference_id    UUID,
  reference_type  VARCHAR(50),
  scheduled_at    TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  read_at         TIMESTAMPTZ,
  failure_reason  TEXT,
  retry_count     INTEGER NOT NULL DEFAULT 0,
  max_retries     INTEGER NOT NULL DEFAULT 3,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notifications_org_idx          ON notification_jobs (organization_id);
CREATE INDEX IF NOT EXISTS notifications_user_idx         ON notification_jobs (user_id);
CREATE INDEX IF NOT EXISTS notifications_type_idx         ON notification_jobs (type);
CREATE INDEX IF NOT EXISTS notifications_status_idx       ON notification_jobs (status);
CREATE INDEX IF NOT EXISTS notifications_scheduled_at_idx ON notification_jobs (scheduled_at);
CREATE INDEX IF NOT EXISTS notifications_ref_idx          ON notification_jobs (reference_id, reference_type);

CREATE TABLE IF NOT EXISTS notification_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name            VARCHAR(100)         NOT NULL,
  type            notification_type    NOT NULL,
  channel         notification_channel NOT NULL,
  subject         VARCHAR(255),
  body_template   TEXT                 NOT NULL,
  variables       JSONB                NOT NULL DEFAULT '[]',
  is_active       BOOLEAN              NOT NULL DEFAULT TRUE,
  is_default      BOOLEAN              NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS templates_org_idx          ON notification_templates (organization_id);
CREATE INDEX IF NOT EXISTS templates_type_channel_idx ON notification_templates (type, channel);

-- =============================================================================
-- MODULE 12 — AUDIT & COMPLIANCE
-- =============================================================================

DO $$ BEGIN CREATE TYPE audit_event_type AS ENUM (
  'user_created','user_updated','user_deleted','login','logout',
  'password_changed','email_changed','role_changed',
  'organization_created','organization_updated','organization_deleted',
  'membership_added','membership_removed','membership_role_changed',
  'assessment_created','assessment_updated','assessment_published','assessment_archived',
  'assignment_created','assignment_updated','assignment_withdrawn',
  'session_started','session_submitted','session_expired',
  'submission_received','evaluation_created','evaluation_updated',
  'review_override','review_completed','feedback_released',
  'practice_attempt_consumed',
  'subscription_created','subscription_updated','subscription_canceled',
  'payment_succeeded','payment_failed','webhook_received',
  'api_key_created','api_key_revoked','security_settings_changed',
  'data_export','data_deletion_request');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE audit_severity AS ENUM ('info','warning','critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- append-only audit log — no UPDATE or DELETE
CREATE TABLE IF NOT EXISTS audit_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID             NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  event_type      audit_event_type NOT NULL,
  severity        audit_severity   NOT NULL DEFAULT 'info',
  description     TEXT             NOT NULL,
  entity_type     VARCHAR(100),
  entity_id       UUID,
  previous_state  JSONB,
  new_state       JSONB,
  ip_address      VARCHAR(45),
  user_agent      TEXT,
  request_id      VARCHAR(255),
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_events_org_idx        ON audit_events (organization_id);
CREATE INDEX IF NOT EXISTS audit_events_user_idx       ON audit_events (user_id);
CREATE INDEX IF NOT EXISTS audit_events_type_idx       ON audit_events (event_type);
CREATE INDEX IF NOT EXISTS audit_events_severity_idx   ON audit_events (severity);
CREATE INDEX IF NOT EXISTS audit_events_entity_idx     ON audit_events (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_events_created_at_idx ON audit_events (created_at);
CREATE INDEX IF NOT EXISTS audit_events_request_id_idx ON audit_events (request_id);

CREATE TABLE IF NOT EXISTS data_retention_policies (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID    NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  assessment_data_days INTEGER NOT NULL DEFAULT 2555,
  session_data_days   INTEGER NOT NULL DEFAULT 2555,
  evidence_data_days  INTEGER NOT NULL DEFAULT 2555,
  evaluation_data_days INTEGER NOT NULL DEFAULT 2555,
  audit_log_days      INTEGER NOT NULL DEFAULT 2555,
  practice_data_days  INTEGER NOT NULL DEFAULT 1095,
  billing_data_days   INTEGER NOT NULL DEFAULT 2555,
  is_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at         TIMESTAMPTZ,
  next_run_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS retention_policies_org_idx ON data_retention_policies (organization_id);

CREATE TABLE IF NOT EXISTS data_access_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  request_type    VARCHAR(50) NOT NULL,
  status          VARCHAR(50) NOT NULL DEFAULT 'pending',
  requested_data  JSONB       NOT NULL DEFAULT '{}',
  response_data   JSONB,
  processed_by    UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  processed_at    TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS data_access_requests_org_idx    ON data_access_requests (organization_id);
CREATE INDEX IF NOT EXISTS data_access_requests_user_idx   ON data_access_requests (user_id);
CREATE INDEX IF NOT EXISTS data_access_requests_status_idx ON data_access_requests (status);

-- =============================================================================
-- MODULE 13 — EXTERNAL INTEGRATIONS
-- =============================================================================

DO $$ BEGIN CREATE TYPE integration_provider AS ENUM (
  'greenhouse','lever','workday','bamboohr','slack','teams','email','webhook','custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE integration_status AS ENUM ('active','inactive','error','pending_setup');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS integration_connections (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID                 NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider            integration_provider NOT NULL,
  name                VARCHAR(255)         NOT NULL,
  status              integration_status   NOT NULL DEFAULT 'pending_setup',
  config              JSONB                NOT NULL DEFAULT '{}',
  credentials_encrypted TEXT,   -- encrypted; never store plaintext secrets here
  sync_enabled        BOOLEAN              NOT NULL DEFAULT TRUE,
  sync_frequency      VARCHAR(50)          NOT NULL DEFAULT 'daily',
  last_sync_at        TIMESTAMPTZ,
  last_sync_status    VARCHAR(50),
  last_sync_error     TEXT,
  field_mappings      JSONB DEFAULT '{}',
  filters             JSONB DEFAULT '{}',
  metadata            JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS integrations_org_idx      ON integration_connections (organization_id);
CREATE INDEX IF NOT EXISTS integrations_provider_idx ON integration_connections (provider);
CREATE INDEX IF NOT EXISTS integrations_status_idx   ON integration_connections (status);

CREATE TABLE IF NOT EXISTS integration_sync_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id     UUID        NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  sync_type         VARCHAR(50) NOT NULL,
  status            VARCHAR(50) NOT NULL,
  records_processed INTEGER     NOT NULL DEFAULT 0,
  records_created   INTEGER     NOT NULL DEFAULT 0,
  records_updated   INTEGER     NOT NULL DEFAULT 0,
  records_failed    INTEGER     NOT NULL DEFAULT 0,
  error             TEXT,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  metadata          JSONB DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS sync_logs_connection_idx ON integration_sync_logs (connection_id);
CREATE INDEX IF NOT EXISTS sync_logs_status_idx     ON integration_sync_logs (status);
CREATE INDEX IF NOT EXISTS sync_logs_started_at_idx ON integration_sync_logs (started_at);

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name             VARCHAR(255) NOT NULL,
  url              VARCHAR(500) NOT NULL,
  events           JSONB        NOT NULL DEFAULT '[]',
  secret           VARCHAR(255) NOT NULL,
  is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
  retry_policy     JSONB        NOT NULL DEFAULT '{}',
  last_triggered_at TIMESTAMPTZ,
  last_status      VARCHAR(50),
  last_error       TEXT,
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS webhooks_org_idx    ON webhook_endpoints (organization_id);
CREATE INDEX IF NOT EXISTS webhooks_active_idx ON webhook_endpoints (is_active);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id     UUID         NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event_type      VARCHAR(100) NOT NULL,
  payload         JSONB        NOT NULL,
  response_status INTEGER,
  response_body   TEXT,
  attempt         INTEGER      NOT NULL DEFAULT 1,
  max_attempts    INTEGER      NOT NULL DEFAULT 3,
  is_success      BOOLEAN      NOT NULL DEFAULT FALSE,
  error           TEXT,
  next_retry_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS webhook_deliveries_endpoint_idx  ON webhook_deliveries (endpoint_id);
CREATE INDEX IF NOT EXISTS webhook_deliveries_event_idx     ON webhook_deliveries (event_type);
CREATE INDEX IF NOT EXISTS webhook_deliveries_success_idx   ON webhook_deliveries (is_success);
CREATE INDEX IF NOT EXISTS webhook_deliveries_next_retry_idx ON webhook_deliveries (next_retry_at);

CREATE TABLE IF NOT EXISTS export_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requested_by    UUID         NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  type            VARCHAR(50)  NOT NULL,
  format          VARCHAR(20)  NOT NULL DEFAULT 'json',
  status          VARCHAR(50)  NOT NULL DEFAULT 'pending',
  filters         JSONB DEFAULT '{}',
  file_path       VARCHAR(500),
  file_size       INTEGER,
  expires_at      TIMESTAMPTZ,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS export_jobs_org_idx    ON export_jobs (organization_id);
CREATE INDEX IF NOT EXISTS export_jobs_status_idx ON export_jobs (status);

-- =============================================================================
-- END OF SCHEMA
-- Total tables : 47
-- Total enums  : 26
-- =============================================================================
