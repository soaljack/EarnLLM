/**
 * Unit tests for token counting utilities
 */

const { countTokensInText, countTokensInMessages, calculateCost } = require('../../src/utils/tokenCounter');

describe('Token Counter Utilities', () => {
  describe('countTokensInText', () => {
    test('should count tokens in a simple string', () => {
      const text = 'Hello, world!';
      const tokenCount = countTokensInText(text);
      expect(tokenCount).toBeGreaterThan(0);
    });

    test('should return 0 for empty text', () => {
      expect(countTokensInText('')).toBe(0);
      expect(countTokensInText(null)).toBe(0);
      expect(countTokensInText(undefined)).toBe(0);
    });

    test('should count tokens in a longer text', () => {
      const text = 'This is a longer piece of text that should result in more tokens. '
        + 'It contains multiple sentences and should have a higher token count than a simple greeting.';
      const tokenCount = countTokensInText(text);
      expect(tokenCount).toBeGreaterThan(20);
    });
  });

  describe('countTokensInMessages', () => {
    test('should count tokens in chat messages array', () => {
      const messages = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello, who are you?' },
        { role: 'assistant', content: 'I am an AI assistant created by EarnLLM.' },
      ];
      const tokenCount = countTokensInMessages(messages);
      expect(tokenCount).toBeGreaterThan(0);
    });

    test('should handle empty messages array', () => {
      expect(countTokensInMessages([])).toBe(0);
      expect(countTokensInMessages(null)).toBe(0);
      expect(countTokensInMessages(undefined)).toBe(0);
    });

    test('should count tokens in messages with name field', () => {
      const messages = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello there', name: 'John' },
        { role: 'assistant', content: 'Hello John, how can I help you?' },
      ];
      const tokenCount = countTokensInMessages(messages);
      expect(tokenCount).toBeGreaterThan(0);
    });
  });

  describe('calculateCost', () => {
    test('should calculate cost for system model', () => {
      const usage = {
        promptTokens: 100,
        completionTokens: 50,
      };

      const model = {
        basePromptTokenCostInCents: 0.01,
        baseCompletionTokenCostInCents: 0.03,
        markupPercentage: 20,
      };

      const result = calculateCost(usage, model);

      expect(result.promptTokens).toBe(100);
      expect(result.completionTokens).toBe(50);
      expect(result.totalTokens).toBe(150);

      // Base cost + 20% markup
      const expectedPromptCost = (100 / 1000) * 0.01 * 1.2;
      const expectedCompletionCost = (50 / 1000) * 0.03 * 1.2;

      expect(result.promptCostCents).toBeCloseTo(expectedPromptCost, 6);
      expect(result.completionCostCents).toBeCloseTo(expectedCompletionCost, 6);
      expect(result.totalCostCents).toBeCloseTo(expectedPromptCost + expectedCompletionCost, 6);
    });

    test('should calculate cost for external model', () => {
      const usage = {
        promptTokens: 100,
        completionTokens: 50,
      };

      const model = {
        promptTokenCostInCents: 0.02,
        completionTokenCostInCents: 0.05,
      };

      const result = calculateCost(usage, model, true);

      expect(result.promptTokens).toBe(100);
      expect(result.completionTokens).toBe(50);
      expect(result.totalTokens).toBe(150);

      const expectedPromptCost = (100 / 1000) * 0.02;
      const expectedCompletionCost = (50 / 1000) * 0.05;

      expect(result.promptCostCents).toBeCloseTo(expectedPromptCost, 6);
      expect(result.completionCostCents).toBeCloseTo(expectedCompletionCost, 6);
      expect(result.totalCostCents).toBeCloseTo(expectedPromptCost + expectedCompletionCost, 6);
    });
  });
});
