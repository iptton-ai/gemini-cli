/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import { Colors } from '../colors.js';
import { shortAsciiLogo, longAsciiLogo, shortDeepSeekLogo, longDeepSeekLogo } from './AsciiArt.js';
import { getAsciiArtWidth } from '../utils/textUtils.js';

interface HeaderProps {
  customAsciiArt?: string; // For user-defined ASCII art
  terminalWidth: number; // For responsive logo
  provider?: 'google' | 'deepseek'; // Provider information
}

export const Header: React.FC<HeaderProps> = ({
  customAsciiArt,
  terminalWidth,
  provider = 'google',
}) => {
  let displayTitle;

  if (customAsciiArt) {
    displayTitle = customAsciiArt;
  } else {
    // Choose logo based on provider
    if (provider === 'deepseek') {
      const widthOfLongDeepSeekLogo = getAsciiArtWidth(longDeepSeekLogo);
      displayTitle =
        terminalWidth >= widthOfLongDeepSeekLogo ? longDeepSeekLogo : shortDeepSeekLogo;
    } else {
      const widthOfLongLogo = getAsciiArtWidth(longAsciiLogo);
      displayTitle =
        terminalWidth >= widthOfLongLogo ? longAsciiLogo : shortAsciiLogo;
    }
  }

  const artWidth = getAsciiArtWidth(displayTitle);

  return (
    <Box
      marginBottom={1}
      alignItems="flex-start"
      width={artWidth}
      flexShrink={0}
    >
      {Colors.GradientColors ? (
        <Gradient colors={Colors.GradientColors}>
          <Text>{displayTitle}</Text>
        </Gradient>
      ) : (
        <Text>{displayTitle}</Text>
      )}
    </Box>
  );
};
