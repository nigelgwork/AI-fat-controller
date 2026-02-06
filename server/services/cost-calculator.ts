// Claude pricing per 1M tokens (as of 2024)
// These are approximate values and may change over time

export interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

export const CLAUDE_PRICING: Record<string, ModelPricing> = {
  // Claude 3.5 Sonnet (default)
  'claude-3-5-sonnet': {
    inputPer1M: 3.00,
    outputPer1M: 15.00,
  },
  // Claude 3.5 Haiku
  'claude-3-5-haiku': {
    inputPer1M: 1.00,
    outputPer1M: 5.00,
  },
  // Claude 3 Opus
  'claude-3-opus': {
    inputPer1M: 15.00,
    outputPer1M: 75.00,
  },
  // Claude 4 Sonnet (estimated)
  'claude-4-sonnet': {
    inputPer1M: 3.00,
    outputPer1M: 15.00,
  },
  // Default (assume Sonnet pricing)
  default: {
    inputPer1M: 3.00,
    outputPer1M: 15.00,
  },
};

/**
 * Calculate the cost in USD for token usage
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  model: string = 'default'
): number {
  const pricing = CLAUDE_PRICING[model] || CLAUDE_PRICING.default;

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;

  return inputCost + outputCost;
}

/**
 * Format cost as a string with currency symbol
 */
export function formatCost(costUsd: number): string {
  if (costUsd < 0.001) {
    return `$${costUsd.toFixed(6)}`;
  }
  if (costUsd < 0.01) {
    return `$${costUsd.toFixed(4)}`;
  }
  if (costUsd < 1) {
    return `$${costUsd.toFixed(3)}`;
  }
  return `$${costUsd.toFixed(2)}`;
}

/**
 * Calculate cost breakdown
 */
export interface CostBreakdown {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
}

export function calculateCostBreakdown(
  inputTokens: number,
  outputTokens: number,
  model: string = 'default'
): CostBreakdown {
  const pricing = CLAUDE_PRICING[model] || CLAUDE_PRICING.default;

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;

  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
    inputPricePerMillion: pricing.inputPer1M,
    outputPricePerMillion: pricing.outputPer1M,
  };
}

/**
 * Estimate tokens from text (rough approximation)
 * Average is ~4 characters per token for English text
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Format tokens as a human-readable string
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(0)}K`;
  }
  return tokens.toString();
}
