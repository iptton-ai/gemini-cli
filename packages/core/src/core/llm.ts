/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GenerateContentResponse } from '@google/genai';
import { Turn } from './turn.js';

export interface LLMProvider {
  generateContent(history: Turn[]): Promise<GenerateContentResponse>;
}
