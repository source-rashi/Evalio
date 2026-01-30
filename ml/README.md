# Evalio ML System

## Purpose

This is a **custom, self-hosted machine learning workspace** for subjective answer evaluation. It is designed to provide transparent, interpretable, and auditable scoring for educational assessments.

The ML system evaluates student answers against model answers and grading rubrics, producing:
- Numerical scores
- Confidence levels
- Matched/missing keypoints
- Actionable feedback

## Why Decoupled from Backend?

**Architectural Benefits:**
1. **Independent Development**: ML models can be trained, tested, and iterated without touching backend code
2. **Technology Flexibility**: Python/ML stack separated from Node.js/Express backend
3. **Scalability**: ML service can be deployed independently, scaled horizontally
4. **Testability**: ML logic can be unit-tested in isolation with mock data
5. **Resume-Worthy Design**: Demonstrates microservice architecture and separation of concerns

**Workflow:**
```
Backend (Node.js)          ML System (Python)
     |                            |
     |--- sends student answer -->|
     |                            |
     |                      [preprocessing]
     |                      [scoring engine]
     |                      [feedback gen]
     |                            |
     |<-- returns score/feedback -|
```

## System Input/Output

### Input (from backend):
- **Model Answer**: The ideal/reference answer
- **Grading Rubric**: Keypoints with weights
- **Student Answer**: The submitted text to evaluate

### Output (to backend):
- **Score**: Numerical grade (0-100 or similar)
- **Confidence**: How certain the model is (0.0-1.0)
- **Matched Keypoints**: Which rubric items the student covered
- **Missing Keypoints**: What the student missed
- **Feedback**: Constructive comments for the student

## Directory Structure

```
ml/
├── README.md              # This file - system documentation
├── preprocessing/         # Text cleaning, normalization
├── scoring/              # Core evaluation logic (rubric + similarity)
├── feedback/             # Feedback generation rules
└── evaluate.py           # Main entry point for evaluation
```

## Current Status

**Phase 3.1**: ✅ Workspace structure initialized
- Folders created
- Architecture documented
- No Python logic yet (coming in subsequent tasks)

## Future Integration

Once the ML system is complete:
1. Backend will call ML via subprocess/API
2. ML will run independently, return JSON results
3. Backend stores results in Evaluation model
4. Teachers can review and override ML scores

## Technology Stack (Planned)

- Python 3.x
- scikit-learn (TF-IDF, cosine similarity)
- NumPy/Pandas (data manipulation)
- NLTK/spaCy (text preprocessing)
- NO external AI APIs (fully self-hosted)
