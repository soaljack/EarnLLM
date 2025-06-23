/**
 * Utility functions for counting tokens and calculating costs
 */

const { encode } = require('gpt-3-encoder');

/**
 * Count the number of tokens in a text string using GPT-3 tokenizer
 * @param {string} text - Text to count tokens for
 * @returns {number} - Token count
 */
function countTokensInText(text) {
  if (!text) return 0;
  const tokens = encode(text);
  return tokens.length;
}

/**
 * Count tokens in a chat messages array
 *
 * This is an approximation based on OpenAI's tokenization.
 * Different models may have slightly different tokenization.
 *
 * @param {Array} messages - Array of chat messages in the format [{role: string, content: string}]
 * @returns {number} - Total token count
 */
function countTokensInMessages(messages) {
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return 0;
  }

  let tokenCount = 0;

  // Add tokens for each message
  messages.forEach((message) => {
    // Count tokens in the content
    tokenCount += countTokensInText(message.content);

    // Add tokens for the message format
    // 4 tokens for the role, ~3 tokens for the message format itself
    tokenCount += 4;

    // If there's a name field, add tokens for that
    if (message.name) {
      tokenCount += countTokensInText(message.name);
      tokenCount += 1; // Add 1 token for the name field itself
    }
  });

  // Add tokens for the overall message format (approximation)
  tokenCount += 3;

  return tokenCount;
}

/**
 * Calculate the cost of a request based on token usage and model costs
 *
 * @param {Object} usage - Token usage {promptTokens, completionTokens}
 * @param {Object} model - Model with cost information
 * @param {boolean} isExternal - Whether this is an external model
 * @returns {Object} - Cost breakdown
 */
function calculateCost(usage, model, isExternal = false) {
  const { promptTokens, completionTokens } = usage;
  const totalTokens = promptTokens + completionTokens;

  let promptCost; let
    completionCost;

  if (isExternal) {
    // External models use direct costs set by user
    promptCost = (promptTokens / 1000) * model.promptTokenCostInCents;
    completionCost = (completionTokens / 1000) * model.completionTokenCostInCents;
  } else {
    // System models use base cost + markup
    const promptBaseCost = (promptTokens / 1000) * model.basePromptTokenCostInCents;
    const completionBaseCost = (completionTokens / 1000) * model.baseCompletionTokenCostInCents;

    // Apply markup percentage
    promptCost = promptBaseCost * (1 + model.markupPercentage / 100);
    completionCost = completionBaseCost * (1 + model.markupPercentage / 100);
  }

  const totalCost = promptCost + completionCost;

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    promptCostCents: parseFloat(promptCost.toFixed(6)),
    completionCostCents: parseFloat(completionCost.toFixed(6)),
    totalCostCents: parseFloat(totalCost.toFixed(6)),
  };
}

module.exports = {
  countTokensInText,
  countTokensInMessages,
  calculateCost,
};
