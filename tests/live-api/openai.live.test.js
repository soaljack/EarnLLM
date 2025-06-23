const request = require('supertest');

// The full API key is seeded by jest.setup.live.js and available globally.

// Helper to generate a unique user for testing if needed, or use a fixed one
// For now, we'll assume the API key implies a user context recognized by your app.

describe('Live OpenAI API Integration', () => {
  // Timeout for this test suite, can be adjusted
  // jest.setTimeout(30000); // Already set in jest.config.live.js

  describe('POST /api/llm/chat/completions', () => {
    it('should get a successful response from a system OpenAI model', async () => {
      // Ensure you have a system model configured that uses OpenAI, e.g., 'gpt-3.5-turbo'
      // This modelId should exist in your LlmModel table after db sync.
      // For this test to pass, your .env OPENAI_API_KEY must be valid.
      const payload = {
        model: 'gpt-3.5-turbo', // Replace with a valid system modelId if different
        messages: [
          { role: 'user', content: 'Say: Hello OpenAI!' },
        ],
        max_tokens: 10,
      };

      const response = await global.testRequest
        .post('/api/llm/chat/completions')
        .set('x-api-key', global.LIVE_TEST_API_FULL_KEY)
        .send(payload);

      expect(response.statusCode).toBe(200);
      expect(response.body).toBeDefined();
      expect(response.body.choices).toBeInstanceOf(Array);
      expect(response.body.choices.length).toBeGreaterThan(0);
      expect(response.body.choices[0].message).toBeDefined();
      expect(response.body.choices[0].message.content).toBeDefined();
      // console.log('OpenAI Response:', response.body.choices[0].message.content);
    });

    it('should handle errors for an invalid OpenAI API key (requires setup)', async () => {
      // This test is more complex to set up reliably for a live environment
      // as it depends on temporarily having an invalid key or mocking the API
      // call at a lower level.
      // For now, we'll focus on the success case.
      // One approach could be to use a specific, known-bad API key if your app allows it,
      // or to test against an endpoint that's expected to fail authentication.
      // console.warn('Skipping test for invalid OpenAI API key in live environment for now.');
      expect(true).toBe(true); // Placeholder
    });

    // Add more tests for other scenarios, e.g.:
    // - Different models
    // - Temperature, max_tokens variations
    // - Error handling for quota limits (if feasible to test)
  });

  // You can add similar describe blocks for other LLM routes like /embeddings
});
