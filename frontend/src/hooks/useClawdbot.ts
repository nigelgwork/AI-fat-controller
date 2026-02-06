import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api';

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

/**
 * Hook to get all personalities
 */
export function usePersonalities() {
  return useQuery({
    queryKey: ['clawdbot-personalities'],
    queryFn: async () => {
      const personalities = await api.getPersonalities();
      return personalities || [];
    },
    staleTime: 30000, // Cache for 30 seconds
  });
}

/**
 * Hook to get a specific personality by ID
 */
export function usePersonality(id: string | null) {
  return useQuery({
    queryKey: ['clawdbot-personality', id],
    queryFn: async () => {
      if (!id) return null;
      return api.getPersonality(id);
    },
    enabled: !!id,
  });
}

/**
 * Hook to get the current active personality
 */
export function useCurrentPersonality() {
  return useQuery({
    queryKey: ['clawdbot-current-personality'],
    queryFn: async () => {
      return api.getCurrentPersonality();
    },
    staleTime: 10000, // Cache for 10 seconds
  });
}

/**
 * Hook to get the current personality ID
 */
export function useCurrentPersonalityId() {
  return useQuery({
    queryKey: ['clawdbot-current-personality-id'],
    queryFn: async () => {
      return api.getCurrentPersonalityId();
    },
    staleTime: 10000,
  });
}

/**
 * Hook to set the current personality
 */
export function useSetCurrentPersonality() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const success = await api.setCurrentPersonality(id);
      if (!success) {
        throw new Error('Failed to set personality');
      }
      return success;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clawdbot-current-personality'] });
      queryClient.invalidateQueries({ queryKey: ['clawdbot-current-personality-id'] });
    },
  });
}

/**
 * Hook to save (create or update) a personality
 */
export function useSavePersonality() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      personality: Omit<ClawdbotPersonality, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
    ) => {
      return api.savePersonality(personality);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clawdbot-personalities'] });
      queryClient.invalidateQueries({ queryKey: ['clawdbot-current-personality'] });
    },
  });
}

/**
 * Hook to delete a personality
 */
export function useDeletePersonality() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const success = await api.deletePersonality(id);
      if (!success) {
        throw new Error('Cannot delete default personality');
      }
      return success;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clawdbot-personalities'] });
      queryClient.invalidateQueries({ queryKey: ['clawdbot-current-personality'] });
      queryClient.invalidateQueries({ queryKey: ['clawdbot-current-personality-id'] });
    },
  });
}

/**
 * Hook to get the greeting message for current personality
 */
export function useClawdbotGreeting() {
  return useQuery({
    queryKey: ['clawdbot-greeting'],
    queryFn: async () => {
      return api.getClawdbotGreeting() ?? 'Hello! How can I help you today?';
    },
    staleTime: 10000,
  });
}

/**
 * Utility to get trait level display value
 */
export function getTraitDisplay(level: TraitLevel): string {
  switch (level) {
    case 'low':
      return 'Low';
    case 'medium':
      return 'Medium';
    case 'high':
      return 'High';
    default:
      return level;
  }
}

/**
 * Utility to get trait level as percentage (0-100)
 */
export function getTraitPercentage(level: TraitLevel): number {
  switch (level) {
    case 'low':
      return 25;
    case 'medium':
      return 50;
    case 'high':
      return 100;
    default:
      return 50;
  }
}

/**
 * Utility to convert percentage to trait level
 */
export function percentageToTraitLevel(percentage: number): TraitLevel {
  if (percentage <= 33) return 'low';
  if (percentage <= 66) return 'medium';
  return 'high';
}
