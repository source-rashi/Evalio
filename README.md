# Evalio

**AI-Powered Exam Evaluation System**

Evalio automates the grading of subjective exam answers using OCR (Optical Character Recognition) and NLP (Natural Language Processing). The system enables teachers to create exams, students to submit handwritten answers via image uploads, and provides AI-assisted evaluation with teacher override capabilities for quality control.

---

## 🎯 Key Features

- **Automated Grading**: AI evaluates subjective answers against model answers and rubric keypoints
- **Teacher Override**: Teachers can review and adjust AI scores, preserving audit trail
- **Background Processing**: Asynchronous evaluation queue handles long-running ML tasks
- **OCR Integration**: Extracts handwritten text from uploaded answer sheets
- **Flexible AI Providers**: Supports OpenAI, Gemini, or heuristic fallback grading
- **Production-Ready**: Comprehensive error handling, logging, validation, and health checks

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
- Node.js + Express.js (REST API)
- MongoDB + Mongoose (Database & ODM)
- Redis + BullMQ (Job queue for async processing)
- JWT (Authentication)
- Pino (Structured logging)
- Jest + Supertest (Testing)

**ML & AI:**
- Python (ML evaluation engine)
- OpenAI GPT (Optional: AI grading)
- Google Gemini (Optional: AI grading + OCR)
- Heuristic fallback (Keyword matching)

**External Services:**
- Cloudinary (Image storage & CDN)
- Gemini Vision API (OCR for handwritten text)

**Frontend:**
- React.js (UI framework)
- Tailwind CSS (Styling)
- Axios (HTTP client)

---

## 🚀 Getting Started

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

- JWT-based authentication with secure token validation
- Password hashing with bcrypt
- Environment variable validation on startup (fails fast if misconfigured)
- Rate limiting on sensitive endpoints
- Input validation and sanitization
- CORS configuration
- Helmet.js security headers
- Error messages don't leak sensitive information
- Audit trail for score overrides

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

## 🧪 Testing Strategy

- **Unit Tests**: Core utilities (scoring, pagination, validation) with 57+ passing tests
- **Integration Tests**: API endpoints with in-memory test database
- **ML Contract Validation**: Strict input/output schemas for ML system
- **Test Coverage**: Focus on critical paths and edge cases
- **Isolated Test Environment**: Separate test database, mocked external services

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
4. **Commit Standards**: Use conventional commits (feat, fix, chore, etc.)
5. **Documentation**: Update README and inline comments

---

## 📄 License

This project is created for educational and portfolio purposes.

---

## 👨‍💻 Author

**Rashid**
- GitHub: [@source-rashi](https://github.com/source-rashi)
- Project: Resume & Interview Ready

---

## 🙏 Acknowledgments

- Built as a demonstration of full-stack architecture
- Showcases Node.js, React, MongoDB, Redis, Python ML integration
- Implements production-grade patterns: async processing, audit trails, override workflows
- Designed for scalability, maintainability, and testability
