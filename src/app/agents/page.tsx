"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Users,
  Crown,
  Eye,
  GitMerge,
  Wrench,
  Server,
  RefreshCw,
  Mail,
  FileText,
  Settings,
  Plus,
} from "lucide-react";
import { ProgressBar, StatusBadge } from "@/components/ui";
import { Agent, AgentRole } from "@/types/gastown";
import { cn, formatRelativeTime } from "@/lib/utils";

const ROLE_ICONS: Record<AgentRole, typeof Crown> = {
  mayor: Crown,
  witness: Eye,
  refinery: GitMerge,
  polecat: Wrench,
  crew: Users,
  deacon: Server,
};

const ROLE_COLORS: Record<AgentRole, string> = {
  mayor: "text-amber-500 bg-amber-500/10",
  witness: "text-blue-500 bg-blue-500/10",
  refinery: "text-purple-500 bg-purple-500/10",
  polecat: "text-green-500 bg-green-500/10",
  crew: "text-cyan-500 bg-cyan-500/10",
  deacon: "text-zinc-500 bg-zinc-500/10",
};

async function fetchAgents() {
  const res = await fetch("/api/agents");
  return res.json();
}

async function triggerHandoff(agentId: string) {
  const res = await fetch("/api/agents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "handoff", agentId }),
  });
  return res.json();
}

export default function AgentsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: fetchAgents,
    refetchInterval: 5000,
  });

  const handoffMutation = useMutation({
    mutationFn: triggerHandoff,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });

  const agents: Agent[] = data?.agents || [];

  const agentsByRole = agents.reduce((acc, agent) => {
    if (!acc[agent.role]) acc[agent.role] = [];
    acc[agent.role].push(agent);
    return acc;
  }, {} as Record<AgentRole, Agent[]>);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Agents</h1>
          <p className="text-sm text-zinc-400">
            Manage and monitor your agent fleet
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" />
          Spawn Agent
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-sm text-zinc-400">Total Agents</p>
          <p className="mt-1 text-2xl font-bold text-zinc-100">
            {agents.length}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-sm text-zinc-400">Working</p>
          <p className="mt-1 text-2xl font-bold text-yellow-500">
            {agents.filter((a) => a.status === "working").length}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-sm text-zinc-400">Idle</p>
          <p className="mt-1 text-2xl font-bold text-zinc-500">
            {agents.filter((a) => a.status === "idle").length}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-sm text-zinc-400">Stuck</p>
          <p className="mt-1 text-2xl font-bold text-red-500">
            {agents.filter((a) => a.status === "stuck").length}
          </p>
        </div>
      </div>

      {/* Agent List */}
      {agents.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-12 text-center">
          <Users className="mx-auto h-12 w-12 text-zinc-600" />
          <h3 className="mt-4 text-lg font-medium text-zinc-300">
            No agents running
          </h3>
          <p className="mt-2 text-sm text-zinc-500">
            Start the Gas Town daemon to spawn agents, or spawn one manually.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(agentsByRole).map(([role, roleAgents]) => {
            const RoleIcon = ROLE_ICONS[role as AgentRole] || Users;
            const roleColor = ROLE_COLORS[role as AgentRole] || "text-zinc-500";

            return (
              <div key={role} className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className={cn("rounded-md p-1.5", roleColor)}>
                    <RoleIcon className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-400">
                    {role}s ({roleAgents.length})
                  </h2>
                </div>

                <div className="space-y-2">
                  {roleAgents.map((agent) => (
                    <AgentCard
                      key={agent.id}
                      agent={agent}
                      onHandoff={() => handoffMutation.mutate(agent.id)}
                      isHandingOff={handoffMutation.isPending}
                      onViewMail={() => router.push(`/mail?agent=${agent.id}`)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AgentCard({
  agent,
  onHandoff,
  isHandingOff,
  onViewMail,
}: {
  agent: Agent;
  onHandoff: () => void;
  isHandingOff: boolean;
  onViewMail: () => void;
}) {
  const RoleIcon = ROLE_ICONS[agent.role] || Users;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-lg",
              ROLE_COLORS[agent.role]
            )}
          >
            <RoleIcon className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-zinc-100">{agent.id}</h3>
              <StatusBadge status={agent.status} />
            </div>
            <p className="text-sm text-zinc-500">
              {agent.role} • {agent.rig || "town level"}
              {agent.started_at && (
                <span className="ml-2">
                  • up {formatRelativeTime(agent.started_at)}
                </span>
              )}
            </p>
            {agent.current_task && (
              <p className="mt-1 text-sm text-zinc-400">
                Working on: <span className="text-blue-400">{agent.current_task}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onViewMail}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            title="View Mail"
          >
            <Mail className="h-4 w-4" />
          </button>
          <button
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            title="View Hook"
          >
            <FileText className="h-4 w-4" />
          </button>
          <button
            onClick={onHandoff}
            disabled={isHandingOff}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50"
            title="Trigger Handoff"
          >
            <RefreshCw className={cn("h-4 w-4", isHandingOff && "animate-spin")} />
          </button>
          <button
            disabled
            className="rounded-lg p-2 text-zinc-400 disabled:cursor-not-allowed disabled:opacity-50"
            title="Settings (coming soon)"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {agent.context_usage !== undefined && (
        <div className="mt-4">
          <ProgressBar
            value={agent.context_usage}
            label="Context Usage"
            variant={
              agent.context_usage > 80
                ? "danger"
                : agent.context_usage > 60
                ? "warning"
                : "default"
            }
          />
        </div>
      )}
    </div>
  );
}
