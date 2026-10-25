# 🎓 StudySpace Admin Frontend

This is the **frontend admin panel** for the **StudySpace** Educational Management System, built with **React**, **Vite**, and **CSS modules**. It connects to a secure Node.js/Express backend (`AI-Education-Backend`) and provides an administrative interface for managing CBSE academic curricula, student learning paths, subject syllabi, and educational operations.

---

## 🚀 Tech Stack

- ⚛️ **React** (Functional Components + Hooks)
- ⚡ **Vite** (for blazing-fast development)
- 🎨 **CSS Modules & Bootstrap** (modular component styling)
- 🔐 **JWT Authentication**
- 🌐 **REST API** integration via `axios` / `fetch`
- 🧠 Organized using feature-based folder structure

---

## 🔧 Setup Instructions

### 1. 📦 Install Dependencies

```bash
npm install
```

### 2. ⚙️ Set up Environment Variables

Create a `.env` file in the root and define:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

Make sure this URL matches your backend server.

### 3. 💻 Start Development Server

```bash
npm run dev
```

This will start the app at: `http://localhost:5173` (or configured Vite port).

---

## 🔐 Authentication Flow

- Admins login via `/admin/login` API using JWT.
- `authService.js` handles all authentication requests and token management.
- Protected route wrappers secure administrative modules and curriculum editors.

---

## 📦 Production Build

```bash
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

---

## 📈 Features

- 🧑‍💼 Admin Login & Authentication flow
- 📊 Academic & Curriculum Management Dashboard
- 📚 CBSE Syllabus, Subjects, and Chapters configuration
- 🧩 Reusable UI components & interactive data tables
- 📁 Clean feature-based folder organization

---

## 👥 Authors & Contributors

Built by **Harshita Surana** ([@harshitasurana](https://github.com/harshitasurana)) and **Yash Joshi**.
