/**
 * EVALUATION STATUS LIFECYCLE DOCUMENTATION
 * 
 * This file documents the complete lifecycle of an evaluation
 * from creation through AI scoring to final teacher approval.
 */

const { EVALUATION_STATUS } = require('../constants/evaluationStatus');

/**
 * ═══════════════════════════════════════════════════════════════
 * EVALUATION LIFECYCLE STATES
 * ═══════════════════════════════════════════════════════════════
 * 
 * 1. PENDING
 *    - Initial state when evaluation is created
 *    - No AI scoring has occurred yet
 *    - Submission must be finalized first
 * 
 * 2. AI_EVALUATED
 *    - AI/ML model has completed scoring
 *    - aiScore and finalScore are identical
 *    - Awaiting teacher review (optional)
 *    - Students can see preliminary results
 * 
 * 3. MANUALLY_REVIEWED
 *    - Teacher has reviewed AI scores
 *    - May include manual overrides (finalScore ≠ aiScore)
 *    - ManualOverride records created if changed
 *    - Not yet released to student
 * 
 * 4. FINALIZED
 *    - Evaluation is locked and published
 *    - No further changes allowed
 *    - Official grades released to student
 *    - Permanent record
 * 
 * ═══════════════════════════════════════════════════════════════
 * STATUS TRANSITION RULES
 * ═══════════════════════════════════════════════════════════════
 * 
 * PENDING → AI_EVALUATED
 *   Trigger: POST /api/evaluate/:submissionId
 *   Actor: Teacher (triggers AI grading)
 *   Changes:
 *     - AI scores all questions
 *     - Sets aiScore and finalScore (same initially)
 *     - Calculates confidence per question
 *     - Status changes to AI_EVALUATED
 * 
 * AI_EVALUATED → MANUALLY_REVIEWED
 *   Trigger: PUT /api/evaluate/:evaluationId/review (future)
 *   Actor: Teacher
 *   Changes:
 *     - Teacher adjusts finalScore if needed
 *     - Creates ManualOverride records for changes
 *     - Updates feedback if changed
 *     - Sets isOverridden flag on modified questions
 *     - Status changes to MANUALLY_REVIEWED
 *     - Sets reviewedBy and reviewedAt fields
 * 
 * AI_EVALUATED → FINALIZED (direct path)
 *   Trigger: PUT /api/evaluate/:evaluationId/finalize (future)
 *   Actor: Teacher
 *   Conditions: Teacher accepts AI scores without changes
 *   Changes:
 *     - No score modifications
 *     - Status changes to FINALIZED
 *     - Grades officially released
 * 
 * MANUALLY_REVIEWED → FINALIZED
 *   Trigger: PUT /api/evaluate/:evaluationId/finalize (future)
 *   Actor: Teacher
 *   Changes:
 *     - Locks all scores permanently
 *     - Status changes to FINALIZED
 *     - Grades officially released
 * 
 * ═══════════════════════════════════════════════════════════════
 * STATUS TRANSITION DIAGRAM
 * ═══════════════════════════════════════════════════════════════
 * 
 *                    ┌─────────┐
 *                    │ PENDING │ (Initial state)
 *                    └────┬────┘
 *                         │
 *                         │ Teacher triggers evaluation
 *                         │ (POST /evaluate/:submissionId)
 *                         ▼
 *                  ┌──────────────┐
 *                  │ AI_EVALUATED │ (AI scoring complete)
 *                  └──────┬───────┘
 *                         │
 *             ┌───────────┴───────────┐
 *             │                       │
 *             │ Teacher reviews       │ Teacher accepts
 *             │ (makes changes)       │ (no changes)
 *             ▼                       ▼
 *    ┌────────────────────┐    ┌──────────┐
 *    │ MANUALLY_REVIEWED  │───▶│FINALIZED │ (Locked)
 *    └────────────────────┘    └──────────┘
 *             │                       ▲
 *             │ Teacher finalizes     │
 *             └───────────────────────┘
 * 
 * ═══════════════════════════════════════════════════════════════
 * PERMISSIONS BY STATUS
 * ═══════════════════════════════════════════════════════════════
 * 
 * PENDING:
 *   - Teacher: Can trigger evaluation
 *   - Student: Cannot see evaluation
 * 
 * AI_EVALUATED:
 *   - Teacher: Can review, override, or finalize
 *   - Student: Can see preliminary scores (optional policy)
 * 
 * MANUALLY_REVIEWED:
 *   - Teacher: Can finalize or make more changes
 *   - Student: Cannot see yet (grades not released)
 * 
 * FINALIZED:
 *   - Teacher: Read-only (no modifications)
 *   - Student: Full access to final grades
 * 
 * ═══════════════════════════════════════════════════════════════
 * AUDIT TRAIL
 * ═══════════════════════════════════════════════════════════════
 * 
 * Status changes are tracked via:
 *   1. Evaluation.status field (current state)
 *   2. Evaluation.createdAt (when AI_EVALUATED)
 *   3. Evaluation.reviewedAt (when MANUALLY_REVIEWED or FINALIZED)
 *   4. Evaluation.reviewedBy (teacher who reviewed)
 *   5. ManualOverride records (what changed, when, why)
 * 
 * ═══════════════════════════════════════════════════════════════
 * IMPLEMENTATION STATUS (Phase 2)
 * ═══════════════════════════════════════════════════════════════
 * 
 * ✅ Schema supports all statuses
 * ✅ PENDING → AI_EVALUATED transition implemented
 * ⏳ AI_EVALUATED → MANUALLY_REVIEWED (Phase 3)
 * ⏳ → FINALIZED transitions (Phase 3)
 * ⏳ Teacher review endpoints (Phase 3)
 * 
 */

module.exports = {
  EVALUATION_STATUS,
  
  /**
   * Check if evaluation can be modified
   */
  canModify: (status) => {
    return status !== EVALUATION_STATUS.FINALIZED;
  },
  
  /**
   * Check if student can view evaluation
   */
  canStudentView: (status) => {
    return [
      EVALUATION_STATUS.AI_EVALUATED,
      EVALUATION_STATUS.FINALIZED
    ].includes(status);
  },
  
  /**
   * Check if teacher can review/override
   */
  canTeacherReview: (status) => {
    return [
      EVALUATION_STATUS.AI_EVALUATED,
      EVALUATION_STATUS.MANUALLY_REVIEWED
    ].includes(status);
  },
  
  /**
   * Get next valid statuses from current status
   */
  getNextStatuses: (currentStatus) => {
    switch (currentStatus) {
      case EVALUATION_STATUS.PENDING:
        return [EVALUATION_STATUS.AI_EVALUATED];
      
      case EVALUATION_STATUS.AI_EVALUATED:
        return [
          EVALUATION_STATUS.MANUALLY_REVIEWED,
          EVALUATION_STATUS.FINALIZED
        ];
      
      case EVALUATION_STATUS.MANUALLY_REVIEWED:
        return [EVALUATION_STATUS.FINALIZED];
      
      case EVALUATION_STATUS.FINALIZED:
        return []; // Terminal state
      
      default:
        return [];
    }
  }
};
