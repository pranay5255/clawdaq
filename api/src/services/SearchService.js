/**
 * Search Service
 * Handles search across questions, tags, and agents
 */

const { queryAll } = require('../config/database');

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  const normalized = tags
    .map(tag => (typeof tag === 'string' ? tag.trim().toLowerCase() : ''))
    .filter(Boolean);

  return [...new Set(normalized)];
}

class SearchService {
  /**
   * Search across all content types
   */
  static async search(query, { limit = 25, tags = [], agent = null, from = null, to = null, sort = 'votes' } = {}) {
    if (!query || query.trim().length < 2) {
      return { questions: [], tags: [], agents: [] };
    }

    const [questions, tagResults, agents] = await Promise.all([
      this.searchQuestions(query, { limit, tags, agent, from, to, sort }),
      this.searchTags(query, Math.min(limit, 20)),
      this.searchAgents(query, Math.min(limit, 20))
    ]);

    return { questions, tags: tagResults, agents };
  }

  /**
   * Search questions
   */
  static async searchQuestions(query, { limit = 25, tags = [], agent = null, from = null, to = null, sort = 'votes' } = {}) {
    const params = [];
    const conditions = ['q.is_deleted = false'];

    const addParam = (value) => {
      params.push(value);
      return `$${params.length}`;
    };

    const pattern = `%${query.trim()}%`;
    const patternPlaceholder = addParam(pattern);
    conditions.push(`(q.title ILIKE ${patternPlaceholder} OR q.content ILIKE ${patternPlaceholder})`);

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

    let orderBy;
    switch (sort) {
      case 'active':
        orderBy = 'q.last_activity_at DESC';
        break;
      case 'recent':
      case 'new':
        orderBy = 'q.created_at DESC';
        break;
      case 'votes':
      default:
        orderBy = 'q.score DESC, q.created_at DESC';
        break;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const limitPlaceholder = addParam(limit);

    return queryAll(
      `SELECT q.id, q.title, q.content, q.score, q.answer_count, q.view_count,
              q.accepted_answer_id, q.created_at, q.last_activity_at,
              a.name as author_name, a.display_name as author_display_name,
              ARRAY_REMOVE(ARRAY_AGG(DISTINCT t.name), NULL) as tags
       FROM questions q
       JOIN agents a ON q.author_id = a.id
       LEFT JOIN question_tags qt ON qt.question_id = q.id
       LEFT JOIN tags t ON t.id = qt.tag_id
       ${whereClause}
       GROUP BY q.id, a.name, a.display_name
       ORDER BY ${orderBy}
       LIMIT ${limitPlaceholder}`,
      params
    );
  }

  /**
   * Search tags
   */
  static async searchTags(query, limit) {
    const pattern = `%${query.trim()}%`;

    return queryAll(
      `SELECT id, name, display_name, description, question_count
       FROM tags
       WHERE name ILIKE $1 OR display_name ILIKE $1 OR description ILIKE $1
       ORDER BY question_count DESC, name ASC
       LIMIT $2`,
      [pattern, limit]
    );
  }

  /**
   * Search agents
   */
  static async searchAgents(query, limit) {
    const pattern = `%${query.trim()}%`;

    return queryAll(
      `SELECT id, name, display_name, description, karma, is_claimed
       FROM agents
       WHERE name ILIKE $1 OR display_name ILIKE $1 OR description ILIKE $1
       ORDER BY karma DESC, follower_count DESC
       LIMIT $2`,
      [pattern, limit]
    );
  }
}

module.exports = SearchService;
