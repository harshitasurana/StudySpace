# AI Education Platform — Backend API (`AI-Education-Backend`)

Enterprise Express.js REST API service powering multi-tenant academic management, user authentication, progress tracking, node NLP intent routing, and educational database orchestration.

---

## 🎨 Technology Stack

- **Runtime Environment**: Node.js (`v20.x` / `v22.x`)
- **Web Framework**: Express 5 (`express`)
- **Database & ORM**: Sequelize ORM, PostgreSQL (`pg`), SQLite3 (`sqlite3`)
- **Caching & Session Data**: Redis / IORedis (`redis`, `ioredis`)
- **Authentication & Security**: JWT (`jsonwebtoken`), bcrypt password hashing, 2FA MFA verification, CORS, sanitize-html
- **AI & NLP Engine**: Node-NLP (`node-nlp`), string-similarity
- **Object Storage**: AWS S3 SDK (`@aws-sdk/client-s3`), MinIO (`minio`), Multer file uploads
- **Observability & Logging**: Elastic APM (`elastic-apm-node`), Winston (`winston`), Prometheus metrics (`prom-client`, `express-prom-bundle`)
- **Documentation**: Swagger UI Express (`swagger-ui-express`, `swagger-autogen`)
- **Testing & Tooling**: Jest (`jest`), Supertest (`supertest`), Nodemon, ESLint

---

## 🚀 Architecture & Feature Modules

### 1. Multi-Tenant Academic Management
- **Boards & Classes**: Supports CBSE, ICSE, and State Boards across Grades 1–12.
- **Subjects & Chapters**: Maps curriculum structures, chapter order, published statuses, and PDF assets.
- **Study Materials**: Manages NCERT Notes, NCERT Solutions, Mind Maps, and Revision Flashcards.

### 2. Authentication & User Management (`/api/auth`, `/api/profile`)
- **JWT Session Tokens**: Secure HTTP-only cookies and Authorization headers.
- **Multi-Factor Authentication (2FA)**: TOTP setup, QR code secret generation, OTP verification, and backup codes.
- **Role-Based Access Control (RBAC)**: Distinct access scopes for `Student`, `Teacher`, and `Admin`.

### 3. Student Progress & Analytics Engine (`/api/progress`)
- **Chapter Mastery Tracking**: State machine managing chapter progress percentages and completion metrics.
- **Streak Calculation Engine**: Server-side daily activity streak calculator.
- **Quiz & Mock Test Attempts**: Evaluates timed assessments, calculates percentage scores, and generates performance feedback.

### 4. Integrated NLP Intent Engine (`src/nlp/`)
- **Node-NLP Model**: Embedded natural language processing model (`model.nlp`) for student help intent classification, FAQ matching, and contextual assistant fallback routing.

---

## 🏁 Getting Started

### Prerequisites
- **Node.js**: `v20.x` or higher
- **PostgreSQL** or **SQLite3**
- **Redis** (optional, fallback to in-memory)

### Installation

```bash
# Navigate to backend directory
cd AI-Education-Backend

# Install dependencies
npm install
```

### Environment Configuration

Create a `.env` file in the root directory:

```env
PORT=5000
NODE_ENV=development

# Database Configuration
DB_DIALECT=sqlite
DB_STORAGE=./healthcare.db
# For PostgreSQL:
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=education_db
# DB_USER=postgres
# DB_PASSWORD=postgres

# JWT Secret
JWT_SECRET=your_jwt_super_secret_key_change_in_production
JWT_EXPIRES_IN=7d

# Cors
CORS_ORIGIN=http://localhost:5180
```

### Database Initialization & Migration

```bash
# Run database migrations
npm run db:migrate

# Seed database with academic subjects & sample chapters
npm run db:seed
```

### Running the Backend

```bash
# Start backend in development mode with nodemon
npm start

# Generate Swagger OpenAPI API docs
npm run generateDoc
```

The server will start on `http://localhost:5000`. Interactive API documentation is available at `http://localhost:5000/api-docs`.

---

## 🧪 Testing & Code Quality

```bash
# Run unit and integration test suite
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

---

## 📁 Directory Structure

```
AI-Education-Backend/
├── config/                 # Database & service configurations
├── dataset/                # NLP intent training datasets
├── db/                     # Migrations & seed files
├── docs/                   # Generated Swagger & API documentation
├── scripts/                # Database seeders, migration runners, utility scripts
├── src/
│   ├── config/             # Environment, JWT, and database configs
│   ├── controllers/        # Route handlers (Auth, Education, Progress, Profile)
│   ├── middleware/         # Auth verification, RBAC, error handlers
│   ├── models/             # Sequelize ORM schema definitions
│   ├── nlp/                # Node-NLP model training & intent router
│   ├── routes/             # Express API route modules
│   ├── services/           # Business logic & database operations
│   ├── utils/              # Helper functions & logger
│   ├── app.js              # Express app initialization
│   └── server.js           # Server listen entrypoint
├── tests/                  # Jest & Supertest integration tests
├── .env                    # Environment variables
├── docker-compose.yml      # Docker container stack configuration
└── package.json            # Node dependencies and npm scripts
```
