import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler';
import {
  getPersonalities,
  getPersonality,
  getCurrentPersonality,
  getCurrentPersonalityId,
  setCurrentPersonality,
  savePersonality,
  deletePersonality,
  getGreeting,
} from '../services/clawdbot';
import { parseIntent, getAvailableCommands } from '../services/intent-parser';
import { dispatchAction, executeConfirmedAction } from '../services/action-dispatcher';
import { getMessages, addMessage, clearMessages } from '../stores/clawdbot-conversation';

const router: Router = Router();

// GET /personality/current - getCurrentPersonality (BEFORE /personalities/:id)
router.get('/personality/current', asyncHandler(async (req, res) => {
  const personality = getCurrentPersonality();
  res.json(personality);
}));

// GET /personality/current-id - getCurrentPersonalityId
router.get('/personality/current-id', asyncHandler(async (req, res) => {
  const id = getCurrentPersonalityId();
  res.json(id);
}));

// PUT /personality/current - setCurrentPersonality
router.put('/personality/current', asyncHandler(async (req, res) => {
  const { id } = req.body;
  const result = setCurrentPersonality(id);
  res.json(result);
}));

// GET /personalities - getPersonalities
router.get('/personalities', asyncHandler(async (req, res) => {
  const personalities = getPersonalities();
  res.json(personalities);
}));

// GET /personalities/:id - getPersonality
router.get('/personalities/:id', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const personality = getPersonality(id);
  res.json(personality);
}));

// POST /personalities - savePersonality
router.post('/personalities', asyncHandler(async (req, res) => {
  const personality = req.body;
  const result = savePersonality(personality);
  res.json(result);
}));

// DELETE /personalities/:id - deletePersonality
router.delete('/personalities/:id', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const result = deletePersonality(id);
  res.json(result);
}));

// GET /greeting - getGreeting
router.get('/greeting', asyncHandler(async (req, res) => {
  const greeting = getGreeting();
  res.json(greeting);
}));

// POST /parse-intent - parseIntent
router.post('/parse-intent', asyncHandler(async (req, res) => {
  const { text } = req.body;
  const intent = parseIntent(text);
  res.json(intent);
}));

// POST /dispatch-action - dispatchAction
router.post('/dispatch-action', asyncHandler(async (req, res) => {
  const { intent, context } = req.body;
  const result = await dispatchAction(intent, context);
  res.json(result);
}));

// POST /execute-confirmed - executeConfirmedAction
router.post('/execute-confirmed', asyncHandler(async (req, res) => {
  const { confirmationMessage } = req.body;
  const result = await executeConfirmedAction(confirmationMessage);
  res.json(result);
}));

// GET /commands - getAvailableCommands
router.get('/commands', asyncHandler(async (req, res) => {
  const commands = getAvailableCommands();
  res.json(commands);
}));

// GET /messages - getMessages
router.get('/messages', asyncHandler(async (req, res) => {
  const messages = getMessages();
  res.json(messages);
}));

// POST /messages - addMessage
router.post('/messages', asyncHandler(async (req, res) => {
  const message = req.body;
  const result = addMessage(message);
  res.json(result);
}));

// DELETE /messages - clearMessages
router.delete('/messages', asyncHandler(async (req, res) => {
  clearMessages();
  res.json({ success: true });
}));

export default router;
