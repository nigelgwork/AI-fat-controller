/**
 * Clawdbot Conversation Store - Server adapter
 * Delegates to SQLite repository instead of electron-store
 */

import * as clawdbotRepo from '../db/repositories/clawdbot-repo';

// Re-export types from the repository
export type { ClawdbotMessage } from '../db/repositories/clawdbot-repo';

import type { ClawdbotMessage } from '../db/repositories/clawdbot-repo';

/**
 * Get all messages
 */
export function getMessages(): ClawdbotMessage[] {
  return clawdbotRepo.getMessages();
}

/**
 * Add a message to the conversation
 */
export function addMessage(message: Omit<ClawdbotMessage, 'id' | 'timestamp'>): ClawdbotMessage {
  return clawdbotRepo.addMessage(message);
}

/**
 * Clear all messages
 */
export function clearMessages(): void {
  clawdbotRepo.clearMessages();
}

/**
 * Get the last N messages for context
 */
export function getRecentMessages(count: number = 10): ClawdbotMessage[] {
  return clawdbotRepo.getRecentMessages(count);
}
