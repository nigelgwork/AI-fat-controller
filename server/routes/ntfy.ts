import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler';
import {
  getNtfyConfig,
  setNtfyConfig,
  sendNotification,
  getPendingQuestions,
  askQuestion,
  answerQuestion,
  startPolling,
  stopPolling,
  testNtfyConnection,
} from '../services/ntfy';
import { handleNtfyMessage } from '../services/ntfy-commands';
import {
  startStatusReporter,
  stopStatusReporter,
  restartStatusReporter,
} from '../services/status-reporter';

const router: Router = Router();

// GET /config - getNtfyConfig
router.get('/config', asyncHandler(async (req, res) => {
  const config = getNtfyConfig();
  res.json(config);
}));

// PUT /config - setNtfyConfig
router.put('/config', asyncHandler(async (req, res) => {
  const config = setNtfyConfig(req.body);
  res.json(config);
}));

// POST /notify - sendNotification
router.post('/notify', asyncHandler(async (req, res) => {
  const { title, message, options } = req.body;
  const result = await sendNotification(title, message, options);
  res.json({ success: result });
}));

// GET /questions - getPendingQuestions
router.get('/questions', asyncHandler(async (req, res) => {
  const questions = getPendingQuestions();
  res.json(questions);
}));

// POST /questions - askQuestion
router.post('/questions', asyncHandler(async (req, res) => {
  const { question, taskId, taskTitle, options } = req.body;
  const result = await askQuestion(question, taskId, taskTitle, options);
  res.json(result);
}));

// PUT /questions/:id - answerQuestion
router.put('/questions/:id', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const { answer } = req.body;
  const result = answerQuestion(id, answer);
  res.json(result);
}));

// POST /polling/start - startPolling
router.post('/polling/start', asyncHandler(async (req, res) => {
  startPolling();
  res.json({ success: true });
}));

// POST /polling/stop - stopPolling
router.post('/polling/stop', asyncHandler(async (req, res) => {
  stopPolling();
  res.json({ success: true });
}));

// POST /test - testNtfyConnection
router.post('/test', asyncHandler(async (req, res) => {
  const result = await testNtfyConnection();
  res.json(result);
}));

// POST /command - handleNtfyMessage
router.post('/command', asyncHandler(async (req, res) => {
  const { message } = req.body;
  const result = await handleNtfyMessage(message);
  res.json(result);
}));

// POST /status-reporter/start - startStatusReporter
router.post('/status-reporter/start', asyncHandler(async (req, res) => {
  startStatusReporter();
  res.json({ success: true });
}));

// POST /status-reporter/stop - stopStatusReporter
router.post('/status-reporter/stop', asyncHandler(async (req, res) => {
  stopStatusReporter();
  res.json({ success: true });
}));

// POST /status-reporter/restart - restartStatusReporter
router.post('/status-reporter/restart', asyncHandler(async (req, res) => {
  restartStatusReporter();
  res.json({ success: true });
}));

export default router;
