# 🏥 B2B Healthcare Admin Frontend

This is the **frontend admin panel** for the B2B Healthcare Management System, built with **React**, **Vite**, and **CSS modules**. It connects to a secure Node.js/Express backend and provides an admin interface for managing healthcare-related operations.

---

## 🚀 Tech Stack

- ⚛️ **React** (Functional Components + Hooks)
- ⚡ **Vite** (for blazing-fast development)
- 🎨 **CSS Modules** (modular component styling)
- 🔐 **JWT Authentication**
- 🌐 **REST API** integration via `fetch`
- 🧠 Organized using feature-based folder structure

---

## 🔧 Setup Instructions

### 1. 📦 Install Dependencies

```bash
npm install

2. ⚙️ Set up Environment Variables
Create a .env file in the root and define:

.env
VITE_API_BASE_URL=http://localhost:3000/api
Make sure this URL matches your backend server.

3. 💻 Start Development Server
npm run dev
This will start the app at: http://localhost:5190

🔐 Authentication Flow
Admins login via /admin/login API using JWT

authService.js handles all auth requests

Credentials stored securely (no localStorage yet, can add it later)

📦 Production Build
bash
npm run build
To preview the production build locally:

bash
npm run preview

📈 Features
🧑‍⚕️ Admin Login with API integration

📊 Admin Dashboard layout

🧩 Reusable UI components

🔄 Password reset UI (under development)

📁 Clean folder organization

🛠️ To-Do / Future Improvements
Add routing with React Router

Add token persistence (localStorage/session)

Form validations (Yup/React Hook Form)

Improve UI with a component library (e.g., Material UI)

Dark mode toggle 🌗

🧑‍💻 Author
Built by HARSH3 
