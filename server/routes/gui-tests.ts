import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler';
import {
  listTestScenarios,
  getTestScenario,
  createTestScenario,
  updateTestScenario,
  deleteTestScenario,
  runTestScenario,
  getTestResults,
  generateTestScenario,
} from '../services/gui-testing';

const router: Router = Router();

// POST /generate - generateTestScenario (BEFORE /:id)
router.post('/generate', asyncHandler(async (req, res) => {
  const { description, appName } = req.body;
  const result = await generateTestScenario(description, appName);
  res.json(result);
}));

// GET / - listTestScenarios
router.get('/', asyncHandler(async (req, res) => {
  const result = listTestScenarios();
  res.json(result);
}));

// GET /:id - getTestScenario
router.get('/:id', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const result = getTestScenario(id);
  res.json(result);
}));

// POST / - createTestScenario
router.post('/', asyncHandler(async (req, res) => {
  const scenario = req.body;
  const result = createTestScenario(scenario);
  res.json(result);
}));

// PUT /:id - updateTestScenario
router.put('/:id', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const updates = req.body;
  const result = updateTestScenario(id, updates);
  res.json(result);
}));

// DELETE /:id - deleteTestScenario
router.delete('/:id', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const result = deleteTestScenario(id);
  res.json({ success: result });
}));

// POST /:id/run - runTestScenario
router.post('/:id/run', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const scenario = getTestScenario(id);
  if (!scenario) {
    res.status(404).json({ error: `Test scenario not found: ${id}` });
    return;
  }
  const result = await runTestScenario(scenario);
  res.json(result);
}));

// POST /:id/run-with-config - runTestScenario with config
router.post('/:id/run-with-config', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const config = req.body;
  const scenario = getTestScenario(id);
  if (!scenario) {
    res.status(404).json({ error: `Test scenario not found: ${id}` });
    return;
  }
  const result = await runTestScenario(scenario, config);
  res.json(result);
}));

// GET /:id/results - getTestResults
router.get('/:id/results', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const result = getTestResults(id, limit);
  res.json(result);
}));

export default router;
