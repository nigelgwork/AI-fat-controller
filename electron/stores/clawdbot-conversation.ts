/**
 * Clawdbot Conversation Store
 * Persists conversation history across navigation
 */

import Store from 'electron-store';
import { getEncryptionKey } from '../utils/encryption-key';

export interface ClawdbotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  intent?: {
    type: string;
    action: string;
    confidence: number;
  };
  usedClaudeCode?: boolean;
}

interface ClawdbotConversationStore {
  messages: ClawdbotMessage[];
  lastUpdated: string;
}

const store = new Store<ClawdbotConversationStore>({
  name: 'clawdbot-conversation',
  defaults: {
    messages: [],
    lastUpdated: new Date().toISOString(),
  },
  encryptionKey: getEncryptionKey(),
});

/**
 * Get all messages
 */
export function getMessages(): ClawdbotMessage[] {
  return store.get('messages') || [];
}

/**
 * Add a message to the conversation
 */
export function addMessage(message: Omit<ClawdbotMessage, 'id' | 'timestamp'>): ClawdbotMessage {
  const messages = getMessages();
  const newMessage: ClawdbotMessage = {
    ...message,
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toISOString(),
  };

  messages.push(newMessage);

  // Keep only last 100 messages to prevent unbounded growth
  if (messages.length > 100) {
    messages.splice(0, messages.length - 100);
  }

  store.set('messages', messages);
  store.set('lastUpdated', new Date().toISOString());

  return newMessage;
}

/**
 * Clear all messages
 */
export function clearMessages(): void {
  store.set('messages', []);
  store.set('lastUpdated', new Date().toISOString());
}

/**
 * Get the last N messages for context
 */
export function getRecentMessages(count: number = 10): ClawdbotMessage[] {
  const messages = getMessages();
  return messages.slice(-count);
}
