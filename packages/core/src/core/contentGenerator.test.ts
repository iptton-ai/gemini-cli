/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi } from 'vitest';
import { createContentGenerator, AuthType } from './contentGenerator.js';
import { createCodeAssistContentGenerator } from '../code_assist/codeAssist.js';
import { GoogleGenAI } from '@google/genai';
import { Config } from '../config/config.js';

vi.mock('../code_assist/codeAssist.js');
vi.mock('@google/genai');

describe('contentGenerator', () => {
  it('should create a CodeAssistContentGenerator', async () => {
    const mockGenerator = {} as unknown;
    vi.mocked(createCodeAssistContentGenerator).mockResolvedValue(
      mockGenerator as never,
    );

    // Create a mock Config object
    const mockConfig = {
      getProvider: () => 'google',
      getModel: () => 'test-model',
      getProviders: () => ({ google: { apiKey: 'test-key' } }),
    } as unknown as Config;

    const generator = await createContentGenerator(mockConfig);
    expect(generator).toBeDefined();
  });

  it('should create a GoogleGenAI content generator', async () => {
    const mockGenerator = {
      models: {},
    } as unknown;
    vi.mocked(GoogleGenAI).mockImplementation(() => mockGenerator as never);

    // Create a mock Config object for Google provider
    const mockConfig = {
      getProvider: () => 'google',
      getModel: () => 'test-model',
      getProviders: () => ({ google: { apiKey: 'test-api-key' } }),
    } as unknown as Config;

    const generator = await createContentGenerator(mockConfig);
    expect(GoogleGenAI).toHaveBeenCalledWith({
      apiKey: 'test-api-key',
    });
    expect(generator).toBeDefined();
  });
});
