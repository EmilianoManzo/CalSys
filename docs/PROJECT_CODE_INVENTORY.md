# CalSys Project Code Inventory

This file summarizes the code in the CalSys project, what each major part does, the work that has already been done, and improvements that would make the system stronger.

## 1. Project Purpose

CalSys is a full-stack academic management system for grades, partial exams, final grades, attendance, students, users, groups, subjects, and role-based dashboards.

The system is split into:

- `backend/`: Node.js, Express, MySQL, JWT, bcrypt, security middleware, and REST API routes.
- `CalSys-JS/`: React, Vite, React Router, Axios, Handsontable, Chart.js, and role-specific dashboards.
- `docs/` plus root Markdown files: project documentation, deployment notes, security notes, and status documents.

## 2. High-Level Flow

1. A user opens the React frontend.
2. React Router sends the user to login or to a protected dashboard.
3. Login calls `POST /api/auth/login`.
4. The backend validates credentials in MySQL.
5. The backend returns a JWT, CSRF token, and user profile.
6. The frontend stores the tokens in `sessionStorage`.
7. Axios attaches the JWT to requests and sends the CSRF token on write operations.
8. The backend checks authentication, origin, CSRF header presence, route permissions, and scoped access.
9. Dashboards read or write academic data through REST endpoints.
10. MySQL stores students, staff users, groups, subjects, grade configurations, grade values, attendance dates, and attendance records.

## 3. Backend Code

### `backend/src/server.js`

Main Express entry point.

What it does:

- Loads environment variables with `dotenv`.
- Creates the Express app.
- Configures CORS from `CORS_ORIGIN`.
- Adds security headers, JSON body requirements, request sanitization, and global rate limiting.
- Exposes `/` and `/api/health`.
- Registers API modules:
  - `/api/auth`
  - `/api/grades`
  - `/api/columns`
  - `/api/admin`
  - `/api/partials`
  - `/api/attendance`
- Protects sensitive routes with authentication and authorization middleware.
- Handles 404 responses and generic server errors.
- Gracefully closes the HTTP server and MySQL pool on shutdown signals.

### `backend/src/config/database.js`

Creates the shared MySQL connection pool.

What it does:

- Uses `mysql2/promise`.
- Reads database host, user, password, name, port, SSL, and timeout from environment variables.
- Uses `utf8mb4`.
- Enables connection pooling with a limit of 10 connections.
- Supports optional TLS when `DB_SSL=true`.

### `backend/src/middleware/security.js`

Central security middleware and auth helpers.

What it does:

- Validates that `JWT_SECRET` exists and is long enough.
- Signs JWT tokens with issuer, audience, algorithm, and expiration.
- Authenticates Bearer tokens.
- Enforces allowed roles: `director`, `maestro`, and `alumno`.
- Adds security headers such as CSP, HSTS, frame denial, content sniffing protection, referrer policy, and no-store cache policy for API responses.
- Requires JSON bodies for state-changing requests.
- Sanitizes body, query, and route params.
- Validates request origins against configured allowed origins.
- Checks that non-safe methods include an `X-CSRF-Token` header.
- Enforces scoped access so teachers cannot request another teacher's data and students cannot request another student's matricula.
- Logs security events in structured JSON.
- Provides generic error helpers that avoid leaking internal error details to clients.

Important note:

- CSRF token validation currently checks for the header, but does not verify the token against server-side session storage. This is better than nothing, but it can be improved.

### `backend/src/middleware/rateLimit.js`

In-memory rate limiting and login lockout.

What it does:

- Implements a sliding-window limiter.
- Adds exponential backoff for repeated violations.
- Limits global API traffic.
- Limits auth attempts.
- Limits protected API route traffic by user and path.
- Tracks failed login attempts by username and role.
- Temporarily locks accounts after repeated failed auth attempts.
- Logs rate-limit events.

Important note:

- The limiter is in memory. It works for one Node process, but should move to Redis or another shared store before horizontal scaling.

### `backend/src/routes/auth.routes.js`

Authentication and password routes.

What it does:

- `POST /api/auth/login`
  - Accepts `username`, `password`, and `role`.
  - Validates role and required values.
  - Checks students in `students` by `matricula`.
  - Checks staff in `users` by `username` and `role`.
  - Requires active users.
  - Verifies password with bcrypt.
  - Records failed login attempts and clears failures on success.
  - Returns JWT, CSRF token, and user object.
- `POST /api/auth/change-password`
  - Requires authentication.
  - Validates current password, new password, and confirmation.
  - Requires at least 8 characters.
  - Hashes the new password.
  - Clears `must_change_password`.
  - Returns a refreshed JWT and CSRF token.
- `GET /api/auth/me`
  - Returns the authenticated user from the token.

### `backend/src/routes/grades.routes.js`

Read endpoints for teacher and student grade views.

What it does:

- Lets teachers/directors get assigned subjects and groups.
- Lets students/directors get a student's subjects.
- Lets students/directors get grades for a specific partial.
- Calculates student final grade data by combining:
  - Partial averages from partials 1, 2, and 3.
  - Exam final from partial 4.
  - Final grade configuration from partial 5.
- Uses IDOR protections so students cannot inspect another student's grades.
- Uses safe numeric helpers to avoid invalid math.

### `backend/src/routes/partials.routes.js`

Core module for partial grades and final-grade calculation.

What it does:

- Reads and writes partial column configuration.
- Reads students enrolled in a class context.
- Reads existing grade values.
- Saves grade values in bulk.
- Ignores virtual and special columns that should not be manually saved.
- Recalculates partial averages as `__promedio`.
- Ensures special final-grade columns exist:
  - `Promedio de Parciales`
  - `Calificacion Examen Final`
- Calculates final global grade from configured weights.
- Uses transactions when configuration or grade saves touch multiple rows.

This is one of the most important files in the project because it defines the current grade-capture workflow.

### `backend/src/routes/attendance.routes.js`

Attendance API module.

What it does:

- Creates class dates.
- Deletes class dates.
- Reads attendance dates for a class context.
- Reads attendance records.
- Saves attendance records in bulk.
- Lets students view attendance summaries.
- Calculates total classes, attended classes, and attendance percentage.

### `backend/src/routes/admin.routes.js`

Administrative API module.

What it does:

- Provides dashboard stats.
- Manages subjects/materias.
- Manages students.
- Manages staff users.
- Manages student groups.
- Assigns subjects to teachers and groups.
- Reads existing assignments.
- Uses bcrypt when creating/updating passwords.
- Uses transactions and deletion utilities to avoid orphaned records.

The frontend currently treats the administrative dashboard as a director dashboard. Backend route protection also allows `director` for `/api/admin`.

### `backend/src/routes/columns.routes.js`

Older or alternate custom-column grade route module.

What it does:

- Supports grade columns and custom values outside the newer partials workflow.
- Appears to be a legacy path compared with `partials.routes.js`.

Recommended direction:

- Decide whether this module is still needed.
- If it is needed, document how it differs from partials.
- If it is not needed, migrate any remaining usage and remove it to reduce maintenance cost.

### `backend/src/utils/validation.js`

Shared safe validation utilities.

What it does:

- Converts values to safe numbers and integers.
- Validates positive IDs.
- Validates email format.
- Validates matriculas.
- Validates non-empty strings.
- Validates enum values.
- Performs safe division.
- Calculates safe averages.
- Validates required fields.
- Validates maximum string lengths.
- Validates subject and semester codes.

### `backend/src/utils/enrolledStudents.js`

Helper for selecting enrolled students.

What it does:

- Reads active students enrolled in a class context through `final_grades`.
- Handles `group_code` comparisons correctly, including `NULL`, using MySQL null-safe comparison.

### `backend/src/utils/deleteAssignment.js`

Helper for deleting related academic data.

What it does:

- Deletes assignment-specific data.
- Deletes all data related to a subject.
- Deletes student records.
- Deletes teacher records.
- Cleans related rows from grade, partial, attendance, and assignment tables.

This helps prevent orphaned data when admins delete students, teachers, subjects, or assignments.

### `backend/src/utils/cache.js`

Utility for caching repeated backend data.

What it does:

- Provides local in-memory caching helpers.
- Useful for reducing repeated lookup work.

Recommended direction:

- Document exactly which routes should use it.
- Add expiration behavior if not already present.
- Replace with Redis or a shared cache if the backend scales to multiple instances.

## 4. Frontend Code

### `CalSys-JS/src/main.jsx`

React entry point.

What it does:

- Creates the React root.
- Renders the main `App`.
- Imports global CSS.

### `CalSys-JS/src/App.jsx`

Main app router.

What it does:

- Wraps routes with `BrowserRouter` and `AuthProvider`.
- Shows loading state while auth restores.
- Redirects users based on role.
- Protects pages by allowed role:
  - `/alumno`: `alumno`
  - `/maestro`: `maestro`, `director`
  - `/admin`: `director`
- Forces users with `mustChangePassword` to `/change-password`.

### `CalSys-JS/src/context/AuthContext.jsx`

Frontend auth state.

What it does:

- Stores current user and loading status.
- Restores auth from `sessionStorage`.
- Configures Axios Authorization header.
- Calls `/auth/me`.
- Handles login.
- Handles password change.
- Handles logout.
- Clears token and CSRF token on logout or invalid session.

### `CalSys-JS/src/api/axios.js`

Shared HTTP client.

What it does:

- Uses `VITE_API_URL` or defaults to `http://localhost:3000/api`.
- Sets JSON headers.
- Reads JWT and CSRF token from `sessionStorage`.
- Adds `Authorization: Bearer ...` when a token exists.
- Adds `X-CSRF-Token` for write requests.
- Ensures DELETE requests have a body object when needed.

### `CalSys-JS/src/pages/Login.jsx`

Login page.

What it does:

- Collects username, password, and role.
- Calls `AuthContext.login`.
- Redirects by role after successful login.
- Sends users to password-change flow when required.

### `CalSys-JS/src/pages/ChangePassword.jsx`

Password-change page.

What it does:

- Collects current password, new password, and confirmation.
- Calls `AuthContext.changePassword`.
- Redirects to the right dashboard after success.

### `CalSys-JS/src/pages/MaestroDashboard.jsx`

Teacher dashboard.

What it does:

- Loads teacher subjects by semester.
- Loads groups for selected subject.
- Lets the teacher choose semester, subject, and group.
- Passes class context into `PartialManager`.
- Shows the grade-capture workflow.

### `CalSys-JS/src/components/PartialManager.jsx`

Partial navigation.

What it does:

- Shows tabs for partials 1, 2, 3, exam final, final grade, and attendance.
- Renders `PartialGradesTable` for grade tabs.
- Renders `AttendanceTable` for attendance.
- Passes selected class context to child components.

### `CalSys-JS/src/components/PartialGradesTable.jsx`

Editable grade table.

What it does:

- Loads partial configuration.
- Loads students and grade values.
- Displays data in Handsontable.
- Opens `ColumnConfig` when columns need configuration.
- Calculates partial values visually for immediate feedback.
- Builds save payloads.
- Saves grades to `/partials/save-grades`.
- Keeps virtual and special columns read-only.

This is the main user-facing teacher workflow.

### `CalSys-JS/src/components/ColumnConfig.jsx`

Column setup UI.

What it does:

- Lets teachers configure column name, type, max value, weight, required flag, and order.
- Validates configuration before saving.
- Supports special final-grade weighting.
- Sends column config to the backend.

### `CalSys-JS/src/components/AttendanceTable.jsx`

Teacher attendance UI.

What it does:

- Loads attendance dates.
- Loads attendance records.
- Lets teachers add/delete class dates.
- Lets teachers mark attendance with checkboxes.
- Saves records in bulk.

### `CalSys-JS/src/components/GradesTable.jsx`

Older or general grade-table component.

What it does:

- Provides a grade table outside the newer partial-specific workflow.
- May belong to the legacy `columns.routes.js` path.

Recommended direction:

- Confirm if this component is still used.
- Remove or consolidate if partials fully replaced it.

### `CalSys-JS/src/components/PartialAveragesTable.jsx`

Partial averages display.

What it does:

- Presents average data for partial-grade workflows.

### `CalSys-JS/src/components/PartialGradesTable.jsx`

Current main grade-entry table.

What it does:

- Handles editable grade values, virtual averages, and backend synchronization.

### `CalSys-JS/src/pages/AlumnoDashboard.jsx`

Student dashboard.

What it does:

- Loads the student's enrolled subjects.
- Lets the student switch between partial grades, final grade, and attendance.
- Calls student-specific grade and attendance endpoints.
- Displays one-student tables and summary values.
- Uses the authenticated student's matricula.

### `CalSys-JS/src/pages/AdminDashboard.jsx`

Director/admin dashboard.

What it does:

- Loads general stats from `/admin/stats`.
- Shows summary cards.
- Shows Chart.js pie and bar charts.
- Provides tabs for:
  - Stats
  - Materias
  - Grades
  - Students
  - Groups
  - Users

### `CalSys-JS/src/components/admin/Stats.jsx`

Admin stats component.

What it does:

- Displays dashboard metrics and possibly chart-ready information.

### `CalSys-JS/src/components/admin/MateriasManager.jsx`

Subject manager.

What it does:

- Creates, reads, updates, and deletes materias.
- Talks to admin subject endpoints.

### `CalSys-JS/src/components/admin/StudentsManager.jsx`

Student manager.

What it does:

- Creates, reads, updates, and deletes students.
- Manages student profile data and active status.

### `CalSys-JS/src/components/admin/UsersManager.jsx`

Staff user manager.

What it does:

- Creates, reads, updates, and deletes staff users.
- Manages roles such as director and maestro.
- Handles active/inactive status.

### `CalSys-JS/src/components/admin/GroupsManager.jsx`

Group manager.

What it does:

- Creates and edits student groups.
- Manages group membership.
- Supports group-based assignment workflows.

### `CalSys-JS/src/components/admin/GradesViewer.jsx`

Grade viewer for admins/directors.

What it does:

- Lets admins/directors inspect grade information globally or by filters.

### `CalSys-JS/src/pages/DirectorDashboard.jsx`

Director dashboard placeholder or alternate dashboard.

What it does:

- Provides a director-facing page path or alternate view.

Current note:

- The active router sends `director` users to `/admin`, which renders `AdminDashboard`.

### `CalSys-JS/src/theme.js`

Shared frontend colors/theme constants.

What it does:

- Centralizes commonly used colors.
- Used by dashboard chart styling and UI components.

### `CalSys-JS/src/App.css` and `CalSys-JS/src/index.css`

Global styling.

What they do:

- Define base visual styles.
- Support app-wide layout and component CSS.

### Assets

Files:

- `CalSys-JS/public/justo-sierra-logo-transparent.png`
- `CalSys-JS/public/justo-sierra-logo.jpg`
- `CalSys-JS/src/assets/justo-sierra-logo-transparent.png`
- `CalSys-JS/src/assets/justo-sierra-logo.jpg`
- `CalSys-JS/src/assets/react.svg`

What they do:

- Provide branding images used in dashboards and public/static access.

## 5. Config, Build, and Deployment Files

### Backend

- `backend/package.json`: backend dependencies and `start` / `dev` scripts.
- `backend/package-lock.json`: exact npm dependency versions.
- `backend/.env.example`: expected backend environment variables.
- `backend/Dockerfile`: backend container definition.
- `backend/railway.json`: Railway deployment configuration.

### Frontend

- `CalSys-JS/package.json`: frontend dependencies and Vite scripts.
- `CalSys-JS/package-lock.json`: exact npm dependency versions.
- `CalSys-JS/vite.config.js`: Vite configuration.
- `CalSys-JS/vercel.json`: Vercel deployment configuration.
- `CalSys-JS/.env.example`: expected frontend environment variables.
- `CalSys-JS/Dockerfile`: frontend container definition.
- `CalSys-JS/nginx.conf` and `CalSys-JS/nginx.conf.template`: static frontend serving configuration.
- `CalSys-JS/eslint.config.js`: frontend linting configuration.
- `CalSys-JS/index.html`: Vite HTML shell.

### Root and Docs

- `README.md`: project overview, setup, architecture, roles, and docs links.
- `DESARROLLO.md`: development guide and conventions.
- `ESTADO_ACTUAL.md`: current project status.
- `SECURITY.md`: security guidance.
- `SECURITY_AUDIT.md`: security audit findings and fixes.
- `DEPLOYMENT_GUIDE.md`: deployment guide.
- `DOCKER_DEPLOYMENT.md`: Docker deployment notes.
- `READY_FOR_DEPLOYMENT.md`: delivery/deployment readiness notes.
- `docs/API.md`: API reference.
- `docs/ARCHITECTURE.md`: architecture documentation.
- `docs/OPERATIONS.md`: operations documentation.
- `docs/FUNCIONAMIENTO_Y_CODIGO.md`: detailed behavior and code explanation.
- `docs/CalSys_Documentacion_Proyecto.docx`: Word-format project documentation.

## 6. Things Already Worked On

The current project shows work in these areas:

### Core academic workflows

- Teacher subject and group selection.
- Partial grade configuration.
- Partial grade capture.
- Partial average calculation.
- Final exam and global final-grade calculation.
- Student grade viewing.
- Attendance date and record management.
- Admin/director management of students, users, groups, subjects, assignments, and stats.

### Security improvements

- JWT authentication.
- Strong JWT secret requirement.
- Token issuer and audience validation.
- Session token storage moved to `sessionStorage`.
- CSRF token returned at login and sent by Axios on write requests.
- Security headers.
- Exact origin validation.
- JSON content-type requirement for write operations.
- Request sanitization.
- Generic server errors instead of exposing internal error messages.
- Structured security logs.
- Rate limiting.
- Login lockout after repeated failures.
- Scoped access checks to reduce IDOR risk.

### Deployment and operations

- Backend and frontend Docker files.
- Nginx configuration for frontend hosting.
- Railway and Vercel deployment config.
- Multiple deployment guides.
- Health check endpoint.
- Environment variable examples.

### Documentation

- Main README.
- Architecture docs.
- API docs.
- Operations docs.
- Development guide.
- Security audit.
- Current project status.
- This project code inventory.

## 7. Known Risks and Gaps

### Testing

- There is no visible automated backend test suite.
- There is no visible frontend component or integration test suite.
- Critical flows should be covered by tests:
  - Login and password change.
  - Role authorization.
  - Teacher grade save.
  - Partial average recalculation.
  - Final grade calculation.
  - Attendance save.
  - Admin assignment and deletion flows.

### CSRF validation

- The backend checks that the CSRF header exists, but does not validate it against server-side storage.
- A stronger implementation would store CSRF tokens server-side or switch to secure, same-site HTTP-only cookie based auth with a real CSRF strategy.

### In-memory rate limiting

- Current rate limiting and lockout state live in process memory.
- This is acceptable for one backend instance.
- It will not work correctly across multiple backend instances without Redis or another shared store.

### Legacy grade paths

- `columns.routes.js` and some older frontend components appear to overlap with the newer partials workflow.
- This increases maintenance cost and makes grade logic harder to reason about.

### Character encoding

- Some files show broken accented characters when read in the console.
- The repo should be normalized to UTF-8.

### Inline styling

- Several React pages use large inline `<style>` blocks or inline style objects.
- This makes styling harder to reuse and maintain.

### Database migrations

- The README references a local schema script, but the visible project structure should be checked to make sure schema and migration files are versioned and easy to run.
- A migration system would make production changes safer.

## 8. Recommended Improvements

### Highest priority

1. Add automated tests for backend routes and grade calculations.
2. Add frontend build/lint verification to CI.
3. Replace CSRF header-presence check with real token validation or cookie-based auth.
4. Move rate limiting and auth lockout storage to Redis for production scaling.
5. Resolve whether `columns.routes.js` and older grade components are still required.

### Medium priority

1. Normalize all source and docs files to UTF-8.
2. Add a formal database migration workflow.
3. Add audit tables for important admin actions.
4. Add backend validation schemas for all route payloads.
5. Consolidate grade calculation logic so frontend preview and backend persistence cannot drift.
6. Improve error display patterns in the frontend.
7. Extract large inline CSS into reusable style modules or component styles.

### Product improvements

1. Export grades and attendance to CSV or Excel.
2. Add printable student reports.
3. Add search and advanced filters in admin tables.
4. Add pagination for large student, user, grade, and attendance lists.
5. Add teacher-facing history of saved changes.
6. Add student notifications when grades are updated.

### Operations improvements

1. Add CI checks for frontend build, frontend lint, backend syntax, and tests.
2. Add production logging guidance.
3. Add backup and restore documentation for MySQL.
4. Add deployment smoke-test steps.
5. Add monitoring for API health, DB connectivity, auth failures, and rate-limit hits.

## 9. Suggested Verification Commands

Backend:

```bash
cd backend
npm install
npm start
```

Frontend:

```bash
cd CalSys-JS
npm install
npm run build
npm run lint
```

Health check:

```bash
curl http://localhost:3000/api/health
```

## 10. Short Handoff Summary

CalSys is already a functional academic management system. The strongest areas are the grade workflow, role-based dashboards, admin management, and recent backend security hardening. The most important next steps are automated tests, real CSRF validation, migration management, UTF-8 cleanup, and removal or documentation of legacy grade code.

