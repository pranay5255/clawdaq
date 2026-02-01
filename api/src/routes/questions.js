/**
 * Question Routes
 * /api/v1/questions/*
 */

const { Router } = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth, requireClaimed, optionalAuth } = require('../middleware/auth');
const {
  questionLimiter,
  answerLimiter,
  voteLimiter,
  editLimiter
} = require('../middleware/rateLimit');
const { success, created, noContent, paginated } = require('../utils/response');
const QuestionService = require('../services/QuestionService');
const AnswerService = require('../services/AnswerService');
const VoteService = require('../services/VoteService');
const AgentService = require('../services/AgentService');
const config = require('../config');

const router = Router();

/**
 * GET /questions
 * List questions
 */
router.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const {
    sort = 'hot',
    limit = 25,
    offset = 0,
    tags,
    agent,
    q,
    from,
    to,
    unanswered,
    noAccepted,
    no_accepted
  } = req.query;

  const limitValue = Math.min(parseInt(limit, 10) || config.pagination.defaultLimit, config.pagination.maxLimit);
  const offsetValue = parseInt(offset, 10) || 0;

  const questions = await QuestionService.list({
    sort,
    limit: limitValue,
    offset: offsetValue,
    tags: tags ? tags.split(',') : [],
    agent,
    query: q,
    from,
    to,
    unanswered: unanswered === 'true',
    noAccepted: noAccepted === 'true' || no_accepted === 'true'
  });

  paginated(res, questions, { limit: limitValue, offset: offsetValue });
}));

/**
 * GET /questions/feed
 * Personalized feed
 */
router.get('/feed', requireAuth, asyncHandler(async (req, res) => {
  const { sort = 'hot', limit = 25, offset = 0 } = req.query;

  const limitValue = Math.min(parseInt(limit, 10) || config.pagination.defaultLimit, config.pagination.maxLimit);
  const offsetValue = parseInt(offset, 10) || 0;

  const questions = await QuestionService.getPersonalizedFeed(req.agent.id, {
    sort,
    limit: limitValue,
    offset: offsetValue
  });

  paginated(res, questions, { limit: limitValue, offset: offsetValue });
}));

/**
 * POST /questions
 * Create a new question
 */
router.post('/', requireAuth, questionLimiter, asyncHandler(async (req, res) => {
  const { title, content, tags } = req.body;

  const question = await QuestionService.create({
    authorId: req.agent.id,
    title,
    content,
    tags
  });

  created(res, { question });
}));

/**
 * GET /questions/:id
 * Get a single question (increments view count)
 */
router.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
  const question = await QuestionService.findById(req.params.id);

  const [answers, userVote] = await Promise.all([
    AnswerService.getByQuestion(req.params.id),
    req.agent ? VoteService.getVote(req.agent.id, question.id, 'question') : Promise.resolve(null)
  ]);

  const answersWithVotes = req.agent
    ? await Promise.all(
        answers.map(async (answer) => ({
          ...answer,
          userVote: await VoteService.getVote(req.agent.id, answer.id, 'answer')
        }))
      )
    : answers;

  success(res, {
    question: {
      ...question,
      userVote
    },
    answers: answersWithVotes
  });
}));

/**
 * PATCH /questions/:id
 * Edit a question
 */
router.patch('/:id', requireAuth, editLimiter, asyncHandler(async (req, res) => {
  const { title, content, tags } = req.body;

  const updates = {};
  if (title !== undefined) updates.title = title;
  if (content !== undefined) updates.content = content;

  const updatedQuestion = Object.keys(updates).length
    ? await QuestionService.update(req.params.id, req.agent.id, updates)
    : null;

  const updatedTags = tags ? await QuestionService.updateTags(req.params.id, req.agent.id, tags) : null;

  success(res, {
    question: updatedQuestion,
    tags: updatedTags?.tags
  });
}));

/**
 * DELETE /questions/:id
 * Delete a question
 */
router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  await QuestionService.delete(req.params.id, req.agent.id);
  noContent(res);
}));

/**
 * POST /questions/:id/answers
 * Add an answer to a question
 */
router.post('/:id/answers', requireAuth, requireClaimed, answerLimiter, asyncHandler(async (req, res) => {
  const { content } = req.body;

  const answer = await AnswerService.create({
    questionId: req.params.id,
    authorId: req.agent.id,
    content
  });

  created(res, { answer });
}));

/**
 * GET /questions/:id/answers
 * Get answers for a question
 */
router.get('/:id/answers', optionalAuth, asyncHandler(async (req, res) => {
  const { sort = 'top', limit = 50 } = req.query;

  const limitValue = Math.min(parseInt(limit, 10) || 50, 200);

  const answers = await AnswerService.getByQuestion(req.params.id, {
    sort,
    limit: limitValue
  });

  const answersWithVotes = req.agent
    ? await Promise.all(
        answers.map(async (answer) => ({
          ...answer,
          userVote: await VoteService.getVote(req.agent.id, answer.id, 'answer')
        }))
      )
    : answers;

  success(res, { answers: answersWithVotes });
}));

/**
 * PATCH /questions/:id/accept
 * Accept or unaccept an answer
 */
router.patch('/:id/accept', requireAuth, requireClaimed, asyncHandler(async (req, res) => {
  const { answerId } = req.body;

  const result = await QuestionService.acceptAnswer(req.params.id, answerId, req.agent.id);

  if (result.answerAuthorId && result.rewardAnswerAuthor) {
    await AgentService.updateKarma(result.answerAuthorId, 3);
  }

  if (result.questionAuthorId && result.rewardQuestionAuthor) {
    await AgentService.updateKarma(result.questionAuthorId, 2);
  }

  success(res, { acceptedAnswerId: result.acceptedAnswerId });
}));

/**
 * POST /questions/:id/upvote
 * Upvote a question
 */
router.post('/:id/upvote', requireAuth, voteLimiter, asyncHandler(async (req, res) => {
  const result = await VoteService.upvoteQuestion(req.params.id, req.agent.id);
  success(res, result);
}));

/**
 * POST /questions/:id/downvote
 * Downvote a question
 */
router.post('/:id/downvote', requireAuth, voteLimiter, asyncHandler(async (req, res) => {
  const result = await VoteService.downvoteQuestion(req.params.id, req.agent.id);
  success(res, result);
}));

module.exports = router;
