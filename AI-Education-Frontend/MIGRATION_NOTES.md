# Sprint 1 Migration Notes

## New dependency
`services/apiClient.js` uses **axios**. It wasn't in the original prototype
(which used raw `fetch`), so add it:

```
npm install axios
```

## What moved where

| Old | New |
|---|---|
| `src/pages/Login.jsx`, `Signup.jsx`, `ForgotPassword.jsx`, `ResetPassword.jsx`, `MfaVerify.jsx` | `src/modules/authentication/pages/` |
| `src/pages/StudentPortal.jsx` | `src/modules/student/pages/` |
| `src/pages/TeacherOverview.jsx`, `CreateAssignment.jsx` | `src/modules/teacher/pages/` |
| `src/pages/ParentDashboard.jsx` | `src/modules/parent/pages/` |
| `src/pages/SuperAdminConsole.jsx` | `src/modules/school/pages/` |
| `src/pages/Curriculum.jsx` | `src/modules/curriculum/pages/` |
| `src/pages/PreAssessment.jsx`, `ChapterTest.jsx`, `MasteryAnalytics.jsx`, `Practice.jsx` | `src/modules/assessment/pages/` |
| `src/pages/LessonHeron.jsx`, `Lesson3D.jsx` | `src/modules/ai/pages/` |
| `src/components/Header.jsx` | `src/layouts/Topbar.jsx` (renamed) |
| `src/components/Sidebar.jsx`, `Footer.jsx` | `src/layouts/` (unchanged names) |

Every protected page used to import `Sidebar`/`Header`/`Footer` itself; those
imports and JSX tags were stripped out, since `MainLayout` now mounts all
three exactly once around an `<Outlet />`.

## Auth flow

- `Login.jsx` now calls `AuthService.login()` (→ `POST /api/users/login`)
  through the shared `apiClient` instead of a raw `fetch` + `localStorage`.
  It still hands off to the existing MFA step for parity with the current
  prototype UX.
- `MfaVerify.jsx` calls a new `AuthService.verifyMfa()` (reuses the existing
  `/api/auth/mfa-verify` endpoint) and finalizes the session via
  `AuthContext.setUser`, then routes by role using
  `routes/routeConfig.js#defaultRouteForRole`.
- `apiClient.js` keeps the access token in memory (not localStorage) and
  relies on an httpOnly refresh-token cookie set by the backend. On a 401
  it calls `POST /api/users/refresh-token` once and retries the original
  request.
- `AuthContext` tries a silent refresh + `GET /api/users/me` on app load, so
  a hard page refresh doesn't force a re-login as long as the refresh
  cookie is still valid.

## Backend endpoints this assumes exist

Beyond `POST /api/users/login` (explicitly named in the sprint doc), the new
services assume these routes — check `src/api/endpoints.js` and adjust to
match the real backend:

- `POST /api/users/refresh-token`, `POST /api/users/logout`, `GET /api/users/me`
- `GET/POST /api/user/profile`, `/api/user/preferences`
- `GET /api/organizations/current`, `/api/organizations`
- `GET /api/roles`, `/api/roles/:role/permissions`
- `GET /api/dashboard/:role`

## Not yet migrated (left as-is, flagged for a follow-up sprint)

Several pages still call `fetch()` directly for non-auth data (dashboard
widgets, notifications, search, curriculum content, etc.) rather than going
through a service + `apiClient`. That wasn't in this sprint's scope
(`AuthService`/`ProfileService`/`PreferenceService`/`OrganizationService`/
`RoleService`/`DashboardService` are in place and ready for those calls to
move onto), but "every API through one client" isn't fully true yet —
worth a Sprint 2 pass through `Curriculum.jsx`, `Practice.jsx`,
`ParentDashboard.jsx`, `TeacherOverview.jsx`, and the notifications/search
`fetch` calls still in `Topbar.jsx`.

`shared/` was created per the target structure but is currently empty —
a good home for cross-module UI primitives (buttons, modals, form inputs)
if/when they get extracted from the page components.

## Role strings

Route guards assume: `student`, `teacher`, `parent`, `school` (or
`organization`), `superadmin` (or `super admin`). Confirm these match what
the backend actually returns in the login/me response — `RoleBasedRoute`
and `defaultRouteForRole` key off `user.role` exactly.
