# EduVision AI — Module Implementation Roadmap

This is the engineering roadmap. It converts the platform baseline, education domain model, and screen matrix into module ownership, dependencies, and implementation order.

| Module | Platform Reused | New Education Backend Module | New Education Frontend Module | Depends On | Sprint |
|---|---|---|---|---|---:|
| Platform configuration | Authentication, Users, Organizations, Products, Subscriptions, RBAC, Features, Menu, Settings, Audit | None | Reuse existing Admin UI | None | 1 |
| Authentication experience | `/api/users`, Profile, Preferences | None | Role-aware login redirect and reused account screens | Platform configuration | 1 |
| Education identity | Users, Profiles, Organizations, RBAC, Audit | Student profile, Teacher profile, Parent/guardian link | Student/teacher/parent profile screens | Authentication experience | 2 |
| Academic structure | Organizations, Settings, Search, Audit | Academic years, classes/sections, coaching batches, grading policy | Academic setup, class/section, batch screens | Education identity | 2 |
| Course & curriculum | Organizations, Search, File Storage, Feature/Menu framework | Courses, subjects, chapters, lessons, learning content | Course catalog, course builder, subject/chapter/lesson management | Academic structure | 3 |
| Enrollment & teaching assignments | Users, Organizations, RBAC, Notifications, Audit | Enrolments, teaching assignments, parent-student relationships | Enrolment manager, teacher classes, parent child selector | Education identity, Academic structure, Course & curriculum | 3 |
| Student experience | Dashboard shell, Tasks, Calendar, Notifications, Preferences | Student learning summary, learning plan, completion events | Student dashboard, learning plan, lesson player | Course & curriculum, Enrollment & teaching assignments | 4 |
| Teacher experience | Dashboard shell, Tasks, Calendar, Notifications, Reports | Teacher summary and learner intervention data | Teacher dashboard, learner workspace | Course & curriculum, Enrollment & teaching assignments | 4 |
| Assignments | Tasks, Calendar, Notifications, File Storage, Audit | Assignments, rubrics, submissions, grading, feedback | Assignment list, authoring, submission, grading screens | Student experience, Teacher experience | 5 |
| Assessments & question bank | Calendar, Search, Notifications, Audit | Assessments, question bank, quizzes, attempts, results | Assessment builder, question bank, quiz player, results screens | Course & curriculum, Enrollment & teaching assignments | 6 |
| Attendance | Calendar, Reports, Audit | Attendance sessions and attendance records | Attendance register and summary screens | Academic structure, Enrollment & teaching assignments | 6 |
| Progress & achievements | Dashboard shell, Reports, Notifications | Lesson progress, mastery, achievements, learner progress summary | My progress and learner progress screens | Student experience, Assignments, Assessments & question bank, Attendance | 7 |
| Learning analytics & reports | Dashboard shell, Reports, Search, Export patterns | Education analytics aggregates and report-card data | Learner analytics, class/institution analytics, report cards | Progress & achievements | 8 |
| Certificates | Reports, Notifications, File Storage, Audit | Certificate templates, issuance, revocation, verification | Certificate center | Progress & achievements, Learning analytics & reports | 8 |
| Education notifications | Notifications, Tasks, Calendar, RBAC | Announcement targeting and education notification events | Education notification center, announcement composer | Education identity, Course & curriculum, Enrollment & teaching assignments | 5 |
| Education settings | Admin Settings, Organizations, Audit | Academic policy settings | Education settings screens | Academic structure | 6 |
| AI Tutor foundation | NLP service, File Storage, Preferences, Audit | Tutor context, knowledge retrieval, conversation persistence, safety controls | Tutor context selection and conversation UI | Course & curriculum, Enrollment & teaching assignments, Progress & achievements, Assessments & question bank | 9 |
| Multimodal Tutor | NLP service, File Storage, Audit | Multimodal ingestion, parsing, retrieval, citation handling | Upload-and-ask interface | AI Tutor foundation, Lessons | 10 |
| Revision & adaptive practice | Tasks, Calendar, NLP, Notifications | Revision plans, practice sessions, adaptive question delivery, mastery updates | Revision planner and adaptive practice screens | AI Tutor foundation, Progress & achievements, Assessments & question bank | 10 |

## Dependency rule

No module is built before its dependencies have a stable API contract and usable frontend flow. In particular, AI Tutor starts only after lesson content, enrolment context, learner progress, and assessment evidence exist.

## Ownership rule

- **Platform code stays reusable:** do not fork or recreate authentication, organization scope, RBAC, menus, subscriptions, audit, notifications, calendar, tasks, reports, or storage.
- **Education modules own education behavior:** they supply education screens and education-domain APIs while consuming platform capabilities through established contracts.
