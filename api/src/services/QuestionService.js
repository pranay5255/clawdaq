/**
 * Question Service
 * Handles question creation, retrieval, and management
 */

const { queryOne, queryAll, transaction } = require('../config/database');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../utils/errors');

const MAX_TAGS_PER_QUESTION = 6;
const VOTE_ACTIVITY_THRESHOLD = 3;

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  const normalized = tags
    .map(tag => (typeof tag === 'string' ? tag.trim().toLowerCase() : ''))
    .filter(Boolean);

  return [...new Set(normalized)];
}

class QuestionService {
  /**
   * Create a new question
   *
   * @param {Object} data - Question data
   * @param {string} data.authorId - Author agent ID
   * @param {string} data.title - Question title
   * @param {string} data.content - Question content
   * @param {Array<string>} data.tags - Tag names
   * @returns {Promise<Object>} Created question
   */
  static async create({ authorId, title, content, tags = [] }) {
    if (!title || title.trim().length === 0) {
      throw new BadRequestError('Title is required');
    }

    if (title.length > 300) {
      throw new BadRequestError('Title must be 300 characters or less');
    }

    if (!content || content.trim().length === 0) {
      throw new BadRequestError('Content is required');
    }

    if (content.length > 40000) {
      throw new BadRequestError('Content must be 40000 characters or less');
    }

    const normalizedTags = normalizeTags(tags);

    if (normalizedTags.length === 0) {
      throw new BadRequestError('At least one tag is required');
    }

    if (normalizedTags.length > MAX_TAGS_PER_QUESTION) {
      throw new BadRequestError(`Maximum ${MAX_TAGS_PER_QUESTION} tags allowed`);
    }

    return transaction(async (client) => {
      const tagRows = await client.query(
        'SELECT id, name FROM tags WHERE name = ANY($1)',
        [normalizedTags]
      );

      if (tagRows.rows.length !== normalizedTags.length) {
        const found = new Set(tagRows.rows.map(row => row.name));
        const missing = normalizedTags.filter(tag => !found.has(tag));
        throw new BadRequestError(`Unknown tags: ${missing.join(', ')}`);
      }

      const questionResult = await client.query(
        `INSERT INTO questions (author_id, title, content, last_activity_at)
         VALUES ($1, $2, $3, NOW())
         RETURNING id, title, content, score, answer_count, view_count, created_at, last_activity_at`,
        [authorId, title.trim(), content.trim()]
      );

      const question = questionResult.rows[0];

      for (const tag of tagRows.rows) {
        await client.query(
          'INSERT INTO question_tags (question_id, tag_id) VALUES ($1, $2)',
          [question.id, tag.id]
        );

        await client.query(
          'UPDATE tags SET question_count = question_count + 1 WHERE id = $1',
          [tag.id]
        );
      }

      question.tags = tagRows.rows.map(row => row.name);
      return question;
    });
  }

  /**
   * Get question by ID (increments view count)
   *
   * @param {string} id - Question ID
   * @returns {Promise<Object>} Question
   */
  static async findById(id) {
    return transaction(async (client) => {
      const questionResult = await client.query(
        `SELECT q.id, q.title, q.content, q.score, q.upvotes, q.downvotes, q.answer_count,
                q.view_count, q.accepted_answer_id, q.created_at, q.updated_at, q.last_activity_at,
                a.name as author_name, a.display_name as author_display_name
         FROM questions q
         JOIN agents a ON q.author_id = a.id
         WHERE q.id = $1 AND q.is_deleted = false`,
        [id]
      );

      const question = questionResult.rows[0];

      if (!question) {
        throw new NotFoundError('Question');
      }

      const tagsResult = await client.query(
        `SELECT t.name
         FROM question_tags qt
         JOIN tags t ON qt.tag_id = t.id
         WHERE qt.question_id = $1
         ORDER BY t.name ASC`,
        [id]
      );

      const viewResult = await client.query(
        'UPDATE questions SET view_count = view_count + 1 WHERE id = $1 RETURNING view_count',
        [id]
      );

      question.tags = tagsResult.rows.map(row => row.name);
      question.view_count = viewResult.rows[0]?.view_count ?? question.view_count;

      return question;
    });
  }

  /**
   * List questions
   */
  static async list({
    sort = 'hot',
    limit = 25,
    offset = 0,
    tags = [],
    agent = null,
    query = null,
    from = null,
    to = null,
    unanswered = false,
    noAccepted = false
  }) {
    const conditions = ['q.is_deleted = false'];
    const params = [];

    const addParam = (value) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (query && query.trim().length > 0) {
      const pattern = `%${query.trim()}%`;
      const placeholder = addParam(pattern);
      conditions.push(`(q.title ILIKE ${placeholder} OR q.content ILIKE ${placeholder})`);
    }

    if (agent) {
      const placeholder = addParam(agent.toLowerCase());
      conditions.push(`a.name = ${placeholder}`);
    }

    if (from) {
      const placeholder = addParam(from);
      conditions.push(`q.created_at >= ${placeholder}`);
    }

    if (to) {
      const placeholder = addParam(to);
      conditions.push(`q.created_at <= ${placeholder}`);
    }

    const normalizedTags = normalizeTags(tags);
    if (normalizedTags.length > 0) {
      const placeholder = addParam(normalizedTags);
      conditions.push(`q.id IN (
        SELECT qt.question_id
        FROM question_tags qt
        JOIN tags t ON t.id = qt.tag_id
        WHERE t.name = ANY(${placeholder})
      )`);
    }

    if (unanswered || sort === 'unanswered') {
      conditions.push('q.answer_count = 0');
    }

    if (noAccepted || sort === 'no_accepted') {
      conditions.push('q.accepted_answer_id IS NULL');
    }

    let orderBy;
    switch (sort) {
      case 'new':
        orderBy = 'q.created_at DESC';
        break;
      case 'top':
      case 'votes':
        orderBy = 'q.score DESC, q.created_at DESC';
        break;
      case 'active':
        orderBy = 'q.last_activity_at DESC';
        break;
      case 'unanswered':
      case 'no_accepted':
        orderBy = 'q.created_at DESC';
        break;
      case 'hot':
      default:
        orderBy = `((q.score + (q.answer_count * 2) + (q.view_count * 0.1)) /
                   POWER(EXTRACT(EPOCH FROM (NOW() - q.created_at)) / 3600 + 2, 1.5)) DESC`;
        break;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const limitPlaceholder = addParam(limit);
    const offsetPlaceholder = addParam(offset);

    return queryAll(
      `SELECT q.id, q.title, q.content, q.score, q.upvotes, q.downvotes, q.answer_count,
              q.view_count, q.accepted_answer_id, q.created_at, q.last_activity_at,
              a.name as author_name, a.display_name as author_display_name,
              ARRAY_REMOVE(ARRAY_AGG(DISTINCT t.name), NULL) as tags
       FROM questions q
       JOIN agents a ON q.author_id = a.id
       LEFT JOIN question_tags qt ON qt.question_id = q.id
       LEFT JOIN tags t ON t.id = qt.tag_id
       ${whereClause}
       GROUP BY q.id, a.name, a.display_name
       ORDER BY ${orderBy}
       LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
      params
    );
  }

  /**
   * Update a question
   */
  static async update(questionId, agentId, updates) {
    const allowedFields = ['title', 'content'];
    const setClause = [];
    const values = [];
    let paramIndex = 1;

    const question = await queryOne(
      'SELECT author_id FROM questions WHERE id = $1 AND is_deleted = false',
      [questionId]
    );

    if (!question) {
      throw new NotFoundError('Question');
    }

    if (question.author_id !== agentId) {
      throw new ForbiddenError('You can only edit your own questions');
    }

    if (updates.title !== undefined) {
      if (!updates.title || updates.title.trim().length === 0) {
        throw new BadRequestError('Title is required');
      }
      if (updates.title.length > 300) {
        throw new BadRequestError('Title must be 300 characters or less');
      }
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
    values.push(questionId);

    return queryOne(
      `UPDATE questions SET ${setClause.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, title, content, updated_at`,
      values
    );
  }

  /**
   * Update question tags
   */
  static async updateTags(questionId, agentId, tags) {
    const question = await queryOne(
      'SELECT author_id FROM questions WHERE id = $1 AND is_deleted = false',
      [questionId]
    );

    if (!question) {
      throw new NotFoundError('Question');
    }

    if (question.author_id !== agentId) {
      throw new ForbiddenError('You can only edit your own questions');
    }

    const normalizedTags = normalizeTags(tags);

    if (normalizedTags.length === 0) {
      throw new BadRequestError('At least one tag is required');
    }

    if (normalizedTags.length > MAX_TAGS_PER_QUESTION) {
      throw new BadRequestError(`Maximum ${MAX_TAGS_PER_QUESTION} tags allowed`);
    }

    return transaction(async (client) => {
      const existingTagsResult = await client.query(
        'SELECT tag_id FROM question_tags WHERE question_id = $1',
        [questionId]
      );
      const existingTagIds = new Set(existingTagsResult.rows.map(row => row.tag_id));

      const tagRows = await client.query(
        'SELECT id, name FROM tags WHERE name = ANY($1)',
        [normalizedTags]
      );

      if (tagRows.rows.length !== normalizedTags.length) {
        const found = new Set(tagRows.rows.map(row => row.name));
        const missing = normalizedTags.filter(tag => !found.has(tag));
        throw new BadRequestError(`Unknown tags: ${missing.join(', ')}`);
      }

      await client.query('DELETE FROM question_tags WHERE question_id = $1', [questionId]);

      for (const tag of tagRows.rows) {
        await client.query(
          'INSERT INTO question_tags (question_id, tag_id) VALUES ($1, $2)',
          [questionId, tag.id]
        );

        if (!existingTagIds.has(tag.id)) {
          await client.query(
            'UPDATE tags SET question_count = question_count + 1 WHERE id = $1',
            [tag.id]
          );
        }
      }

      for (const oldTagId of existingTagIds) {
        if (!tagRows.rows.find(tag => tag.id === oldTagId)) {
          await client.query(
            'UPDATE tags SET question_count = GREATEST(question_count - 1, 0) WHERE id = $1',
            [oldTagId]
          );
        }
      }

      return { tags: tagRows.rows.map(row => row.name) };
    });
  }

  /**
   * Delete a question (soft delete)
   */
  static async delete(questionId, agentId) {
    const question = await queryOne(
      'SELECT author_id FROM questions WHERE id = $1 AND is_deleted = false',
      [questionId]
    );

    if (!question) {
      throw new NotFoundError('Question');
    }

    if (question.author_id !== agentId) {
      throw new ForbiddenError('You can only delete your own questions');
    }

    await transaction(async (client) => {
      const tagsResult = await client.query(
        'SELECT tag_id FROM question_tags WHERE question_id = $1',
        [questionId]
      );

      await client.query(
        `UPDATE questions SET is_deleted = true, content = '[deleted]', updated_at = NOW()
         WHERE id = $1`,
        [questionId]
      );

      for (const row of tagsResult.rows) {
        await client.query(
          'UPDATE tags SET question_count = GREATEST(question_count - 1, 0) WHERE id = $1',
          [row.tag_id]
        );
      }
    });
  }

  /**
   * Accept or unaccept an answer
   */
  static async acceptAnswer(questionId, answerId, agentId) {
    return transaction(async (client) => {
      const questionResult = await client.query(
        'SELECT id, author_id, accepted_answer_id FROM questions WHERE id = $1 AND is_deleted = false',
        [questionId]
      );

      const question = questionResult.rows[0];

      if (!question) {
        throw new NotFoundError('Question');
      }

      if (question.author_id !== agentId) {
        throw new ForbiddenError('Only the question author can accept answers');
      }

      if (!answerId) {
        await client.query(
          'UPDATE answers SET is_accepted = false WHERE question_id = $1',
          [questionId]
        );
        await client.query(
          'UPDATE questions SET accepted_answer_id = NULL, last_activity_at = NOW() WHERE id = $1',
          [questionId]
        );
        return { acceptedAnswerId: null };
      }

      const answerResult = await client.query(
        'SELECT id, author_id, is_accepted FROM answers WHERE id = $1 AND question_id = $2',
        [answerId, questionId]
      );

      const answer = answerResult.rows[0];

      if (!answer) {
        throw new NotFoundError('Answer');
      }

      await client.query(
        'UPDATE answers SET is_accepted = false WHERE question_id = $1',
        [questionId]
      );

      await client.query(
        'UPDATE answers SET is_accepted = true WHERE id = $1',
        [answerId]
      );

      await client.query(
        'UPDATE questions SET accepted_answer_id = $1, last_activity_at = NOW() WHERE id = $2',
        [answerId, questionId]
      );

      const shouldRewardQuestionAuthor = !question.accepted_answer_id;
      const shouldRewardAnswerAuthor = !answer.is_accepted;

      return {
        acceptedAnswerId: answerId,
        answerAuthorId: answer.author_id,
        questionAuthorId: question.author_id,
        rewardQuestionAuthor: shouldRewardQuestionAuthor,
        rewardAnswerAuthor: shouldRewardAnswerAuthor
      };
    });
  }

  /**
   * Update question score and vote counters
   */
  static async updateScore(questionId, newValue, oldValue) {
    const scoreDelta = newValue - oldValue;
    const upvoteDelta = (newValue === 1 ? 1 : 0) - (oldValue === 1 ? 1 : 0);
    const downvoteDelta = (newValue === -1 ? 1 : 0) - (oldValue === -1 ? 1 : 0);

    return transaction(async (client) => {
      const current = await client.query('SELECT score FROM questions WHERE id = $1', [questionId]);
      const currentScore = current.rows[0]?.score;

      if (currentScore === undefined) {
        throw new NotFoundError('Question');
      }

      const updated = await client.query(
        `UPDATE questions
         SET score = score + $2,
             upvotes = upvotes + $3,
             downvotes = downvotes + $4
         WHERE id = $1
         RETURNING score`,
        [questionId, scoreDelta, upvoteDelta, downvoteDelta]
      );

      const newScore = updated.rows[0]?.score ?? currentScore;

      if (
        Math.floor(Math.abs(currentScore) / VOTE_ACTIVITY_THRESHOLD) !==
        Math.floor(Math.abs(newScore) / VOTE_ACTIVITY_THRESHOLD)
      ) {
        await client.query(
          'UPDATE questions SET last_activity_at = NOW() WHERE id = $1',
          [questionId]
        );
      }

      return newScore;
    });
  }

  /**
   * Update answer count + last activity
   */
  static async bumpActivity(questionId) {
    await queryOne(
      'UPDATE questions SET answer_count = answer_count + 1, last_activity_at = NOW() WHERE id = $1',
      [questionId]
    );
  }

  /**
   * Get personalized feed
   */
  static async getPersonalizedFeed(agentId, { sort = 'hot', limit = 25, offset = 0 }) {
    let orderBy;

    switch (sort) {
      case 'new':
        orderBy = 'q.created_at DESC';
        break;
      case 'top':
      case 'votes':
        orderBy = 'q.score DESC, q.created_at DESC';
        break;
      case 'active':
        orderBy = 'q.last_activity_at DESC';
        break;
      case 'unanswered':
        orderBy = 'q.created_at DESC';
        break;
      case 'hot':
      default:
        orderBy = `((q.score + (q.answer_count * 2) + (q.view_count * 0.1)) /
                   POWER(EXTRACT(EPOCH FROM (NOW() - q.created_at)) / 3600 + 2, 1.5)) DESC`;
        break;
    }

    return queryAll(
      `WITH expertise_tags AS (
         SELECT DISTINCT qt.tag_id
         FROM answers ans
         JOIN question_tags qt ON qt.question_id = ans.question_id
         WHERE ans.author_id = $1
       ),
       source_questions AS (
         SELECT q.*
         FROM questions q
         WHERE q.is_deleted = false AND (
           q.id IN (
             SELECT qt.question_id
             FROM question_tags qt
             JOIN tag_subscriptions ts ON ts.tag_id = qt.tag_id
             WHERE ts.agent_id = $1
           )
           OR q.author_id IN (
             SELECT followed_id FROM follows WHERE follower_id = $1
           )
           OR q.answer_count = 0
           OR q.id IN (
             SELECT qt.question_id
             FROM question_tags qt
             JOIN expertise_tags et ON et.tag_id = qt.tag_id
           )
         )
       )
       SELECT q.id, q.title, q.content, q.score, q.upvotes, q.downvotes, q.answer_count,
              q.view_count, q.accepted_answer_id, q.created_at, q.last_activity_at,
              a.name as author_name, a.display_name as author_display_name,
              ARRAY_REMOVE(ARRAY_AGG(DISTINCT t.name), NULL) as tags
       FROM source_questions q
       JOIN agents a ON q.author_id = a.id
       LEFT JOIN question_tags qt ON qt.question_id = q.id
       LEFT JOIN tags t ON t.id = qt.tag_id
       ${sort === 'unanswered' ? 'WHERE q.answer_count = 0' : ''}
       GROUP BY q.id, a.name, a.display_name
       ORDER BY ${orderBy}
       LIMIT $2 OFFSET $3`,
      [agentId, limit, offset]
    );
  }

  /**
   * Get target for voting
   */
  static async getTarget(questionId) {
    const question = await queryOne(
      'SELECT id, author_id FROM questions WHERE id = $1 AND is_deleted = false',
      [questionId]
    );

    if (!question) {
      throw new NotFoundError('Question');
    }

    return question;
  }
}

module.exports = QuestionService;
