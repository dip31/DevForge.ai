# DevForge.ai — Security Limitations & Demo Boundaries

This document describes the known security limitations and demo boundaries of the current DevForge.ai implementation. These are intentional design decisions for the Phase 2 prototype and should be addressed before production deployment.

## 1. Authentication & Authorization

### Current State

- **Demo-only authentication**: Hardcoded demo accounts (`candidate@codeapex.demo` / `Demo123!`, `recruiter@codeapex.demo` / `Demo123!`)
- **No password hashing**: Passwords stored in plaintext in source code
- **No session tokens**: Authentication state stored in localStorage only
- **No JWT/OAuth**: No token-based authentication or third-party identity providers
- **Frontend-only role guards**: Route protection implemented only in React components; no server-side validation

### Production Requirements

- Implement proper authentication (OAuth 2.0 / OIDC, or secure password-based auth with bcrypt/argon2)
- Add JWT or session cookie-based authentication with secure flags
- Implement server-side authorization checks for all API endpoints
- Add multi-factor authentication for recruiter accounts
- Implement password reset and account recovery flows

## 2. Data Persistence

### Current State

- **localStorage only**: All data (sessions, assessments, evaluations, evidence) stored in browser localStorage
- **No backend database**: No PostgreSQL, MongoDB, or other persistent storage
- **No data synchronization**: Data cannot be shared across browsers or devices
- **No backup/recovery**: Clearing browser data destroys all records
- **No audit trail persistence**: Audit events stored only in localStorage

### Production Requirements

- Implement PostgreSQL (or similar) with proper schema migrations
- Add Redis for session storage and caching
- Implement automated backups and point-in-time recovery
- Add audit log persistence with tamper-evident storage
- Implement data retention and GDPR compliance (right to deletion)

## 3. Code Execution & Sandboxing

### Current State

- **No code execution**: The "Run" and "Test" features use a deterministic source analyzer (`analyzeTests`) that pattern-matches source code
- **No sandbox**: Arbitrary candidate JavaScript is never executed
- **Preview is simulated**: Live Preview uses a predefined React component adapter, not actual candidate code
- **Terminal is simulated**: Demo terminal only supports `help`, `clear`, `pwd`, `ls`, `npm test`, `npm run`, `echo`

### Production Requirements

- Implement secure code execution sandbox (e.g., Firecracker microVMs, gVisor, or cloud-based runners like GitHub Actions / CodeSandbox)
- Enforce CPU/memory limits, execution timeouts, filesystem isolation, network restrictions
- Separate hidden tests from candidate-visible code
- Implement secure dependency installation with allowlists
- Add output size limits and safe cleanup

## 4. Evidence Integrity

### Current State

- **Client-side only**: Evidence records created and stored in browser
- **No tamper protection**: localStorage can be modified by user via DevTools
- **No cryptographic signing**: Evidence records not signed or hashed
- **No chain of custody**: No cryptographic proof that evidence hasn't been altered
- **Provenance limitations**: Many events marked `provenance: "unknown"` because source cannot be verified

### Production Requirements

- Implement server-side evidence collection with append-only storage
- Add cryptographic signing (Ed25519) of evidence records at creation time
- Implement Merkle tree or blockchain-anchored audit trail
- Add hardware-backed attestation (TPM/TEE) where possible
- Implement WORM (Write Once Read Many) storage for evidence

## 5. Evaluation Integrity

### Current State

- **Deterministic rule-based only**: Evaluation uses hardcoded rules, no AI/LLM integration
- **Custom rubrics not fully integrated**: Custom rubrics stored but don't replace default criteria
- **No model versioning**: Evaluator version is static string
- **No human-in-the-loop enforcement**: Reviewer overrides don't require second approval

### Production Requirements

- Integrate with LLM evaluation service (with strict prompt engineering and output validation)
- Implement rubric versioning with immutable snapshots
- Add model version pinning and evaluation reproducibility
- Require dual-reviewer approval for overrides
- Implement evaluation appeals process

## 6. Transport Security

### Current State

- **No HTTPS enforcement**: Development server runs on HTTP
- **No CSP headers**: No Content Security Policy configured
- **No HSTS**: No HTTP Strict Transport Security
- **No secure cookies**: No cookie-based session management

### Production Requirements

- Enforce HTTPS everywhere with HSTS preload
- Implement strict CSP with nonce-based script/style allowlists
- Use Secure, HttpOnly, SameSite=Strict cookies
- Add security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
- Implement certificate transparency monitoring

## 7. Input Validation & Injection Prevention

### Current State

- **No server-side validation**: All validation happens in React components
- **No SQL injection protection**: No database queries (localStorage only)
- **No XSS protection beyond React**: Relies on React's auto-escaping
- **No rate limiting**: No API rate limiting or abuse prevention

### Production Requirements

- Implement server-side input validation with Zod/Valibot schemas
- Use parameterized queries / ORM for all database operations
- Add rate limiting (token bucket) on all API endpoints
- Implement request size limits
- Add WAF (Web Application Firewall) rules

## 8. Privacy & Data Protection

### Current State

- **No data minimization**: All candidate activity recorded without explicit granular consent
- **No data export/deletion**: No GDPR Article 15/17 compliance
- **No encryption at rest**: localStorage is unencrypted
- **No encryption in transit**: HTTP only

### Production Requirements

- Implement granular consent management for evidence collection
- Add data subject access request (DSAR) portal
- Implement AES-256 encryption at rest, TLS 1.3 in transit
- Add data processing agreements (DPAs) with subprocessors
- Conduct DPIA (Data Protection Impact Assessment)

## 9. Multi-tenancy & Isolation

### Current State

- **Single-tenant demo**: All data in single localStorage namespace
- **No organization isolation**: Recruiters see all data, no company-level separation
- **Candidate data visible**: Candidate can see all their localStorage data

### Production Requirements

- Implement row-level security (RLS) for multi-tenant data isolation
- Add organization-scoped API keys and data access
- Implement candidate data visibility controls
- Add cross-tenant data leakage prevention

## 10. Monitoring & Incident Response

### Current State

- **No logging**: No structured logging or observability
- **No alerting**: No alerts for failed evaluations, auth failures, or anomalies
- **No incident response plan**: No documented procedures

### Production Requirements

- Implement structured logging (JSON) with correlation IDs
- Add distributed tracing (OpenTelemetry)
- Set up alerting for: auth failures, evaluation errors, sandbox escapes, data access anomalies
- Document incident response runbooks
- Conduct regular penetration testing and red team exercises

## 11. Supply Chain Security

### Current State

- **No dependency scanning**: No automated vulnerability scanning
- **No SBOM**: No Software Bill of Materials generation
- **No signed commits**: No commit signing enforcement

### Production Requirements

- Enable Dependabot / Renovate for automated updates
- Generate SBOM (CycloneDX) on every build
- Require signed commits (GPG/SSH) and verified authors
- Implement SLSA Level 3+ build provenance
- Pin all dependencies to exact versions with integrity hashes

## 12. Demo-Specific Boundaries (Phase 2)

The following features are explicitly **demo-only** and not production-ready:

| Feature          | Demo Behavior                   | Production Gap                  |
| ---------------- | ------------------------------- | ------------------------------- |
| Authentication   | Hardcoded demo credentials      | Full auth system needed         |
| Code execution   | Pattern-matching analyzer       | Secure sandbox required         |
| Evidence storage | localStorage (tamperable)       | Append-only signed storage      |
| Evaluation       | Rule-based deterministic        | LLM + human review pipeline     |
| Assignments      | Created in recruiter UI only    | API + webhook integration       |
| Billing          | 3 free attempts tracked locally | Stripe/Billing integration      |
| Reports          | localStorage-based              | Database-backed with RBAC       |
| Terminal         | Simulated command whitelist     | Real shell with restrictions    |
| AI Coach         | Deterministic local responses   | LLM integration with guardrails |

## 13. Recommended Next Steps

### Immediate (Before Any External Use)

1. Remove hardcoded credentials from source code
2. Add `.env` configuration for demo mode toggle
3. Implement basic CSP headers in `vite.config.ts`
4. Add security.txt file

### Short-term (Phase 3)

1. Implement PostgreSQL backend with Prisma/Drizzle ORM
2. Add JWT authentication with httpOnly cookies
3. Implement secure code execution sandbox (Firecracker)
4. Add cryptographic evidence signing
5. Implement basic rate limiting

### Medium-term (Phase 4)

1. Integrate LLM evaluation service (with guardrails)
2. Implement multi-tenant row-level security
3. Add GDPR compliance tooling
4. Set up observability stack (logging, tracing, alerting)
5. Conduct third-party penetration test

### Long-term (Production Ready)

1. Achieve SOC 2 Type II compliance
2. Implement zero-trust network architecture
3. Add hardware-backed attestation for evidence
4. Formal verification of evaluation algorithms
5. Continuous red team / blue team exercises

---

**Last Updated**: 2025-01-13
**Version**: Phase 2 Prototype
**Classification**: Internal - Demo Boundaries Documentation
