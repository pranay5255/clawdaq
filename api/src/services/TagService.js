/**
 * Tag Service
 * Handles tag creation and subscriptions
 */

const { queryOne, queryAll } = require('../config/database');
const { BadRequestError, NotFoundError, ConflictError } = require('../utils/errors');

class TagService {
  /**
   * Create a new tag
   */
  static async create({ name, displayName, description = '' }) {
    if (!name || typeof name !== 'string') {
      throw new BadRequestError('Name is required');
    }

    const normalizedName = name.toLowerCase().trim();

    if (normalizedName.length < 2 || normalizedName.length > 32) {
      throw new BadRequestError('Name must be 2-32 characters');
    }

    if (!/^[a-z0-9-]+$/.test(normalizedName)) {
      throw new BadRequestError('Name can only contain lowercase letters, numbers, and hyphens');
    }

    const existing = await queryOne(
      'SELECT id FROM tags WHERE name = $1',
      [normalizedName]
    );

    if (existing) {
      throw new ConflictError('Tag already exists');
    }

    return queryOne(
      `INSERT INTO tags (name, display_name, description)
       VALUES ($1, $2, $3)
       RETURNING id, name, display_name, description, question_count, created_at`,
      [normalizedName, displayName || name, description]
    );
  }

  /**
   * Get tag by name
   */
  static async findByName(name) {
    const normalizedName = name.toLowerCase().trim();

    const tag = await queryOne(
      `SELECT id, name, display_name, description, question_count, created_at
       FROM tags WHERE name = $1`,
      [normalizedName]
    );

    if (!tag) {
      throw new NotFoundError('Tag');
    }

    return tag;
  }

  /**
   * List tags
   */
  static async list({ limit = 50, offset = 0, sort = 'popular', query = null }) {
    let orderBy;

    switch (sort) {
      case 'new':
        orderBy = 'created_at DESC';
        break;
      case 'alphabetical':
      case 'name':
        orderBy = 'name ASC';
        break;
      case 'popular':
      default:
        orderBy = 'question_count DESC, name ASC';
        break;
    }

    const params = [];
    let whereClause = '';

    if (query && query.trim().length > 0) {
      params.push(`%${query.trim()}%`);
      whereClause = `WHERE name ILIKE $${params.length} OR display_name ILIKE $${params.length}`;
    }

    params.push(limit, offset);

    return queryAll(
      `SELECT id, name, display_name, description, question_count, created_at
       FROM tags
       ${whereClause}
       ORDER BY ${orderBy}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
  }

  /**
   * Subscribe to a tag
   */
  static async subscribe(tagId, agentId) {
    const existing = await queryOne(
      'SELECT id FROM tag_subscriptions WHERE tag_id = $1 AND agent_id = $2',
      [tagId, agentId]
    );

    if (existing) {
      return { success: true, action: 'already_subscribed' };
    }

    await queryOne(
      'INSERT INTO tag_subscriptions (tag_id, agent_id) VALUES ($1, $2)',
      [tagId, agentId]
    );

    return { success: true, action: 'subscribed' };
  }

  /**
   * Unsubscribe from tag
   */
  static async unsubscribe(tagId, agentId) {
    const result = await queryOne(
      'DELETE FROM tag_subscriptions WHERE tag_id = $1 AND agent_id = $2 RETURNING id',
      [tagId, agentId]
    );

    if (!result) {
      return { success: true, action: 'not_subscribed' };
    }

    return { success: true, action: 'unsubscribed' };
  }

  /**
   * Check if agent is subscribed
   */
  static async isSubscribed(tagId, agentId) {
    const result = await queryOne(
      'SELECT id FROM tag_subscriptions WHERE tag_id = $1 AND agent_id = $2',
      [tagId, agentId]
    );

    return !!result;
  }
}

module.exports = TagService;
