/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GenerateContentResponse, FinishReason, Content, Part, GenerateContentParameters } from '@google/genai';
import { Turn } from './turn.js';
import { LLMProvider } from './llm.js';
import axios from 'axios';
import { Config } from '../config/config.js';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// DeepSeek Chat instance that mimics GeminiChat interface
class DeepSeekChat {
  private history: Content[] = [];
  private systemPrompt: string = '';

  constructor(private apiKey: string, private model: string, systemPrompt?: string) {
    this.systemPrompt = systemPrompt || '';
  }

  addHistory(content: Content): void {
    this.history.push(content);
  }

  getHistory(): Content[] {
    return [...this.history];
  }

  setHistory(history: Content[]): void {
    this.history = [...history];
  }

  async sendMessageStream(params: { message: string | Part | Part[]; config?: { abortSignal?: AbortSignal } }): Promise<AsyncGenerator<GenerateContentResponse>> {
    // Convert message to string
    let messageText: string;
    if (typeof params.message === 'string') {
      messageText = params.message;
    } else if (Array.isArray(params.message)) {
      messageText = params.message.map(part => 'text' in part ? part.text : '').join('');
    } else if ('text' in params.message) {
      messageText = params.message.text || '';
    } else {
      messageText = '';
    }

    // Add user message to history
    this.addHistory({
      role: 'user',
      parts: [{ text: messageText }]
    });

    // Convert history to DeepSeek format
    const messages: Array<{role: string, content: string}> = [];

    // Add system prompt if available
    if (this.systemPrompt.trim()) {
      messages.push({
        role: 'system',
        content: this.systemPrompt
      });
    }

    // Add conversation history
    this.history.forEach(content => {
      const role = content.role === 'model' ? 'assistant' : (content.role || 'user');
      const text = (content.parts || []).map(part => 'text' in part ? (part.text || '') : '').join('');
      if (text.trim()) {
        messages.push({
          role,
          content: text
        });
      }
    });

    try {
      const response = await axios.post(
        DEEPSEEK_API_URL,
        {
          model: 'deepseek-chat', // Always use DeepSeek model name
          messages,
          stream: false, // For now, we'll implement non-streaming
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          signal: params.config?.abortSignal,
        }
      );

      const deepseekResponse = response.data;
      const assistantMessage = deepseekResponse.choices[0]?.message?.content || '';

      // Add assistant response to history
      this.addHistory({
        role: 'model',
        parts: [{ text: assistantMessage }]
      });

      // Convert to Gemini format
      const geminiResponse = new GenerateContentResponse();
      geminiResponse.candidates = [{
        content: {
          role: 'model',
          parts: [{ text: assistantMessage }]
        },
        finishReason: FinishReason.STOP,
        safetyRatings: []
      }];
      geminiResponse.usageMetadata = {
        promptTokenCount: deepseekResponse.usage?.prompt_tokens || 0,
        candidatesTokenCount: deepseekResponse.usage?.completion_tokens || 0,
        totalTokenCount: deepseekResponse.usage?.total_tokens || 0,
      };

      // Return as async generator
      return (async function* () {
        yield geminiResponse;
      })();

    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error(
          `DeepSeek API authentication failed. ` +
          `Environment variable DEEPSEEK_API_KEY: ${process.env.DEEPSEEK_API_KEY ? 'SET' : 'NOT SET'}. ` +
          `Please check your API key.`
        );
      }
      throw error;
    }
  }
}

export class DeepSeekClient implements LLMProvider {
  private apiKey: string;
  private chat?: DeepSeekChat;
  private model: string;

  constructor(private config: Config) {
    this.apiKey = this.config.getProviders()?.deepseek?.apiKey || '';
    // For DeepSeek, always use deepseek-chat as the model name for display
    // The actual API call will use 'deepseek-chat' regardless
    this.model = 'deepseek-chat';

    // Debug information
    console.log('DeepSeekClient Debug Info:');
    console.log('- Environment DEEPSEEK_API_KEY:', process.env.DEEPSEEK_API_KEY ? 'SET' : 'NOT SET');
    console.log('- Config providers:', JSON.stringify(this.config.getProviders(), null, 2));
    console.log('- Extracted API Key:', this.apiKey ? 'SET' : 'NOT SET');
    console.log('- Current provider:', this.config.getProvider());
    console.log('- Model:', this.model);
    console.log('- Config getModel():', this.config.getModel());
  }

  // GeminiClient-compatible methods
  async initialize(contentConfig?: any): Promise<void> {
    // Initialize the chat with system prompt
    await this.startChat();
  }

  getChat(): DeepSeekChat {
    if (!this.chat) {
      throw new Error('DeepSeek chat not initialized. Call initialize() first.');
    }
    return this.chat;
  }

  // Method to update system prompt for existing chat
  updateSystemPrompt(systemPrompt: string): void {
    if (this.chat) {
      (this.chat as any).systemPrompt = systemPrompt;
    }
  }

  // Add startChat method for compatibility with GeminiClient interface
  async startChat(extraHistory?: any[]): Promise<any> {
    // Import getCoreSystemPrompt dynamically to avoid circular dependency
    const { getCoreSystemPrompt } = await import('./prompts.js');

    const userMemory = this.config.getUserMemory();
    const systemInstruction = getCoreSystemPrompt(userMemory);

    // Create a new chat with system prompt
    this.chat = new DeepSeekChat(this.apiKey, this.model, systemInstruction);

    // Add any extra history if provided
    if (extraHistory && extraHistory.length > 0) {
      extraHistory.forEach(content => {
        this.chat!.addHistory(content);
      });
    }

    return this.chat;
  }

  async addHistory(content: Content): Promise<void> {
    this.getChat().addHistory(content);
  }

  async getHistory(): Promise<Content[]> {
    return this.getChat().getHistory();
  }

  async setHistory(history: Content[]): Promise<void> {
    this.getChat().setHistory(history);
  }

  async resetChat(): Promise<void> {
    // Preserve the system prompt when resetting
    const currentSystemPrompt = this.chat ? (this.chat as any).systemPrompt : '';
    this.chat = new DeepSeekChat(this.apiKey, this.model, currentSystemPrompt);
  }

  async generateContent(history: Turn[]): Promise<GenerateContentResponse> {
    if (!this.apiKey) {
      const envKey = process.env.DEEPSEEK_API_KEY;
      const configProviders = this.config.getProviders();
      throw new Error(
        `DEEPSEEK_API_KEY is not configured.\n` +
        `Environment variable DEEPSEEK_API_KEY: ${envKey ? 'SET' : 'NOT SET'}\n` +
        `Config providers: ${JSON.stringify(configProviders, null, 2)}\n` +
        `Please set the DEEPSEEK_API_KEY environment variable.`
      );
    }

    // Convert Turn[] to DeepSeek API message format
    const messages = this.convertTurnsToMessages(history);

    try {
      const response = await axios.post(
        DEEPSEEK_API_URL,
        {
          model: 'deepseek-chat', // Always use DeepSeek model name
          messages,
          stream: false,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
        },
      );

      // Convert DeepSeek API response to GenerateContentResponse format
      return this.convertDeepSeekResponseToGeminiFormat(response.data);
    } catch (error: any) {
      if (error.response) {
        throw new Error(`API Error: ${error.response.data?.error?.message || error.response.statusText} (Status: ${error.response.status === 403 ? 'Forbidden' : error.response.status})`);
      }
      throw error;
    }
  }

  private convertTurnsToMessages(history: Turn[]): Array<{role: string, content: string}> {
    const messages: Array<{role: string, content: string}> = [];

    // Add a simple user message for now
    // In a real implementation, this would extract content from Turn objects
    messages.push({
      role: 'user',
      content: 'Hello, how can you help me?'
    });

    return messages;
  }

  private convertDeepSeekResponseToGeminiFormat(deepseekResponse: any): GenerateContentResponse {
    const choice = deepseekResponse.choices?.[0];
    const content = choice?.message?.content || '';

    const response = new GenerateContentResponse();
    response.candidates = [
      {
        content: {
          parts: [{ text: content }],
          role: 'model',
        },
        finishReason: FinishReason.STOP,
        index: 0,
        safetyRatings: [],
      },
    ];
    response.usageMetadata = {
      promptTokenCount: deepseekResponse.usage?.prompt_tokens || 0,
      candidatesTokenCount: deepseekResponse.usage?.completion_tokens || 0,
      totalTokenCount: deepseekResponse.usage?.total_tokens || 0,
    };
    response.promptFeedback = {
      safetyRatings: [],
    };

    return response;
  }

  /**
   * Generate content with proper system prompt support
   * This method is called by the LLMProviderAdapter
   */
  async generateContentWithSystemPrompt(req: GenerateContentParameters): Promise<GenerateContentResponse> {
    const messages: Array<{role: string, content: string}> = [];

    // Add system prompt if provided
    if (req.config?.systemInstruction) {
      let systemContent = '';
      if (typeof req.config.systemInstruction === 'string') {
        systemContent = req.config.systemInstruction;
      } else if (Array.isArray(req.config.systemInstruction)) {
        // Handle PartUnion[]
        systemContent = req.config.systemInstruction
          .map((part: any) => typeof part === 'string' ? part : (part.text || ''))
          .join('');
      } else if (req.config.systemInstruction && 'parts' in req.config.systemInstruction) {
        // Handle Content object
        systemContent = (req.config.systemInstruction.parts || [])
          .map((part: any) => part.text || '')
          .join('');
      } else if (req.config.systemInstruction && 'text' in req.config.systemInstruction) {
        // Handle Part object
        systemContent = (req.config.systemInstruction as any).text || '';
      }

      if (systemContent.trim()) {
        messages.push({
          role: 'system',
          content: systemContent
        });
      }
    }

    // Add conversation history from contents
    if (req.contents) {
      // Convert ContentListUnion to Content[]
      const contentsArray = Array.isArray(req.contents) ? req.contents : [req.contents];

      for (const contentItem of contentsArray) {
        // Handle different content types
        let content: any;
        if (typeof contentItem === 'string') {
          content = { role: 'user', parts: [{ text: contentItem }] };
        } else if (Array.isArray(contentItem)) {
          content = { role: 'user', parts: contentItem };
        } else if ('parts' in contentItem) {
          content = contentItem;
        } else {
          content = { role: 'user', parts: [contentItem] };
        }

        const role = content.role === 'model' ? 'assistant' : content.role;
        const text = (content.parts || [])
          .map((part: any) => part.text || '')
          .join('');

        if (text.trim()) {
          messages.push({
            role,
            content: text
          });
        }
      }
    }

    try {
      const response = await axios.post(
        DEEPSEEK_API_URL,
        {
          model: 'deepseek-chat',
          messages,
          stream: false,
          temperature: req.config?.temperature || 0,
          top_p: req.config?.topP || 1,
          max_tokens: req.config?.maxOutputTokens || 8192,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          signal: req.config?.abortSignal,
        },
      );

      return this.convertDeepSeekResponseToGeminiFormat(response.data);
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error(
          `DeepSeek API authentication failed. ` +
          `Environment variable DEEPSEEK_API_KEY: ${process.env.DEEPSEEK_API_KEY ? 'SET' : 'NOT SET'}. ` +
          `Please check your API key.`
        );
      }
      if (error.response) {
        throw new Error(`DeepSeek API Error: ${error.response.data?.error?.message || error.response.statusText} (Status: ${error.response.status})`);
      }
      throw error;
    }
  }
}
