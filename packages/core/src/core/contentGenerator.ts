/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GenerateContentParameters,
  GenerateContentResponse,
  CountTokensParameters,
  CountTokensResponse,
  EmbedContentParameters,
  EmbedContentResponse,
} from '@google/genai';
import { Config } from '../config/config.js';
import { DeepSeekClient } from './deepseek.js';
import { GeminiClient } from './client.js';
import { LLMProvider } from './llm.js';
import { Turn } from './turn.js';
import { AuthType, ContentGeneratorConfig } from '../config/auth.js';

// Re-export AuthType for convenience
export { AuthType };

/**
 * Interface abstracting the core functionalities for generating content and counting tokens.
 * This interface is compatible with @google/genai Models interface.
 */
export interface ContentGenerator {
  generateContent(
    req: GenerateContentParameters,
  ): Promise<GenerateContentResponse>;
  generateContentStream(
    req: GenerateContentParameters,
  ): Promise<AsyncGenerator<GenerateContentResponse>>;
  countTokens(req: CountTokensParameters): Promise<CountTokensResponse>;
  embedContent(req: EmbedContentParameters): Promise<EmbedContentResponse>;
}

export async function createContentGeneratorConfig(
  model: string,
  authType: AuthType,
  config: Config,
): Promise<ContentGeneratorConfig> {
  return {
    model,
    authType,
  };
}

/**
 * Adapter class to make LLMProvider compatible with ContentGenerator interface
 */
class LLMProviderAdapter implements ContentGenerator {
  constructor(private llmProvider: LLMProvider) {}

  async generateContent(
    req: GenerateContentParameters,
  ): Promise<GenerateContentResponse> {
    // For DeepSeek, we need to call a different method that handles system prompts
    if ('generateContentWithSystemPrompt' in this.llmProvider) {
      return (this.llmProvider as any).generateContentWithSystemPrompt(req);
    }

    // Fallback for other providers - convert GenerateContentParameters to Turn[] format
    // This is a simplified conversion - in a real implementation,
    // we would need proper Turn objects
    const turns: Turn[] = [];
    return this.llmProvider.generateContent(turns);
  }

  async generateContentStream(
    req: GenerateContentParameters,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    // For DeepSeek, we need to call the same method that handles system prompts
    if ('generateContentWithSystemPrompt' in this.llmProvider) {
      const response = await (this.llmProvider as any).generateContentWithSystemPrompt(req);
      return (async function* () {
        yield response;
      })();
    }

    // Fallback for other providers - implement as a simple wrapper
    const response = await this.generateContent(req);
    return (async function* () {
      yield response;
    })();
  }

  async countTokens(req: CountTokensParameters): Promise<CountTokensResponse> {
    // Simple token estimation - just return a fixed number for now
    // In a real implementation, this would properly count tokens
    return { totalTokens: 100 };
  }

  async embedContent(
    req: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    throw new Error('Embedding not supported by LLM provider adapter');
  }
}

/**
 * Factory function to create content generators for different providers
 */
export async function createContentGenerator(
  config: Config,
): Promise<ContentGenerator> {
  const provider = config.getProvider();

  // Debug information
  console.log('createContentGenerator called with provider:', provider);
  console.log('Config details:', {
    provider: config.getProvider(),
    model: config.getModel(),
    providers: config.getProviders()
  });

  switch (provider) {
    case 'google': {
      console.log('Creating Google Gemini client');
      const geminiClient = new GeminiClient(config);
      return geminiClient.getContentGenerator();
    }
    case 'deepseek': {
      console.log('Creating DeepSeek client');
      const deepseekClient = new DeepSeekClient(config);
      return new LLMProviderAdapter(deepseekClient);
    }
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}
