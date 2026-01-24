# Attendance Management System Architecture

## Goals
- Multi-role RBAC (Super Admin, Admin/HR, Faculty, Student) with least-privilege defaults.
- Reliable attendance capture (biometric-ready, QR, GPS/IP rules) with fraud prevention and auditability.
- Configurable shifts, holidays, grace rules, and leave balances with approvals.
- Reporting and exports (PDF/Excel) with trend analytics.
- Production-grade security (validation, rate limits, logging, encryption where required).

## High-Level Design
```
[Client (Expo / Web)]
    ↓ HTTPS + JWT
[API Gateway / Express App]
    ↓
[Routing + Middleware]
    - AuthN (JWT) & Session checks
    - AuthZ (RBAC policy enforcement)
    - Rate limit & input validation
    - Request/response logging, correlation IDs
    ↓
[Controllers]
    ↓
[Services]
    - Business rules, workflows, approvals
    - Domain events (publish → async workers)
    ↓
[Repositories]
    - Mongoose models
    - Query optimization & soft deletes
    ↓
[MongoDB]
    - Primary data store
    - TTL indexes for ephemeral tokens/OTPs

[Async Workers]
    - Cron (auto-absent, reminders)
    - Notification sender (email/SMS/push)
    - Bulk upload processor
```

## Key Modules
- **Auth & RBAC**: JWT access tokens, optional refresh tokens; roles & permissions stored in Mongo. Policy middleware protects routes and checks resource ownership (e.g., student belongs to faculty/department).
- **User & Org**: Users linked to departments and shifts; supports Super Admin (global), Admin/HR (org-scoped), Faculty (class/section scoped), Student (self-service).
- **Attendance**:
  - Check-in/out with derived metrics (work hours, overtime, late/early flags, grace rules, half-day/short-leave handling).
  - Multi-capture inputs: biometric webhooks (API-ready), QR sessions (time/geo/IP-bound), GPS geofencing, IP restriction, face-recognition placeholders.
  - Manual override with audit trail and dual-approval options.
- **Shifts & Calendars**: Fixed/rotating shifts, break windows, grace minutes; holiday and weekend configuration per location/department.
- **Leave Management**: Leave types (paid/unpaid/sick/casual, etc.), balances, accruals, approvals, and auto-deduction when leave overlaps attendance.
- **Corrections**: Employee/student-submitted correction requests with approval workflow, reason codes, and audit logs.
- **Bulk Ops**: CSV/Excel upload for attendance/roster; background jobs with progress and error reporting.
- **Reports & Analytics**: Periodic and ad-hoc reports (daily/weekly/monthly, user/department), late/absent frequency, trends; export to PDF/Excel.
- **Notifications**: Email/SMS/push for late/absent alerts, approvals, reminders; templated messages and quiet hours.
- **Audit & Security**: Audit trail for all critical actions; rate limiting, input validation, encryption for sensitive fields, IP allowlists, anomaly detection (geo/IP/device changes).

## API Layering & Patterns
- **Routing**: Express routers per module (auth, users, roles, attendance, shifts, leave, corrections, reports, devices, uploads).
- **Validation**: Request DTO validation (e.g., Zod/Joi) at the edge; sanitization to prevent injection/XSS in stored notes.
- **AuthN**: Bearer JWT; optional refresh token rotation with reuse detection; short-lived access tokens.
- **AuthZ**: Policy middleware (`requireRole`, `requirePermission`, `scopedToDepartment`, `scopedToStudentSelf`) enforced before controllers.
- **Error Handling**: Centralized error mapper → consistent problem+JSON responses with error codes; correlation IDs for tracing.
- **Logging**: Structured logs (req/res, errors, audit events) with redaction of secrets/PII.

## Domain Events & Automation
- **Cron/Jobs**: Node-cron or BullMQ (Redis) for:
  - Auto-mark absent if no check-in by cutoff.
  - Balance accrual and expiry.
  - Reminder pings for pending approvals.
  - Bulk upload processing & retries.
- **Events**: Services publish domain events (`attendance.marked`, `leave.approved`, `correction.requested`) consumed by notification workers and analytics updaters.

## Integrations & Extensibility
- **Biometric**: Webhook endpoints with signatures; device registry and status; replay protection.
- **QR**: Time-bound QR session issuance (per shift/class), signed payload with location/IP constraints.
- **GPS/Geofence**: Polygon/circle geofences per site; server-side validation of lat/lng & accuracy.
- **IP Restriction**: Allowlist per location/role for web check-ins.
- **Face Recognition**: Placeholder endpoints and storage model for future model integration; decoupled via adapter interface.

## Non-Functional
- **Scalability**: Stateless API, horizontal scaling; indexes on high-cardinality fields; pagination for list endpoints.
- **Resilience**: Timeouts/retries to downstream services; circuit breakers for external SMS/Email providers.
- **Security**: Helmet/CORS, rate limiting per IP + token, strong password policy, MFA-ready; encrypted secrets via environment/config.
- **Observability**: Health checks, metrics (p95 latency, job success), tracing-ready (OpenTelemetry friendly).

## Frontend (Expo Router)
- Role-based navigation guards; dashboards per role.
- Offline-friendly attendance capture (queued submissions) for mobile if required.
- Reusable UI components (forms, charts, tables) with validation and error surfacing.
- Upload and report download flows; map/geo prompts for GPS check-ins.

## Deployment Targets
- Containerized services (Docker) with separate web & worker processes.
- Config via environment variables and secrets management.
- MongoDB Atlas (or managed Mongo) with VPC peering; Redis for queues/caching.
- CI/CD: lint/test → build → deploy; seeded demo data for smoke tests.
