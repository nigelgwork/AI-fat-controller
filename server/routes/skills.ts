import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler';
import {
  listSkills,
  getSkill,
  createSkill,
  updateSkill,
  deleteSkill,
  copySkillToWindows,
  copySkillToWsl,
} from '../services/claude-skills';

const router: Router = Router();

// GET / - list all skills
router.get('/', asyncHandler(async (_req, res) => {
  const skills = await listSkills();
  res.json(skills);
}));

// GET /:id - get a specific skill
router.get('/:id', asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const skill = await getSkill(id);
  if (!skill) {
    res.status(404).json({ error: 'Skill not found' });
    return;
  }
  res.json(skill);
}));

// POST / - create a new skill
router.post('/', asyncHandler(async (req, res) => {
  const skill = await createSkill(req.body);
  res.json(skill);
}));

// PUT /:id - update a skill
router.put('/:id', asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const skill = await updateSkill(id, req.body);
  res.json(skill);
}));

// DELETE /:id - delete a skill
router.delete('/:id', asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  await deleteSkill(id);
  res.json({ success: true });
}));

// POST /:id/copy-windows - copy skill to Windows
router.post('/:id/copy-windows', asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const skill = await copySkillToWindows(id);
  res.json(skill);
}));

// POST /:id/copy-wsl - copy skill to WSL
router.post('/:id/copy-wsl', asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const skill = await copySkillToWsl(id);
  res.json(skill);
}));

export default router;
