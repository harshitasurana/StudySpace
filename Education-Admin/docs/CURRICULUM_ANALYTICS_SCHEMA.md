# 📊 Curriculum Analytics & Student Mastery Data Dictionary

This specification defines the schema and tracking methodology for CBSE curriculum student mastery, chapter progression, and spaced-repetition retention analytics within the **StudySpace** platform.

---

## 🏗️ Core Mastery Entities

### 1. `ChapterMastery`
Tracks a student's granular progress through each NCERT syllabus unit.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `UUID` | Primary key |
| `userId` | `UUID` | Student identifier |
| `subjectId` | `String` | e.g. `science-std9`, `math-std9` |
| `chapterNumber` | `Integer` | 1–16 depending on subject |
| `progressPercent` | `Float` | 0.0 to 100.0% completion |
| `status` | `Enum` | `LOCKED`, `UNLOCKED`, `IN_PROGRESS`, `MASTERED` |
| `lastStudiedAt` | `Timestamp` | UTC timestamp of last activity |

### 2. `QuizAssessmentAttempt`
Records performance on chapter-end and conceptual check questions.

| Field | Type | Description |
| :--- | :--- | :--- |
| `attemptId` | `UUID` | Primary key |
| `userId` | `UUID` | Foreign key referencing Student |
| `chapterId` | `Integer` | Target NCERT chapter |
| `score` | `Float` | Raw score achieved |
| `maxScore` | `Float` | Total available points |
| `passed` | `Boolean` | Mastery threshold ($\ge 80\%$) |
| `completedAt` | `Timestamp` | Submission time |

---

## 📈 Spaced Repetition Flashcard Algorithm
StudySpace uses a modified **SM-2** spaced repetition interval calculator:

$$I(n) = I(n-1) \times EF$$

Where:
- $I(n)$: Interval in days for repetition $n$.
- $EF$: Easiness factor calculated from student response difficulty (1–5).

---

## 👥 Contributors & Authors
- **Harshita Surana** ([@harshitasurana](https://github.com/harshitasurana))
- **Yash Joshi**
