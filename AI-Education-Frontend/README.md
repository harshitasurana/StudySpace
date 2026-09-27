# AI Education Platform — Frontend (`AI-Education-Frontend`)

A modern, highly interactive, responsive, and student-focused Single Page Application (SPA) for modern digital learning. Built with **React 19**, **Vite**, **Tailwind CSS v4**, and **React Router v7**.

---

## 🎨 Technology Stack

- **Core Framework**: React 19 (`react`, `react-dom`)
- **Build Tool**: Vite 8 with HMR
- **Routing**: React Router DOM v7
- **Styling**: Tailwind CSS v4 with PostCSS & custom 12-role color tokens
- **PDF & Document Viewing**: `react-pdf` (PDF.js canvas rendering)
- **Interactive UI & Animations**: Material Symbols, Lucide React, React Joyride, React Markdown
- **HTTP Client**: Axios with request/response interceptors & auth headers
- **Testing & Quality**: Vitest 4, React Testing Library, `@testing-library/user-event`, Oxlint

---

## 🛠️ Design System & Color Palette

The application enforces a strict, premium **12-role color system** designed for maximum clarity, readability, and engagement:

| Role | Color Name | Hex Code | Usage |
| :--- | :--- | :--- | :--- |
| **Primary / Brand** | Deep Indigo | `#283593` | Primary CTAs, active tab pills, header badges |
| **Primary Dark** | Midnight Blue | `#172554` | Dark mode accents, secondary focus |
| **Accent** | Golden Amber | `#F4B942` | Achievements, flashcard study badges, streaks |
| **Background** | Warm Ivory | `#F8F7F2` | Page canvas background (`body`) |
| **Surface / Cards** | White | `#FFFFFF` | Clean card containers (`glass-card`) |
| **Text Primary** | Ink | `#172033` | Primary headlines, titles, body text |
| **Text Secondary** | Slate | `#64748B` | Subtitles, captions, metadata tags |
| **Border** | Soft Gray | `#E5E7EB` | Card borders and divider lines |
| **Success** | Emerald | `#16866A` | Mastered nodes, correct quiz answers |
| **Info** | Sky Blue | `#3B82C4` | Informational chips, Mind Map cards |
| **Warning** | Apricot | `#E89B3C` | Pending items, attention banners |
| **Error** | Coral | `#D95D5D` | Validation errors, wrong quiz choices |

---

## 🚀 Key Modules & UI Features

### 1. Subject Dashboard (`/my-learning/subjects`)
- **Overview Stats**: Real-time stats bar showing Enrolled Subjects, Total Mastered Chapters, and Term Progress.
- **3D Cover Banners**: High-resolution 3D educational illustrations for Mathematics, Science, English, and Social Studies.
- **Search & Filter**: Real-time instant subject search filter bar.

### 2. Interactive Learning Path (`/my-learning/learning-path`)
- **Click-to-Unlock Flow**: Sequential chapter unlocking flow with visual node indicators (`Mastered`, `In Progress`, `Unlocked`, `Locked`).
- **Accordion Curriculum Cards**: Collapsible chapter nodes expanding into 5 core study resources:
  1. 📝 **Chapter Notes**: Interactive reading notes document.
  2. 📋 **NCERT Solutions**: Step-by-step textbook solutions.
  3. 🧠 **Mind Map**: Visual concept diagrams.
  4. 📇 **Flashcards**: Interactive revision card deck.
  5. ✍️ **Practice Tests**: Exam-style chapter quizzes.

### 3. Advanced Chapter Reader (`/read/:chapterId`)
- **Dual Reading Modes**: Single Page mode with book-style page turns and Continuous Scroll virtualization.
- **PDF Navigator & Deep-Linking**: Right-side drawer TOC, page search indexing, bookmarking, and deep-link query parameter support (`?page=N`).
- **Contextual AI Tutor Drawer**: Grounded AI Tutor side drawer with citation chips linking directly to relevant textbook/solution pages.

### 4. Contextual Help & Account Management
- **Resizable Help Drawer**: Preset width toggles (`Compact`, `Standard`, `Split`) and article search.
- **Security & Profile**: 2FA OTP verification, password updates, multi-language toggling, and profile management.

---

## 🏁 Getting Started

### Prerequisites
- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher

### Installation

```bash
# Navigate to the frontend directory
cd AI-Education-Frontend

# Install dependencies
npm install
```

### Environment Configuration

Create a `.env` file in the root directory (optional, defaults to `http://localhost:5000`):

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

### Development Server

Start the Vite development server with HMR:

```bash
npm run dev
```

The app will be accessible at `http://localhost:5180`.

### Production Build

Compile and bundle for production:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

---

## 🧪 Testing

The repository includes a comprehensive unit and integration test suite using **Vitest**:

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate test coverage report
npm run test:coverage
```

---

## 📁 Directory Structure

```
AI-Education-Frontend/
├── public/                  # Static assets (3D subject banners, icons, favicon)
├── src/
│   ├── assets/              # Shared image & SVG assets
│   ├── context/             # Global Contexts (User, Theme, HelpDrawer, StudentMode)
│   ├── features/            # Onboarding & shared feature components
│   ├── hooks/               # Custom React hooks (useUser, useAuth, useTheme)
│   ├── layouts/             # Application Shell (Topbar, Sidebar, MainLayout)
│   ├── modules/             # Core feature modules
│   │   ├── authentication/  # Login, Register, MFA, Password Reset
│   │   ├── help/            # Contextual Help Drawer & FAQ components
│   │   ├── mock-tests/      # Timed mock test runner
│   │   ├── my-learning/     # Subjects & Learning Path curriculum
│   │   ├── notes/           # Student notes management
│   │   ├── practice/        # Topic & chapter practice exercises
│   │   ├── reader/          # Interactive PDF Chapter Reader & AI Tutor
│   │   └── settings/        # User Profile & Security settings
│   ├── services/            # API Service Layer (EducationService, ProfileService, etc.)
│   ├── shared/              # Reusable UI primitives (ProgressRing, Modal, Button)
│   ├── index.css            # Tailwind directives & CSS design tokens
│   └── main.jsx             # React root entrypoint
├── tailwind.config.js       # Tailwind CSS 12-role color palette mapping
├── vite.config.js           # Vite server & build configuration
└── package.json             # Project dependencies and scripts
```
