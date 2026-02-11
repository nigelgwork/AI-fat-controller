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

// GET /version - getVersion from package.json or APP_VERSION env
router.get('/version', asyncHandler(async (req, res) => {
  let version = process.env.APP_VERSION;
  if (!version) {
    try {
      const packagePath = path.join(process.cwd(), 'package.json');
      version = require(packagePath).version;
    } catch {
      version = 'unknown';
    }
  }
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

// GET /claude-usage - real-time usage from Anthropic OAuth API
// Uses the undocumented /api/oauth/usage endpoint with the Claude Code OAuth token.
// Falls back to stats-cache.json if the API call fails.
let usageCache: { data: any; timestamp: number } | null = null;
const USAGE_CACHE_TTL = 30_000; // 30 second cache

async function fetchOAuthUsage(): Promise<{
  fiveHour: { utilization: number; resetsAt: string | null };
  sevenDay: { utilization: number; resetsAt: string | null };
  sevenDayOpus: { utilization: number; resetsAt: string | null } | null;
  sevenDaySonnet: { utilization: number; resetsAt: string | null } | null;
  extraUsage: { isEnabled: boolean; monthlyLimit: number | null; usedCredits: number | null; utilization: number | null } | null;
} | null> {
  const homeDir = os.homedir();
  const credsPath = path.join(homeDir, '.claude', '.credentials.json');

  let accessToken: string;
  try {
    const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
    accessToken = creds.claudeAiOauth?.accessToken;
    if (!accessToken) return null;
  } catch {
    return null;
  }

  try {
    const resp = await fetch('https://api.anthropic.com/api/oauth/usage', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'anthropic-beta': 'oauth-2025-04-20',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!resp.ok) {
      log.warn(`OAuth usage API returned ${resp.status}`);
      return null;
    }

    const data = await resp.json() as any;
    return {
      fiveHour: {
        utilization: data.five_hour?.utilization ?? 0,
        resetsAt: data.five_hour?.resets_at ?? null,
      },
      sevenDay: {
        utilization: data.seven_day?.utilization ?? 0,
        resetsAt: data.seven_day?.resets_at ?? null,
      },
      sevenDayOpus: data.seven_day_opus ? {
        utilization: data.seven_day_opus.utilization ?? 0,
        resetsAt: data.seven_day_opus.resets_at ?? null,
      } : null,
      sevenDaySonnet: data.seven_day_sonnet ? {
        utilization: data.seven_day_sonnet.utilization ?? 0,
        resetsAt: data.seven_day_sonnet.resets_at ?? null,
      } : null,
      extraUsage: data.extra_usage ? {
        isEnabled: data.extra_usage.is_enabled ?? false,
        monthlyLimit: data.extra_usage.monthly_limit ?? null,
        usedCredits: data.extra_usage.used_credits ?? null,
        utilization: data.extra_usage.utilization ?? null,
      } : null,
    };
  } catch (err) {
    log.warn('OAuth usage API call failed:', err);
    return null;
  }
}

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

  // Try real-time OAuth API first
  const oauthUsage = await fetchOAuthUsage();

  if (oauthUsage) {
    const data = {
      subscription: subscriptionType,
      rateLimitTier,
      source: 'api' as const,
      session: {
        percent: oauthUsage.fiveHour.utilization,
        resetsAt: oauthUsage.fiveHour.resetsAt,
      },
      week: {
        percent: oauthUsage.sevenDay.utilization,
        resetsAt: oauthUsage.sevenDay.resetsAt,
      },
      weekOpus: oauthUsage.sevenDayOpus,
      weekSonnet: oauthUsage.sevenDaySonnet,
      extraUsage: oauthUsage.extraUsage,
    };

    usageCache = { data, timestamp: now };
    return res.json(data);
  }

  // Fallback: read stats-cache.json
  let todayTokens = 0;
  let weekTokens = 0;
  try {
    const statsPath = path.join(claudeDir, 'stats-cache.json');
    const stats = JSON.parse(fs.readFileSync(statsPath, 'utf-8'));

    const todayStr = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000);

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
  } catch (err) {
    log.warn('Could not read Claude stats-cache.json:', err);
  }

  // Approximate limits for fallback
  const tierLimits: Record<string, { session: number; weekly: number }> = {
    'default_claude_max_5x':   { session: 480_000,  weekly: 7_000_000 },
    'default_claude_max_20x':  { session: 1_920_000, weekly: 28_000_000 },
    'default_claude_pro':      { session: 96_000,    weekly: 1_400_000 },
    'default_claude_team':     { session: 144_000,   weekly: 2_100_000 },
  };
  const limits = tierLimits[rateLimitTier] || { session: 96_000, weekly: 1_400_000 };

  const data = {
    subscription: subscriptionType,
    rateLimitTier,
    source: 'stats-cache' as const,
    session: {
      percent: limits.session > 0 ? Math.min(100, Math.round((todayTokens / limits.session) * 100)) : 0,
      resetsAt: null,
    },
    week: {
      percent: limits.weekly > 0 ? Math.min(100, Math.round((weekTokens / limits.weekly) * 100)) : 0,
      resetsAt: null,
    },
    weekOpus: null,
    weekSonnet: null,
    extraUsage: null,
  };

  usageCache = { data, timestamp: now };
  res.json(data);
}));

export default router;
