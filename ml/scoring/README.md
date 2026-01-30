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

### `similarity_scorer.py`
**Purpose**: Semantic similarity measurement using TF-IDF and cosine similarity.

**How It Works**:
1. Converts student and model answers to TF-IDF vectors
2. TF-IDF weighs words by importance (frequent in doc, rare in corpus)
3. Calculates cosine similarity between vectors (0.0 to 1.0)
4. Interprets similarity level (excellent/good/moderate/weak/poor)

**The Math (Simplified)**:
- **TF-IDF**: Term Frequency × Inverse Document Frequency
  - High score = word is important in this answer but not overused everywhere
- **Cosine Similarity**: Measures angle between two vectors
  - 1.0 = identical meaning, 0.0 = completely different

**Key Features**:
- Captures semantic meaning beyond exact keyword matches
- Handles synonyms and paraphrasing
- Uses n-grams (unigrams + bigrams) for phrase context
- Removes English stop words automatically
- Confidence based on answer length and quality

**Combined Scoring**:
The `HybridScorer` class combines both approaches:
- 60% rubric-based (ensures key concepts are covered)
- 40% similarity (rewards overall understanding and expression)

This balance ensures students must hit key points (rubric) while also demonstrating comprehension (similarity).

**Example**:
```python
from scoring.similarity_scorer import create_default_similarity_scorer

scorer = create_default_similarity_scorer()
result = scorer.calculate_similarity(
    student_answer="Plants convert light into chemical energy",
    model_answer="Plants use photosynthesis to transform sunlight into stored energy"
)
# Returns: {'similarity_score': 0.65, 'percentage': 65, 'interpretation': 'good_match', ...}
```

## Usage Modes

The ML system supports three evaluation modes:

1. **Rubric Only** (`mode='rubric'`): Strict keyword matching, perfect for factual recall
2. **Similarity Only** (`mode='similarity'`): Semantic comparison, good for essays
3. **Hybrid** (`mode='hybrid'`, default): Best of both worlds - 60% rubric + 40% similarity
