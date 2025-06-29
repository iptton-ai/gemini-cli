/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text } from 'ink';
import { Colors } from '../colors.js';
import { shortenPath, tildeifyPath, tokenLimit } from '@google/gemini-cli-core';
import { ConsoleSummaryDisplay } from './ConsoleSummaryDisplay.js';
import process from 'node:process';
import { MemoryUsageDisplay } from './MemoryUsageDisplay.js';

/**
 * Format model name for display in the footer
 */
function formatModelName(model: string, provider: 'google' | 'deepseek'): string {
  // For DeepSeek provider, always show DeepSeek Chat regardless of the actual model
  if (provider === 'deepseek') {
    switch (model) {
      case 'deepseek-chat':
        return 'DeepSeek Chat';
      case 'deepseek-reasoner':
        return 'DeepSeek Reasoner';
      default:
        return 'DeepSeek Chat'; // Default to DeepSeek Chat for DeepSeek provider
    }
  }

  // For Google provider, return the model as-is
  return model;
}

interface FooterProps {
  model: string;
  targetDir: string;
  branchName?: string;
  debugMode: boolean;
  debugMessage: string;
  corgiMode: boolean;
  errorCount: number;
  showErrorDetails: boolean;
  showMemoryUsage?: boolean;
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
  provider?: 'google' | 'deepseek';
}

export const Footer: React.FC<FooterProps> = ({
  model,
  targetDir,
  branchName,
  debugMode,
  debugMessage,
  corgiMode,
  errorCount,
  showErrorDetails,
  showMemoryUsage,
  totalTokenCount,
  provider = 'google',
}) => {
  const limit = tokenLimit(model);

  // Ensure totalTokenCount is valid and not negative
  const validTokenCount = Math.max(0, totalTokenCount || 0);

  // Calculate percentage, but cap it at 1.0 (100%) to avoid negative context left
  const percentage = Math.min(1.0, validTokenCount / limit);

  // Debug logging for DeepSeek context calculation
  if (provider === 'deepseek' && debugMode) {
    console.log('DeepSeek Context Debug:', {
      model,
      provider,
      totalTokenCount,
      validTokenCount,
      limit,
      percentage,
      contextLeft: ((1 - percentage) * 100).toFixed(0) + '%'
    });
  }

  return (
    <Box marginTop={1} justifyContent="space-between" width="100%">
      <Box>
        <Text color={Colors.LightBlue}>
          {shortenPath(tildeifyPath(targetDir), 70)}
          {branchName && <Text color={Colors.Gray}> ({branchName}*)</Text>}
        </Text>
        {debugMode && (
          <Text color={Colors.AccentRed}>
            {' ' + (debugMessage || '--debug')}
          </Text>
        )}
      </Box>

      {/* Middle Section: Centered Sandbox Info */}
      <Box
        flexGrow={1}
        alignItems="center"
        justifyContent="center"
        display="flex"
      >
        {process.env.SANDBOX && process.env.SANDBOX !== 'sandbox-exec' ? (
          <Text color="green">
            {process.env.SANDBOX.replace(/^gemini-(?:cli-)?/, '')}
          </Text>
        ) : process.env.SANDBOX === 'sandbox-exec' ? (
          <Text color={Colors.AccentYellow}>
            MacOS Seatbelt{' '}
            <Text color={Colors.Gray}>({process.env.SEATBELT_PROFILE})</Text>
          </Text>
        ) : (
          <Text color={Colors.AccentRed}>
            no sandbox <Text color={Colors.Gray}>(see /docs)</Text>
          </Text>
        )}
      </Box>

      {/* Right Section: Model Label and Console Summary */}
      <Box alignItems="center">
        <Text color={Colors.AccentBlue}>
          {' '}
          {formatModelName(model, provider)}{' '}
          <Text color={Colors.Gray}>
            ({((1 - percentage) * 100).toFixed(0)}% context left)
          </Text>
        </Text>
        {corgiMode && (
          <Text>
            <Text color={Colors.Gray}>| </Text>
            <Text color={Colors.AccentRed}>▼</Text>
            <Text color={Colors.Foreground}>(´</Text>
            <Text color={Colors.AccentRed}>ᴥ</Text>
            <Text color={Colors.Foreground}>`)</Text>
            <Text color={Colors.AccentRed}>▼ </Text>
          </Text>
        )}
        {!showErrorDetails && errorCount > 0 && (
          <Box>
            <Text color={Colors.Gray}>| </Text>
            <ConsoleSummaryDisplay errorCount={errorCount} />
          </Box>
        )}
        {showMemoryUsage && <MemoryUsageDisplay />}
      </Box>
    </Box>
  );
};
