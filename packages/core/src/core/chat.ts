/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { PartListUnion } from '@google/genai';
import { Turn, ServerGeminiStreamEvent, GeminiEventType } from './turn.js';
import { LLMProvider } from './llm.js';
import { GeminiChat } from './geminiChat.js';

export class Chat {
  private readonly MAX_TURNS = 100;
  private history: Turn[] = [];
  private geminiChat: GeminiChat | null = null;

  constructor(private llmProvider: LLMProvider) {}

  async *sendMessageStream(
    request: PartListUnion,
    signal: AbortSignal,
    turns: number = this.MAX_TURNS,
  ): AsyncGenerator<ServerGeminiStreamEvent, Turn> {
    // For now, create a simplified implementation
    // This needs to be properly implemented with GeminiChat integration

    // Create a mock turn for compatibility
    const mockTurn = {
      pendingToolCalls: [],
      getDebugResponses: () => [],
      run: async function* (): AsyncGenerator<ServerGeminiStreamEvent> {
        yield {
          type: GeminiEventType.Content,
          value: 'Mock response from Chat class',
        };
      },
    } as unknown as Turn;

    this.history.push(mockTurn);

    // Yield a simple content event
    yield {
      type: GeminiEventType.Content,
      value: 'Mock response from Chat class',
    };

    return mockTurn;
  }

  getHistory(): Turn[] {
    return this.history;
  }
}
