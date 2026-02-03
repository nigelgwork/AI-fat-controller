import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

// Types
export interface ConversationEntry {
  id: string;
  timestamp: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  projectId?: string;
  taskId?: string;
  tokens?: { input: number; output: number };
}

export interface ConversationSession {
  id: string;
  projectId: string;
  projectName: string;
  startedAt: string;
  lastActivityAt: string;
  entryCount: number;
  totalTokens: { input: number; output: number };
  summary?: string;
}

interface SessionsIndex {
  sessions: ConversationSession[];
}

// Generate a simple unique ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Get the conversations directory path
function getConversationsDir(): string {
  const userDataPath = app.getPath('userData');
  const conversationsDir = path.join(userDataPath, 'conversations');

  // Ensure directory exists
  if (!fs.existsSync(conversationsDir)) {
    fs.mkdirSync(conversationsDir, { recursive: true });
  }

  return conversationsDir;
}

// Get path to sessions index file
function getSessionsIndexPath(): string {
  return path.join(getConversationsDir(), 'sessions.json');
}

// Get path to a session's JSONL file
function getSessionFilePath(sessionId: string, projectId: string): string {
  return path.join(getConversationsDir(), `${projectId}_${sessionId}.jsonl`);
}

// Load sessions index
function loadSessionsIndex(): SessionsIndex {
  const indexPath = getSessionsIndexPath();

  if (!fs.existsSync(indexPath)) {
    return { sessions: [] };
  }

  try {
    const content = fs.readFileSync(indexPath, 'utf-8');
    return JSON.parse(content) as SessionsIndex;
  } catch (error) {
    console.error('Failed to load sessions index:', error);
    return { sessions: [] };
  }
}

// Save sessions index
function saveSessionsIndex(index: SessionsIndex): void {
  const indexPath = getSessionsIndexPath();
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
}

// Create a new conversation session
export function createConversationSession(
  projectId: string,
  projectName: string
): ConversationSession {
  const session: ConversationSession = {
    id: generateId(),
    projectId,
    projectName,
    startedAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    entryCount: 0,
    totalTokens: { input: 0, output: 0 },
  };

  // Add to index
  const index = loadSessionsIndex();
  index.sessions.push(session);
  saveSessionsIndex(index);

  // Create empty JSONL file
  const filePath = getSessionFilePath(session.id, projectId);
  fs.writeFileSync(filePath, '', 'utf-8');

  return session;
}

// Append an entry to a conversation session
export function appendConversationEntry(
  sessionId: string,
  entry: Omit<ConversationEntry, 'id' | 'timestamp'>
): ConversationEntry {
  const index = loadSessionsIndex();
  const session = index.sessions.find(s => s.id === sessionId);

  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const fullEntry: ConversationEntry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    ...entry,
  };

  // Append to JSONL file
  const filePath = getSessionFilePath(sessionId, session.projectId);
  fs.appendFileSync(filePath, JSON.stringify(fullEntry) + '\n', 'utf-8');

  // Update session metadata
  session.lastActivityAt = fullEntry.timestamp;
  session.entryCount += 1;
  if (fullEntry.tokens) {
    session.totalTokens.input += fullEntry.tokens.input;
    session.totalTokens.output += fullEntry.tokens.output;
  }
  saveSessionsIndex(index);

  return fullEntry;
}

// Load conversation entries from a session
export function loadConversation(
  sessionId: string,
  options?: { limit?: number; offset?: number }
): ConversationEntry[] {
  const index = loadSessionsIndex();
  const session = index.sessions.find(s => s.id === sessionId);

  if (!session) {
    return [];
  }

  const filePath = getSessionFilePath(sessionId, session.projectId);

  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());

    let entries: ConversationEntry[] = lines.map(line => JSON.parse(line));

    // Apply offset
    if (options?.offset && options.offset > 0) {
      entries = entries.slice(options.offset);
    }

    // Apply limit
    if (options?.limit && options.limit > 0) {
      entries = entries.slice(0, options.limit);
    }

    return entries;
  } catch (error) {
    console.error('Failed to load conversation:', error);
    return [];
  }
}

// List all conversation sessions
export function listConversationSessions(projectId?: string): ConversationSession[] {
  const index = loadSessionsIndex();

  let sessions = index.sessions;

  // Filter by project if specified
  if (projectId) {
    sessions = sessions.filter(s => s.projectId === projectId);
  }

  // Sort by last activity (most recent first)
  return sessions.sort(
    (a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
  );
}

// Get a specific session by ID
export function getConversationSession(sessionId: string): ConversationSession | null {
  const index = loadSessionsIndex();
  return index.sessions.find(s => s.id === sessionId) || null;
}

// Update session metadata
export function updateConversationSession(
  sessionId: string,
  updates: Partial<Pick<ConversationSession, 'summary' | 'projectName'>>
): ConversationSession | null {
  const index = loadSessionsIndex();
  const session = index.sessions.find(s => s.id === sessionId);

  if (!session) {
    return null;
  }

  Object.assign(session, updates);
  saveSessionsIndex(index);

  return session;
}

// Delete a conversation session
export function deleteConversationSession(sessionId: string): boolean {
  const index = loadSessionsIndex();
  const sessionIndex = index.sessions.findIndex(s => s.id === sessionId);

  if (sessionIndex === -1) {
    return false;
  }

  const session = index.sessions[sessionIndex];

  // Remove the JSONL file
  const filePath = getSessionFilePath(sessionId, session.projectId);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  // Remove from index
  index.sessions.splice(sessionIndex, 1);
  saveSessionsIndex(index);

  return true;
}

// Compact a conversation by summarizing older entries
export async function compactConversation(
  sessionId: string,
  summarizeCallback: (entries: ConversationEntry[]) => Promise<string>
): Promise<void> {
  const index = loadSessionsIndex();
  const session = index.sessions.find(s => s.id === sessionId);

  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const filePath = getSessionFilePath(sessionId, session.projectId);

  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n').filter(line => line.trim());
  const entries: ConversationEntry[] = lines.map(line => JSON.parse(line));

  // Keep last 20 entries verbatim
  const keepCount = 20;
  if (entries.length <= keepCount) {
    return; // Nothing to compact
  }

  const olderEntries = entries.slice(0, -keepCount);
  const recentEntries = entries.slice(-keepCount);

  // Generate summary of older entries
  const summary = await summarizeCallback(olderEntries);

  // Create a summary entry
  const summaryEntry: ConversationEntry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    role: 'system',
    content: `[CONVERSATION SUMMARY]\n${summary}`,
  };

  // Calculate token totals from compacted entries
  let compactedInputTokens = 0;
  let compactedOutputTokens = 0;
  for (const entry of olderEntries) {
    if (entry.tokens) {
      compactedInputTokens += entry.tokens.input;
      compactedOutputTokens += entry.tokens.output;
    }
  }

  // Add token info to summary
  summaryEntry.tokens = {
    input: compactedInputTokens,
    output: compactedOutputTokens,
  };

  // Write compacted conversation
  const newEntries = [summaryEntry, ...recentEntries];
  const newContent = newEntries.map(e => JSON.stringify(e)).join('\n') + '\n';
  fs.writeFileSync(filePath, newContent, 'utf-8');

  // Update session metadata
  session.entryCount = newEntries.length;
  session.summary = summary.substring(0, 500); // Store truncated summary
  saveSessionsIndex(index);
}

// Get recent conversations across all projects (for dashboard)
export function getRecentConversations(limit: number = 10): ConversationSession[] {
  const sessions = listConversationSessions();
  return sessions.slice(0, limit);
}

// Search conversations for a string (basic implementation)
export function searchConversations(
  query: string,
  options?: { projectId?: string; limit?: number }
): Array<{ session: ConversationSession; entry: ConversationEntry; match: string }> {
  const sessions = listConversationSessions(options?.projectId);
  const results: Array<{ session: ConversationSession; entry: ConversationEntry; match: string }> = [];
  const queryLower = query.toLowerCase();
  const limit = options?.limit || 50;

  for (const session of sessions) {
    if (results.length >= limit) break;

    const entries = loadConversation(session.id);
    for (const entry of entries) {
      if (results.length >= limit) break;

      const contentLower = entry.content.toLowerCase();
      if (contentLower.includes(queryLower)) {
        // Extract a snippet around the match
        const matchIndex = contentLower.indexOf(queryLower);
        const start = Math.max(0, matchIndex - 50);
        const end = Math.min(entry.content.length, matchIndex + query.length + 50);
        const match = entry.content.substring(start, end);

        results.push({ session, entry, match });
      }
    }
  }

  return results;
}

// Get conversation statistics
export function getConversationStats(): {
  totalSessions: number;
  totalEntries: number;
  totalTokens: { input: number; output: number };
  sessionsByProject: Record<string, number>;
} {
  const index = loadSessionsIndex();

  const stats = {
    totalSessions: index.sessions.length,
    totalEntries: 0,
    totalTokens: { input: 0, output: 0 },
    sessionsByProject: {} as Record<string, number>,
  };

  for (const session of index.sessions) {
    stats.totalEntries += session.entryCount;
    stats.totalTokens.input += session.totalTokens.input;
    stats.totalTokens.output += session.totalTokens.output;

    const projectKey = session.projectName || session.projectId;
    stats.sessionsByProject[projectKey] = (stats.sessionsByProject[projectKey] || 0) + 1;
  }

  return stats;
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
