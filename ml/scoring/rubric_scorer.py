"""
Rubric-Based Scoring Engine

This module provides deterministic, explainable scoring based on keyword matching
and weighted rubric criteria. No machine learning - pure rule-based logic.

Key Features:
- Keyword matching with fuzzy tolerance
- Weight-based scoring from grading rubric
- Transparent scoring breakdown
- Identifies matched and missing keypoints
"""

import re
from typing import List, Dict, Any


class RubricScorer:
    """
    Evaluates student answers against a grading rubric using keyword matching.
    """
    
    def __init__(self, case_sensitive: bool = False, partial_match: bool = True):
        """
        Initialize the rubric scorer.
        
        Args:
            case_sensitive: Whether keyword matching should be case-sensitive
            partial_match: Allow partial word matches (e.g., "photo" matches "photosynthesis")
        """
        self.case_sensitive = case_sensitive
        self.partial_match = partial_match
    
    def normalize_text(self, text: str) -> str:
        """
        Normalize text for comparison.
        
        Args:
            text: Input text to normalize
            
        Returns:
            Normalized text (lowercase, trimmed, extra spaces removed)
        """
        text = text.strip()
        text = re.sub(r'\s+', ' ', text)  # Replace multiple spaces with single space
        
        if not self.case_sensitive:
            text = text.lower()
        
        return text
    
    def keyword_match(self, keywords: List[str], student_answer: str) -> Dict[str, bool]:
        """
        Check which keywords are present in the student's answer.
        
        Args:
            keywords: List of keywords to search for
            student_answer: The student's submitted answer
            
        Returns:
            Dictionary mapping each keyword to True (found) or False (not found)
        """
        normalized_answer = self.normalize_text(student_answer)
        matches = {}
        
        for keyword in keywords:
            normalized_keyword = self.normalize_text(keyword)
            
            if self.partial_match:
                # Search for keyword as substring
                found = normalized_keyword in normalized_answer
            else:
                # Search for exact word match
                pattern = r'\b' + re.escape(normalized_keyword) + r'\b'
                found = bool(re.search(pattern, normalized_answer))
            
            matches[keyword] = found
        
        return matches
    
    def score_answer(
        self,
        student_answer: str,
        model_answer: str,
        rubric: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Score a student answer using a weighted rubric.
        
        Args:
            student_answer: The student's submitted answer
            model_answer: The ideal/reference answer (for context)
            rubric: List of rubric items, each with:
                - keypoint: Description of the concept
                - keywords: List of keywords that indicate this keypoint
                - weight: Point value for this keypoint
                - required: Whether this keypoint is mandatory (optional)
        
        Returns:
            Dictionary containing:
                - score: Total points earned
                - max_score: Maximum possible points
                - percentage: Score as percentage (0-100)
                - matched_keypoints: List of keypoints the student covered
                - missing_keypoints: List of keypoints the student missed
                - breakdown: Detailed scoring breakdown per rubric item
        """
        if not student_answer or not student_answer.strip():
            return {
                'score': 0,
                'max_score': sum(item['weight'] for item in rubric),
                'percentage': 0,
                'matched_keypoints': [],
                'missing_keypoints': [item['keypoint'] for item in rubric],
                'breakdown': []
            }
        
        total_score = 0
        max_score = 0
        matched_keypoints = []
        missing_keypoints = []
        breakdown = []
        
        for rubric_item in rubric:
            keypoint = rubric_item['keypoint']
            keywords = rubric_item.get('keywords', [])
            weight = rubric_item['weight']
            required = rubric_item.get('required', False)
            
            max_score += weight
            
            # Check keyword matches
            keyword_matches = self.keyword_match(keywords, student_answer)
            matched_keywords = [kw for kw, found in keyword_matches.items() if found]
            
            # Determine if keypoint is satisfied
            if matched_keywords:
                # Calculate partial credit based on keyword coverage
                coverage_ratio = len(matched_keywords) / len(keywords) if keywords else 0
                earned_points = weight * coverage_ratio
                
                total_score += earned_points
                matched_keypoints.append(keypoint)
                
                breakdown.append({
                    'keypoint': keypoint,
                    'weight': weight,
                    'earned': round(earned_points, 2),
                    'matched_keywords': matched_keywords,
                    'missing_keywords': [kw for kw, found in keyword_matches.items() if not found],
                    'status': 'partial' if coverage_ratio < 1.0 else 'complete'
                })
            else:
                missing_keypoints.append(keypoint)
                
                breakdown.append({
                    'keypoint': keypoint,
                    'weight': weight,
                    'earned': 0,
                    'matched_keywords': [],
                    'missing_keywords': keywords,
                    'status': 'missing',
                    'required': required
                })
        
        percentage = (total_score / max_score * 100) if max_score > 0 else 0
        
        return {
            'score': round(total_score, 2),
            'max_score': max_score,
            'percentage': round(percentage, 2),
            'matched_keypoints': matched_keypoints,
            'missing_keypoints': missing_keypoints,
            'breakdown': breakdown
        }


def create_default_scorer() -> RubricScorer:
    """
    Factory function to create a scorer with default settings.
    
    Returns:
        RubricScorer with case-insensitive, partial matching enabled
    """
    return RubricScorer(case_sensitive=False, partial_match=True)
