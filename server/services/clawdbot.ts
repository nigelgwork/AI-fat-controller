import { randomUUID } from 'crypto';
import {
  getPersonalities as repoGetPersonalities,
  getPersonality as repoGetPersonality,
  savePersonality as repoSavePersonality,
  deletePersonality as repoDeletePersonality,
  initializeDefaults as repoInitializeDefaults,
  type ClawdbotPersonality,
  type TraitLevel,
} from '../db/repositories/clawdbot-repo';
import * as settingsRepo from '../db/repositories/settings-repo';

// Re-export types from the repo
export type { ClawdbotPersonality, TraitLevel };

/**
 * Initialize default personalities if not present
 */
export function initializeDefaults(): void {
  repoInitializeDefaults();

  // Set default personality if none selected
  if (!settingsRepo.get('currentPersonalityId')) {
    settingsRepo.set('currentPersonalityId', 'default');
  }
}

/**
 * Get all personalities
 */
export function getPersonalities(): ClawdbotPersonality[] {
  initializeDefaults();
  return repoGetPersonalities();
}

/**
 * Get a specific personality by ID
 */
export function getPersonality(id: string): ClawdbotPersonality | null {
  const personalities = getPersonalities();
  return personalities.find((p) => p.id === id) || null;
}

/**
 * Get the current active personality
 */
export function getCurrentPersonality(): ClawdbotPersonality | null {
  const currentId = settingsRepo.get('currentPersonalityId');
  if (!currentId) {
    return getPersonality('default');
  }
  return getPersonality(currentId);
}

/**
 * Get the current personality ID
 */
export function getCurrentPersonalityId(): string | null {
  return settingsRepo.get('currentPersonalityId');
}

/**
 * Set the current active personality
 */
export function setCurrentPersonality(id: string): boolean {
  const personality = getPersonality(id);
  if (!personality) {
    return false;
  }
  settingsRepo.set('currentPersonalityId', id);
  return true;
}

/**
 * Save (create or update) a personality
 */
export function savePersonality(
  personality: Omit<ClawdbotPersonality, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): ClawdbotPersonality {
  return repoSavePersonality({
    ...personality,
    id: personality.id || randomUUID(),
    isDefault: personality.id ? undefined : false,
  } as any);
}

/**
 * Delete a personality
 */
export function deletePersonality(id: string): boolean {
  const result = repoDeletePersonality(id);

  // If deleted the current personality, reset to default
  if (result && settingsRepo.get('currentPersonalityId') === id) {
    settingsRepo.set('currentPersonalityId', 'default');
  }

  return result;
}

/**
 * Build a system prompt incorporating personality traits
 */
export function buildSystemPrompt(personality: ClawdbotPersonality, basePrompt: string): string {
  const traitInstructions: string[] = [];

  // Verbosity
  switch (personality.traits.verbosity) {
    case 'low':
      traitInstructions.push('Be concise and brief. Avoid unnecessary explanations.');
      break;
    case 'high':
      traitInstructions.push('Provide thorough explanations with context and examples when helpful.');
      break;
    // medium is default, no special instruction
  }

  // Humor
  switch (personality.traits.humor) {
    case 'low':
      traitInstructions.push('Maintain a serious, professional tone.');
      break;
    case 'high':
      traitInstructions.push('Feel free to use light humor, wit, and playful language when appropriate.');
      break;
    case 'medium':
      traitInstructions.push('Occasional light humor is fine when it fits naturally.');
      break;
  }

  // Formality
  switch (personality.traits.formality) {
    case 'low':
      traitInstructions.push('Use a casual, friendly tone. Contractions and informal language are encouraged.');
      break;
    case 'high':
      traitInstructions.push('Maintain a formal, professional tone. Avoid contractions and casual language.');
      break;
    // medium is default
  }

  // Enthusiasm
  switch (personality.traits.enthusiasm) {
    case 'low':
      traitInstructions.push('Keep responses measured and calm.');
      break;
    case 'high':
      traitInstructions.push('Show enthusiasm and energy in your responses!');
      break;
    // medium is default
  }

  // Build the full prompt
  let fullPrompt = basePrompt;

  if (traitInstructions.length > 0) {
    fullPrompt += `\n\n## Communication Style\n${traitInstructions.join(' ')}`;
  }

  if (personality.customInstructions) {
    fullPrompt += `\n\n## Custom Instructions\n${personality.customInstructions}`;
  }

  return fullPrompt;
}

/**
 * Get a greeting message for the current personality
 */
export function getGreeting(): string {
  const personality = getCurrentPersonality();
  if (personality?.greeting) {
    return personality.greeting;
  }
  return 'Hello! How can I help you today?';
}

/**
 * Get a signoff message for the current personality
 */
export function getSignoff(): string {
  const personality = getCurrentPersonality();
  return personality?.signoff || '';
}
