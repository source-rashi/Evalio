"""
Semantic Similarity Scoring using TF-IDF

This module provides semantic similarity measurement between student and model answers
using TF-IDF (Term Frequency-Inverse Document Frequency) and cosine similarity.

No deep learning required - lightweight, interpretable, fast.
"""

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
from typing import Dict, Any, List


class SimilarityScorer:
    """
    Measures semantic similarity between student and model answers using TF-IDF.
    """
    
    def __init__(self, ngram_range: tuple = (1, 2), min_df: int = 1):
        """
        Initialize the similarity scorer.
        
        Args:
            ngram_range: Range of n-grams to consider (default: unigrams + bigrams)
            min_df: Minimum document frequency for terms
        """
        self.ngram_range = ngram_range
        self.min_df = min_df
        self.vectorizer = None
    
    def calculate_similarity(
        self,
        student_answer: str,
        model_answer: str,
        additional_context: List[str] = None
    ) -> Dict[str, Any]:
        """
        Calculate semantic similarity between student and model answers.
        
        Args:
            student_answer: The student's submitted answer
            model_answer: The ideal/reference answer
            additional_context: Optional list of related texts for better TF-IDF
        
        Returns:
            Dictionary containing:
                - similarity_score: Cosine similarity (0.0 to 1.0)
                - percentage: Similarity as percentage (0-100)
                - confidence: Confidence in the similarity measure
                - interpretation: Human-readable interpretation
        """
        if not student_answer or not student_answer.strip():
            return {
                'similarity_score': 0.0,
                'percentage': 0,
                'confidence': 1.0,
                'interpretation': 'empty_answer',
                'method': 'tfidf_cosine'
            }
        
        # Prepare corpus for TF-IDF
        corpus = [model_answer, student_answer]
        if additional_context:
            corpus.extend(additional_context)
        
        # Create TF-IDF vectorizer
        self.vectorizer = TfidfVectorizer(
            ngram_range=self.ngram_range,
            min_df=self.min_df,
            stop_words='english',  # Remove common words
            lowercase=True
        )
        
        try:
            # Transform texts to TF-IDF vectors
            tfidf_matrix = self.vectorizer.fit_transform(corpus)
            
            # Extract vectors for model and student answers
            model_vector = tfidf_matrix[0]
            student_vector = tfidf_matrix[1]
            
            # Calculate cosine similarity
            similarity = cosine_similarity(model_vector, student_vector)[0][0]
            
            # Ensure similarity is in valid range [0, 1]
            similarity = max(0.0, min(1.0, similarity))
            
            # Interpret similarity level
            interpretation = self._interpret_similarity(similarity)
            
            # Confidence based on answer length and vocabulary overlap
            confidence = self._calculate_confidence(
                student_answer,
                model_answer,
                similarity
            )
            
            return {
                'similarity_score': round(float(similarity), 4),
                'percentage': round(float(similarity * 100), 2),
                'confidence': round(confidence, 4),
                'interpretation': interpretation,
                'method': 'tfidf_cosine'
            }
        
        except ValueError as e:
            # Handle edge cases (e.g., empty vocabulary after stop word removal)
            return {
                'similarity_score': 0.0,
                'percentage': 0,
                'confidence': 0.5,
                'interpretation': 'calculation_error',
                'error': str(e),
                'method': 'tfidf_cosine'
            }
    
    def _interpret_similarity(self, similarity: float) -> str:
        """
        Provide human-readable interpretation of similarity score.
        
        Args:
            similarity: Cosine similarity value (0.0 to 1.0)
        
        Returns:
            Interpretation string
        """
        if similarity >= 0.9:
            return 'excellent_match'
        elif similarity >= 0.7:
            return 'good_match'
        elif similarity >= 0.5:
            return 'moderate_match'
        elif similarity >= 0.3:
            return 'weak_match'
        else:
            return 'poor_match'
    
    def _calculate_confidence(
        self,
        student_answer: str,
        model_answer: str,
        similarity: float
    ) -> float:
        """
        Calculate confidence level in the similarity measurement.
        
        Confidence decreases if:
        - Student answer is very short
        - Student answer is much longer than model answer (padding/rambling)
        
        Args:
            student_answer: Student's submitted answer
            model_answer: Reference answer
            similarity: Calculated similarity score
        
        Returns:
            Confidence value (0.0 to 1.0)
        """
        student_words = len(student_answer.split())
        model_words = len(model_answer.split())
        
        # Base confidence
        confidence = 1.0
        
        # Penalize very short answers (less than 5 words)
        if student_words < 5:
            confidence *= 0.6
        elif student_words < 10:
            confidence *= 0.8
        
        # Penalize extreme length differences
        if model_words > 0:
            length_ratio = student_words / model_words
            if length_ratio > 3.0:  # Student wrote 3x more than needed
                confidence *= 0.7
            elif length_ratio < 0.3:  # Student wrote less than 30% of expected
                confidence *= 0.8
        
        return confidence


def create_default_similarity_scorer() -> SimilarityScorer:
    """
    Factory function to create a similarity scorer with default settings.
    
    Returns:
        SimilarityScorer with unigrams and bigrams
    """
    return SimilarityScorer(ngram_range=(1, 2), min_df=1)


class HybridScorer:
    """
    Combines rubric-based scoring with semantic similarity for comprehensive evaluation.
    """
    
    def __init__(
        self,
        rubric_weight: float = 0.6,
        similarity_weight: float = 0.4
    ):
        """
        Initialize hybrid scorer.
        
        Args:
            rubric_weight: Weight for rubric-based score (0.0 to 1.0)
            similarity_weight: Weight for similarity score (0.0 to 1.0)
        """
        if not (0 <= rubric_weight <= 1 and 0 <= similarity_weight <= 1):
            raise ValueError("Weights must be between 0 and 1")
        
        total = rubric_weight + similarity_weight
        if abs(total - 1.0) > 0.01:
            raise ValueError("Weights must sum to 1.0")
        
        self.rubric_weight = rubric_weight
        self.similarity_weight = similarity_weight
    
    def combine_scores(
        self,
        rubric_result: Dict[str, Any],
        similarity_result: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Combine rubric and similarity scores into final evaluation.
        
        Args:
            rubric_result: Result from rubric scorer
            similarity_result: Result from similarity scorer
        
        Returns:
            Combined evaluation with weighted final score
        """
        # Extract percentages
        rubric_percentage = rubric_result.get('percentage', 0)
        similarity_percentage = similarity_result.get('percentage', 0)
        
        # Calculate weighted final score
        final_percentage = (
            rubric_percentage * self.rubric_weight +
            similarity_percentage * self.similarity_weight
        )
        
        # Calculate combined confidence
        rubric_confidence = rubric_result.get('confidence', 1.0)
        similarity_confidence = similarity_result.get('confidence', 1.0)
        combined_confidence = (rubric_confidence + similarity_confidence) / 2
        
        return {
            'final_percentage': round(final_percentage, 2),
            'rubric_component': {
                'percentage': rubric_percentage,
                'weight': self.rubric_weight,
                'contribution': round(rubric_percentage * self.rubric_weight, 2)
            },
            'similarity_component': {
                'percentage': similarity_percentage,
                'weight': self.similarity_weight,
                'contribution': round(similarity_percentage * self.similarity_weight, 2)
            },
            'confidence': round(combined_confidence, 4),
            'method': 'hybrid_rubric_similarity',
            'rubric_details': rubric_result,
            'similarity_details': similarity_result
        }


def create_default_hybrid_scorer() -> HybridScorer:
    """
    Factory function to create a hybrid scorer with default weights.
    
    Returns:
        HybridScorer with 60% rubric, 40% similarity
    """
    return HybridScorer(rubric_weight=0.6, similarity_weight=0.4)
