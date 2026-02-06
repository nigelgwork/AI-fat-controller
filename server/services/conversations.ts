/**
 * Conversations Service - Adapted from electron/services/conversations.ts
 * Replaces file-based storage with SQLite via conversations-repo.
 * Keeps search/stats logic, context building, and Claude Code session linking.
 */

import { createLogger } from '../utils/logger';
import * as conversationsRepo from '../db/repositories/conversations-repo';

const log = createLogger('Conversations');

// Re-export types from repo
export type { ConversationEntry, ConversationSession } from '../db/repositories/conversations-repo';
import type { ConversationEntry, ConversationSession } from '../db/repositories/conversations-repo';

// ============================================
// Session Management
// ============================================

/**
 * Create a new conversation session
 */
export function createConversationSession(
  projectId: string,
  projectName: string
): ConversationSession {
  return conversationsRepo.createSession(projectId, projectName);
}

/**
 * Append an entry to a conversation session
 */
export function appendConversationEntry(
  sessionId: string,
  entry: Omit<ConversationEntry, 'id' | 'timestamp'>
): ConversationEntry {
  return conversationsRepo.appendEntry(sessionId, entry);
}

/**
 * Load conversation entries from a session
 */
export function loadConversation(
  sessionId: string,
  options?: { limit?: number; offset?: number }
): ConversationEntry[] {
  return conversationsRepo.loadEntries(sessionId, options);
}

/**
 * List all conversation sessions, optionally filtered by project
 */
export function listConversationSessions(projectId?: string): ConversationSession[] {
  return conversationsRepo.listSessions(projectId);
}

/**
 * Get a specific session by ID
 */
export function getConversationSession(sessionId: string): ConversationSession | null {
  return conversationsRepo.getSession(sessionId);
}

/**
 * Update session metadata
 */
export function updateConversationSession(
  sessionId: string,
  updates: Partial<Pick<ConversationSession, 'summary' | 'projectName'>>
): ConversationSession | null {
  return conversationsRepo.updateSession(sessionId, updates);
}

/**
 * Delete a conversation session
 */
export function deleteConversationSession(sessionId: string): boolean {
  return conversationsRepo.deleteSession(sessionId);
}

/**
 * Compact a conversation by summarizing older entries.
 * Replaces older entries with a summary entry, keeping the most recent ones.
 */
export async function compactConversation(
  sessionId: string,
  summarizeCallback: (entries: ConversationEntry[]) => Promise<string>
): Promise<void> {
  const entries = loadConversation(sessionId);

  // Keep last 20 entries verbatim
  const keepCount = 20;
  if (entries.length <= keepCount) {
    return; // Nothing to compact
  }

  const olderEntries = entries.slice(0, -keepCount);

  // Generate summary of older entries
  const summary = await summarizeCallback(olderEntries);

  // Calculate token totals from compacted entries
  let compactedInputTokens = 0;
  let compactedOutputTokens = 0;
  for (const entry of olderEntries) {
    if (entry.tokens) {
      compactedInputTokens += entry.tokens.input;
      compactedOutputTokens += entry.tokens.output;
    }
  }

  // Note: With SQLite, we can't easily replace entries in-place like with JSONL files.
  // Instead, we append a summary entry. The old entries remain in the DB but the
  // summary is stored on the session for quick access.
  appendConversationEntry(sessionId, {
    role: 'system',
    content: `[CONVERSATION SUMMARY]\n${summary}`,
    tokens: {
      input: compactedInputTokens,
      output: compactedOutputTokens,
    },
  });

  // Update session summary
  updateConversationSession(sessionId, {
    summary: summary.substring(0, 500),
  });
}

/**
 * Get recent conversations across all projects (for dashboard)
 */
export function getRecentConversations(limit: number = 10): ConversationSession[] {
  return conversationsRepo.getRecentSessions(limit);
}

/**
 * Search conversations for a string
 */
export function searchConversations(
  query: string,
  options?: { projectId?: string; limit?: number }
): Array<{ session: ConversationSession; entry: ConversationEntry; match: string }> {
  return conversationsRepo.searchConversations(query, options);
}

/**
 * Get conversation statistics
 */
export function getConversationStats(): {
  totalSessions: number;
  totalEntries: number;
  totalTokens: { input: number; output: number };
  sessionsByProject: Record<string, number>;
} {
  return conversationsRepo.getStats();
}

// ============================================
// Context Building for Claude
// ============================================

/**
 * Estimate token count for a string (rough approximation: ~4 chars per token)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Format conversation history as context for Claude prompts.
 * Respects the maxTokens limit by truncating older messages.
 *
 * @param sessionId - The conversation session ID
 * @param maxTokens - Maximum tokens for context (default: 50000)
 * @returns Formatted context string and token count
 */
export function buildConversationContext(
  sessionId: string,
  maxTokens: number = 50000
): { context: string; tokenCount: number; entriesIncluded: number } {
  const entries = loadConversation(sessionId);

  if (entries.length === 0) {
    return { context: '', tokenCount: 0, entriesIncluded: 0 };
  }

  // Build context from newest to oldest, then reverse
  const contextParts: string[] = [];
  let totalTokens = 0;
  let entriesIncluded = 0;

  // Start from most recent entries
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    const formattedEntry = formatConversationEntry(entry);
    const entryTokens = estimateTokens(formattedEntry);

    // Check if adding this entry would exceed the limit
    if (totalTokens + entryTokens > maxTokens && contextParts.length > 0) {
      // Add a note about truncated history
      contextParts.unshift('[Earlier conversation history truncated]');
      break;
    }

    contextParts.unshift(formattedEntry);
    totalTokens += entryTokens;
    entriesIncluded++;
  }

  const context = contextParts.join('\n\n');
  return { context, tokenCount: totalTokens, entriesIncluded };
}

/**
 * Format a single conversation entry for context
 */
function formatConversationEntry(entry: ConversationEntry): string {
  const roleLabel = entry.role === 'user' ? 'User' :
    entry.role === 'assistant' ? 'Assistant' : 'System';

  const timestamp = new Date(entry.timestamp).toLocaleString();

  return `[${timestamp}] ${roleLabel}:\n${entry.content}`;
}

/**
 * Get recent conversation summary if available, or generate a brief one.
 * This is used when context is too long and needs summarization.
 */
export function getOrCreateSummary(sessionId: string): string | null {
  const session = getConversationSession(sessionId);
  if (!session) return null;

  // Return existing summary if available
  if (session.summary) {
    return session.summary;
  }

  // Generate a brief summary from recent entries
  const entries = loadConversation(sessionId, { limit: 10 });
  if (entries.length === 0) return null;

  // Extract key topics from recent messages
  const topics = new Set<string>();
  for (const entry of entries) {
    // Simple topic extraction: find capitalized phrases or quoted terms
    const matches = entry.content.match(/(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)|(?:"[^"]+"|'[^']+')/g);
    if (matches) {
      matches.slice(0, 3).forEach(m => topics.add(m.replace(/['"]/g, '')));
    }
  }

  if (topics.size === 0) {
    return `Conversation started ${new Date(session.startedAt).toLocaleDateString()} with ${session.entryCount} messages.`;
  }

  return `Conversation about: ${Array.from(topics).slice(0, 5).join(', ')}. Started ${new Date(session.startedAt).toLocaleDateString()}.`;
}

/**
 * Build a prompt with conversation context included.
 * Automatically manages context size.
 */
export function buildPromptWithContext(
  sessionId: string,
  currentPrompt: string,
  options?: {
    maxContextTokens?: number;
    includeSystemContext?: boolean;
  }
): string {
  const maxContextTokens = options?.maxContextTokens ?? 50000;

  // Get conversation context
  const { context, tokenCount, entriesIncluded } = buildConversationContext(
    sessionId,
    maxContextTokens
  );

  if (!context || entriesIncluded === 0) {
    return currentPrompt;
  }

  // Build the full prompt
  const parts: string[] = [];

  if (options?.includeSystemContext) {
    parts.push('## Previous Conversation Context');
    parts.push(`(${entriesIncluded} messages, ~${tokenCount} tokens)`);
    parts.push('');
  }

  parts.push(context);
  parts.push('');
  parts.push('---');
  parts.push('');
  parts.push('## Current Request');
  parts.push(currentPrompt);

  return parts.join('\n');
}

// ============================================
// Claude Code Session Linking
// ============================================

/**
 * Link a Claude Code session ID to an app conversation session.
 * This enables resuming the Claude Code session later.
 */
export function linkClaudeCodeSession(
  appSessionId: string,
  claudeSessionId: string,
  claudeSessionPath?: string
): ConversationSession | null {
  const result = conversationsRepo.linkClaudeCodeSession(appSessionId, claudeSessionId, claudeSessionPath);
  if (result) {
    log.info(`Linked Claude session ${claudeSessionId} to app session ${appSessionId}`);
  }
  return result;
}

/**
 * Get sessions that can be resumed (have a linked Claude Code session)
 */
export function getResumableSessions(projectId?: string): ConversationSession[] {
  return conversationsRepo.getResumableSessions(projectId);
}

/**
 * Unlink a Claude Code session from an app session
 */
export function unlinkClaudeCodeSession(appSessionId: string): ConversationSession | null {
  return conversationsRepo.unlinkClaudeCodeSession(appSessionId);
}

/**
 * Find app session by Claude Code session ID
 */
export function findSessionByClaudeId(claudeSessionId: string): ConversationSession | null {
  return conversationsRepo.findSessionByClaudeId(claudeSessionId);
}
