"""
Evalio ML Evaluation System - Main Entry Point

This script serves as the primary interface for answer evaluation.
Backend will call this script with input data and receive scoring results.
"""

import sys
import json
from scoring.rubric_scorer import create_default_scorer


def evaluate_answer(input_data: dict) -> dict:
    """
    Main evaluation function using rubric-based scoring.
    
    Args:
        input_data: Dictionary containing:
            - student_answer: The student's submitted answer
            - model_answer: The ideal/reference answer
            - rubric: List of keypoint items with keywords and weights
    
    Returns:
        Dictionary containing:
            - score: Points earned
            - max_score: Maximum possible points
            - percentage: Score as percentage
            - confidence: Confidence level (1.0 for deterministic rubric)
            - matched_keypoints: List of covered concepts
            - missing_keypoints: List of missed concepts
            - breakdown: Detailed scoring per rubric item
            - method: Scoring method used
    """
    student_answer = input_data.get('student_answer', '')
    model_answer = input_data.get('model_answer', '')
    rubric = input_data.get('rubric', [])
    
    # Initialize rubric scorer
    scorer = create_default_scorer()
    
    # Score the answer
    result = scorer.score_answer(student_answer, model_answer, rubric)
    
    # Add metadata
    result['confidence'] = 1.0  # Deterministic scoring = 100% confidence
    result['method'] = 'rubric_based'
    
    return result


def main():
    """
    Main entry point for command-line usage.
    
    Usage:
        python ml/evaluate.py
        (reads JSON from stdin, writes JSON to stdout)
    """
    # Example usage for testing
    if len(sys.argv) > 1 and sys.argv[1] == '--test':
        print("Running test example...")
        
        test_input = {
            'student_answer': 'Photosynthesis is the process where plants convert sunlight into energy using chlorophyll in their leaves.',
            'model_answer': 'Photosynthesis is the process by which plants use sunlight, water, and carbon dioxide to produce glucose and oxygen.',
            'rubric': [
                {
                    'keypoint': 'Mentions sunlight as energy source',
                    'keywords': ['sunlight', 'light', 'solar'],
                    'weight': 2,
                    'required': True
                },
                {
                    'keypoint': 'Identifies chlorophyll role',
                    'keywords': ['chlorophyll', 'green pigment'],
                    'weight': 2,
                    'required': False
                },
                {
                    'keypoint': 'Mentions carbon dioxide as input',
                    'keywords': ['carbon dioxide', 'CO2'],
                    'weight': 2,
                    'required': True
                },
                {
                    'keypoint': 'Mentions water as input',
                    'keywords': ['water', 'H2O'],
                    'weight': 1,
                    'required': True
                },
                {
                    'keypoint': 'Identifies glucose as output',
                    'keywords': ['glucose', 'sugar', 'energy'],
                    'weight': 2,
                    'required': True
                },
                {
                    'keypoint': 'Mentions oxygen as output',
                    'keywords': ['oxygen', 'O2'],
                    'weight': 1,
                    'required': True
                }
            ]
        }
        
        result = evaluate_answer(test_input)
        
        print("\n" + "="*60)
        print("EVALUATION RESULT")
        print("="*60)
        print(f"Score: {result['score']}/{result['max_score']} ({result['percentage']}%)")
        print(f"Confidence: {result['confidence']}")
        print(f"Method: {result['method']}")
        print(f"\nMatched Keypoints ({len(result['matched_keypoints'])}):")
        for kp in result['matched_keypoints']:
            print(f"  ✓ {kp}")
        print(f"\nMissing Keypoints ({len(result['missing_keypoints'])}):")
        for kp in result['missing_keypoints']:
            print(f"  ✗ {kp}")
        print(f"\nDetailed Breakdown:")
        for item in result['breakdown']:
            status_icon = "✓" if item['status'] == 'complete' else "◐" if item['status'] == 'partial' else "✗"
            print(f"  {status_icon} {item['keypoint']}: {item['earned']}/{item['weight']} points")
            if item['matched_keywords']:
                print(f"      Matched: {', '.join(item['matched_keywords'])}")
            if item['missing_keywords']:
                print(f"      Missing: {', '.join(item['missing_keywords'])}")
        print("="*60)
        
        return 0
    
    else:
        print("Evalio ML System - Rubric-Based Scoring")
        print("Usage: python ml/evaluate.py --test")
        print("For integration: pass JSON via stdin")
        return 0


if __name__ == "__main__":
    sys.exit(main())
