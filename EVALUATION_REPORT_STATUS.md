# Evaluation Report System - Status and Requirements

## What a Complete Recruiter Report Contains

### 1. Candidate & Submission Overview
- ✅ Candidate name, email, avatar
- ✅ Company name and role
- ✅ Assessment title and task description
- ✅ Submission timestamp
- ✅ Time spent on assessment
- ✅ Session ID and submission revision ID

### 2. Evaluation Summary Metrics
- ✅ Overall evaluation status (Ready for Review, Inconclusive, Needs Attention, Reviewed)
- ✅ Human reviewer status (Pending, In Review, Reviewed)
- ✅ Evidence coverage percentage (how much evidence supports the rubric)
- ✅ Criteria evaluated count
- ✅ Sufficient vs insufficient evidence breakdown
- ✅ Test pass/fail summary

### 3. Skills Assessment Criteria (5 weighted criteria)

#### Functional Correctness (30% weight)
- Status: Demonstrated/Partially/Not Demonstrated/Inconclusive
- Based on: 6 deterministic test checks against submitted code
- Shows: Pass/fail status for each test, diagnostic messages
- Supported score: 0-100 based on passing tests

#### Code Quality & Maintainability (20% weight)  
- Status: Demonstrated/Partially/Not Demonstrated
- Based on: Source structure analysis (named functions, UI/state separation)
- Shows: Whether code follows readability patterns
- Supported score: 0-100 based on structure indicators

#### Testing & Debugging (20% weight)
- Status: Demonstrated/Partially/Inconclusive
- Based on: Number of test runs, save/test iterations
- Shows: Evidence of iterative testing workflow
- Supported score: 0-100 based on test frequency

#### Problem-Solving Evidence (15% weight)
- Status: Demonstrated/Partially/Inconclusive
- Based on: Multiple code snapshots, edit events
- Shows: Iterative refinement and evolution
- Supported score: 0-100 based on iteration count

#### AI Collaboration & Verification (15% weight)
- Status: Demonstrated/Partially/Inconclusive
- Based on: AI prompts, applied suggestions, subsequent test runs
- Shows: Whether AI assistance was verified with tests
- Supported score: 0-100 if verification is evident

Each criterion includes:
- ✅ Explanation of the finding
- ✅ Evidence sufficiency (Sufficient/Partial/Insufficient/Invalid)
- ✅ List of missing evidence
- ✅ Links to supporting evidence records
- ✅ Whether visible to candidate for feedback

### 4. Aggregate Score
- ✅ Weighted average from all 5 criteria (if all have valid scores)
- ✅ Or marked as "No overall score" if criteria are excluded
- ✅ Explanation of why criteria might be excluded (inconclusive/invalid evidence)

### 5. Submission Code Snapshot
- ✅ All submitted workspace files
- ✅ Read-only indicators
- ✅ File viewer with syntax highlighting
- ✅ Immutable revision ID
- ✅ Link to evidence record

### 6. Test Execution Results
- ✅ Total/passed/failed/skipped count
- ✅ Each test case with:
  - Name
  - Status (passed/failed/pending)
  - Diagnostic message
  - Criterion mapping
- ✅ Expandable test details
- ✅ Revision alignment check

### 7. AI Collaboration Analysis
- ✅ Count of candidate prompts sent
- ✅ Count of AI coach responses
- ✅ Count of explicitly applied suggestions
- ✅ Verification status (whether tests were run after AI help)
- ✅ Timeline of each interaction with full prompt/response
- ✅ Evidence links for each AI interaction
- ✅ Caution note: "Interaction count is not a negative score"

### 8. Evidence Timeline
Filterable by:
- All Activity
- Code Changes (file edits, saves, snapshots)
- AI Interactions (prompts, responses)
- Test Runs (test execution, app runs)
- Submission Events (start, submit)

Each evidence record shows:
- ✅ Timestamp
- ✅ Event type and title
- ✅ Summary
- ✅ Revision ID (if applicable)
- ✅ Provenance (candidate_action, system_generated, unknown)
- ✅ Link to detailed evidence view

### 9. Evidence Explorer
- ✅ Searchable, filterable evidence browser
- ✅ Filters: type, file, revision, test status, time range
- ✅ Evidence detail view with:
  - Full code snapshots
  - Test result details
  - AI conversation threads
  - Activity event details
  - Integrity status
  - Associated criteria

### 10. Reviewer Decision Tools
- ✅ Accept automated finding
- ✅ Override criterion status with reason
- ✅ Add confidential reviewer notes
- ✅ Mark overall assessment (Reviewed/Needs Attention)
- ✅ Decision history/audit trail
- ✅ All changes preserved separately from automated findings

### 11. Candidate Feedback Preview
- ✅ Shows candidate-visible criteria only
- ✅ Excludes confidential reviewer notes
- ✅ Preview before publishing

### 12. Limitations & Conflicts
- ✅ List of evaluation limitations (e.g., "deterministic rule-based", "cannot prove authorship")
- ✅ List of conflicts (e.g., "test revision mismatch")

### 13. Export Capability
- ✅ Export full report as JSON with all evidence

---

## Current System Status

### ✅ What's Working

1. **Evaluation Generation** - Automatic
   - `useEffect` in App.tsx triggers when `assessmentSession.submittedAt` is set
   - Calls `createEvaluation()` from evidence.ts
   - Generates all 5 criteria with evidence analysis
   - Saves to `localStorage: devforge-evaluation-record`
   - Adds to `localStorage: devforge-evaluation-history[]`

2. **Report Display** - Complete UI
   - `ReportPageV2` component renders full report
   - All sections implemented and styled
   - Evidence explorer functional
   - Reviewer tools functional

3. **Database Submissions** - Backend Storage
   - Assignments stored in PostgreSQL
   - Sessions submitted via `sessionsApi.submit()`
   - Candidates page shows submitted assessments from database

### ⚠️ What's Missing - The Gap

The problem is the **data flow disconnect** between:
- **Backend Database** → Stores assignment metadata (candidate, assessment, submission timestamp)
- **Browser localStorage** → Stores full session data (code, tests, AI interactions) and evaluations

When a candidate submits:
1. ✅ Session data saved to localStorage with `submittedAt`
2. ✅ Backend API called to mark assignment as submitted
3. ✅ Evaluation auto-generated in localStorage
4. ❌ **But:** Evaluation NOT sent to or stored in backend
5. ❌ **But:** Session workspace data NOT sent to backend
6. ❌ **But:** Evidence records NOT sent to backend

When a recruiter views candidates:
1. ✅ Sees submitted assignments from database
2. ✅ Clicks "View" on a candidate
3. ❌ **But:** No session data available (it's in candidate's browser only)
4. ❌ **But:** No evaluation available (it's in candidate's browser only)
5. ❌ **But:** Report shows "unavailable" or wrong data

---

## Solution: Complete the Data Flow

### Option A: Store Everything in Backend (Recommended)

When assessment is submitted (`ide.tsx:submit()`):

```typescript
// 1. Already done: Save to localStorage
persist(next);

// 2. Already done: Submit to backend
await sessionsApi.submit(session.sessionId);

// 3. NEW: Send full session workspace data to backend
await sessionsApi.saveWorkspace(session.sessionId, {
  files: saved.savedFiles,
  revisions: saved.revisions,
  testRuns: saved.testRuns,
  coachMessages: saved.coachMessages,
  activity: saved.activity,
  runHistory: saved.runHistory,
});

// 4. NEW: Backend generates evaluation
// (or send evaluation from frontend if it's already generated)
```

Backend needs:
- API endpoint: `POST /api/sessions/:id/workspace` - Store session workspace data
- API endpoint: `POST /api/sessions/:id/evaluate` - Generate or store evaluation
- Database schema: Already exists (evidence, evaluations tables)
- Evaluation service: Generate evaluation server-side using the same `createEvaluation` logic

### Option B: Hybrid Approach (Quick Fix)

Keep workspace data in localStorage but make it accessible:

```typescript
// When recruiter views a report, check if session exists locally
const sessionKey = `devforge-session-${assignmentId}`;
const localSession = localStorage.getItem(sessionKey);

if (localSession) {
  // Generate evaluation on-the-fly if not already generated
  // Display full report
} else {
  // Show message: "Session data not available. 
  // Candidate must submit from this browser, or workspace 
  // data must be transferred."
}
```

---

## Immediate Next Steps

1. **Backend API Endpoints** (apps/api/src/routes/sessions.ts)
   - Add `POST /api/sessions/:id/workspace` to store workspace data
   - Add `POST /api/sessions/:id/evaluate` to generate evaluations

2. **Frontend Submission Flow** (apps/web/src/ide.tsx)
   - After `sessionsApi.submit()`, call workspace save API
   - After workspace saved, trigger evaluation generation

3. **Reports Page Data Loading** (apps/web/src/App.tsx)
   - When viewing a report, fetch session workspace from backend
   - Generate evaluation if it doesn't exist
   - Pass to RecruiterReportsPage

4. **Database Service** (apps/api/src/services)
   - Add workspace storage service
   - Add evaluation generation service (reuse frontend logic or port it)

---

## Current Workaround

The system currently works for the **demo session** (alex-morgan) because:
- Session exists in localStorage as `devforge-assessment-session`
- Evaluation exists as `devforge-evaluation-record`
- Both are passed to RecruiterReportsPage

For real submitted assessments, you'll see them in the candidates list, but reports won't load because the session/evaluation data isn't available cross-browser.

The fix I added allows viewing evaluations from `devforge-evaluation-history` by URL, which helps if you're on the same browser where the assessment was submitted.
