# EduVision AI — Platform Reuse Matrix

This is the stable platform inventory. These capabilities already belong to the shared SaaS framework and must be reused rather than rebuilt for Myntiq-Education.

| Platform Module | Existing APIs | Reuse? | Education Use |
|---|---|---:|---|
| Authentication | `/api/users/login`, `/api/users/verify`, `/api/users/refresh-token`, `/api/users/logout`, password-reset APIs | Yes | Sign-in, session, password recovery for every education role. |
| User management | `/api/users` | Yes | User identity, status, organization assignments, and account administration. |
| Profile | `/api/profile` | Yes | Avatar, password/security, and common personal profile fields. |
| Preferences | `/api/user-preferences` | Yes | UI, accessibility, language, and personal learning preferences. |
| Organizations | `/api/org-structure` | Yes | School/coaching organization tenancy, administrators, and hierarchy. |
| Customers | `/api/customers` | Yes | Commercial customer/tenant administration. |
| Products | `/api/products` | Yes | Myntiq-Education product/plan configuration. |
| Subscriptions | `/api/subscriptions`, `/api/org-features` | Yes | Attach the product to an organization and enable/disable packaged capabilities. |
| RBAC | `/api/roles`, `/api/feature-permissions` | Yes | Access control for Student, Teacher, Parent, School Admin, Coaching Admin, Organization Admin, and Platform Admin. |
| Feature & menu management | `/api/features`, `/api/feature-availability-types`, `/api/menu` | Yes | Register education screens as platform features and expose only permitted menu items. |
| Dashboard framework | `/api/dashboard` | Yes | Shared dashboard shell, cards, widgets, and role-specific dashboard placement. |
| Notifications | `/api/profile/notifications` | Yes | Delivery and reading of reminders, grading alerts, and announcements. |
| Search | `/api/search` | Yes | Global search patterns for education entities once registered. |
| Tasks & calendar | `/api/tasks`, `/api/calendar` | Yes | Due dates, schedules, reminders, and learner task presentation. |
| Reports | `/api/reports` | Yes | Reporting framework and export patterns. |
| Settings | `/api/admin/settings` | Yes | Portal/organization settings framework. |
| Audit logs | `/api/audit` | Yes | Audit trail for education administration and sensitive changes. |
| File storage | Existing upload/storage utilities | Yes | Lesson files, assignment submissions, certificate files, and tutor attachments. |

## Reuse rule

An education module uses the platform’s authentication, organization scope, RBAC, feature/menu registration, audit, notification, task, calendar, report, search, and storage facilities. It adds only education business behavior and data.
