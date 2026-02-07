import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler';
import {
  getProjects,
  addProject,
  removeProject,
  refreshProjects,
  discoverGitRepos,
} from '../services/projects';
import {
  isValidGitUrl,
  cloneRepository,
  detectSetupCommands,
  runSetupCommands,
  getProjectsDirectory,
  getRepoInfo,
} from '../services/git-clone';
import { setSetting } from '../services/settings';

const router: Router = Router();

// GET / - listProjects
router.get('/', asyncHandler(async (req, res) => {
  const projects = getProjects();
  res.json(projects);
}));

// POST / - addProject
router.post('/', asyncHandler(async (req, res) => {
  const { path } = req.body;
  const project = await addProject(path);
  res.json(project);
}));

// DELETE /:id - removeProject
router.delete('/:id', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  removeProject(id);
  res.json({ success: true });
}));

// POST /refresh - refreshProjects
router.post('/refresh', asyncHandler(async (req, res) => {
  const projects = await refreshProjects();
  res.json(projects);
}));

// POST /discover - discoverProjects
router.post('/discover', asyncHandler(async (req, res) => {
  const discovered = await discoverGitRepos();
  res.json(discovered);
}));

// POST /clone - cloneFromGit
router.post('/clone', asyncHandler(async (req, res) => {
  const options = req.body;
  if (!options?.repoUrl || !isValidGitUrl(options.repoUrl)) {
    res.status(400).json({ success: false, error: 'Invalid git URL' });
    return;
  }
  const cloneResult = await cloneRepository(options);
  if (!cloneResult.success || !cloneResult.projectPath) {
    res.json({ success: false, cloneResult, error: cloneResult.error || 'Clone failed' });
    return;
  }
  // Add the cloned project to our projects list
  try {
    const project = await addProject(cloneResult.projectPath);
    res.json({ success: true, project, cloneResult });
  } catch (err) {
    res.json({
      success: false,
      cloneResult,
      error: err instanceof Error ? err.message : 'Failed to add project',
    });
  }
}));

// POST /detect-setup - detectProjectSetup
router.post('/detect-setup', asyncHandler(async (req, res) => {
  const { projectPath } = req.body;
  if (!projectPath || typeof projectPath !== 'string') {
    res.status(400).json({ error: 'Invalid project path' });
    return;
  }
  const commands = await detectSetupCommands(projectPath);
  res.json(commands);
}));

// POST /run-setup - runProjectSetup
router.post('/run-setup', asyncHandler(async (req, res) => {
  const { projectPath, commands } = req.body;
  if (!projectPath || typeof projectPath !== 'string') {
    res.status(400).json({ error: 'Invalid project path' });
    return;
  }
  if (!Array.isArray(commands)) {
    res.status(400).json({ error: 'Commands must be an array' });
    return;
  }
  const result = await runSetupCommands(projectPath, commands);
  res.json(result);
}));

// GET /directory - getProjectsDirectory
router.get('/directory', asyncHandler(async (req, res) => {
  const directory = getProjectsDirectory();
  res.json(directory);
}));

// PUT /directory - setProjectsDirectory
router.put('/directory', asyncHandler(async (req, res) => {
  const { dir } = req.body;
  if (!dir || typeof dir !== 'string') {
    res.status(400).json({ error: 'Invalid directory path' });
    return;
  }
  setSetting('projectsDirectory', dir);
  res.json({ success: true });
}));

// POST /repo-info - getRepoInfo
router.post('/repo-info', asyncHandler(async (req, res) => {
  const { repoUrl } = req.body;
  if (!repoUrl || typeof repoUrl !== 'string') {
    res.status(400).json({ error: 'Invalid repository URL' });
    return;
  }
  const info = await getRepoInfo(repoUrl);
  res.json(info);
}));

// POST /validate-url - isValidGitUrl
router.post('/validate-url', asyncHandler(async (req, res) => {
  const { url } = req.body;
  const valid = isValidGitUrl(url);
  res.json(valid);
}));

export default router;
