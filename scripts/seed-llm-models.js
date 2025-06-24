const { sequelize, LlmModel } = require('../src/models');
require('dotenv').config();

const models = [
  {
    name: 'GPT-4',
    provider: 'OpenAI',
    modelId: 'gpt-4',
    isActive: true,
    description: 'The most powerful OpenAI model, great for complex reasoning.',
    capabilities: ['chat', 'tools'],
    basePromptTokenCostInCents: 0.3,
    baseCompletionTokenCostInCents: 0.6,
    contextWindow: 8192,
    markupPercentage: 20,
  },
  {
    name: 'GPT-3.5 Turbo',
    provider: 'OpenAI',
    modelId: 'gpt-3.5-turbo',
    isActive: true,
    description: 'A fast and affordable model for general-purpose tasks.',
    capabilities: ['chat'],
    basePromptTokenCostInCents: 0.05,
    baseCompletionTokenCostInCents: 0.15,
    contextWindow: 16385,
    markupPercentage: 25,
  },
  {
    name: 'Text Embedding 3 Large',
    provider: 'OpenAI',
    modelId: 'text-embedding-3-large',
    isActive: true,
    description: 'The latest and most performant embedding model from OpenAI.',
    capabilities: ['embed'],
    basePromptTokenCostInCents: 0.013, // Cost per 1000 tokens
    baseCompletionTokenCostInCents: 0, // Not applicable
    contextWindow: 8191,
    markupPercentage: 20,
  },
];

const seedLlmModels = async () => {
  try {
    await sequelize.sync();
    console.log('Seeding LLM models...');

    const seedPromises = models.map(async (modelData) => {
      const [model, created] = await LlmModel.findOrCreate({
        where: { modelId: modelData.modelId },
        defaults: modelData,
      });

      if (created) {
        console.log(`✅ Created model: ${model.name}`);
      } else {
        // Optional: Update existing models if needed
        await model.update(modelData);
        console.log(`🔄 Updated model: ${model.name}`);
      }
    });

    await Promise.all(seedPromises);

    console.log('✅ LLM models seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding LLM models:', error);
  } finally {
    await sequelize.close();
  }
};

seedLlmModels();
