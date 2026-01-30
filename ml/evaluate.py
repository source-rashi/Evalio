"""
Evalio ML Evaluation System - Main Entry Point

This script serves as the primary interface for answer evaluation.
Backend will call this script with input data and receive scoring results.
"""

import sys
import json
from scoring.rubric_scorer import create_default_scorer
from scoring.similarity_scorer import (
    create_default_similarity_scorer,
    create_default_hybrid_scorer
)


def evaluate_answer(input_data: dict, mode: str = 'hybrid') -> dict:
    """
    Main evaluation function with multiple scoring modes.
    
    Args:
        input_data: Dictionary containing:
            - student_answer: The student's submitted answer
            - model_answer: The ideal/reference answer
            - rubric: List of keypoint items with keywords and weights
        mode: Scoring mode - 'rubric', 'similarity', or 'hybrid' (default)
    
    Returns:
        Dictionary containing evaluation results based on selected mode
    """
    student_answer = input_data.get('student_answer', '')
    model_answer = input_data.get('model_answer', '')
    rubric = input_data.get('rubric', [])
    
    if mode == 'rubric':
        # Pure rubric-based scoring
        scorer = create_default_scorer()
        result = scorer.score_answer(student_answer, model_answer, rubric)
        result['confidence'] = 1.0
        result['method'] = 'rubric_based'
        return result
    
    elif mode == 'similarity':
        # Pure semantic similarity
        similarity_scorer = create_default_similarity_scorer()
        result = similarity_scorer.calculate_similarity(student_answer, model_answer)
        return result
    
    else:  # mode == 'hybrid'
        # Combined rubric + similarity scoring
        # 1. Calculate rubric score
        rubric_scorer = create_default_scorer()
        rubric_result = rubric_scorer.score_answer(student_answer, model_answer, rubric)
        rubric_result['confidence'] = 1.0
        
        # 2. Calculate similarity score
        similarity_scorer = create_default_similarity_scorer()
        similarity_result = similarity_scorer.calculate_similarity(student_answer, model_answer)
        
        # 3. Combine scores (60% rubric + 40% similarity)
        hybrid_scorer = create_default_hybrid_scorer()
        combined_result = hybrid_scorer.combine_scores(rubric_result, similarity_result)
        
        return combined_result


def main():
    """
    Main entry point for command-line usage.
    
    Usage:
        python ml/evaluate.py --test [mode]
        Modes: rubric, similarity, hybrid (default)
    """
    # Example usage for testing
    if len(sys.argv) > 1 and sys.argv[1] == '--test':
        mode = sys.argv[2] if len(sys.argv) > 2 else 'hybrid'
        print(f"Running test example in '{mode}' mode...")
        
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
        
        result = evaluate_answer(test_input, mode=mode)
        
        print("\n" + "="*60)
        print(f"EVALUATION RESULT - {mode.upper()} MODE")
        print("="*60)
        
        if mode == 'similarity':
            print(f"Similarity Score: {result['similarity_score']}")
            print(f"Percentage: {result['percentage']}%")
            print(f"Confidence: {result['confidence']}")
            print(f"Interpretation: {result['interpretation']}")
            print(f"Method: {result['method']}")
        
        elif mode == 'rubric':
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
        
        else:  # hybrid
            print(f"Final Score: {result['final_percentage']}%")
            print(f"Confidence: {result['confidence']}")
            print(f"Method: {result['method']}")
            print(f"\n--- Component Breakdown ---")
            print(f"Rubric Component: {result['rubric_component']['percentage']}% × {result['rubric_component']['weight']} = {result['rubric_component']['contribution']}%")
            print(f"Similarity Component: {result['similarity_component']['percentage']}% × {result['similarity_component']['weight']} = {result['similarity_component']['contribution']}%")
            print(f"\n--- Rubric Details ---")
            rubric_details = result['rubric_details']
            print(f"Score: {rubric_details['score']}/{rubric_details['max_score']}")
            print(f"Matched: {len(rubric_details['matched_keypoints'])} keypoints")
            print(f"Missing: {len(rubric_details['missing_keypoints'])} keypoints")
            print(f"\n--- Similarity Details ---")
            sim_details = result['similarity_details']
            print(f"Similarity: {sim_details['similarity_score']} ({sim_details['interpretation']})")
            print(f"Confidence: {sim_details['confidence']}")
        
        print("="*60)
        
        return 0
    
    else:
        print("Evalio ML System - Hybrid Scoring (Rubric + TF-IDF Similarity)")
        print("Usage: python ml/evaluate.py --test [mode]")
        print("Modes: rubric, similarity, hybrid (default)")
        print("\nFor integration: pass JSON via stdin")
        return 0


if __name__ == "__main__":
    sys.exit(main())
