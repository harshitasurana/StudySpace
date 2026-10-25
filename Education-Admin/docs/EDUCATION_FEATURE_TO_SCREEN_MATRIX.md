# EduVision AI — Education Screen and API Matrix

This document covers education screens only. Platform administration is documented separately in the Platform Reuse Matrix. A “new API” is education-domain functionality; it reuses the shared platform authentication, RBAC, organization scope, menu, audit, notification, task, calendar, report, search, and file-storage foundations.

| Module | Screen | User Role | Purpose | Platform APIs Reused | Education APIs Required | New frontend required | Priority | Phase |
|---|---|---|---|---|---|---:|---|---|
| Student | Student Dashboard | Student | Today’s plan, due work, progress, and learning alerts. | `/api/dashboard`, `/api/tasks`, `/api/calendar`, notifications | Student learning summary | Yes | P0 | 3 |
| Student | Student Profile | Student | Academic profile, grade/class and learning preferences. | `/api/profile`, `/api/user-preferences` | Student academic profile | Yes | P1 | 3 |
| Student | My Learning Plan | Student | Ordered enrolled courses, lessons, and due learning activities. | `/api/tasks`, `/api/calendar` | Learning-plan data | Yes | P0 | 3 |
| Teacher | Teacher Dashboard | Teacher | Classes, pending grading, attendance, learner alerts. | `/api/dashboard`, `/api/tasks`, `/api/calendar` | Teacher teaching summary | Yes | P0 | 3 |
| Teacher | My Classes | Teacher | Assigned classes/batches and course coverage. | `/api/users`, `/api/org-structure` | Class/batch and teaching assignments | Yes | P0 | 3 |
| Teacher | Learner Workspace | Teacher | Review a student’s progress, submissions, and interventions. | `/api/users`, `/api/reports`, `/api/tasks` | Learner academic workspace | Yes | P0 | 4 |
| Parent | Parent Dashboard | Parent | Linked children, progress, attendance, and notices. | `/api/dashboard`, notifications, `/api/calendar` | Parent-child linkage and summary | Yes | P1 | 6 |
| Parent | Child Progress | Parent | View permitted course progress, results, and feedback. | `/api/reports` | Guardian progress access | Yes | P1 | 6 |
| School & Coaching | Institution Overview | School Admin, Coaching Admin, Organization Admin | Monitor learners, staff, courses, and outcomes. | `/api/dashboard`, `/api/reports`, `/api/org-structure` | Institution education metrics | Yes | P0 | 4 |
| School & Coaching | Academic Setup | School Admin, Coaching Admin, Organization Admin | Manage academic years, classes, sections, batches, and grading policy. | `/api/org-structure`, `/api/admin/settings` | Academic year, class, section, batch, policy | Yes | P0 | 4 |
| Curriculum | Course Catalog | All relevant roles | Browse organization courses. | `/api/search`, `/api/products` | Course catalog | Yes | P0 | 3 |
| Curriculum | Course Builder | Teacher, School Admin, Coaching Admin | Create courses and curriculum structure. | None | Course authoring | Yes | P0 | 4 |
| Curriculum | Subject Manager | Teacher, School Admin, Coaching Admin | Manage subjects within courses. | `/api/search` | Subjects | Yes | P0 | 4 |
| Curriculum | Chapter Manager | Teacher, School Admin, Coaching Admin | Organize subjects into chapters. | None | Chapters | Yes | P0 | 4 |
| Curriculum | Lesson Library | Teacher, School Admin, Coaching Admin | Create, upload, organize, and publish lessons. | File-storage utilities, `/api/search` | Lessons/content assets | Yes | P0 | 5 |
| Curriculum | Lesson Player | Student, Parent (view only), Teacher | Consume lesson content and record completion. | `/api/user-preferences` | Lesson delivery/completion | Yes | P0 | 5 |
| Enrollment | Enrollment Manager | School Admin, Coaching Admin, Teacher | Enrol/remove learners from courses/classes/batches. | `/api/users`, `/api/org-structure` | Enrolments | Yes | P0 | 5 |
| Assignments | Assignment List | Student, Teacher | View pending, submitted, graded, and overdue work. | `/api/tasks`, `/api/calendar`, notifications | Assignments | Yes | P0 | 5 |
| Assignments | Assignment Authoring | Teacher | Create assignments, rubrics, targets, and deadlines. | `/api/tasks`, `/api/calendar` | Assignment authoring | Yes | P0 | 5 |
| Assignments | Submission & Grading | Student, Teacher | Submit work, grade it, annotate, and return feedback. | Notifications, file-storage utilities | Submission/grading | Yes | P0 | 6 |
| Assessments | Assessment List & Builder | Student, Teacher, School Admin | Create, schedule, publish, and view assessments. | `/api/calendar`, notifications | Assessments | Yes | P0 | 6 |
| Assessments | Question Bank | Teacher, School Admin | Create, tag, import, search, and reuse questions. | `/api/search` | Question bank | Yes | P0 | 6 |
| Assessments | Quiz Player | Student | Take timed quizzes and receive allowed feedback. | `/api/calendar` | Quiz delivery, attempts, scoring | Yes | P0 | 6 |
| Assessments | Results & Feedback | Student, Teacher | View results, answers, scores, and feedback. | `/api/reports` | Assessment result data | Yes | P0 | 7 |
| Attendance | Attendance Register | Teacher, School Admin | Mark/correct attendance by class or batch. | `/api/calendar`, `/api/reports` | Attendance | Yes | P1 | 7 |
| Attendance | Attendance Summary | Student, Parent, Teacher, Admin roles | View attendance trends and exceptions. | `/api/reports` | Attendance analytics | Yes | P1 | 7 |
| Progress | My Progress | Student | Completion, mastery, weak topics, and achievements. | `/api/dashboard`, `/api/reports` | Learning progress/mastery | Yes | P0 | 7 |
| Progress | Learner Progress | Teacher, Parent, Admin roles | Detailed learner progress across all learning activity. | `/api/reports` | Learner progress detail | Yes | P0 | 7 |
| Analytics | Learning Analytics | Teacher, School Admin, Coaching Admin | Analyze class, subject, teacher, and cohort outcomes. | `/api/dashboard`, `/api/reports` | Education analytics | Yes | P1 | 8 |
| Reports | Student Report Card | Student, Parent, Teacher | View/export academic reports. | `/api/reports` | Education report-card data | Yes | P1 | 8 |
| Reports | Class & Institution Reports | Teacher, School Admin, Coaching Admin | Export performance, attendance, and completion reports. | `/api/reports` | Education report definitions/data | Yes | P1 | 8 |
| Certificates | Certificate Center | Student, School Admin, Coaching Admin | Issue, revoke, view, and download certificates. | `/api/reports`, notifications, file storage | Certificates | Yes | P2 | 9 |
| Notifications | Education Notification Center | All | Learning reminders, grading alerts, announcements. | `/api/profile/notifications` | No for delivery/read; announcements need targeting | Yes | P1 | 5 |
| Settings | Learning Preferences | Student, Teacher, Parent | Language, accessibility, reminder, and learning preferences. | `/api/user-preferences`, notification preferences | No | Yes | P1 | 4 |
| Settings | Education Organization Settings | School Admin, Coaching Admin, Organization Admin | Academic years, grading, attendance, certificate policies. | `/api/admin/settings`, `/api/org-structure` | Education settings | Yes | P1 | 7 |
| AI Tutor | Tutor Home & Context Selection | Student | Choose course/lesson context for a tutor session. | `/api/nlp`, `/api/user-preferences` | Tutor context/orchestration | Yes | P0 | 10 |
| AI Tutor | Tutor Conversation | Student, Teacher (review) | Personalized learning explanations with safe session history. | `/api/nlp` | Tutor session/history/safety | Yes | P0 | 10 |
| AI Tutor | Multimodal Ask | Student, Teacher | Ask about text, image, document, audio, or video content. | File-storage utilities, `/api/nlp` | Multimodal ingestion/retrieval | Yes | P0 | 10 |
| AI Tutor | Revision Planner | Student | Recommend revision based on goals, deadlines, progress, and results. | `/api/tasks`, `/api/calendar` | Revision planning | Yes | P1 | 10 |
| AI Tutor | Adaptive Practice | Student | Generate practice, hints, feedback, and mastery updates. | `/api/nlp` | Practice sessions/mastery | Yes | P0 | 11 |

## Delivery phases

1. **Platform — complete/reused:** platform configuration, authentication, RBAC, organizations, product, subscription, features, menus, settings.
2. **Education domain design:** confirm the concepts and workflows in `EDUCATION_DOMAIN_MODEL.md`; do not build AI yet.
3. **Academic foundation:** dashboards, classes/batches, courses, curriculum, enrolment, lessons, assignments.
4. **Evidence of learning:** assessments, questions, quizzes, results, attendance, progress.
5. **AI Tutor integration:** only after curriculum, enrolment, learner activity, assessment results, and progress provide useful personalization context.
