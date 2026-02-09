import { Router } from 'express';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { asyncHandler } from '../middleware/error-handler';
import { getSystemStatus } from '../services/projects';
import { getDebugInfo } from '../services/mode-detection';
import { createLogger } from '../utils/logger';

const log = createLogger('SystemRoutes');

const router: Router = Router();

// GET /status - getSystemStatus
router.get('/status', asyncHandler(async (req, res) => {
  const status = await getSystemStatus();
  res.json(status);
}));

// GET /version - getVersion from package.json
router.get('/version', asyncHandler(async (req, res) => {
  const path = require('path');
  const packagePath = path.join(process.cwd(), 'package.json');
  const { version } = require(packagePath);
  res.json({ version });
}));

// GET /debug - getDebugInfo
router.get('/debug', asyncHandler(async (req, res) => {
  const debugInfo = await getDebugInfo();
  res.json(debugInfo);
}));

// CPU measurement state for delta-based calculation
let prevCpuTimes: { idle: number; total: number } | null = null;
let lastCpuPercent = 0;

function measureCpu(): number {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    const { user, nice, sys, idle: cpuIdle, irq } = cpu.times;
    total += user + nice + sys + cpuIdle + irq;
    idle += cpuIdle;
  }

  if (prevCpuTimes) {
    const idleDelta = idle - prevCpuTimes.idle;
    const totalDelta = total - prevCpuTimes.total;
    if (totalDelta > 0) {
      lastCpuPercent = Math.round(((totalDelta - idleDelta) / totalDelta) * 100);
    }
  }
  prevCpuTimes = { idle, total };
  return lastCpuPercent;
}

// Take initial CPU snapshot so first request has a baseline
measureCpu();

// GET /metrics - system and app metrics for diagnostics bar
router.get('/metrics', asyncHandler(async (_req, res) => {
  const cpuPercent = measureCpu();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  // App memory from process.memoryUsage()
  const appMem = process.memoryUsage();

  res.json({
    system: {
      cpuPercent,
      cpuCores: os.cpus().length,
      memTotal: totalMem,
      memUsed: usedMem,
      memPercent: Math.round((usedMem / totalMem) * 100),
    },
    app: {
      memRss: appMem.rss,
      memHeapUsed: appMem.heapUsed,
      memHeapTotal: appMem.heapTotal,
      uptime: Math.round(process.uptime()),
    },
  });
}));

// GET /claude-usage - lightweight read from stats-cache.json + credentials
// No heavy file scanning — just reads two small JSON files.
let usageCache: { data: any; timestamp: number } | null = null;
const USAGE_CACHE_TTL = 30_000; // 30 second cache

router.get('/claude-usage', asyncHandler(async (_req, res) => {
  const now = Date.now();
  if (usageCache && (now - usageCache.timestamp) < USAGE_CACHE_TTL) {
    return res.json(usageCache.data);
  }

  const homeDir = os.homedir();
  const claudeDir = path.join(homeDir, '.claude');

  // Read credentials for subscription info
  let subscriptionType = 'unknown';
  let rateLimitTier = 'unknown';
  try {
    const credsPath = path.join(claudeDir, '.credentials.json');
    const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
    const oauth = creds.claudeAiOauth || {};
    subscriptionType = oauth.subscriptionType || 'unknown';
    rateLimitTier = oauth.rateLimitTier || 'unknown';
  } catch { /* credentials not found */ }

  // Read stats-cache.json — small file, fast read
  let todayTokens = 0;
  let weekTokens = 0;
  let todayMessages = 0;
  let totalMessages = 0;
  let totalSessions = 0;
  let lastComputedDate = '';

  try {
    const statsPath = path.join(claudeDir, 'stats-cache.json');
    const stats = JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
    lastComputedDate = stats.lastComputedDate || '';
    totalMessages = stats.totalMessages || 0;
    totalSessions = stats.totalSessions || 0;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const weekAgo = new Date(now.getTime() - 7 * 86400000);

    if (stats.dailyModelTokens) {
      for (const day of stats.dailyModelTokens) {
        if (day.date === todayStr) {
          for (const [, tokens] of Object.entries(day.tokensByModel)) {
            todayTokens += tokens as number;
          }
        }
        if (new Date(day.date) >= weekAgo) {
          for (const [, tokens] of Object.entries(day.tokensByModel)) {
            weekTokens += tokens as number;
          }
        }
      }
    }

    if (stats.dailyActivity) {
      for (const day of stats.dailyActivity) {
        if (day.date === todayStr) {
          todayMessages = day.messageCount || 0;
        }
      }
    }
  } catch (err) {
    log.warn('Could not read Claude stats-cache.json:', err);
  }

  // Plan limits (approximate, calibrated against claude.ai/settings/usage)
  const tierLimits: Record<string, { session: number; weekly: number }> = {
    'default_claude_max_5x':   { session: 480_000,  weekly: 7_000_000 },
    'default_claude_max_20x':  { session: 1_920_000, weekly: 28_000_000 },
    'default_claude_pro':      { session: 96_000,    weekly: 1_400_000 },
    'default_claude_team':     { session: 144_000,   weekly: 2_100_000 },
  };
  const limits = tierLimits[rateLimitTier] || { session: 96_000, weekly: 1_400_000 };

  const sessionPercent = limits.session > 0 ? Math.min(100, Math.round((todayTokens / limits.session) * 100)) : 0;
  const weeklyPercent = limits.weekly > 0 ? Math.min(100, Math.round((weekTokens / limits.weekly) * 100)) : 0;

  const data = {
    subscription: subscriptionType,
    rateLimitTier,
    session: {
      tokens: todayTokens,
      messages: todayMessages,
      limit: limits.session,
      percent: sessionPercent,
    },
    week: {
      tokens: weekTokens,
      limit: limits.weekly,
      percent: weeklyPercent,
    },
    totals: { messages: totalMessages, sessions: totalSessions },
    lastUpdated: lastComputedDate,
  };

  usageCache = { data, timestamp: now };
  res.json(data);
}));

export default router;
