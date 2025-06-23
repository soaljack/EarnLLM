# EarnLLM API Reference

## Overview

The EarnLLM API allows you to monetize AI language models on your websites and applications. 
This API provides both hosted models and support for Bring Your Own Model (BYOM).

**Base URL:** `https://api.earnllm.com/api`

## Authentication

EarnLLM API uses API key authentication for all endpoints. 
Include your API key in the header of all requests:

```
Authorization: Bearer YOUR_API_KEY
```

## Core Endpoints

### LLM Endpoints

#### Chat Completions

```
POST /llm/chat/completions
```

Generate chat completions from LLM models, similar to OpenAI's ChatGPT.

**Request:**

```json
{
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Hello, who are you?" }
  ],
  "model": "gpt-4",  // Can be a system model ID or "external:YOUR_MODEL_ID"
  "temperature": 0.7,
  "max_tokens": 150
}
```

**Response:**

```json
{
  "id": "cmpl-abc123",
  "object": "chat.completion",
  "created": 1677858242,
  "model": "gpt-4",
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "Hello! I'm an AI assistant based on GPT technology, designed to be helpful, harmless, and honest."
    },
    "index": 0,
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 20,
    "completion_tokens": 19,
    "total_tokens": 39
  }
}
```

#### Embeddings

```
POST /llm/embeddings
```

Generate vector embeddings from text for semantic search and other NLP tasks.

**Request:**

```json
{
  "input": "The quick brown fox jumps over the lazy dog",
  "model": "text-embedding-ada-002"
}
```

**Response:**

```json
{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "embedding": [0.0023064255, -0.009327292, ...],
      "index": 0
    }
  ],
  "model": "text-embedding-ada-002",
  "usage": {
    "prompt_tokens": 8,
    "total_tokens": 8
  }
}
```

### Models

#### List Available Models

```
GET /models
```

List all available models.

**Response:**

```json
{
  "data": [
    {
      "id": "gpt-4",
      "object": "model",
      "created": 1677610602,
      "owned_by": "openai",
      "provider": "openai",
      "contextWindow": 8192,
      "tokenCostPrompt": 0.03,
      "tokenCostCompletion": 0.06
    },
    // ... more models
  ]
}
```

#### External Models

```
POST /models/external
```

Register your own model endpoint (BYOM).

**Request:**

```json
{
  "name": "My Custom GPT Model",
  "provider": "my-company",
  "apiEndpoint": "https://api.mycompany.com/v1/completions",
  "apiKey": "your-api-key",
  "apiHeaders": {
    "X-Custom-Header": "value"
  },
  "requestTemplate": "JSON template for the API request",
  "responseMapping": "JSON path mapping for the response",
  "promptTokenCostInCents": 0.01,
  "completionTokenCostInCents": 0.02,
  "capabilities": ["chat", "text-generation"],
  "contextWindow": 4096
}
```

## User Management

### Register

```
POST /auth/register
```

**Request:**

```json
{
  "email": "user@example.com",
  "password": "secure_password",
  "firstName": "John",
  "lastName": "Doe",
  "companyName": "Example Inc"
}
```

### Login

```
POST /auth/login
```

**Request:**

```json
{
  "email": "user@example.com",
  "password": "secure_password"
}
```

### API Key Management

#### Create API Key

```
POST /api-keys
```

**Request:**

```json
{
  "name": "Production API Key",
  "expiresAt": "2025-12-31T23:59:59Z"  // Optional
}
```

## Billing

### List Plans

```
GET /billing/plans
```

### Create Checkout Session

```
POST /billing/checkout-session
```

**Request:**

```json
{
  "planId": "plan_123"
}
```

### Add Credits

```
POST /billing/add-credits
```

**Request:**

```json
{
  "amountUsd": 50
}
```

## Analytics

### User Usage

```
GET /users/me/usage?period=month
```

Query parameter `period` can be: day, week, month, year

### Admin Analytics (Admin Only)

```
GET /analytics/admin/overview
GET /analytics/admin/users-growth
GET /analytics/admin/revenue
```

## Error Codes

EarnLLM API uses standard HTTP status codes to indicate the success or failure of an API request.

| Status Code | Description |
|-------------|-------------|
| 200 | OK - The request was successful |
| 400 | Bad Request - The request could not be understood or was missing required parameters |
| 401 | Unauthorized - Authentication failed or insufficient permissions |
| 403 | Forbidden - Authentication succeeded but account lacks permissions |
| 404 | Not Found - Resource not found |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Something went wrong on our end |

Each error response includes a message that explains the error.
