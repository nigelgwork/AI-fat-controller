import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Agent, Convoy, Insights, Mail, Rig, TownStats } from "@/types/gastown";

// Get project bin directory for gt/bd commands
// Use multiple fallbacks for reliable path resolution
const getProjectRoot = () => {
  // Try common locations
  const candidates = [
    process.cwd(),
    join(process.cwd(), ".."),
    "/home/michael_pappas/Documents/Personal/code/gastown-ui",
  ];

  for (const candidate of candidates) {
    try {
      const binPath = join(candidate, "bin", "gt");
      require("fs").accessSync(binPath);
      return candidate;
    } catch {
      continue;
    }
  }
  return process.cwd();
};

const projectRoot = getProjectRoot();
const binDir = join(projectRoot, "bin");
const gastownPath = process.env.GASTOWN_PATH || join(process.env.HOME || "", "gt");

function execCommand(command: string): string {
  try {
    return execSync(command, {
      encoding: "utf-8",
      timeout: 5000, // 5 second timeout
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH}`,
        GASTOWN_PATH: gastownPath,
      },
      cwd: gastownPath,
    }).trim();
  } catch (error: unknown) {
    const err = error as { message?: string; stderr?: string };
    const errorMsg = err.message || err.stderr || "Unknown error";
    // Only log if not a simple "command failed" error
    if (!errorMsg.includes("SIGTERM") && !errorMsg.includes("ETIMEDOUT")) {
      console.error(`Command failed: ${command} - ${errorMsg.slice(0, 100)}`);
    }
    throw error;
  }
}

function parseJsonOutput<T>(command: string): T | null {
  try {
    const output = execCommand(command);
    return JSON.parse(output) as T;
  } catch {
    return null;
  }
}

// Town Management
export function getTownStatus(): TownStats | null {
  // gt doesn't have a direct status --json command yet
  // Return null to indicate not available
  return null;
}

export function getRigs(): Rig[] {
  const result = parseJsonOutput<{ rigs: Rig[] }>("gt rig list --json");
  return result?.rigs ?? [];
}

// Agent Management
export function getAgents(): Agent[] {
  // gt agents list outputs text, not JSON - parse or return empty for now
  try {
    const output = execCommand("gt agents list");
    // If no agents running, return empty
    if (output.includes("No agent sessions running")) {
      return [];
    }
    // TODO: Parse text output to Agent[] if needed
    return [];
  } catch {
    return [];
  }
}

export function getAgentById(id: string): Agent | null {
  const agents = getAgents();
  return agents.find((a) => a.id === id) ?? null;
}

export function triggerHandoff(agentId: string): boolean {
  try {
    execCommand(`gt handoff --agent ${agentId}`);
    return true;
  } catch {
    return false;
  }
}

export function spawnPolecat(rig: string, beadId?: string): string | null {
  try {
    const cmd = beadId
      ? `gt sling ${beadId} ${rig}`
      : `gt polecat spawn ${rig}`;
    return execCommand(cmd);
  } catch {
    return null;
  }
}

// Convoy Management
export function getConvoys(): Convoy[] {
  const result = parseJsonOutput<{ convoys: Convoy[] }>("gt convoy list --json");
  return result?.convoys ?? [];
}

export function getConvoyById(id: string): Convoy | null {
  const result = parseJsonOutput<Convoy>(`gt convoy status ${id} --json`);
  return result;
}

export function createConvoy(
  name: string,
  beadIds: string[],
  options?: { notify?: boolean; humanRequired?: boolean }
): Convoy | null {
  const flags = [
    options?.notify ? "--notify" : "",
    options?.humanRequired ? "--human" : "",
  ].filter(Boolean).join(" ");

  return parseJsonOutput<Convoy>(
    `gt convoy create "${name}" ${beadIds.join(" ")} ${flags} --json`
  );
}

// Mail Management
export function getInbox(agent: string): Mail[] {
  const result = parseJsonOutput<{ messages: Mail[] }>(
    `gt mail inbox --agent ${agent} --json`
  );
  return result?.messages ?? [];
}

export function getAnnounces(): Mail[] {
  const result = parseJsonOutput<{ messages: Mail[] }>("gt mail announces --json");
  return result?.messages ?? [];
}

export function sendMail(to: string, subject: string, body: string): boolean {
  try {
    execCommand(`gt mail send ${to} -s "${subject}" -m "${body}"`);
    return true;
  } catch {
    return false;
  }
}

// Insights (from bv)
export function getInsights(): Insights | null {
  return parseJsonOutput<Insights>("bv --robot-insights");
}

export function getExecutionPlan(): unknown | null {
  return parseJsonOutput<unknown>("bv --robot-plan");
}

export function getPriorityRecommendations(): unknown | null {
  return parseJsonOutput<unknown>("bv --robot-priority");
}

// Health Check
export function runDoctor(): { healthy: boolean; issues: string[] } {
  try {
    const output = execCommand("gt doctor --json");
    return JSON.parse(output);
  } catch {
    return { healthy: false, issues: ["Failed to run doctor"] };
  }
}

export function runDoctorFix(): boolean {
  try {
    execCommand("gt doctor --fix");
    return true;
  } catch {
    return false;
  }
}
