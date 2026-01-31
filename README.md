# Evalio

**AI-Powered Exam Evaluation System** — Production-Ready, Dockerized, and Fully Tested

Evalio automates the grading of subjective exam answers using OCR (Optical Character Recognition) and NLP (Natural Language Processing). The system enables teachers to create exams, students to submit handwritten answers via image uploads, and provides AI-assisted evaluation with teacher override capabilities for quality control.

**🚀 Deployment Ready:** Complete with Docker containerization, 133 automated tests, performance optimizations, and comprehensive documentation.

---

## 🎯 Key Features

### Core Functionality
- **Automated Grading**: AI evaluates subjective answers against model answers and rubric keypoints
- **Teacher Override**: Teachers can review and adjust AI scores, preserving audit trail
- **Background Processing**: Asynchronous evaluation queue handles long-running ML tasks
- **OCR Integration**: Extracts handwritten text from uploaded answer sheets
- **Flexible AI Providers**: Supports OpenAI, Gemini, or heuristic fallback grading

### Production Features
- **Docker Deployment**: Multi-container orchestration with docker-compose
- **Comprehensive Testing**: 133 automated tests (73 unit + 60 integration)
- **Performance Optimized**: Database indexes, pagination, payload trimming
- **Health Monitoring**: Liveness and readiness probes for orchestration
- **Structured Logging**: Correlation IDs and JSON logs for aggregation
- **Security Hardened**: JWT auth, rate limiting, input validation, non-root containers

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
│  Landing | Login | Signup | Teacher Dashboard | Student Portal  │
└────────────────────────┬────────────────────────────────────────┘
                         │ REST API (JWT Auth)
┌────────────────────────▼────────────────────────────────────────┐
│                      Express Backend (Node.js)                   │
│                                                                   │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │   API Routes    │  │   Middleware     │  │   Services     │ │
│  │  /exam          │  │  - Auth (JWT)    │  │  - Grading     │ │
│  │  /submission    │  │  - Error Handler │  │  - OCR         │ │
│  │  /evaluate      │  │  - Rate Limit    │  │  - ML Adapter  │ │
│  │  /teacher       │  │  - Correlation   │  │  - Override    │ │
│  │  /student       │  │  - Validation    │  │  - Cloudinary  │ │
│  └─────────────────┘  └──────────────────┘  └────────────────┘ │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Background Job Queue (BullMQ)              │    │
│  │  Submission → Enqueue → Worker → ML Processing → DB    │    │
│  └─────────────────────────────────────────────────────────┘    │
└────┬────────────────────┬──────────────────────┬────────────────┘
     │                    │                      │
┌────▼──────┐      ┌─────▼──────┐       ┌──────▼────────┐
│  MongoDB  │      │   Redis    │       │  Python ML    │
│  (Data)   │      │  (Queue)   │       │   Engine      │
└───────────┘      └────────────┘       └───────────────┘
```

### Data Flow: Evaluation Lifecycle

1. **Exam Creation**: Teacher creates exam with questions, model answers, rubric keypoints
2. **Student Submission**: Student uploads answer sheet images with text answers
3. **Async Enqueue**: Submission triggers background evaluation job (returns immediately)
4. **OCR Processing**: Extract text from uploaded images (Gemini Vision API)
5. **ML Evaluation**: Python ML engine grades answers against model answers and keypoints
6. **Result Mapping**: ML output is validated and mapped to database schema
7. **Database Update**: Evaluation results stored with AI scores (immutable) and final scores
8. **Teacher Review**: Teacher views results, can override AI scores with feedback
9. **Score Reconciliation**: Overrides update final scores while preserving AI scores for audit

---

## 🔑 ML Ownership & Architecture Decision

**Why Node.js Orchestrates ML (Not Direct Python API)?**

Evalio follows a **Node.js-orchestrated, Python-executed ML** pattern:
- **Node.js backend** handles API requests, authentication, database, queuing
- **Python subprocess** executes ML evaluation when triggered by background worker
- **Separation of concerns**: ML logic isolated in Python, business logic in Node.js

**Benefits:**
- **Flexibility**: Easy to swap ML implementations without changing API
- **Type Safety**: ML input/output contracts validated by JSON schema
- **Scalability**: ML processing happens asynchronously via queue workers
- **Maintainability**: ML scientists work in Python, backend devs work in Node.js
- **Testability**: ML adapter can be mocked for integration tests

**Trade-offs:**
- Subprocess overhead (mitigated by async queue)
- More complex deployment (mitigated by container orchestration)

---

## 🛠️ Tech Stack

**Backend:**
- Node.js 20 + Express.js (REST API)
- MongoDB 7.0 + Mongoose (Database & ODM with optimized indexes)
- Redis 7 + BullMQ (Job queue for async processing)
- JWT (Authentication with bcrypt password hashing)
- Pino (Structured logging with correlation IDs)
- Jest + Supertest (133 automated tests)

**ML & AI:**
- Python 3 + scikit-learn (ML evaluation engine)
- OpenAI GPT (Optional: AI grading)
- Google Gemini (Optional: AI grading + OCR)
- Heuristic fallback (Keyword matching)

**Deployment:**
- Docker + Docker Compose (Multi-container orchestration)
- Alpine Linux (Minimal base images)
- Multi-stage builds (Optimized image sizes)
- Health checks (Kubernetes-ready)

**External Services:**
- Cloudinary (Image storage & CDN)
- Gemini Vision API (OCR for handwritten text)

**Frontend:**
- React.js (UI framework)
- Tailwind CSS (Styling)
- Axios (HTTP client)

---

## 🚀 Quick Start (Docker)

### Prerequisites

- Docker Engine 20.10+ or Docker Desktop
- Docker Compose V2+

### 1. Clone and Configure

```bash
git clone https://github.com/source-rashi/Evalio.git
cd Evalio

# Copy environment template
cp .env.docker .env

# Edit .env with your credentials
# Required: JWT_SECRET (32+ chars), GEMINI_API_KEY, CLOUDINARY_URL
```

### 2. Build and Start

```bash
# Build Docker images
docker build -t evalio-backend:latest .
docker build -f Dockerfile.worker -t evalio-worker:latest .

# Start all services (MongoDB, Redis, Backend, Worker)
docker-compose up -d
```

### 3. Verify Deployment

```bash
# Check service status
docker-compose ps

# Test API health
curl http://localhost:5000/health
# Expected: {"status":"ok"}

# View logs
docker-compose logs -f backend
docker-compose logs -f worker
```

### 4. Access Application

- **API Server:** http://localhost:5000
- **Frontend:** Configure frontend to connect to backend
- **MongoDB:** localhost:27017
- **Redis:** localhost:6379

### Stop Services

```bash
docker-compose down           # Stop containers
docker-compose down -v        # Stop and remove data volumes
```

For detailed Docker documentation, see [docs/DOCKER.md](docs/DOCKER.md).

---

## 🛠️ Development Setup (Local)

### Prerequisites

- Node.js >= 18.x
- MongoDB running locally or connection URI
- (Optional) Redis for async job queue
- (Optional) Python 3.x for ML evaluation

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/source-rashi/Evalio.git
   cd Evalio
   ```

2. **Install backend dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Create a `.env` file in the project root:
   ```env
   # Database
   MONGO_URI=mongodb://localhost:27017/evalio
   
   # Authentication
   JWT_SECRET=your_jwt_secret_min_32_characters_long
   
   # AI Provider (openai|gemini|none)
   AI_PROVIDER=none
   OPENAI_API_KEY=your_openai_key  # If using OpenAI
   GEMINI_API_KEY=your_gemini_key  # If using Gemini
   
   # Image Storage
   CLOUDINARY_URL=cloudinary://key:secret@cloud_name
   
   # Job Queue (optional, falls back to in-memory)
   REDIS_HOST=localhost
   REDIS_PORT=6379
   
   # Server
   PORT=5000
   CORS_ORIGIN=http://localhost:3000
   ```

4. **Start the backend server:**
   ```bash
   npm run dev
   ```

5. **Install and run frontend (optional):**
   ```bash
   cd frontend
   npm install
   npm start
   ```

### Running Tests

```bash
# Run all tests (unit + integration)
npm test

# Run unit tests only
npm test tests/unit

# Run with coverage
npm test -- --coverage
```

### API Health Checks

```bash
# Liveness check (is server running?)
curl http://localhost:5000/health

# Readiness check (is server ready to serve traffic?)
curl http://localhost:5000/ready
```

---

## 📁 Project Structure

```
Evalio/
├── src/
│   ├── middleware/      # Auth, error handling, rate limiting, correlation
│   ├── models/          # Mongoose schemas (Teacher, Student, Exam, etc.)
│   ├── routes/          # API endpoints (/exam, /submission, /evaluate, etc.)
│   ├── services/        # Business logic (grading, OCR, ML adapter)
│   ├── utils/           # Helpers (logger, pagination, scoring, validation)
│   ├── validators/      # Input/output validation (ML contracts)
│   ├── workers/         # Background job processors (evaluationWorker)
│   └── queues/          # BullMQ queue configuration
├── tests/
│   ├── unit/            # Unit tests for utilities and services
│   ├── integration/     # API integration tests
│   └── setup.js         # Test environment configuration
├── frontend/            # React application
├── server.js            # Express app entry point
├── package.json         # Dependencies and scripts
└── README.md            # This file
```

---

## 🔐 Security Features

- **Authentication:** JWT-based with secure token validation and bcrypt password hashing
- **Environment Validation:** Startup checks fail fast if misconfigured (min 32-char JWT secret)
- **Rate Limiting:** Prevents abuse on sensitive endpoints
- **Input Validation:** Comprehensive sanitization and schema validation
- **CORS:** Configurable origin restrictions
- **Security Headers:** Helmet.js protection against common vulnerabilities
- **Container Security:** Non-root users, minimal Alpine Linux base images
- **Audit Trail:** Immutable AI scores with override tracking
- **No Secret Leakage:** Error messages sanitized for production

---

## 🧪 Testing & Quality Assurance

### Test Coverage

- **133 Total Tests** across unit and integration suites
- **Unit Tests (73):** Core utilities, ML adapters, validators, pagination, scoring
- **Integration Tests (60):** Full API workflows with isolated test database

### Test Infrastructure

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Watch mode for development
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Quality Features

- ✅ **Isolated Test Environment:** Separate `.env.test` with safety checks
- ✅ **Cross-Platform:** `cross-env` for Windows/Mac/Linux compatibility
- ✅ **Database Isolation:** Test database must contain "test" in URI
- ✅ **Mock External Services:** Cloudinary, Gemini API mocked in tests
- ✅ **Comprehensive Coverage:** Authentication, CRUD operations, ML contracts, error handling

### Performance Optimizations

- **Database Indexes:** Optimized queries on frequently accessed fields (submission_id, status)
- **Pagination:** All list endpoints support `page` and `limit` parameters
- **Payload Trimming:** Heavy fields (images, model answers) excluded from list responses
- **Efficient Queries:** Mongoose `lean()` and field projection

---

## 📊 Key API Endpoints

**Authentication:**
- `POST /api/teacher/signup` - Register new teacher
- `POST /api/teacher/login` - Teacher login
- `POST /api/student/signup` - Register new student
- `POST /api/student/login` - Student login

**Exam Management:**
- `POST /api/exam/create` - Create new exam
- `POST /api/exam/:examId/question/add` - Add question to exam
- `GET /api/exam/list` - List teacher's exams
- `PUT /api/exam/:examId/toggle-public` - Publish/unpublish exam

**Submissions:**
- `POST /api/submission/create` - Submit answers for evaluation
- `GET /api/submission/student/:studentId` - Student's submissions
- `GET /api/submission/:submissionId` - Submission details

**Evaluation:**
- `POST /api/evaluate/:submissionId` - Trigger evaluation (async)
- `GET /api/evaluation/:submissionId` - Get evaluation results
- `POST /api/evaluation/:evaluationId/override` - Teacher override score

**Health:**
- `GET /health` - Liveness probe
- `GET /ready` - Readiness probe (checks DB + Redis)

---

## 🚢 Deployment

### Docker Deployment (Recommended)

Evalio is fully containerized and can be deployed with Docker Compose:

**Quick Start:**

```bash
# 1. Configure environment
cp .env.docker .env
# Edit .env and set your credentials

# 2. Build images
docker build -t evalio-backend:latest .
docker build -f Dockerfile.worker -t evalio-worker:latest .

# 3. Start all services
docker-compose up -d

# 4. Verify health
curl http://localhost:5000/health
# Expected: {"status":"ok"}

# 5. View logs
docker-compose logs -f
```

**Docker Services:**
- **evalio-backend**: REST API server (port 5000)
- **evalio-worker**: Background evaluation processor
- **mongodb**: Database with persistent storage
- **redis**: Queue and cache

**Verification Steps:**

```bash
# Check all services are running
docker-compose ps

# Test API health endpoint
curl http://localhost:5000/health

# Check worker logs for queue connection
docker-compose logs worker
# Should see: "Evaluation worker started" and "Worker ready and waiting for jobs"

# Monitor all logs
docker-compose logs -f

# Stop services
docker-compose down

# Stop and remove data volumes
docker-compose down -v
```

For detailed Docker documentation, see [docs/DOCKER.md](docs/DOCKER.md).

### Production Readiness Checklist:
- ✅ Environment validation on startup
- ✅ Health and readiness endpoints for orchestration
- ✅ Structured logging with correlation IDs
- ✅ Error handling with proper status codes
- ✅ Database indexes for query performance
- ✅ Pagination for list endpoints
- ✅ Payload trimming to reduce bandwidth
- ✅ Caching boundaries (Redis-ready)
- ✅ Background job processing with retries
- ✅ Test suite with unit and integration coverage
- ✅ Docker containerization with multi-stage builds
- ✅ Docker Compose orchestration

**Recommended for Production:**
- Use Docker/containers for consistent environments
- Redis required for production (async queue processing)
- MongoDB with replica set for high availability
- Environment-specific configs (dev/staging/prod)
- CI/CD pipeline with automated testing
- Log aggregation (ELK, CloudWatch, DataDog)
- Monitoring and alerting for health endpoints
- Container orchestration (Kubernetes, Docker Swarm, AWS ECS)
- Load balancing for API servers
- Secrets management (HashiCorp Vault, AWS Secrets Manager)

---

## 📝 Development Workflow

1. **Feature Development**: Work on feature branches
2. **Testing**: Write unit tests for utilities, integration tests for APIs
3. **Code Review**: Ensure adherence to patterns and conventions
4. **Commit Standards**: Use conventional commits (feat, fix, chore, perf, test, docs)
5. **Documentation**: Update README and inline comments
6. **CI/CD Ready**: Docker images, test automation, health checks

---

## 📚 Documentation

- [Architecture Overview](docs/ARCHITECTURE.md) - System design and data flow
- [Docker Deployment](docs/DOCKER.md) - Container setup and configuration
- [Docker Verification](docs/DOCKER_VERIFICATION.md) - Deployment test results
- [Retry Safety](docs/RETRY_SAFETY.md) - Idempotency and error handling
- [Test Suite](tests/README.md) - Testing strategy and coverage

---

## 📊 Project Statistics

- **Backend Code:** ~15,000 lines (Node.js/Express)
- **Test Coverage:** 133 automated tests (73 unit + 60 integration)
- **Docker Images:** 2 optimized containers (backend 333MB, worker 1.58GB)
- **API Endpoints:** 25+ RESTful routes with comprehensive validation
- **Database Models:** 8 Mongoose schemas with optimized indexes
- **Documentation:** 5 comprehensive guides (4,000+ words)

---

## 📄 License

This project is created for educational and portfolio purposes.

---

## 👨‍💻 Author

**Rashid**
- GitHub: [@source-rashi](https://github.com/source-rashi)
- Project: Production-Ready Full-Stack Application

---

## 🙏 Acknowledgments

Built as a comprehensive demonstration of modern full-stack architecture:

- ✅ **Backend Excellence:** Node.js/Express with async job processing, structured logging, comprehensive error handling
- ✅ **Testing Maturity:** 133 automated tests with isolated test environment and cross-platform support
- ✅ **Performance Optimization:** Database indexing, pagination, payload trimming, efficient queries
- ✅ **Security Hardening:** JWT authentication, rate limiting, input validation, container security
- ✅ **DevOps Ready:** Docker containerization, health checks, environment-driven config, production logging
- ✅ **ML Integration:** Python subprocess orchestration, contract validation, async processing
- ✅ **Documentation:** Comprehensive guides for architecture, deployment, testing, and troubleshooting

**Technologies Showcased:**
- Node.js 20, Express, MongoDB 7, Redis 7, BullMQ, Jest, Docker, Python, scikit-learn
- Production patterns: Async queues, audit trails, override workflows, health monitoring
- Designed for scalability, maintainability, testability, and deployability
