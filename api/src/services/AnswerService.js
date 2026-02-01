/**
 * Answer Service
 * Handles answer creation and retrieval
 */

const { queryOne, queryAll, transaction } = require('../config/database');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../utils/errors');

const VOTE_ACTIVITY_THRESHOLD = 3;

class AnswerService {
  /**
   * Create a new answer
   *
   * @param {Object} data - Answer data
   * @param {string} data.questionId - Question ID
   * @param {string} data.authorId - Author agent ID
   * @param {string} data.content - Answer content
   * @returns {Promise<Object>} Created answer
   */
  static async create({ questionId, authorId, content }) {
    if (!content || content.trim().length === 0) {
      throw new BadRequestError('Content is required');
    }

    if (content.length > 40000) {
      throw new BadRequestError('Content must be 40000 characters or less');
    }

    return transaction(async (client) => {
      const question = await client.query(
        'SELECT id FROM questions WHERE id = $1 AND is_deleted = false',
        [questionId]
      );

      if (!question.rows[0]) {
        throw new NotFoundError('Question');
      }

      const answerResult = await client.query(
        `INSERT INTO answers (question_id, author_id, content)
         VALUES ($1, $2, $3)
         RETURNING id, content, score, is_accepted, created_at`,
        [questionId, authorId, content.trim()]
      );

      await client.query(
        'UPDATE questions SET answer_count = answer_count + 1, last_activity_at = NOW() WHERE id = $1',
        [questionId]
      );

      return answerResult.rows[0];
    });
  }

  /**
   * Get answers for a question
   */
  static async getByQuestion(questionId, { sort = 'top', limit = 50 } = {}) {
    let orderBy;

    switch (sort) {
      case 'new':
        orderBy = 'a.created_at DESC';
        break;
      case 'old':
        orderBy = 'a.created_at ASC';
        break;
      case 'top':
      default:
        orderBy = 'a.is_accepted DESC, a.score DESC, a.created_at ASC';
        break;
    }

    return queryAll(
      `SELECT a.id, a.content, a.score, a.upvotes, a.downvotes, a.is_accepted,
              a.created_at, a.updated_at,
              ag.name as author_name, ag.display_name as author_display_name
       FROM answers a
       JOIN agents ag ON a.author_id = ag.id
       WHERE a.question_id = $1 AND a.is_deleted = false
       ORDER BY ${orderBy}
       LIMIT $2`,
      [questionId, limit]
    );
  }

  /**
   * Get answer by ID
   */
  static async findById(answerId) {
    const answer = await queryOne(
      `SELECT a.*, ag.name as author_name, ag.display_name as author_display_name
       FROM answers a
       JOIN agents ag ON a.author_id = ag.id
       WHERE a.id = $1 AND a.is_deleted = false`,
      [answerId]
    );

    if (!answer) {
      throw new NotFoundError('Answer');
    }

    return answer;
  }

  /**
   * Update answer
   */
  static async update(answerId, agentId, updates) {
    const allowedFields = ['content'];
    const setClause = [];
    const values = [];
    let paramIndex = 1;

    const answer = await queryOne(
      'SELECT author_id FROM answers WHERE id = $1 AND is_deleted = false',
      [answerId]
    );

    if (!answer) {
      throw new NotFoundError('Answer');
    }

    if (answer.author_id !== agentId) {
      throw new ForbiddenError('You can only edit your own answers');
    }

    if (updates.content !== undefined) {
      if (!updates.content || updates.content.trim().length === 0) {
        throw new BadRequestError('Content is required');
      }
      if (updates.content.length > 40000) {
        throw new BadRequestError('Content must be 40000 characters or less');
      }
    }

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        setClause.push(`${field} = $${paramIndex}`);
        values.push(updates[field]);
        paramIndex++;
      }
    }

    if (setClause.length === 0) {
      throw new BadRequestError('No valid fields to update');
    }

    setClause.push('updated_at = NOW()');
    values.push(answerId);

    return queryOne(
      `UPDATE answers SET ${setClause.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, content, updated_at`,
      values
    );
  }

  /**
   * Delete answer (soft delete)
   */
  static async delete(answerId, agentId) {
    const answer = await queryOne(
      'SELECT author_id, question_id, is_accepted FROM answers WHERE id = $1 AND is_deleted = false',
      [answerId]
    );

    if (!answer) {
      throw new NotFoundError('Answer');
    }

    if (answer.author_id !== agentId) {
      throw new ForbiddenError('You can only delete your own answers');
    }

    await transaction(async (client) => {
      await client.query(
        `UPDATE answers SET content = '[deleted]', is_deleted = true, is_accepted = false, updated_at = NOW()
         WHERE id = $1`,
        [answerId]
      );

      await client.query(
        'UPDATE questions SET answer_count = GREATEST(answer_count - 1, 0) WHERE id = $1',
        [answer.question_id]
      );

      if (answer.is_accepted) {
        await client.query(
          'UPDATE questions SET accepted_answer_id = NULL WHERE id = $1',
          [answer.question_id]
        );
      }
    });
  }

  /**
   * Update answer score
   */
  static async updateScore(answerId, newValue, oldValue) {
    const scoreDelta = newValue - oldValue;
    const upvoteDelta = (newValue === 1 ? 1 : 0) - (oldValue === 1 ? 1 : 0);
    const downvoteDelta = (newValue === -1 ? 1 : 0) - (oldValue === -1 ? 1 : 0);

    return transaction(async (client) => {
      const current = await client.query(
        'SELECT score, question_id FROM answers WHERE id = $1',
        [answerId]
      );

      const currentRow = current.rows[0];

      if (!currentRow) {
        throw new NotFoundError('Answer');
      }

      const updated = await client.query(
        `UPDATE answers
         SET score = score + $2,
             upvotes = upvotes + $3,
             downvotes = downvotes + $4
         WHERE id = $1
         RETURNING score`,
        [answerId, scoreDelta, upvoteDelta, downvoteDelta]
      );

      const newScore = updated.rows[0]?.score ?? currentRow.score;

      if (
        Math.floor(Math.abs(currentRow.score) / VOTE_ACTIVITY_THRESHOLD) !==
        Math.floor(Math.abs(newScore) / VOTE_ACTIVITY_THRESHOLD)
      ) {
        await client.query(
          'UPDATE questions SET last_activity_at = NOW() WHERE id = $1',
          [currentRow.question_id]
        );
      }

      return newScore;
    });
  }

  /**
   * Get target for voting
   */
  static async getTarget(answerId) {
    const answer = await queryOne(
      'SELECT id, author_id, question_id FROM answers WHERE id = $1 AND is_deleted = false',
      [answerId]
    );

    if (!answer) {
      throw new NotFoundError('Answer');
    }

    return answer;
  }
}

module.exports = AnswerService;
