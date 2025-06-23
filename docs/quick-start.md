# EarnLLM Quick Start Guide

## Introduction

EarnLLM is an API service that allows you to monetize AI language models on your website or app. This quick start guide will help you get up and running in minutes.

## 1. Sign Up

Start by signing up for an account at [dashboard.earnllm.com/register](https://dashboard.earnllm.com/register).

## 2. Choose Your Plan

Select a pricing plan that fits your needs:

- **Starter (Free)**: Limited usage, perfect for testing
- **Earn-as-You-Go**: Pay only for what you use
- **Pro Plan**: Flat monthly fee with premium support
- **BYOM (Bring Your Own Model)**: Use your own models with our infrastructure

## 3. Generate Your API Key

1. Log into the [Dashboard](https://dashboard.earnllm.com)
2. Go to "API Keys" section
3. Click "Create New API Key"
4. Name your key and set permissions
5. Copy the API key displayed (it will only be shown once)

## 4. Make Your First API Call

### Using cURL

```bash
curl -X POST https://api.earnllm.com/api/llm/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello, who are you?"}
    ],
    "model": "gpt-4",
    "temperature": 0.7
  }'
```

### Using JavaScript

```javascript
const axios = require('axios');

async function generateChatCompletion() {
  try {
    const response = await axios.post('https://api.earnllm.com/api/llm/chat/completions', {
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hello, who are you?" }
      ],
      model: "gpt-4",
      temperature: 0.7
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer YOUR_API_KEY`
      }
    });
    
    console.log(response.data);
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}

generateChatCompletion();
```

### Using Python

```python
import requests

url = "https://api.earnllm.com/api/llm/chat/completions"
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
}
data = {
    "messages": [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello, who are you?"}
    ],
    "model": "gpt-4",
    "temperature": 0.7
}

response = requests.post(url, headers=headers, json=data)
print(response.json())
```

## 5. Implement in Your Website or App

### JavaScript Frontend Example

```html
<script>
async function askAI() {
  const userInput = document.getElementById('user-input').value;
  const responseDiv = document.getElementById('ai-response');
  
  responseDiv.innerHTML = 'Thinking...';
  
  try {
    const response = await fetch('YOUR_BACKEND_API', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: userInput
      })
    });
    
    const data = await response.json();
    responseDiv.innerHTML = data.response;
    
  } catch (error) {
    responseDiv.innerHTML = 'Error: Could not get a response';
    console.error(error);
  }
}
</script>

<input type="text" id="user-input" placeholder="Ask the AI...">
<button onclick="askAI()">Send</button>
<div id="ai-response"></div>
```

### Node.js Backend Example

```javascript
const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

app.post('/api/ask', async (req, res) => {
  try {
    const userMessage = req.body.message;
    
    const response = await axios.post('https://api.earnllm.com/api/llm/chat/completions', {
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: userMessage }
      ],
      model: "gpt-4",
      temperature: 0.7
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer YOUR_API_KEY`
      }
    });
    
    res.json({
      response: response.data.choices[0].message.content
    });
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to get AI response' });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## 6. Track Usage and Revenue

1. Log into the [Dashboard](https://dashboard.earnllm.com)
2. Go to "Analytics" section
3. View metrics like:
   - API calls by model
   - Token usage
   - Revenue generated
   - Costs incurred

## 7. Bring Your Own Model (BYOM)

If you're using the BYOM plan, you can register your own model endpoints:

1. Log into the [Dashboard](https://dashboard.earnllm.com)
2. Go to "External Models" section
3. Click "Register New Model"
4. Fill in your model details:
   - Name and provider
   - API endpoint
   - API key (will be encrypted)
   - Cost parameters
   - Request/response templates

Once registered, your model will be available at `external:your-model-id`.

## 8. Set Up Billing

1. Log into the [Dashboard](https://dashboard.earnllm.com)
2. Go to "Billing" section
3. Add your payment method
4. Set up any subscription plans or pay-as-you-go options

## Next Steps

- Check out the full [API Reference](/docs/api-reference.md)
- Learn about [Advanced Features](/docs/advanced-features.md)
- Join our [Discord community](https://discord.gg/earnllm) for support

For any questions or support needs, contact us at support@earnllm.com.
