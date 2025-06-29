/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { LoadedSettings, SettingScope } from '../../config/settings.js';
import {
  AuthType,
  Config,
  clearCachedCredentialFile,
  getErrorMessage,
} from '@google/gemini-cli-core';

async function performAuthFlow(authMethod: AuthType, config: Config, onComplete?: () => void | Promise<void>) {
  await config.refreshAuth(authMethod);
  console.log(`Authenticated via "${authMethod}".`);
  await onComplete?.();
}

export const useAuthCommand = (
  settings: LoadedSettings,
  setAuthError: (error: string | null) => void,
  config: Config,
  onAuthComplete?: () => void | Promise<void>,
) => {
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(
    settings.merged.selectedAuthType === undefined,
  );

  const openAuthDialog = useCallback(() => {
    setIsAuthDialogOpen(true);
  }, []);

  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const isUserInitiatedAuthRef = useRef(false);
  const hasAutoAuthFailedRef = useRef(false);

  useEffect(() => {
    const authFlow = async () => {
      // Only auto-trigger auth flow on initial load or when dialog closes
      // handleAuthSelect will handle auth flow for user-initiated changes
      // Don't retry if auto-auth has already failed
      if (isAuthDialogOpen || !settings.merged.selectedAuthType || isAuthenticating || isUserInitiatedAuthRef.current || hasAutoAuthFailedRef.current) {
        return;
      }

      try {
        setIsAuthenticating(true);
        await performAuthFlow(
          settings.merged.selectedAuthType as AuthType,
          config,
          onAuthComplete,
        );
      } catch (e) {
        setAuthError(`Failed to login. Message: ${getErrorMessage(e)}`);
        hasAutoAuthFailedRef.current = true; // Prevent auto-retry
        openAuthDialog();
      } finally {
        setIsAuthenticating(false);
      }
    };

    void authFlow();
  }, [isAuthDialogOpen, settings, config, setAuthError, openAuthDialog, onAuthComplete]);

  const handleAuthSelect = useCallback(
    async (authMethod: string | undefined, scope: SettingScope) => {
      if (authMethod) {
        // Mark this as user-initiated auth to prevent useEffect from interfering
        isUserInitiatedAuthRef.current = true;
        // Reset auto-auth failure flag since user is trying again
        hasAutoAuthFailedRef.current = false;

        await clearCachedCredentialFile();
        settings.setValue(scope, 'selectedAuthType', authMethod);

        // Immediately trigger auth flow for the new auth method
        try {
          setIsAuthenticating(true);
          await performAuthFlow(
            authMethod as AuthType,
            config,
            onAuthComplete,
          );
        } catch (e) {
          setAuthError(`Failed to login. Message: ${getErrorMessage(e)}`);
          // Reset the flag on error so useEffect can handle retry if needed
          isUserInitiatedAuthRef.current = false;
          // Don't close dialog if auth failed, let user try again
          return;
        } finally {
          setIsAuthenticating(false);
          // Reset the flag after auth completes
          isUserInitiatedAuthRef.current = false;
        }
      }
      setIsAuthDialogOpen(false);
      setAuthError(null);
    },
    [settings, setAuthError, config, onAuthComplete],
  );

  const handleAuthHighlight = useCallback((_authMethod: string | undefined) => {
    // For now, we don't do anything on highlight.
  }, []);

  const cancelAuthentication = useCallback(() => {
    setIsAuthenticating(false);
  }, []);

  return {
    isAuthDialogOpen,
    openAuthDialog,
    handleAuthSelect,
    handleAuthHighlight,
    isAuthenticating,
    cancelAuthentication,
  };
};
