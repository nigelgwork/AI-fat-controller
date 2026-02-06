import { getDb } from '../database';

/**
 * Clawdbot Repository - messages CRUD, personalities CRUD
 */

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

export type TraitLevel = 'low' | 'medium' | 'high';

export interface ClawdbotPersonality {
  id: string;
  name: string;
  description: string;
  traits: {
    verbosity: TraitLevel;
    humor: TraitLevel;
    formality: TraitLevel;
    enthusiasm: TraitLevel;
  };
  customInstructions?: string;
  greeting?: string;
  signoff?: string;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// ============================================
// Messages
// ============================================

function rowToMessage(row: any): ClawdbotMessage {
  return {
    id: row.id,
    role: row.role as 'user' | 'assistant',
    content: row.content,
    timestamp: row.timestamp,
    intent: row.intent ? JSON.parse(row.intent) : undefined,
    usedClaudeCode: !!row.used_claude_code || undefined,
  };
}

export function getMessages(): ClawdbotMessage[] {
  const rows = getDb().prepare(
    'SELECT * FROM clawdbot_messages ORDER BY timestamp ASC'
  ).all();
  return rows.map(rowToMessage);
}

export function getRecentMessages(count: number = 10): ClawdbotMessage[] {
  const rows = getDb().prepare(
    'SELECT * FROM clawdbot_messages ORDER BY timestamp DESC LIMIT ?'
  ).all(count);
  return rows.map(rowToMessage).reverse();
}

export function addMessage(
  message: Omit<ClawdbotMessage, 'id' | 'timestamp'>
): ClawdbotMessage {
  const id = generateId();
  const now = new Date().toISOString();

  getDb().prepare(`
    INSERT INTO clawdbot_messages (id, role, content, timestamp, intent, used_claude_code)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    id,
    message.role,
    message.content,
    now,
    message.intent ? JSON.stringify(message.intent) : null,
    message.usedClaudeCode ? 1 : 0,
  );

  // Keep only last 100 messages
  getDb().prepare(`
    DELETE FROM clawdbot_messages WHERE id NOT IN (
      SELECT id FROM clawdbot_messages ORDER BY timestamp DESC LIMIT 100
    )
  `).run();

  return {
    id,
    role: message.role,
    content: message.content,
    timestamp: now,
    intent: message.intent,
    usedClaudeCode: message.usedClaudeCode,
  };
}

export function clearMessages(): void {
  getDb().prepare('DELETE FROM clawdbot_messages').run();
}

// ============================================
// Personalities
// ============================================

function rowToPersonality(row: any): ClawdbotPersonality {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    traits: JSON.parse(row.traits),
    customInstructions: row.custom_instructions || undefined,
    greeting: row.greeting || undefined,
    signoff: row.signoff || undefined,
    isDefault: !!row.is_default || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getPersonalities(): ClawdbotPersonality[] {
  const rows = getDb().prepare(
    'SELECT * FROM clawdbot_personalities ORDER BY is_default DESC, name ASC'
  ).all();
  return rows.map(rowToPersonality);
}

export function getPersonality(id: string): ClawdbotPersonality | null {
  const row = getDb().prepare('SELECT * FROM clawdbot_personalities WHERE id = ?').get(id);
  return row ? rowToPersonality(row) : null;
}

export function savePersonality(
  personality: Omit<ClawdbotPersonality, 'createdAt' | 'updatedAt'> & { id?: string }
): ClawdbotPersonality {
  const now = new Date().toISOString();

  if (personality.id) {
    const existing = getPersonality(personality.id);
    if (existing) {
      // Update existing
      if (existing.isDefault) {
        // Only allow updating custom instructions, greeting, signoff for defaults
        getDb().prepare(`
          UPDATE clawdbot_personalities
          SET custom_instructions = ?, greeting = ?, signoff = ?, updated_at = ?
          WHERE id = ?
        `).run(
          personality.customInstructions || null,
          personality.greeting || null,
          personality.signoff || null,
          now,
          personality.id,
        );
      } else {
        getDb().prepare(`
          UPDATE clawdbot_personalities
          SET name = ?, description = ?, traits = ?, custom_instructions = ?,
              greeting = ?, signoff = ?, is_default = ?, updated_at = ?
          WHERE id = ?
        `).run(
          personality.name,
          personality.description,
          JSON.stringify(personality.traits),
          personality.customInstructions || null,
          personality.greeting || null,
          personality.signoff || null,
          personality.isDefault ? 1 : 0,
          now,
          personality.id,
        );
      }

      return getPersonality(personality.id)!;
    }
  }

  // Create new
  const id = personality.id || generateId();

  getDb().prepare(`
    INSERT INTO clawdbot_personalities (id, name, description, traits, custom_instructions, greeting, signoff, is_default, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    personality.name,
    personality.description,
    JSON.stringify(personality.traits),
    personality.customInstructions || null,
    personality.greeting || null,
    personality.signoff || null,
    personality.isDefault ? 1 : 0,
    now,
    now,
  );

  return getPersonality(id)!;
}

export function deletePersonality(id: string): boolean {
  const personality = getPersonality(id);
  if (!personality || personality.isDefault) return false;

  const result = getDb().prepare('DELETE FROM clawdbot_personalities WHERE id = ? AND is_default = 0').run(id);
  return result.changes > 0;
}

/**
 * Initialize default personalities if they don't exist
 */
export function initializeDefaults(): void {
  const defaults: Array<Omit<ClawdbotPersonality, 'createdAt' | 'updatedAt'>> = [
    {
      id: 'default',
      name: 'Default',
      description: 'Balanced, professional, and helpful',
      traits: { verbosity: 'medium', humor: 'low', formality: 'medium', enthusiasm: 'medium' },
      isDefault: true,
    },
    {
      id: 'cheerful',
      name: 'Cheerful',
      description: 'High enthusiasm, friendly tone, casual approach',
      traits: { verbosity: 'medium', humor: 'medium', formality: 'low', enthusiasm: 'high' },
      greeting: 'Hey there! Great to see you!',
      signoff: 'Happy coding!',
      isDefault: true,
    },
    {
      id: 'concise',
      name: 'Concise',
      description: 'Direct, minimal, gets to the point quickly',
      traits: { verbosity: 'low', humor: 'low', formality: 'high', enthusiasm: 'low' },
      isDefault: true,
    },
    {
      id: 'creative',
      name: 'Creative',
      description: 'Playful language, thinks outside the box',
      traits: { verbosity: 'high', humor: 'high', formality: 'low', enthusiasm: 'high' },
      greeting: 'Ahoy there, fellow code adventurer!',
      isDefault: true,
    },
    {
      id: 'teacher',
      name: 'Teacher',
      description: 'Patient, explains concepts thoroughly',
      traits: { verbosity: 'high', humor: 'low', formality: 'medium', enthusiasm: 'medium' },
      customInstructions: 'Explain concepts step by step. Use analogies when helpful. Always verify understanding.',
      isDefault: true,
    },
    {
      id: 'jarvis',
      name: 'Jarvis',
      description: 'Refined AI butler with dry wit and quiet competence',
      traits: { verbosity: 'medium', humor: 'medium', formality: 'high', enthusiasm: 'low' },
      customInstructions: 'Speak like a highly capable AI butler. Use dry, understated wit. Be polished and composed. Address the user as "sir" or "ma\'am" occasionally. Deliver even alarming information with calm poise. Offer subtle observations and gentle suggestions rather than directives.',
      greeting: 'Good to see you. What shall we tackle today, sir?',
      signoff: 'Will that be all, sir?',
      isDefault: true,
    },
  ];

  const now = new Date().toISOString();

  for (const personality of defaults) {
    const existing = getPersonality(personality.id);
    if (!existing) {
      getDb().prepare(`
        INSERT INTO clawdbot_personalities (id, name, description, traits, custom_instructions, greeting, signoff, is_default, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        personality.id,
        personality.name,
        personality.description,
        JSON.stringify(personality.traits),
        personality.customInstructions || null,
        personality.greeting || null,
        personality.signoff || null,
        personality.isDefault ? 1 : 0,
        now,
        now,
      );
    }
  }
}
