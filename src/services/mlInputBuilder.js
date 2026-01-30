/**
 * ML Input Builder
 * 
 * Transforms MongoDB documents into the structured format required by the ML system.
 * This is a PURE FUNCTION - no database access, no side effects, just data transformation.
 * 
 * WHY THIS EXISTS:
 * - ML should never access database directly (security + decoupling)
 * - Backend controls exactly what data ML sees
 * - Ensures reproducibility (same input → same output)
 * - Makes testing easy (no mocks needed)
 * 
 * INPUT: MongoDB documents (Submission, Exam, Questions, Answers)
 * OUTPUT: Plain JavaScript object ready for ML consumption
 */

/**
 * Build ML evaluation input from database documents
 * 
 * This function takes raw MongoDB documents and transforms them into
 * the exact structure expected by the ML system (see docs/ARCHITECTURE.md).
 * 
 * @param {Object} params - Input parameters
 * @param {Object} params.submission - Submission document from MongoDB
 * @param {Object} params.exam - Exam document from MongoDB
 * @param {Array<Object>} params.questions - Array of Question documents
 * @param {Array<Object>} params.answers - Array of student answers from submission
 * @returns {Object} ML input structure conforming to contract
 * 
 * @example
 * const mlInput = buildMLInput({
 *   submission: submissionDoc,
 *   exam: examDoc,
 *   questions: questionDocs,
 *   answers: submissionDoc.answers
 * });
 * 
 * // Result:
 * {
 *   submission: { _id, student_id, exam_id, submitted_at },
 *   exam: { _id, title, subject, instructions },
 *   questions: [
 *     {
 *       _id, questionText, modelAnswer, maxScore,
 *       rubric: [{ keypoint, keywords, weight }]
 *     }
 *   ],
 *   answers: [
 *     { questionId, studentAnswer, imageUrl }
 *   ]
 * }
 */
function buildMLInput({ submission, exam, questions, answers }) {
  // Validate required parameters
  if (!submission) {
    throw new Error('buildMLInput: submission is required');
  }
  if (!exam) {
    throw new Error('buildMLInput: exam is required');
  }
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('buildMLInput: questions must be a non-empty array');
  }
  if (!Array.isArray(answers)) {
    throw new Error('buildMLInput: answers must be an array');
  }

  // Build submission metadata
  const submissionData = {
    _id: submission._id,
    student_id: submission.student_id,
    exam_id: submission.exam_id,
    submitted_at: submission.submitted_at || submission.createdAt
  };

  // Build exam metadata
  const examData = {
    _id: exam._id,
    title: exam.title,
    subject: exam.subject || null,
    instructions: exam.instructions || null
  };

  // Build questions array with rubrics
  const questionsData = questions.map(question => {
    // Extract rubric (handle both direct rubric and keypoints array)
    let rubric = [];
    
    if (question.rubric && Array.isArray(question.rubric)) {
      // New format: question has direct rubric array
      rubric = question.rubric.map(item => ({
        keypoint: item.keypoint || item.text || '',
        keywords: Array.isArray(item.keywords) ? item.keywords : [],
        weight: typeof item.weight === 'number' ? item.weight : 1.0
      }));
    } else if (question.keypoints && Array.isArray(question.keypoints)) {
      // Old format: question has keypoints array
      rubric = question.keypoints.map(kp => ({
        keypoint: kp.text || kp.keypoint || '',
        keywords: Array.isArray(kp.keywords) ? kp.keywords : [],
        weight: typeof kp.weight === 'number' ? kp.weight : 1.0
      }));
    }

    return {
      _id: question._id,
      questionText: question.text || question.questionText || '',
      modelAnswer: question.model_answer || question.modelAnswer || '',
      maxScore: question.marks || question.maxScore || 10,
      rubric: rubric
    };
  });

  // Build answers array
  const answersData = answers.map(answer => ({
    questionId: answer.question_id || answer.questionId,
    studentAnswer: answer.answer_text || answer.studentAnswer || '',
    imageUrl: answer.image_url || answer.imageUrl || null
  }));

  // Assemble final ML input structure
  const mlInput = {
    submission: submissionData,
    exam: examData,
    questions: questionsData,
    answers: answersData
  };

  return mlInput;
}

/**
 * Validate ML input structure before sending to ML
 * 
 * This performs a final sanity check to ensure the built input
 * conforms to what ML expects. This is defensive programming.
 * 
 * @param {Object} mlInput - ML input structure to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateMLInput(mlInput) {
  const errors = [];

  if (!mlInput || typeof mlInput !== 'object') {
    return { valid: false, errors: ['ML input must be an object'] };
  }

  // Validate submission
  if (!mlInput.submission || !mlInput.submission._id) {
    errors.push('submission._id is required');
  }
  if (!mlInput.submission || !mlInput.submission.student_id) {
    errors.push('submission.student_id is required');
  }
  if (!mlInput.submission || !mlInput.submission.exam_id) {
    errors.push('submission.exam_id is required');
  }

  // Validate exam
  if (!mlInput.exam || !mlInput.exam._id) {
    errors.push('exam._id is required');
  }

  // Validate questions
  if (!Array.isArray(mlInput.questions) || mlInput.questions.length === 0) {
    errors.push('questions must be a non-empty array');
  } else {
    mlInput.questions.forEach((q, index) => {
      if (!q._id) {
        errors.push(`questions[${index}]._id is required`);
      }
      if (!q.questionText || q.questionText.trim() === '') {
        errors.push(`questions[${index}].questionText is required`);
      }
      if (typeof q.maxScore !== 'number' || q.maxScore <= 0) {
        errors.push(`questions[${index}].maxScore must be a positive number`);
      }
    });
  }

  // Validate answers
  if (!Array.isArray(mlInput.answers)) {
    errors.push('answers must be an array');
  } else {
    mlInput.answers.forEach((a, index) => {
      if (!a.questionId) {
        errors.push(`answers[${index}].questionId is required`);
      }
    });
  }

  // Validate answers match questions
  if (mlInput.questions && mlInput.answers) {
    const questionIds = new Set(mlInput.questions.map(q => String(q._id)));
    mlInput.answers.forEach((a, index) => {
      if (!questionIds.has(String(a.questionId))) {
        errors.push(`answers[${index}].questionId does not match any question`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get ML input statistics for logging/debugging
 * 
 * @param {Object} mlInput - ML input structure
 * @returns {Object} Statistics about the input
 */
function getMLInputStats(mlInput) {
  if (!mlInput || typeof mlInput !== 'object') {
    return { error: 'Invalid ML input' };
  }

  return {
    submissionId: mlInput.submission?._id,
    examId: mlInput.exam?._id,
    studentId: mlInput.submission?.student_id,
    questionCount: mlInput.questions?.length || 0,
    answerCount: mlInput.answers?.length || 0,
    totalMaxScore: mlInput.questions?.reduce((sum, q) => sum + (q.maxScore || 0), 0) || 0,
    questionsWithRubrics: mlInput.questions?.filter(q => q.rubric && q.rubric.length > 0).length || 0
  };
}

module.exports = {
  buildMLInput,
  validateMLInput,
  getMLInputStats
};
