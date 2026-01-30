# Evalio System Architecture

## Table of Contents
1. [System Overview](#system-overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Evaluation Lifecycle](#evaluation-lifecycle)
4. [ML Model Integration Points](#ml-model-integration-points)
5. [Component Details](#component-details)
6. [Data Flow Diagrams](#data-flow-diagrams)
7. [Technology Stack](#technology-stack)

---

## System Overview

Evalio is an intelligent exam evaluation system designed to automate the grading of subjective answers. The system separates concerns between:
- **Business Logic Layer**: Handles exam management, submission tracking, and orchestration
- **ML Evaluation Layer**: Performs intelligent grading using machine learning models
- **Data Layer**: Manages persistence of exams, submissions, and evaluations

**Core Design Principles:**
- **Separation of Concerns**: Business logic is decoupled from ML evaluation logic
- **Pluggable ML Backend**: ML models can be swapped without changing business logic
- **Extensibility**: New grading strategies can be added without core system changes
- **Scalability**: Stateless API design allows horizontal scaling

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND LAYER                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Teacher    │  │   Student    │  │    Header    │         │
│  │  Dashboard   │  │  Dashboard   │  │  Component   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│              React + TailwindCSS + Axios                        │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/REST API
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                        BACKEND LAYER                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Express Server                         │  │
│  │  ┌────────────┐ ┌────────────┐ ┌──────────────────────┐ │  │
│  │  │    Auth    │ │Rate Limit  │ │   CORS + Helmet      │ │  │
│  │  │ Middleware │ │ Middleware │ │   (Security)         │ │  │
│  │  └────────────┘ └────────────┘ └──────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   API ROUTES                              │  │
│  │  /api/teacher  /api/student  /api/exam                   │  │
│  │  /api/submission  /api/evaluate  /api/ocr                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  SERVICE LAYER                            │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │  │
│  │  │   Grading    │  │     OCR      │  │  Cloudinary   │  │  │
│  │  │   Service    │  │   Service    │  │   Service     │  │  │
│  │  └──────────────┘  └──────────────┘  └───────────────┘  │  │
│  │         ▲                                                 │  │
│  │         │ ML Integration Point                           │  │
│  │         └────────────────────────────────────────────────┼──┤
│  │                                                           │  │
│  │  ┌──────────────────────────────────────────────────┐   │  │
│  │  │         ML EVALUATION ABSTRACTION                 │   │  │
│  │  │  ┌──────────────┐  ┌──────────────┐              │   │  │
│  │  │  │ External AI  │  │   Custom ML  │              │   │  │
│  │  │  │ (OpenAI/     │  │    Model     │              │   │  │
│  │  │  │  Gemini)     │  │  (Future)    │              │   │  │
│  │  │  └──────────────┘  └──────────────┘              │   │  │
│  │  │         │                  │                      │   │  │
│  │  │         └──────────┬───────┘                      │   │  │
│  │  │                    │                              │   │  │
│  │  │         ┌──────────▼───────────┐                  │   │  │
│  │  │         │ Fallback Heuristic   │                  │   │  │
│  │  │         │  (Keyword Matching)  │                  │   │  │
│  │  │         └──────────────────────┘                  │   │  │
│  │  └──────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    MongoDB Database                       │  │
│  │  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌─────────────┐   │  │
│  │  │ Teacher │ │ Student │ │   Exam   │ │  Question   │   │  │
│  │  └─────────┘ └─────────┘ └──────────┘ └─────────────┘   │  │
│  │  ┌──────────────┐ ┌─────────────────────┐               │  │
│  │  │  Submission  │ │    Evaluation       │               │  │
│  │  └──────────────┘ └─────────────────────┘               │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Evaluation Lifecycle

The evaluation process follows a strict state machine pattern:

```
┌─────────────┐
│   Teacher   │
│   Creates   │
│    Exam     │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ EXAM CREATION                                               │
│ • Teacher defines questions                                 │
│ • Each question has: modelAnswer, keypoints, marks          │
│ • Assigns to students                                       │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────┐
│   Student   │
│   Submits   │
│   Answers   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ STATE 1: DRAFT                                              │
│ • Student uploads answer images                            │
│ • Can edit/modify answers                                  │
│ • OCR extracts text from images (extractedText)            │
│ • Not yet committed                                        │
│                                                             │
│ Status: submission.status = 'draft'                        │
└─────────────────────────────────────────────────────────────┘
       │
       │ Student clicks "Finalize"
       ▼
┌─────────────────────────────────────────────────────────────┐
│ STATE 2: FINALIZED                                          │
│ • Submission is locked (no more edits)                     │
│ • Ready for evaluation                                     │
│ • Awaiting teacher action                                  │
│                                                             │
│ Status: submission.status = 'finalized'                    │
└─────────────────────────────────────────────────────────────┘
       │
       │ Teacher/System triggers evaluation
       ▼
┌─────────────────────────────────────────────────────────────┐
│ STATE 3: EVALUATED                                          │
│ • ML grading service processes each answer                 │
│ • Evaluation record created with:                          │
│   - Per-question scores and feedback                       │
│   - Total score                                            │
│ • Cannot be re-evaluated (immutable)                       │
│                                                             │
│ Status: submission.status = 'evaluated'                    │
│ Result: Evaluation document created                        │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ STATE 4: REVIEWED (Future Extension)                        │
│ • Teacher can review ML grades                             │
│ • Manual adjustments possible                              │
│ • Comments added                                           │
│                                                             │
│ Status: submission.status = 'reviewed' (not yet impl.)     │
└─────────────────────────────────────────────────────────────┘
```

### State Transition Rules

```
DRAFT ──────finalize()──────▶ FINALIZED ──────evaluate()──────▶ EVALUATED
  ▲                              │                                   │
  │                              │                                   │
  └──────────reopen()────────────┘                                   │
  (Future: Allow teacher to reopen)                                  │
                                                                      │
                                                            review() (future)
                                                                      │
                                                                      ▼
                                                                  REVIEWED
```

---

## ML Model Integration Points

### Current Architecture (External AI Dependencies)

The system currently uses external AI APIs (OpenAI/Gemini), which will be replaced with a custom self-hosted ML model.

### Integration Point: `grading.js` Service

**Location**: `src/services/grading.js`

**Key Function**: `gradeAnswer(options)`

```javascript
// Current Interface (to be preserved)
async function gradeAnswer({ 
  modelAnswer,    // Reference answer from teacher
  studentAnswer,  // Extracted text from student submission
  maxScore,       // Maximum points for this question
  keypoints       // Rubric keypoints with weights
}) {
  // Returns: { score: number, feedback: string }
}
```

### Future ML Model Integration Strategy

**Design Pattern**: Strategy Pattern with Provider Abstraction

```
┌───────────────────────────────────────────────────────────────┐
│              Grading Service Interface                        │
│  gradeAnswer({ modelAnswer, studentAnswer, maxScore, ...})   │
└────────────────────────────┬──────────────────────────────────┘
                             │
                             ▼
            ┌────────────────────────────────┐
            │   Provider Selection Logic     │
            │   (Based on env config)        │
            └────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐  ┌──────────────────┐  ┌──────────────┐
│ External AI   │  │  Custom ML Model │  │  Heuristic   │
│ Provider      │  │  Provider        │  │  Fallback    │
│ (OpenAI/      │  │  (Self-hosted)   │  │  (Keyword)   │
│  Gemini)      │  │                  │  │              │
└───────────────┘  └──────────────────┘  └──────────────┘
  │ (current)        │ (FUTURE TARGET)    │ (backup)
  │                  │                    │
  └──────────────────┴────────────────────┘
                     │
                     ▼
         ┌──────────────────────────┐
         │  Unified Response Format │
         │  { score, feedback }     │
         └──────────────────────────┘
```

### Custom ML Model Requirements

When implementing the custom ML model provider, it must:

1. **Accept Input Schema**:
   ```json
   {
     "modelAnswer": "string (reference answer)",
     "studentAnswer": "string (OCR extracted text)",
     "maxScore": "number (0-100)",
     "keypoints": [
       {
         "text": "string (rubric point)",
         "weight": "number (importance 0-1)"
       }
     ]
   }
   ```

2. **Return Output Schema**:
   ```json
   {
     "score": "number (0 to maxScore)",
     "feedback": "string (brief explanation)"
   }
   ```

3. **Deployment Options**:
   - Local model server (FastAPI/Flask endpoint)
   - Docker container with REST API
   - gRPC service
   - Embedded model (TensorFlow.js, ONNX Runtime)

4. **Expected Response Time**: < 2 seconds per question

5. **Error Handling**: Must gracefully degrade to heuristic fallback

### Implementation Phases for Custom ML

**Phase 1: Interface Definition** (Current - Design Only)
- Define clear contract between business logic and ML service
- Document input/output schemas
- Create mock/stub implementations

**Phase 2: Model Development** (Future)
- Train custom NLP model for answer grading
- Fine-tune on educational Q&A datasets
- Implement semantic similarity scoring

**Phase 3: Service Integration** (Future)
- Develop ML model server (Python FastAPI)
- Create Node.js client for model server
- Implement provider in `grading.js`

**Phase 4: Production Deployment** (Future)
- Containerize ML model
- Add monitoring and logging
- Implement caching for performance
- A/B testing against existing providers

---

## Component Details

### Backend Components

#### 1. **API Routes** (`src/routes/`)

| Route | Purpose | Key Endpoints |
|-------|---------|---------------|
| `teacher.js` | Teacher authentication & management | POST /api/teacher/register, POST /api/teacher/login |
| `student.js` | Student authentication & management | POST /api/student/register, POST /api/student/login |
| `exam.js` | Exam CRUD operations | POST /create, GET /:id, PUT /:id |
| `submission.js` | Student answer submission | POST /, PUT /:id/finalize |
| `evaluate.js` | Grading orchestration | POST /:submissionId |
| `ocr.js` | Image text extraction | POST /extract |
| `draft.js` | Draft submission management | GET /, POST /:examId |

#### 2. **Data Models** (`src/models/`)

**Teacher**
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  institution: String
}
```

**Student**
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  rollNumber: String
}
```

**Exam**
```javascript
{
  title: String,
  subject: String,
  teacher_id: ObjectId (ref Teacher),
  questions: [ObjectId] (ref Question),
  assignedStudents: [ObjectId] (ref Student),
  isPublic: Boolean
}
```

**Question**
```javascript
{
  text: String,
  modelAnswer: String,
  marks: Number,
  keypoints: [{
    text: String,
    weight: Number
  }]
}
```

**Submission**
```javascript
{
  student_id: ObjectId (ref Student),
  exam_id: ObjectId (ref Exam),
  status: 'draft' | 'finalized' | 'evaluated',
  answers: [{
    questionId: ObjectId (ref Question),
    answerImage: String (Cloudinary URL),
    extractedText: String (OCR output)
  }]
}
```

**Evaluation**
```javascript
{
  submission_id: ObjectId (ref Submission),
  results: [{
    questionId: ObjectId (ref Question),
    score: Number,
    maxScore: Number,
    feedback: String
  }],
  totalScore: Number
}
```

#### 3. **Services** (`src/services/`)

**Grading Service** (`grading.js`)
- **Purpose**: Core ML integration point
- **Responsibilities**:
  - Route grading requests to appropriate provider
  - Build prompts for AI models
  - Parse and validate responses
  - Implement fallback scoring logic
- **Key Function**: `gradeAnswer()`

**OCR Service** (`ocr.js`, `gemini-ocr.js`)
- **Purpose**: Extract text from answer images
- **Providers**: 
  - Google Vision API
  - Gemini Vision (multimodal)
- **Flow**: Image URL → OCR Provider → Extracted Text

**Cloudinary Service** (`cloudinary.js`)
- **Purpose**: Manage image uploads
- **Features**: Secure upload, URL generation, transformations

#### 4. **Middleware** (`src/middleware/`)

**Authentication** (`auth.js`)
- JWT token validation
- Role-based access control

**Rate Limiting** (`rateLimit.js`)
- Protects expensive operations (evaluation, OCR)
- Configurable limits per endpoint

---

## Data Flow Diagrams

### Evaluation Flow (Detailed)

```
┌─────────┐                                    ┌──────────────┐
│ Teacher │                                    │   MongoDB    │
└────┬────┘                                    └──────┬───────┘
     │                                                │
     │ 1. POST /api/evaluate/:submissionId           │
     ▼                                                │
┌────────────────┐                                   │
│ Express Server │                                   │
│ (evaluate.js)  │                                   │
└────────┬───────┘                                   │
         │                                            │
         │ 2. Fetch Submission                        │
         ├───────────────────────────────────────────▶│
         │                                            │
         │◀───────────────────────────────────────────┤
         │ 3. Submission document                     │
         │    { status, answers[], exam_id }          │
         │                                            │
         │ 4. Validate status = 'finalized'           │
         ├─────────X                                  │
         │         ❌ If 'draft', return 400          │
         │                                            │
         │ 5. Fetch Questions (with model answers)    │
         ├───────────────────────────────────────────▶│
         │                                            │
         │◀───────────────────────────────────────────┤
         │ 6. Question documents                      │
         │                                            │
         │ 7. For each answer:                        │
         ▼                                            │
┌─────────────────────┐                              │
│  Grading Service    │                              │
│  (grading.js)       │                              │
└──────────┬──────────┘                              │
           │                                          │
           │ 8. gradeAnswer({                         │
           │      modelAnswer,                        │
           │      studentAnswer,                      │
           │      maxScore,                           │
           │      keypoints                           │
           │    })                                    │
           │                                          │
           ▼                                          │
┌────────────────────────────┐                       │
│   ML Provider Selection    │                       │
│   (OpenAI/Gemini/Custom)   │                       │
└────────────┬───────────────┘                       │
             │                                        │
             │ 9. Call ML API                         │
             ▼                                        │
    ┌─────────────────┐                              │
    │  ML Model/API   │                              │
    │  Returns:       │                              │
    │  { score,       │                              │
    │    feedback }   │                              │
    └─────────┬───────┘                              │
              │                                       │
              │ 10. Response parsed                   │
              ▼                                       │
┌─────────────────────┐                              │
│  Aggregate Results  │                              │
│  • Sum scores       │                              │
│  • Collect feedback │                              │
└──────────┬──────────┘                              │
           │                                          │
           │ 11. Create Evaluation document           │
           ├─────────────────────────────────────────▶│
           │                                          │
           │ 12. Update Submission.status = 'evaluated'│
           ├─────────────────────────────────────────▶│
           │                                          │
           │◀─────────────────────────────────────────┤
           │ 13. Evaluation saved                     │
           │                                          │
           │ 14. Return evaluation to client          │
           ▼                                          │
     { ok: true,                                      │
       evaluation: {                                  │
         totalScore,                                  │
         maxScore,                                    │
         results: [...]                               │
       }                                              │
     }                                                │
```

### Submission Creation Flow

```
┌─────────┐                                    ┌──────────────┐
│ Student │                                    │   Cloudinary │
└────┬────┘                                    └──────┬───────┘
     │                                                │
     │ 1. Upload answer images                        │
     ▼                                                │
┌────────────────┐                                   │
│ Frontend       │                                   │
│ (React)        │                                   │
└────────┬───────┘                                   │
         │                                            │
         │ 2. POST /api/ocr/upload (multipart)        │
         ▼                                            │
┌────────────────┐                                   │
│ Express Server │                                   │
│ (ocr.js)       │                                   │
└────────┬───────┘                                   │
         │                                            │
         │ 3. Upload to Cloudinary                    │
         ├───────────────────────────────────────────▶│
         │                                            │
         │◀───────────────────────────────────────────┤
         │ 4. Image URLs                              │
         │                                            │
         │ 5. Extract text via OCR                    │
         ▼                                            │
┌────────────────┐                                   │
│  OCR Service   │                                   │
│ (Gemini/Vision)│                                   │
└────────┬───────┘                                   │
         │                                            │
         │ 6. Extracted text                          │
         ▼                                            │
┌────────────────┐                              ┌─────────┐
│ Submission     │                              │ MongoDB │
│ Created/Updated│──────7. Save─────────────────▶│         │
└────────────────┘                              └─────────┘
  {
    status: 'draft',
    answers: [{
      questionId,
      answerImage: "cloudinary_url",
      extractedText: "OCR output"
    }]
  }
```

---

## Technology Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose ODM)
- **Authentication**: JWT (jsonwebtoken)
- **Security**: Helmet, CORS, rate-limiting
- **Validation**: express-validator
- **File Upload**: Multer
- **Image Hosting**: Cloudinary
- **OCR**: Google Vision API, Gemini Vision

### Frontend
- **Framework**: React
- **Styling**: TailwindCSS
- **HTTP Client**: Axios
- **Routing**: React Router

### ML/AI (Current - To Be Replaced)
- **Providers**: OpenAI GPT-4, Google Gemini
- **Future**: Custom self-hosted NLP model

### DevOps
- **Deployment**: Render.com (configured)
- **Environment**: dotenv
- **Testing**: Jest
- **Linting**: ESLint

---

## Design Decisions & Rationale

### 1. **Why Separate Grading Service?**
- **Modularity**: Business logic doesn't depend on ML implementation
- **Testability**: Can mock grading service for unit tests
- **Flexibility**: Easy to swap ML providers or add new ones
- **Performance**: Can optimize/cache ML calls independently

### 2. **Why State Machine for Submissions?**
- **Data Integrity**: Prevents accidental edits to evaluated submissions
- **Audit Trail**: Clear progression through lifecycle
- **Concurrency Safety**: Atomic state transitions prevent race conditions

### 3. **Why Store `extractedText` in Submission?**
- **Performance**: Don't re-run OCR on every evaluation
- **Consistency**: Same text used if re-evaluation needed
- **Debugging**: Can verify OCR quality manually
- **Cost**: Reduces API calls to OCR providers

### 4. **Why Keypoints with Weights?**
- **Transparency**: Teachers define grading rubric explicitly
- **Partial Credit**: ML can allocate points proportionally
- **Fairness**: Consistent grading criteria across students
- **Explainability**: Feedback tied to rubric elements

---

## Security Considerations

1. **Authentication**: JWT tokens with short expiry
2. **Authorization**: Role-based access (teacher vs student)
3. **Rate Limiting**: Protects expensive operations
4. **Input Validation**: All API inputs validated
5. **Image Security**: Cloudinary handles malicious uploads
6. **CORS**: Configured for allowed origins only
7. **Helmet**: Security headers enabled

---

## Future Enhancements

### Short Term
1. **Manual Review Feature**: Allow teachers to adjust ML grades
2. **Plagiarism Detection**: Compare submissions across students
3. **Analytics Dashboard**: Grade distribution, statistics
4. **Batch Evaluation**: Process multiple submissions concurrently

### Long Term
1. **Custom ML Model**: Replace external AI APIs
2. **Real-time Collaboration**: Multiple graders for same exam
3. **Mobile App**: React Native implementation
4. **Multi-language Support**: OCR and grading in multiple languages
5. **Adaptive Testing**: Difficulty adjustment based on performance

---

## Getting Started

See [README.md](../README.md) for setup instructions.
See [DEPLOYMENT.md](../DEPLOYMENT.md) for production deployment.

---

## ML Integration Boundaries

This section defines the **clear separation of responsibilities** between the Node.js backend and the Python ML evaluation system. Understanding these boundaries is critical for maintaining system integrity and enabling independent development.

### Architectural Principle: Separation of Concerns

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BACKEND (Node.js)                            │
│  Responsibilities:                                                   │
│  • API endpoints                                                     │
│  • Authentication & authorization                                    │
│  • Database operations                                               │
│  • Request validation                                                │
│  • ML result validation                                              │
│  • Business logic orchestration                                      │
│                                                                       │
│  Does NOT:                                                           │
│  • Perform ML scoring                                                │
│  • Know ML algorithm details                                         │
│  • Process text semantically                                         │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Data Contract
                                    │ (defined interface)
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         ML SYSTEM (Python)                           │
│  Responsibilities:                                                   │
│  • Answer evaluation                                                 │
│  • Rubric-based scoring                                              │
│  • Semantic similarity calculation                                   │
│  • Feedback generation                                               │
│  • Confidence estimation                                             │
│                                                                       │
│  Does NOT:                                                           │
│  • Store data in database                                            │
│  • Handle authentication                                             │
│  • Serve HTTP requests directly                                      │
│  • Know about Express routes                                         │
└─────────────────────────────────────────────────────────────────────┘
```

### What Backend Provides to ML

The backend sends a structured evaluation request containing:

```javascript
{
  submission: {
    _id: ObjectId,              // Submission identifier
    student_id: ObjectId,       // Student who submitted
    exam_id: ObjectId,          // Exam being evaluated
    submitted_at: Date          // When submitted
  },
  exam: {
    _id: ObjectId,              // Exam identifier
    title: String,              // Exam name
    subject: String,            // Subject area (optional)
    instructions: String        // Exam instructions (optional)
  },
  questions: [
    {
      _id: ObjectId,            // Question identifier
      questionText: String,     // The question asked
      modelAnswer: String,      // Ideal answer
      maxScore: Number,         // Maximum possible score
      rubric: [                 // Grading criteria
        {
          keypoint: String,     // Concept to look for
          keywords: [String],   // Keywords indicating this concept
          weight: Number        // Points for this keypoint
        }
      ]
    }
  ],
  answers: [
    {
      questionId: ObjectId,     // Which question this answers
      studentAnswer: String,    // Student's submitted answer
      imageUrl: String          // Optional: OCR'd image reference
    }
  ]
}
```

**Key Points:**
- All data is pre-fetched from MongoDB
- Student answers are already extracted (via OCR if needed)
- Rubrics are pre-defined by teachers
- ML receives **ready-to-process** data

### What ML Must Return to Backend

The ML system MUST return a result conforming to the **MLEvaluationResult contract** (see `src/contracts/mlEvaluationResult.js`):

```javascript
{
  results: [                    // Per-question evaluations
    {
      questionId: ObjectId,     // Question being graded
      aiScore: Number,          // Score assigned by ML (0 to maxScore)
      maxScore: Number,         // Maximum possible score
      confidence: Number,       // ML confidence (0.0 to 1.0)
      aiFeedback: String,       // Feedback for student
      matchedKeypoints: [String], // Concepts student covered
      missingKeypoints: [String], // Concepts student missed
      metadata: Object          // Optional: ML-specific data
    }
  ],
  aiTotalScore: Number,         // Sum of all question scores
  maxTotalScore: Number,        // Sum of all maxScores
  averageConfidence: Number,    // Average confidence across questions
  method: String,               // ML method used (e.g., 'hybrid_rubric_similarity')
  evaluatedAt: Date,            // When evaluation occurred
  systemMetadata: Object        // Optional: ML version, runtime info
}
```

**Validation Requirements:**
- All scores must be non-negative and ≤ maxScore
- Confidence must be between 0.0 and 1.0
- Total scores must equal sum of individual scores
- No NaN or Infinity values allowed
- All required fields must be present

**Backend Validation:**
The backend validates ALL ML output using `src/validators/mlResultValidator.js` before saving to database. Invalid results are **rejected** with clear error messages.

### What Backend NEVER Does

To maintain clean separation, the backend **must never**:

1. **❌ Perform ML Scoring**
   - No semantic analysis in JavaScript
   - No keyword matching algorithms in backend
   - No confidence calculations

2. **❌ Know ML Implementation Details**
   - Doesn't know if ML uses TF-IDF, transformers, or regex
   - Doesn't know Python subprocess vs HTTP vs queue
   - Only knows the input/output contract

3. **❌ Modify ML Results**
   - Backend validates but doesn't alter ML scores
   - Teacher overrides are stored separately (ManualOverride model)
   - Original AI scores preserved for audit trail

4. **❌ Bypass Validation**
   - All ML output goes through validation layer
   - No "trusted" paths that skip validation
   - Defense in depth principle

### What ML System NEVER Does

To maintain clean separation, the ML system **must never**:

1. **❌ Access Database Directly**
   - No MongoDB connections in Python code
   - No ORM or database drivers
   - Backend provides all data via input

2. **❌ Perform Authentication**
   - No JWT verification in ML code
   - No user permission checks
   - Backend handles all auth before calling ML

3. **❌ Store State**
   - ML is stateless - each call is independent
   - No user sessions or cached data
   - Backend manages all state in MongoDB

4. **❌ Serve HTTP Directly to Frontend**
   - ML is not a public API
   - Only backend calls ML
   - Frontend never knows ML exists

### Integration Adapter Pattern

The `src/services/mlAdapter.js` module provides the interface layer:

```javascript
const { evaluateAnswers } = require('../services/mlAdapter');

// Backend prepares input
const input = {
  submission: submissionDoc,
  exam: examDoc,
  questions: questionDocs,
  answers: studentAnswers
};

// Call ML (adapter handles details)
const mlResult = await evaluateAnswers(input);

// Validate output
const validated = validateAndSanitize(mlResult, {
  expectedQuestionCount: questionDocs.length,
  expectedQuestionIds: questionDocs.map(q => q._id)
});

// Save to database
await Evaluation.create({
  submission_id: submissionDoc._id,
  results: validated.results,
  aiTotalScore: validated.aiTotalScore,
  status: EVALUATION_STATUS.AI_EVALUATED
});
```

**Benefits of This Pattern:**
- Backend doesn't know HOW ML works (Python, R, cloud API)
- ML can be swapped without changing backend code
- Clear contract enables parallel development
- Testing is easier (mock the adapter)

### Communication Methods (Planned)

The adapter can implement ML communication via:

1. **Python Subprocess** (current plan)
   - `child_process.spawn('python', ['ml/evaluate.py'])`
   - Pass JSON via stdin, read JSON from stdout
   - Synchronous evaluation

2. **HTTP Service** (future option)
   - ML runs as separate Flask/FastAPI server
   - Backend makes HTTP POST to ML endpoint
   - Enables independent scaling

3. **Message Queue** (future option)
   - Backend publishes to RabbitMQ/Redis
   - ML consumes evaluation jobs
   - Asynchronous evaluation

**Current Status:** Adapter interface defined, implementation pending.

### Error Handling Boundaries

**Backend Handles:**
- Network errors (if ML service unavailable)
- Timeout errors (if ML takes too long)
- Validation errors (if ML returns invalid data)
- Database errors (if save fails)

**ML Handles:**
- Text processing errors
- Model inference errors
- Confidence calculation errors
- Missing rubric data

**Shared Responsibility:**
- Both systems log errors independently
- Backend logs include request ID for tracing
- ML includes processing time in metadata

### Security Boundaries

**Backend Enforces:**
- User authentication (JWT)
- Role-based access control (teacher/student/admin)
- Rate limiting
- Input sanitization (prevent SQL injection, XSS)
- ML result validation (prevent data corruption)

**ML Enforces:**
- Input validation (reject malformed requests)
- Resource limits (prevent DOS via large inputs)
- Safe text processing (handle Unicode, special chars)

**Neither system trusts the other blindly** - both validate their inputs.

### Testing Boundaries

**Backend Tests:**
- Unit tests: Business logic, validation, routes
- Integration tests: API endpoints with mocked ML
- E2E tests: Full flow with ML stub

**ML Tests:**
- Unit tests: Scoring algorithms, similarity functions
- Integration tests: Full evaluation pipeline
- Performance tests: Speed and accuracy benchmarks

**Contract Tests:**
- Verify ML output conforms to contract
- Verify backend input conforms to ML expectations
- Run on both sides independently

### Development Workflow

**Parallel Development Enabled:**

```
Backend Team                    ML Team
     |                              |
     |-- Define contract ---------> |
     |                              |
     |-- Implement adapter -------> |-- Build ML system
     |   (throws NotImplemented)    |   (conforms to contract)
     |                              |
     |-- Add validation ---------> |-- Add contract tests
     |                              |
     |-- Mock ML for testing ----> |-- Standalone testing
     |                              |
     |                              |
     |<----- Integration ---------->|
     |   (connect adapter to ML)    |
```

Both teams can work simultaneously without blocking each other.

---

**Document Version**: 1.1  
**Last Updated**: January 30, 2026  
**Maintained By**: Architecture Team
