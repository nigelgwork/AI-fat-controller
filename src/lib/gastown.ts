import { execSync } from "child_process";
import { join } from "path";
import { Agent, Convoy, Insights, Mail, Rig, TownStats } from "@/types/gastown";

// Get project bin directory for gt/bd commands
const projectRoot = process.cwd();
const binDir = join(projectRoot, "bin");
const gastownPath = process.env.GASTOWN_PATH || join(process.env.HOME || "", "gt");

function execCommand(command: string): string {
  try {
    return execSync(command, {
      encoding: "utf-8",
      timeout: 30000,
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH}`,
        GASTOWN_PATH: gastownPath,
      },
      cwd: gastownPath,
    }).trim();
  } catch (error) {
    console.error(`Command failed: ${command}`, error);
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
  return parseJsonOutput<TownStats>("gt status --json");
}

export function getRigs(): Rig[] {
  const result = parseJsonOutput<{ rigs: Rig[] }>("gt rig list --json");
  return result?.rigs ?? [];
}

// Agent Management
export function getAgents(): Agent[] {
  const result = parseJsonOutput<{ agents: Agent[] }>("gt status --json");
  return result?.agents ?? [];
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
