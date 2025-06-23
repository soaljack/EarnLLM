/* eslint-env browser, node */
/* eslint-disable max-classes-per-file */
/**
 * EarnLLM JavaScript SDK
 * A lightweight wrapper around the EarnLLM API for easy integration
 */

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

class EarnLLM {
  /**
   * Initialize the SDK with your API key
   * @param {string} apiKey - Your EarnLLM API key
   * @param {object} options - Configuration options
   * @param {string} options.baseUrl - Base URL for API requests (default: https://api.earnllm.com/api)
   */
  constructor(apiKey, options = {}) {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    this.apiKey = apiKey;
    this.baseUrl = options.baseUrl || 'https://api.earnllm.com/api';
  }

  /**
   * Make an API request to EarnLLM
   * @private
   */
  async _request(endpoint, method = 'GET', data = null) {
    const url = `${this.baseUrl}${endpoint}`;

    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'EarnLLM-JS-SDK/1.0.0',
    };

    const options = {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
    };

    try {
      const response = await fetch(url, options);
      const responseData = await response.json();

      if (!response.ok) {
        throw new ApiError(
          responseData.message || 'API request failed',
          response.status,
          responseData,
        );
      }

      return responseData;
    } catch (error) {
      // Re-throw specific API errors
      if (error instanceof ApiError) {
        throw error;
      }
      // Wrap other errors (e.g., network) in our custom error
      throw new ApiError('Network error or invalid JSON response', 0, { originalError: error });
    }
  }

  /**
   * Generate a chat completion
   * @param {object} params - Chat completion parameters
   * @param {array} params.messages - Array of messages in the chat
   * @param {string} params.model - Model ID to use
   * @param {number} params.temperature - Temperature for response generation (0-1)
   * @param {number} params.max_tokens - Maximum tokens to generate
   * @param {boolean} params.stream - Whether to stream the response
   * @returns {Promise<object>} - Chat completion response
   */
  async createChatCompletion(params) {
    return this._request('/llm/chat/completions', 'POST', params);
  }

  /**
   * Generate embeddings for text
   * @param {object} params - Embedding parameters
   * @param {string|array} params.input - Text to embed
   * @param {string} params.model - Model ID to use
   * @returns {Promise<object>} - Embedding response
   */
  async createEmbeddings(params) {
    return this._request('/llm/embeddings', 'POST', params);
  }

  /**
   * List available models
   * @returns {Promise<object>} - List of available models
   */
  async listModels() {
    return this._request('/models');
  }

  /**
   * Get a specific model's details
   * @param {string} modelId - ID of the model to retrieve
   * @returns {Promise<object>} - Model details
   */
  async getModel(modelId) {
    return this._request(`/models/${modelId}`);
  }

  /**
   * Register an external model (BYOM)
   * @param {object} modelDetails - External model details
   * @returns {Promise<object>} - Registered model details
   */
  async createExternalModel(modelDetails) {
    return this._request('/models/external', 'POST', modelDetails);
  }

  /**
   * List your external models
   * @returns {Promise<object>} - List of your external models
   */
  async listExternalModels() {
    return this._request('/models/external');
  }

  /**
   * Get API usage statistics
   * @param {string} period - Time period ('day', 'week', 'month', 'year')
   * @returns {Promise<object>} - Usage statistics
   */
  async getUsage(period = 'month') {
    return this._request(`/users/me/usage?period=${period}`);
  }

  /**
   * Get current user details
   * @returns {Promise<object>} - User details
   */
  async getUserProfile() {
    return this._request('/users/me');
  }

  /**
   * List API keys
   * @returns {Promise<object>} - List of API keys
   */
  async listApiKeys() {
    return this._request('/api-keys');
  }

  /**
   * Create a new API key
   * @param {object} keyDetails - API key details
   * @returns {Promise<object>} - Created API key
   */
  async createApiKey(keyDetails) {
    return this._request('/api-keys', 'POST', keyDetails);
  }

  /**
   * Revoke an API key
   * @param {string} keyId - ID of the API key to revoke
   * @returns {Promise<object>} - Response
   */
  async revokeApiKey(keyId) {
    return this._request(`/api-keys/${keyId}/revoke`, 'PUT');
  }

  /**
   * List available pricing plans
   * @returns {Promise<object>} - List of pricing plans
   */
  async listPricingPlans() {
    return this._request('/billing/plans');
  }

  /**
   * Get subscription details
   * @returns {Promise<object>} - Subscription details
   */
  async getSubscription() {
    return this._request('/billing/subscription');
  }

  /**
   * Create a checkout session for subscription
   * @param {string} planId - ID of the plan to subscribe to
   * @returns {Promise<object>} - Checkout session
   */
  async createCheckoutSession(planId) {
    return this._request('/billing/checkout-session', 'POST', { planId });
  }

  /**
   * Create a customer portal session
   * @returns {Promise<object>} - Customer portal session
   */
  async createPortalSession() {
    return this._request('/billing/portal-session', 'POST');
  }

  /**
   * Add credits to your account
   * @param {number} amountUsd - Amount in USD to add
   * @returns {Promise<object>} - Payment intent
   */
  async addCredits(amountUsd) {
    return this._request('/billing/add-credits', 'POST', { amountUsd });
  }
}

// For CommonJS environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EarnLLM;
}

// For browser environments
if (typeof window !== 'undefined') {
  window.EarnLLM = EarnLLM;
}

// For ES modules
export default EarnLLM;
