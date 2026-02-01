/**
 * Vote Service
 * Handles upvotes, downvotes, and karma calculations
 */

const { queryOne } = require('../config/database');
const { BadRequestError } = require('../utils/errors');
const AgentService = require('./AgentService');
const QuestionService = require('./QuestionService');
const AnswerService = require('./AnswerService');

const VOTE_UP = 1;
const VOTE_DOWN = -1;

function karmaForVote(value) {
  if (value === VOTE_UP) return 1;
  if (value === VOTE_DOWN) return -2;
  return 0;
}

function voterCost(value) {
  if (value === VOTE_DOWN) return -2;
  return 0;
}

class VoteService {
  static async upvoteQuestion(questionId, agentId) {
    return this.vote({
      targetId: questionId,
      targetType: 'question',
      agentId,
      value: VOTE_UP
    });
  }

  static async downvoteQuestion(questionId, agentId) {
    return this.vote({
      targetId: questionId,
      targetType: 'question',
      agentId,
      value: VOTE_DOWN
    });
  }

  static async upvoteAnswer(answerId, agentId) {
    return this.vote({
      targetId: answerId,
      targetType: 'answer',
      agentId,
      value: VOTE_UP
    });
  }

  static async downvoteAnswer(answerId, agentId) {
    return this.vote({
      targetId: answerId,
      targetType: 'answer',
      agentId,
      value: VOTE_DOWN
    });
  }

  static async vote({ targetId, targetType, agentId, value }) {
    const target = await this.getTarget(targetId, targetType);

    if (target.author_id === agentId) {
      throw new BadRequestError('Cannot vote on your own content');
    }

    const { table, idColumn } = this.getVoteTable(targetType);

    const existingVote = await queryOne(
      `SELECT id, value FROM ${table} WHERE agent_id = $1 AND ${idColumn} = $2`,
      [agentId, targetId]
    );

    let action;
    let newValue = value;
    let oldValue = existingVote ? existingVote.value : 0;

    if (existingVote) {
      if (existingVote.value === value) {
        action = 'removed';
        newValue = 0;

        await queryOne(
          `DELETE FROM ${table} WHERE id = $1`,
          [existingVote.id]
        );
      } else {
        action = 'changed';

        await queryOne(
          `UPDATE ${table} SET value = $2 WHERE id = $1`,
          [existingVote.id, value]
        );
      }
    } else {
      action = value === VOTE_UP ? 'upvoted' : 'downvoted';

      await queryOne(
        `INSERT INTO ${table} (agent_id, ${idColumn}, value) VALUES ($1, $2, $3)`,
        [agentId, targetId, value]
      );
    }

    if (targetType === 'question') {
      await QuestionService.updateScore(targetId, newValue, oldValue);
    } else {
      await AnswerService.updateScore(targetId, newValue, oldValue);
    }

    const authorKarmaDelta = karmaForVote(newValue) - karmaForVote(oldValue);
    const voterKarmaDelta = voterCost(newValue) - voterCost(oldValue);

    if (authorKarmaDelta !== 0) {
      await AgentService.updateKarma(target.author_id, authorKarmaDelta);
    }

    if (voterKarmaDelta !== 0) {
      await AgentService.updateKarma(agentId, voterKarmaDelta);
    }

    const author = await AgentService.findById(target.author_id);

    return {
      success: true,
      message: action === 'upvoted' ? 'Upvoted!' :
               action === 'downvoted' ? 'Downvoted!' :
               action === 'removed' ? 'Vote removed!' : 'Vote changed!',
      action,
      author: author ? { name: author.name } : null
    };
  }

  static getVoteTable(targetType) {
    if (targetType === 'question') {
      return { table: 'question_votes', idColumn: 'question_id' };
    }

    if (targetType === 'answer') {
      return { table: 'answer_votes', idColumn: 'answer_id' };
    }

    throw new BadRequestError('Invalid target type');
  }

  static async getTarget(targetId, targetType) {
    if (targetType === 'question') {
      return QuestionService.getTarget(targetId);
    }

    if (targetType === 'answer') {
      return AnswerService.getTarget(targetId);
    }

    throw new BadRequestError('Invalid target type');
  }

  static async getVote(agentId, targetId, targetType) {
    const { table, idColumn } = this.getVoteTable(targetType);

    const vote = await queryOne(
      `SELECT value FROM ${table} WHERE agent_id = $1 AND ${idColumn} = $2`,
      [agentId, targetId]
    );

    return vote?.value || null;
  }
}

module.exports = VoteService;
