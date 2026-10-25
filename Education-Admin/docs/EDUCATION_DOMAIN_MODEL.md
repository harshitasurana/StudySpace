# EduVision AI — Education Domain Model

This is a product/domain model, not a database schema or backend architecture. It defines the education concepts that future frontend and backend work must share.

## Academic structure

```text
Organization (School / Coaching Institute)
└── Academic Year
    └── Course
        └── Subject
            └── Chapter
                └── Lesson
```

- **Organization:** a school, coaching institute, or education tenant. Reuses the platform organization.
- **Academic Year:** the period in which teaching, grading, classes, and enrolments operate.
- **Course:** a programme or class-level learning offering, such as Grade 8 or JEE Foundation.
- **Subject:** a discipline within a course, such as Mathematics or Biology.
- **Chapter:** a curriculum unit within a subject.
- **Lesson:** the learner-facing unit containing learning material and activities.

## People and participation

```text
Student ── Enrollment ── Course / Class / Batch
Teacher ── Teaching Assignment ── Course / Subject / Class
Parent  ── Guardian Link ── Student
```

- **Student:** a platform user with a learner profile and academic participation.
- **Teacher:** a platform user assigned to teach one or more course/subject/class combinations.
- **Parent:** a platform user linked to one or more students with governed, read-oriented access.
- **Class/Section:** a school cohort within an academic year.
- **Batch:** a coaching cohort, typically scheduled around a course/programme.
- **Enrollment:** a student’s active participation in a course, class, or batch.
- **Teaching Assignment:** a teacher’s responsibility for a course, subject, class, or batch.

## Learning and evaluation

```text
Lesson → Assignment → Submission → Grade / Feedback
Lesson → Assessment → Quiz / Questions → Attempt → Result
Enrollment + lessons + submissions + attempts → Progress / Mastery
```

- **Assignment:** teacher-created work with a due date, target learners, rubric, and submission rules.
- **Submission:** learner work and its submission state, attachments, timestamps, and feedback.
- **Assessment:** a scored evaluation with timing, rules, and targets.
- **Question Bank:** reusable questions, tags, topic mapping, difficulty, and answer data.
- **Quiz:** an assessment assembled from selected or generated questions.
- **Attempt:** one learner’s interaction with a quiz/assessment.
- **Result:** scores, answers, feedback, and outcome from an attempt or assessment.
- **Attendance:** learner presence/absence for a class, batch, or scheduled event.
- **Progress:** completion, mastery, engagement, and achievement calculated from learner activity.
- **Certificate:** evidence of course completion or achievement.

## AI learning layer — Phase 5 only

```text
Student + Course Context + Lesson Context + Progress + Results
                         ↓
                    AI Tutor Session
                         ↓
       Multimodal Question / Response / Learning Recommendation
```

- **AI Tutor Session:** a contextual learning conversation tied to a student and, where available, a course, subject, chapter, or lesson.
- **Multimodal Interaction:** a question/reference supplied as text, image, document, audio, or video.
- **Revision Plan:** a recommended learning schedule based on assessment results, progress, goals, and upcoming dates.
- **Practice Session:** adaptive questions, answers, hints, and mastery updates.

AI Tutor is deliberately downstream of curriculum, enrolment, lesson delivery, submissions, assessment attempts, and progress. Without those entities, it cannot personalize safely or usefully.
