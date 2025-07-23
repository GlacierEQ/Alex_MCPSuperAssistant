/**
 * Content Script
 *
 * This is the entry point for the content script that runs on web pages.
 * Now uses the comprehensive Session 10 initialization system.
 */

import './tailwind-input.css';
import { logMessage } from '@src/utils/helpers';
import { mcpClient } from './core/mcp-client';
import { eventBus } from './events/event-bus';
import type { ConnectionStatus } from './types/stores';
import { useConnectionStore } from './stores/connection.store';

// Import the new initialization system
import { applicationInit, applicationCleanup, initializationUtils } from './core/main-initializer';
import { pluginRegistry } from './plugins/plugin-registry';

// Force import of adapters to prevent tree-shaking
import { GrokAdapter } from './plugins/adapters/grok.adapter';
import { GeminiAdapter } from './plugins/adapters/gemini.adapter';
import { ChatGPTAdapter } from './plugins/adapters/chatgpt.adapter';

// Force side effects to prevent tree-shaking
const _forceAdapterInclusion = {
  grok: GrokAdapter,
  gemini: GeminiAdapter,
  chatgpt: ChatGPTAdapter,
};

console.log('Forcing adapter inclusion in main entry:', Object.keys(_forceAdapterInclusion));

// Import the render script functions
import {
  initialize as initializeRenderer,
  startDirectMonitoring,
  stopDirectMonitoring,
  processFunctionCalls as renderFunctionCalls,
  checkForUnprocessedFunctionCalls,
  configureFunctionCallRenderer,
} from '@src/render_prescript/src/index';

// import { adapterRegistry, getCurrentAdapter } from '@src/adapters/adapterRegistry';

// Import the automation service
import { initializeAllServices, cleanupAllServices } from './services';

import { useMCPState, useToolEnablement } from './hooks';

// Add this as a global recovery mechanism for the sidebar
function setupSidebarRecovery(): void {
  // Watch for the case where push mode is enabled but sidebar isn't visible
  const recoveryInterval = setInterval(() => {
    try {
      // Check if there's an active sidebar manager
      const sidebarManager = (window as any).activeSidebarManager;
      if (!sidebarManager) return;

      // Get HTML element to check for push-mode-enabled class
      const htmlElement = document.documentElement;

      // Check if push mode is enabled but host is invisible or missing
      if (htmlElement.classList.contains('push-mode-enabled')) {
        const shadowHost = sidebarManager.getShadowHost();

        // If shadow host exists but is not visible, force it
        if (shadowHost) {
          if (
            shadowHost.style.display !== 'block' ||
            window.getComputedStyle(shadowHost).display === 'none' ||
            shadowHost.style.opacity !== '1' ||
            parseFloat(window.getComputedStyle(shadowHost).opacity) < 0.9
          ) {
            logMessage('[SidebarRecovery] Detected invisible sidebar with push mode enabled, forcing visibility');
            shadowHost.style.display = 'block';
            shadowHost.style.opacity = '1';
            shadowHost.classList.add('initialized');

            // OPTIMIZATION: Don't force a re-render unless absolutely necessary
            // The sidebar content should automatically update through React state management
            logMessage(
              '[SidebarRecovery] Sidebar visibility restored - skipping re-render to avoid performance issues',
            );
            // sidebarManager.refreshContent();
          }
        } else {
          // If shadow host doesn't exist but push mode is enabled,
          // try to re-initialize the sidebar
          logMessage('[SidebarRecovery] Push mode enabled but shadow host missing, re-initializing sidebar');
          sidebarManager.initialize().then(() => {
            sidebarManager.show();
          });
        }
      }
    } catch (error) {
      console.error('[SidebarRecovery] Error:', error);
    }
  }, 1000); // Check every second

  // Clean up when navigating away
  window.addEventListener('unload', () => {
    clearInterval(recoveryInterval);
  });

  logMessage('[SidebarRecovery] Sidebar recovery mechanism set up');
}

// Track which adapters have been initialized to prevent redundant initialization
const initializedAdapters = new Set<string>();

/**
 * Content Script Entry Point - Session 10 Implementation
 */
logMessage('Content script loaded - initializing with Session 10 architecture');

// Initialize URL change tracking for demographic analytics
let lastUrl = window.location.href;
const demographicData = collectDemographicData();

// Track initial page view with demographic data
try {
  chrome.runtime.sendMessage({
    command: 'trackAnalyticsEvent',
    eventName: 'page_view',
    eventParams: {
      page_title: document.title,
      page_location: document.location.href,
      ...demographicData,
    },
  });
  logMessage('[Analytics] Initial page view tracked with demographic data');
} catch (error) {
  console.error(
    '[ContentScript] Error sending page view analytics:',
    error instanceof Error ? error.message : String(error),
  );
}

// Set up URL change detection
setInterval(() => {
  const currentUrl = window.location.href;
  if (currentUrl !== lastUrl) {
    logMessage(`[Analytics] URL changed from ${lastUrl} to ${currentUrl}`);

    // Send URL change event with demographic data
    try {
      chrome.runtime.sendMessage({
        command: 'trackAnalyticsEvent',
        eventName: 'url_change',
        eventParams: {
          page_title: document.title,
          page_location: currentUrl,
          previous_page: lastUrl,
          ...demographicData,
        },
      });
      lastUrl = currentUrl;
    } catch (error) {
      console.error(
        '[ContentScript] Error sending URL change analytics:',
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}, 1000); // Check every second

// Ask background script to track the event
try {
  chrome.runtime.sendMessage({
    command: 'trackAnalyticsEvent',
    eventName: 'content_script_loaded',
    eventParams: {
      hostname: window.location.hostname,
      path: window.location.pathname,
    },
  });
} catch (error) {
  // This catch block is primarily for the rare case where the background script context is invalidated
  // during the sendMessage call (e.g., extension update/reload). It won't catch errors in the background handler.
  console.error(
    '[ContentScript] Error sending analytics tracking message:',
    error instanceof Error ? error.message : String(error),
  );
}

// Add this call right before your existing script loads
setupSidebarRecovery();

/**
 * Collects demographic data about the user's environment.
 * This includes browser info, OS, language, screen size, and device type.
 */
function collectDemographicData(): { [key: string]: any } {
  try {
    const userAgent = navigator.userAgent;
    const language = navigator.language;

    // Parse browser and OS information from user agent
    let browser = 'Unknown';
    let browserVersion = 'Unknown';
    let os = 'Unknown';
    let osVersion = 'Unknown';

    // Detect browser
    if (userAgent.indexOf('Firefox') > -1) {
      browser = 'Firefox';
      const match = userAgent.match(/Firefox\/(\d+\.\d+)/);
      browserVersion = match && match[1] ? match[1] : 'Unknown';
    } else if (userAgent.indexOf('Edg') > -1) {
      browser = 'Edge';
      const match = userAgent.match(/Edg\/(\d+\.\d+)/);
      browserVersion = match && match[1] ? match[1] : 'Unknown';
    } else if (userAgent.indexOf('Chrome') > -1) {
      browser = 'Chrome';
      const match = userAgent.match(/Chrome\/(\d+\.\d+)/);
      browserVersion = match && match[1] ? match[1] : 'Unknown';
    } else if (userAgent.indexOf('Safari') > -1) {
      browser = 'Safari';
      const match = userAgent.match(/Version\/(\d+\.\d+)/);
      browserVersion = match && match[1] ? match[1] : 'Unknown';
    } else if (userAgent.indexOf('MSIE') > -1 || userAgent.indexOf('Trident/') > -1) {
      browser = 'Internet Explorer';
      const match = userAgent.match(/(?:MSIE |rv:)(\d+\.\d+)/);
      browserVersion = match && match[1] ? match[1] : 'Unknown';
    }

    // Detect OS
    if (userAgent.indexOf('Windows') > -1) {
      os = 'Windows';
      const match = userAgent.match(/Windows NT (\d+\.\d+)/);
      const ntVersion = match && match[1] ? match[1] : 'Unknown';
      // Map Windows NT version to Windows version
      const windowsVersions: { [key: string]: string } = {
        '10.0': '10/11',
        '6.3': '8.1',
        '6.2': '8',
        '6.1': '7',
        '6.0': 'Vista',
        '5.2': 'XP x64',
        '5.1': 'XP',
      };
      osVersion = windowsVersions[ntVersion] || ntVersion;
    } else if (userAgent.indexOf('Mac') > -1) {
      os = 'macOS';
      const match = userAgent.match(/Mac OS X ([\d_]+)/);
      osVersion = match && match[1] ? match[1].replace(/_/g, '.') : 'Unknown';
    } else if (userAgent.indexOf('Linux') > -1) {
      os = 'Linux';
      const match = userAgent.match(/Linux ([\w\d\.]+)/);
      osVersion = match && match[1] ? match[1] : 'Unknown';
    } else if (userAgent.indexOf('Android') > -1) {
      os = 'Android';
      const match = userAgent.match(/Android ([\d\.]+)/);
      osVersion = match && match[1] ? match[1] : 'Unknown';
    } else if (userAgent.indexOf('iOS') > -1 || userAgent.indexOf('iPhone') > -1 || userAgent.indexOf('iPad') > -1) {
      os = 'iOS';
      const match = userAgent.match(/OS ([\d_]+)/);
      osVersion = match && match[1] ? match[1].replace(/_/g, '.') : 'Unknown';
    }

    // Determine device type
    let deviceType = 'desktop';
    if (/Mobi|Android|iPhone|iPad|iPod/i.test(userAgent)) {
      deviceType = /iPad|tablet/i.test(userAgent) ? 'tablet' : 'mobile';
    }

    // Get screen information
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    const screenResolution = `${screenWidth}x${screenHeight}`;
    const pixelRatio = window.devicePixelRatio || 1;

    // Get country/region (this will be limited and may need server-side enrichment)
    // For privacy reasons, we're just using the language as a proxy
    const region = language.split('-')[1] || language;

    return {
      browser,
      browser_version: browserVersion,
      operating_system: os,
      os_version: osVersion,
      language,
      region,
      screen_resolution: screenResolution,
      pixel_ratio: pixelRatio,
      device_type: deviceType,
    };
  } catch (error) {
    console.error('[Analytics] Error collecting demographic data:', error);
    return {
      error: 'Failed to collect demographic data',
    };
  }
}

// Initialize the renderer at the earliest possible moment (styles are injected automatically)
// This ensures function call blocks are hidden before they can be seen by the user
(function instantInitialize() {
  try {
    // This will set up early observers to hide function blocks before they render
    initializeRenderer();
    logMessage('Function call renderer initialized immediately at script load');
  } catch (error) {
    console.error('Error in immediate renderer initialization:', error);
    // If this fails, we'll try again with the standard approach
  }
})();

// Initialize the current site adapter regardless of MCP connection status
// Legacy adapter initialization disabled - using new plugin system instead
// (function initializeCurrentAdapter() {
//   try {
//     const currentHostname = window.location.hostname;
//     const adapter = adapterRegistry.getAdapter(currentHostname);

//     if (adapter) {
//       const adapterId = adapter.name;

//       if (!initializedAdapters.has(adapterId)) {
//         logMessage(`Initializing site adapter for ${adapter.name} (regardless of MCP connection)`);

//         // Always initialize the adapter to ensure UI is visible
//         adapter.initialize();

//         // Mark this adapter as initialized
//         initializedAdapters.add(adapterId);

//         // Set the adapter globally
//         window.mcpAdapter = adapter;
//         logMessage(`Exposed adapter ${adapter.name} to global window.mcpAdapter`);
//       } else {
//         logMessage(`Adapter ${adapter.name} already initialized, skipping initialization`);
//       }
//     } else {
//       logMessage('No adapter found for current hostname, cannot initialize');
//     }
//   } catch (error) {
//     console.error('Error initializing current adapter:', error);
//   }
// })();

// Initialize the new application architecture (Session 10)
(async function initializeNewArchitecture() {
  try {
    logMessage('Starting comprehensive application initialization...');

    // Initialize MCP client first to ensure communication layer is ready
    try {
      if (!mcpClient.isReady()) {
        logMessage('MCP client not ready, initialization will be handled by the client itself');
      } else {
        logMessage('MCP client is ready for communication');
      }

      // Expose MCP client globally for debugging and legacy compatibility
      (window as any).mcpClient = mcpClient;
      logMessage('MCP client exposed on window.mcpClient');
    } catch (mcpError) {
      console.error('MCP client initialization warning:', mcpError);
      // Don't fail the entire initialization for MCP client issues
    }

    // Initialize the complete application with all core services
    await applicationInit();

    // Initialize automation service and other services
    await initializeAllServices();

    logMessage('Application initialized successfully with Session 10 architecture');

    // Expose plugin registry globally for adapter access
    try {
      (window as any).pluginRegistry = pluginRegistry;
      logMessage('Plugin registry exposed on window.pluginRegistry');
    } catch (pluginError) {
      console.warn('Failed to expose plugin registry globally:', pluginError);
    }

    // Expose initialization utilities for debugging
    if (process.env.NODE_ENV === 'development') {
      (window as any).appInitUtils = initializationUtils;
      logMessage('Initialization utilities exposed on window.appInitUtils');
    }

  } catch (error) {
    console.error('Failed to initialize application with Session 10 architecture:', error);

    // Fallback to basic functionality if available
    logMessage('Attempting fallback initialization...');
    try {
      // Basic renderer initialization as fallback
      initializeRenderer();
      logMessage('Fallback renderer initialization completed');
    } catch (fallbackError) {
      console.error('Fallback initialization also failed:', fallbackError);
    }
  }
})();

// Listen for connection status changes via the global event bus
eventBus.on('connection:status-changed', ({ status }: { status: ConnectionStatus }) => {
  const isConnected = status === 'connected';
  logMessage(`[Content Script] MCP connection status changed: ${isConnected ? 'Connected' : 'Disconnected'}`);

  // Use new plugin system instead of legacy adapter registry
  const activePlugin = pluginRegistry.getActivePlugin();
  if (activePlugin) {
    // Update connection status on the active plugin if it has the method
    if ('updateConnectionStatus' in activePlugin && typeof (activePlugin as any).updateConnectionStatus === 'function') {
      (activePlugin as any).updateConnectionStatus(isConnected);
    }
    (window as any).mcpAdapter = activePlugin;
  }
});

// Improved initialization strategy for the function call renderer
let rendererInitialized = false;

// More robust initialization with retries if immediate initialization failed
const initRendererWithRetry = (retries = 3, delay = 300) => {
  if (rendererInitialized) return; // Don't try again if already initialized

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    try {
      initializeRenderer();
      rendererInitialized = true;
      logMessage('Function call renderer initialized successfully on retry.');

      // Process any function calls that might have been missed
      setTimeout(() => {
        if (rendererInitialized) {
          renderFunctionCalls();
          checkForUnprocessedFunctionCalls();
        }
      }, 500);
    } catch (error) {
      console.error('Error initializing function call renderer:', error);
      if (retries > 0) {
        logMessage(`Retrying renderer initialization in ${delay}ms... (${retries} retries left)`);
        setTimeout(() => initRendererWithRetry(retries - 1, delay), delay);
      } else {
        logMessage('Failed to initialize function call renderer after multiple retries.');
      }
    }
  } else {
    // DOM not fully ready, schedule another check
    logMessage('DOM not ready for renderer initialization, retrying...');
    setTimeout(() => initRendererWithRetry(retries, delay), 100); // Use shorter delay for readyState check
  }
};

// Also set up the standard initialization path as a fallback
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (!rendererInitialized) {
      initRendererWithRetry();
    }
  });
} else {
  // If DOMContentLoaded already fired but initialization failed earlier
  if (!rendererInitialized) {
    initRendererWithRetry();
  }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  logMessage(`Message received in content script: ${JSON.stringify(message)}`); // Log all incoming messages
  
  // Use new plugin system instead of legacy adapter registry
  const activePlugin = pluginRegistry.getActivePlugin();
  const adapter = activePlugin; // Use the active plugin as the adapter

  if (message.command === 'getStats') {
      sendResponse({
        success: true,
        stats: {
          mcpConnected: useConnectionStore.getState().status === 'connected',
          activeSite: adapter?.name || 'Unknown',
        },
      });
    } else if (message.command === 'toggleSidebar') {
      // Use the site adapter to toggle sidebar
      if (adapter && 'toggleSidebar' in adapter && typeof (adapter as any).toggleSidebar === 'function') {
        (adapter as any).toggleSidebar();
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'No active site adapter or toggleSidebar not available' });
      }
    } else if (message.command === 'showSidebarWithToolOutputs') {
      // Show the sidebar with tool outputs
      if (adapter && 'showSidebarWithToolOutputs' in adapter && typeof (adapter as any).showSidebarWithToolOutputs === 'function') {
        (adapter as any).showSidebarWithToolOutputs();
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'No active site adapter or showSidebarWithToolOutputs not available' });
      }
    } else if (message.command === 'callMcpTool') {
      // Handle MCP tool call requests from popup
      const { toolName, args } = message;
      if (toolName && args) {
        mcpClient
          .callTool(toolName, args)
          .then(result => {
            sendResponse({ success: true, result });
          })
          .catch(err => {
            const errorMsg = err instanceof Error ? err.message : String(err);
            sendResponse({ success: false, error: errorMsg });
          });
        return true; // Indicate we'll respond asynchronously
      } else {
        sendResponse({ success: false, error: 'Invalid tool call request' });
      }
    } else if (message.command === 'refreshSidebarContent') {
      // Refresh the sidebar content
      if (adapter && 'refreshSidebarContent' in adapter && typeof (adapter as any).refreshSidebarContent === 'function') {
        (adapter as any).refreshSidebarContent();
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'No active site adapter or refreshSidebarContent not available' });
      }
    } else if (message.command === 'setFunctionCallRendering') {
      // Handle toggling function call rendering
      const { enabled } = message;
      if (rendererInitialized) {
        if (enabled) {
          logMessage('Starting function call monitoring.');
          startDirectMonitoring();
          // Run a check immediately after enabling
          renderFunctionCalls();
          checkForUnprocessedFunctionCalls();
        } else {
          logMessage('Stopping function call monitoring.');
          stopDirectMonitoring();
        }
        sendResponse({ success: true });
      } else {
        logMessage('Cannot toggle function call rendering: Renderer not initialized.');
        sendResponse({ success: false, error: 'Renderer not initialized' });
      }
    } else if (message.command === 'forceRenderFunctionCalls') {
      // Force a re-render/check for function calls
      if (rendererInitialized) {
        logMessage('Forcing function call render check.');
        renderFunctionCalls();
        checkForUnprocessedFunctionCalls();
        sendResponse({ success: true });
      } else {
        logMessage('Cannot force render: Renderer not initialized.');
        sendResponse({ success: false, error: 'Renderer not initialized' });
      }
    } else if (message.command === 'configureRenderer') {
      // Configure the renderer
      if (rendererInitialized) {
        logMessage(`Configuring function call renderer with options: ${JSON.stringify(message.options)}`);
        configureFunctionCallRenderer(message.options);
        sendResponse({ success: true });
      } else {
        logMessage('Cannot configure renderer: Not initialized.');
        sendResponse({ success: false, error: 'Renderer not initialized' });
      }
    } else if (message && message.type === 'mcp:toggle-sidebar') {
      // Toggle the sidebar state (show if hidden, hide if shown)
      try {
        // Use the UI store's setMCPEnabled if available
        const uiStore = require('./stores/ui.store');
        if (uiStore && uiStore.useUIStore) {
          const currentState = uiStore.useUIStore.getState().mcpEnabled;
          uiStore.useUIStore.getState().setMCPEnabled(!currentState, 'chrome-action-icon');
          sendResponse && sendResponse({ success: true, toggled: !currentState });
          return true;
        }
      } catch (e) {
        // Fallback: try window.mcpAdapter or window.activeSidebarManager
        if (window.mcpAdapter && typeof window.mcpAdapter.setMCPEnabled === 'function') {
          // Try to get current state and toggle it
          const currentState = window.mcpAdapter.isMCPEnabled ? window.mcpAdapter.isMCPEnabled() : true;
          window.mcpAdapter.setMCPEnabled(!currentState);
          sendResponse && sendResponse({ success: true, toggled: !currentState });
          return true;
        } else if (window.activeSidebarManager && typeof window.activeSidebarManager.show === 'function') {
          // Check if sidebar is currently visible and toggle accordingly
          const shadowHost = window.activeSidebarManager.getShadowHost();
          const isVisible = shadowHost && 
            shadowHost.style.display !== 'none' && 
            window.getComputedStyle(shadowHost).display !== 'none';
          
          if (isVisible) {
            window.activeSidebarManager.hide();
          } else {
            window.activeSidebarManager.show();
          }
          sendResponse && sendResponse({ success: true, toggled: !isVisible });
          return true;
        }
      }
      sendResponse && sendResponse({ success: false, error: 'No sidebar toggle method found' });
      return true;
    } else if (message && message.type === 'mcp:activate-sidebar') {
      // Use the same logic as the MCP button: enable MCP (show sidebar)
      try {
        // Use the UI store's setMCPEnabled if available
        const uiStore = require('./stores/ui.store');
        if (uiStore && uiStore.useUIStore) {
          uiStore.useUIStore.getState().setMCPEnabled(true, 'chrome-action-icon');
          sendResponse && sendResponse({ success: true });
          return true;
        }
      } catch (e) {
        // Fallback: try window.mcpAdapter or window.activeSidebarManager
        if (window.mcpAdapter && typeof window.mcpAdapter.setMCPEnabled === 'function') {
          window.mcpAdapter.setMCPEnabled(true);
          sendResponse && sendResponse({ success: true });
          return true;
        } else if (window.activeSidebarManager && typeof window.activeSidebarManager.show === 'function') {
          window.activeSidebarManager.show();
          sendResponse && sendResponse({ success: true });
          return true;
        }
      }
      sendResponse && sendResponse({ success: false, error: 'No sidebar activation method found' });
      return true;
    }

    // Always return true if you want to use sendResponse asynchronously
    return true;
  }
);

// Handle page unload to clean up resources (Session 10)
window.addEventListener('beforeunload', async () => {
  logMessage('Page unloading - starting comprehensive cleanup...');
  
  try {
    // Cleanup all services first
    await cleanupAllServices();
    
    // Use the comprehensive cleanup from Session 10
    await applicationCleanup();
    
    // Legacy adapter cleanup for compatibility
    // const currentHostname = window.location.hostname;
    // const adapter = adapterRegistry.getAdapter(currentHostname);
    // if (adapter) {
    //   adapter.cleanup();
    // }

    // Clear the initialized adapters set
    initializedAdapters.clear();
    
    logMessage('Comprehensive cleanup completed');
  } catch (error) {
    console.error('Error during comprehensive cleanup:', error);
  }
});

// Expose mcpClient to the global window object for renderer or debugging access
(window as any).mcpClient = mcpClient;
console.debug('[Content Script] mcpClient exposed to window object for renderer use.');

// Set the current adapter to global window object
// const currentAdapter = getCurrentAdapter();
// if (currentAdapter) {
//   window.mcpAdapter = currentAdapter;
//   console.debug(`[Content Script] Current adapter (${currentAdapter.name}) exposed to window object as mcpAdapter.`);
// }

// At the top level of the content script, ensure MCP is not enabled and all tools are deselected on startup
(function ensureMcpDisabledAndToolsDeselectedOnStartup() {
  try {
    const { setMCPEnabled } = useMCPState();
    const { disableAllTools } = useToolEnablement();
    setMCPEnabled(false, 'startup');
    disableAllTools();
    // Optionally log for debugging
    // console.log('[MCP] Disabled MCP and deselected all tools on startup');
  } catch (e) {
    // Silently ignore errors (e.g., if stores not initialized yet)
  }
})();

// --- ENSURE PLUGIN SYSTEM IS ALWAYS INITIALIZED ---
(async () => {
  await applicationInit();
})();
