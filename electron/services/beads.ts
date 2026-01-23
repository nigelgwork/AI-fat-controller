import fs from 'fs';
import path from 'path';

export interface Bead {
  id: string;
  title: string;
  status: string;
  priority?: string;
  created?: string;
  updated?: string;
  tags?: string[];
  assignee?: string;
  description?: string;
  [key: string]: unknown;
}

export interface BeadsStats {
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
}

export interface BeadEvent {
  id: string;
  type: string;
  beadId: string;
  timestamp: string;
  data?: unknown;
}

const BEADS_FILE = '.beads/beads.jsonl';

export function readBeadsFile(gastownPath: string): Bead[] {
  const beadsPath = path.join(gastownPath, BEADS_FILE);

  if (!fs.existsSync(beadsPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(beadsPath, 'utf-8');
    const lines = content.trim().split('\n').filter((line) => line.trim());

    const beads: Bead[] = [];
    for (const line of lines) {
      try {
        const bead = JSON.parse(line);
        // Skip tombstones (deleted beads)
        if (bead.tombstone) continue;
        beads.push(bead);
      } catch {
        // Skip invalid JSON lines
      }
    }

    return beads;
  } catch {
    return [];
  }
}

export function getBeadsStats(gastownPath: string): BeadsStats {
  const beads = readBeadsFile(gastownPath);

  const stats: BeadsStats = {
    total: beads.length,
    byStatus: {},
    byPriority: {},
  };

  for (const bead of beads) {
    const status = bead.status || 'unknown';
    const priority = bead.priority || 'none';

    stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
    stats.byPriority[priority] = (stats.byPriority[priority] || 0) + 1;
  }

  return stats;
}

export function getBeadsEvents(gastownPath: string, limit = 10): BeadEvent[] {
  const beads = readBeadsFile(gastownPath);

  // Create events from bead data (simplified - real implementation would track actual events)
  const events: BeadEvent[] = beads
    .filter((bead) => bead.updated || bead.created)
    .map((bead) => ({
      id: `${bead.id}-update`,
      type: 'updated',
      beadId: bead.id,
      timestamp: bead.updated || bead.created || new Date().toISOString(),
      data: { title: bead.title, status: bead.status },
    }))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);

  return events;
}

export function getBeadById(gastownPath: string, id: string): Bead | null {
  const beads = readBeadsFile(gastownPath);
  return beads.find((b) => b.id === id) || null;
}
