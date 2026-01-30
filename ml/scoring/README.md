# Scoring Module

This module contains the core evaluation logic for the Evalio ML system.

## Components

### `rubric_scorer.py`
**Purpose**: Deterministic, rule-based scoring using keyword matching and weighted rubrics.

**How It Works**:
1. Takes a grading rubric (list of keypoints with keywords and weights)
2. Searches for each keyword in the student's answer
3. Awards points based on keyword coverage
4. Returns transparent breakdown of matched/missing keypoints

**Key Features**:
- Case-insensitive matching (configurable)
- Partial word matching (e.g., "photo" matches "photosynthesis")
- Partial credit (e.g., 2/3 keywords matched = 66% of points)
- Fully explainable - no black box decisions

**Example**:
```python
from scoring.rubric_scorer import create_default_scorer

scorer = create_default_scorer()
result = scorer.score_answer(
    student_answer="Plants use sunlight for energy",
    model_answer="Plants use sunlight, water, and CO2",
    rubric=[
        {
            'keypoint': 'Mentions sunlight',
            'keywords': ['sunlight', 'light'],
            'weight': 5
        }
    ]
)
# Returns: {'score': 5, 'max_score': 5, 'percentage': 100, ...}
```

## Future Additions
- `similarity_scorer.py` - TF-IDF semantic similarity (Phase 3.3)
- `hybrid_scorer.py` - Combined rubric + similarity scoring
