/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export enum AuthType {
  LOGIN_WITH_GOOGLE_PERSONAL = 'oauth-personal',
  USE_GEMINI = 'api-key',
  USE_VERTEX_AI = 'vertex-ai',
  USE_DEEPSEEK = 'deepseek',
}

export interface ContentGeneratorConfig {
  model: string;
  authType: AuthType;
}
