import type React from 'react';
import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { useCurrentAdapter, useUserPreferences, useMCPState, useConnectionStatus, useAvailableTools, useToolEnablement, useNotifications } from '../../hooks';
import { useMcpCommunication } from '../../hooks/useMcpCommunication';
import PopoverPortal from './PopoverPortal';
import { instructionsState } from '../sidebar/Instructions/InstructionManager';
import { AutomationService } from '../../services/automation.service';

export interface MCPToggleState {
  mcpEnabled: boolean;
  autoInsert: boolean;
  autoSubmit: boolean;
  autoExecute: boolean;
}

// Hook to detect dark mode
const useThemeDetector = () => {
  const [isDarkMode, setIsDarkMode] = useState(
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return isDarkMode;
};

// CSS for the component using the provided color scheme
const styles = `
.mcp-popover-container {
  position: relative;
  display: inline-block;
}

.mcp-main-button {
  display: flex;
  align-items: center;
  width: max-content;
  height: max-content;
  justify-content: center;
  padding: 4px 8px;
  border-radius: 10px;
  background-color: #e8f0fe;
  border: 1px solid #dadce0;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #202124;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, sans-serif;
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(60,64,67,0.08);
  letter-spacing: 0.3px;
  white-space: nowrap;
}

.mcp-main-button:hover {
  background-color: #aecbfa;
  box-shadow: 0 2px 4px rgba(60,64,67,0.12);
}

.mcp-main-button:active {
  transform: translateY(1px);
  box-shadow: 0 0 1px rgba(60,64,67,0.08);
}

.mcp-main-button.inactive {
  background-color: #f5f7f9;
  border-color: #dadce0;
  color: #5f6368;
}

.mcp-popover {
  width: 650px;
  background-color: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(60,64,67,0.10), 0 2px 8px rgba(60,64,67,0.06);
  padding: 0;
  z-index: 1000;
  border: 1px solid #dadce0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, sans-serif;
  overflow: visible;
  max-height: 90vh;
  position: relative;
}

.mcp-close-button {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: transparent;
  border: none;
  color: #5f6368;
  font-size: 18px;
  font-weight: 500;
  z-index: 1002;
  transition: all 0.2s ease;
}

.mcp-close-button:hover {
  background-color: #e8f0fe;
  color: #1a73e8;
}

.mcp-close-button:active {
  transform: scale(0.95);
}

/* Default arrow (positioned at the bottom for popover above trigger) */
.mcp-popover.position-above::after {
  content: '';
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%) rotate(45deg);
  width: 14px;
  height: 14px;
  background-color: #ffffff;
  border-right: 1px solid #dadce0;
  border-bottom: 1px solid #dadce0;
}

/* Arrow for popover positioned below the trigger */
.mcp-popover.position-below::after {
  content: '';
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%) rotate(-135deg);
  width: 14px;
  height: 14px;
  background-color: #ffffff;
  border-right: 1px solid #dadce0;
  border-bottom: 1px solid #dadce0;
}

.mcp-toggle-item {
  display: block;
  margin-bottom: 6px;
  padding: 8px 10px;
  cursor: pointer;
  border-bottom: 1px solid #dadce0;
  transition: background-color 0.15s ease;
  box-sizing: border-box;
  width: 100%;
  background: #ffffff;
}

.mcp-toggle-item:hover {
  background-color: #e8f0fe;
}

.mcp-toggle-item:last-child {
  margin-bottom: 0;
  border-bottom: none;
}

.mcp-toggle-checkbox {
  position: relative;
  width: 36px;
  height: 18px;
  flex-shrink: 0;
  display: inline-block;
  margin-right: 10px;
  vertical-align: middle;
  border-radius: 34px;
  
}

.mcp-toggle-checkbox input {
  opacity: 0;
  width: 0;
  height: 0;
  margin: 0;
  padding: 0;
}

.mcp-toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #dadce0;
  transition: .3s;
  border-radius: 34px;
  box-sizing: border-box;
  overflow: hidden;
}

.mcp-toggle-slider:before {
  position: absolute;
  content: "";
  height: 12px;
  width: 12px;
  left: 3px;
  bottom: 3px;
  background-color: #ffffff;
  transition: .3s;
  border-radius: 50%;
  box-shadow: 0 1px 2px rgba(60,64,67,0.08);
  z-index: 1;
}

input:checked + .mcp-toggle-slider {
  background-color: #1a73e8;
}

input:checked + .mcp-toggle-slider:before {
  transform: translateX(18px);
}

.mcp-toggle-label {
  font-size: 13px;
  color: #202124;
  font-weight: 500;
  letter-spacing: 0.2px;
  white-space: nowrap;
  vertical-align: middle;
}

.mcp-toggle-item.disabled {
  opacity: 0.65;
  cursor: not-allowed;
  background-color: #f5f7f9;
}

.mcp-toggle-item.disabled .mcp-toggle-slider {
  background-color: #dadce0;
  cursor: not-allowed;
  border-radius: 34px;
  overflow: hidden;
}

.mcp-instruction-btn {
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px rgba(60,64,67,0.05);
}

.mcp-instruction-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(60,64,67,0.10);
}

.mcp-instruction-btn:active {
  transform: translateY(0);
}

.mcp-instructions-container {
  background-color: #f8f9fa;
  border: 1px solid #eaecef;
  border-radius: 10px;
  padding: 16px;
  font-family: monospace;
  font-size: 13px;
  line-height: 1.5;
  color: #3c4043;
  box-shadow: inset 0 1px 2px rgba(60,64,67,0.03);
  width: 100%;
  box-sizing: border-box;
  overflow-wrap: break-word;
}

.mcp-popover {
  position: relative;
}

.mcp-drag-handle {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 80px;
  height: 6px;
  cursor: move;
  z-index: 1001;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  background-color: #dadce0;
  border-bottom-left-radius: 3px;
  border-bottom-right-radius: 3px;
  border: none;
}

.mcp-drag-handle:hover {
  background-color: #e8f0fe;
}

.mcp-drag-handle:hover .mcp-drag-handle-bar {
  background-color: #1a73e8;
}

.mcp-drag-handle-bar {
  width: 12px;
  height: 3px;
  background-color: #5f6368;
  border-radius: 1.5px;
  margin: 0 1px;
  transition: background-color 0.2s ease;
}

@media (prefers-color-scheme: dark) {
  .mcp-main-button {
    background-color: #174ea6;
    border-color: #8ab4f8;
    color: #e8eaed;
  }

  .mcp-main-button:hover {
    background-color: #8ab4f8;
    color: #202124;
  }

  .mcp-main-button.inactive {
    background-color: #2d2d2d;
    border-color: #444;
    color: #9aa0a6;
  }

  .mcp-popover {
    background-color: #2d2d2d;
    box-shadow: 0 4px 20px rgba(20,20,20,0.25), 0 2px 8px rgba(20,20,20,0.15);
    border: 1px solid #444;
    overflow: visible;
  }

  .mcp-popover.position-above::after,
  .mcp-popover.position-below::after {
    background-color: #2d2d2d;
    border-right: 1px solid #444;
    border-bottom: 1px solid #444;
  }

  .mcp-toggle-item {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    border-bottom: 1px solid #444;
    background: #2d2d2d;
  }

  .mcp-toggle-item:hover {
    background-color: #174ea6;
  }

  .mcp-toggle-slider {
    background-color: #444;
  }

  input:checked + .mcp-toggle-slider {
    background-color: #8ab4f8;
  }

  .mcp-toggle-label {
    color: #e8eaed;
  }

  .mcp-toggle-item.disabled {
    background-color: #282828;
  }

  .mcp-toggle-item.disabled .mcp-toggle-slider {
    background-color: #444;
    border-radius: 34px;
    overflow: hidden;
  }

  .mcp-instructions-container {
    background-color: #2d2d2d;
    border: 1px solid #444;
    color: #e8eaed;
    box-shadow: inset 0 1px 2px rgba(20,20,20,0.10);
  }

  .mcp-close-button {
    color: #9aa0a6;
  }

  .mcp-close-button:hover {
    background-color: #174ea6;
    color: #8ab4f8;
  }
  
  .mcp-drag-handle {
    background-color: #444;
    border: none;
  }

  .mcp-drag-handle-bar {
    background-color: #9aa0a6;
  }
  
  .mcp-drag-handle:hover {
    background-color: #174ea6;
  }

  .mcp-drag-handle:hover .mcp-drag-handle-bar {
    background-color: #8ab4f8;
  }
}

/* Hover overlay styles */
.mcp-hover-overlay {
  position: fixed !important;
  background: #ffffff !important;
  border: 1px solid #e1e5e9 !important;
  border-radius: 10px !important;
  box-shadow: 0 6px 20px rgba(60,64,67,0.12), 0 2px 8px rgba(60,64,67,0.06) !important;
  padding: 8px !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 4px !important;
  align-items: stretch !important;
  opacity: 0 !important;
  visibility: hidden !important;
  transform: translateY(-8px) scale(0.95) !important;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
  z-index: 2147483647 !important;
  white-space: nowrap !important;
  pointer-events: none !important;
  width: 130px !important;
  min-width: 130px !important;
  max-width: 130px !important;
  box-sizing: border-box !important;
  font-family: inherit !important;
  font-synthesis: none !important;
  text-rendering: optimizeLegibility !important;
  -webkit-font-smoothing: antialiased !important;
  -moz-osx-font-smoothing: grayscale !important;
}

.mcp-hover-overlay.visible {
  opacity: 1 !important;
  visibility: visible !important;
  transform: translateY(0) scale(1) !important;
  pointer-events: auto !important;
}

.mcp-hover-button {
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 8px !important;
  padding: 10px 12px !important;
  border-radius: 6px !important;
  border: none !important;
  background: #f8f9fa !important;
  color: #374151 !important;
  font-size: 13px !important;
  font-weight: 500 !important;
  cursor: pointer !important;
  transition: all 0.2s ease !important;
  width: 100% !important;
  min-width: 110px !important;
  max-width: none !important;
  box-sizing: border-box !important;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji" !important;
  text-align: left !important;
  letter-spacing: -0.01em !important;
  white-space: nowrap !important;
  overflow: hidden !important;
}

.mcp-hover-button:hover {
  background: #e3f2fd !important;
  color: #1565c0 !important;
  transform: scale(1.02) !important;
  box-shadow: 0 2px 8px rgba(21, 101, 192, 0.15) !important;
}

.mcp-hover-button:active {
  transform: scale(0.98) !important;
  box-shadow: 0 1px 3px rgba(21, 101, 192, 0.2) !important;
}

@media (prefers-color-scheme: dark) {
  .mcp-hover-overlay {
    background: #1f2937 !important;
    border-color: #374151 !important;
    box-shadow: 0 8px 25px rgba(0,0,0,0.3), 0 3px 10px rgba(0,0,0,0.2) !important;
  }

  .mcp-hover-button {
    background: #374151 !important;
    color: #d1d5db !important;
  }

  .mcp-hover-button:hover {
    background: #1e3a8a !important;
    color: #93c5fd !important;
    box-shadow: 0 2px 8px rgba(147, 197, 253, 0.2) !important;
  }
}
`;
function useInjectStyles() {
  useEffect(() => {
    if (!document.getElementById('mcp-popover-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'mcp-popover-styles';
      styleEl.textContent = styles;
      document.head.appendChild(styleEl);
    }
  }, []);
}

interface MCPPopoverProps {
  toggleStateManager: {
    getState(): MCPToggleState;
    setMCPEnabled(enabled: boolean): void;
    setAutoInsert(enabled: boolean): void;
    setAutoSubmit(enabled: boolean): void;
    setAutoExecute(enabled: boolean): void;
    updateUI(): void;
  };
  /**
   * Adapter-specific button styling configuration
   * Allows adapters to override the default MCP button styling
   * to match the host website's design system
   */
  adapterButtonConfig?: {
    className?: string;        // Main button class (e.g., 'mcp-gh-button-base')
    contentClassName?: string; // Content wrapper class (e.g., 'mcp-gh-button-content')  
    textClassName?: string;    // Text label class (e.g., 'mcp-gh-button-text')
    iconClassName?: string;    // Icon class (e.g., 'mcp-gh-button-icon')
    activeClassName?: string;  // Active state class (e.g., 'mcp-button-active')
    style?: React.CSSProperties; // Add style prop
  };
  /**
   * Name of the adapter providing the styling
   * Used for debugging and logging
   */
  adapterName?: string;
}

interface ToggleItemProps {
  id: string;
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}

const ToggleItem: React.FC<ToggleItemProps> = ({ id, label, checked, disabled, onChange }) => {
  const isDarkMode = useThemeDetector();

  // Color scheme for toggles
  const toggleTheme = {
    itemBackground: isDarkMode ? '#2d2d2d' : '#ffffff',
    itemBackgroundHover: isDarkMode ? '#174ea6' : '#e8f0fe',
    itemBorderColor: isDarkMode ? '#444' : '#dadce0',
    labelColor: isDarkMode ? '#e8eaed' : '#202124',
    toggleBackground: isDarkMode ? '#444' : '#dadce0',
    toggleBackgroundChecked: isDarkMode ? '#8ab4f8' : '#1a73e8',
    toggleBackgroundDisabled: isDarkMode ? '#444' : '#dadce0',
  };

  return (
    <div
      className={`mcp-toggle-item${disabled ? ' disabled' : ''}`}
      style={{
        borderBottom: `1px solid ${toggleTheme.itemBorderColor}`,
        backgroundColor: toggleTheme.itemBackground,
      }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
        }}>
        <div style={{ width: '36px', marginRight: '10px' }}>
          <label className="mcp-toggle-checkbox" style={{ display: 'block' }}>
            <input
              type="checkbox"
              id={id}
              checked={checked}
              disabled={disabled}
              onChange={e => onChange(e.target.checked)}
            />
            <span
              className="mcp-toggle-slider"
              style={{
                backgroundColor: disabled
                  ? toggleTheme.toggleBackgroundDisabled
                  : checked
                    ? toggleTheme.toggleBackgroundChecked
                    : toggleTheme.toggleBackground,
              }}></span>
          </label>
        </div>
        <label
          htmlFor={id}
          className="mcp-toggle-label"
          style={{
            cursor: disabled ? 'not-allowed' : 'pointer',
            color: toggleTheme.labelColor,
          }}>
          {label}
        </label>
      </div>
    </div>
  );
};

export interface ToastContainerHandle {
  showToast: () => void;
}

const ToastContainer = forwardRef<ToastContainerHandle, { anchorRef: React.RefObject<HTMLButtonElement> }>(
  ({ anchorRef }, ref) => {
    const [visible, setVisible] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [isDark, setIsDark] = useState(false);
    const [fadeState, setFadeState] = useState<'hidden' | 'fading-in' | 'visible' | 'fading-out'>('hidden');
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const fadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
      // Detect dark mode
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      setIsDark(mq.matches);
      const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }, []);

    useImperativeHandle(ref, () => ({
      showToast: () => {
        console.log('[Toast] showToast called');
        setMessage('MCP Tools Updated');
        setVisible(true);
        setFadeState('fading-in');
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
        // Fade in
        fadeTimeoutRef.current = setTimeout(() => setFadeState('visible'), 20);
        // Fade out after 4s
        timeoutRef.current = setTimeout(() => {
          setFadeState('fading-out');
          fadeTimeoutRef.current = setTimeout(() => {
            setVisible(false);
            setFadeState('hidden');
            setMessage(null);
          }, 300); // match transition duration
        }, 4000);
      },
    }));

    if (!message || !visible || !anchorRef.current) return null;
    const rect = anchorRef.current.getBoundingClientRect();
    let opacity = 0, translateY = 12;
    if (fadeState === 'fading-in' || fadeState === 'visible') {
      opacity = 1;
      translateY = 0;
    } else if (fadeState === 'fading-out') {
      opacity = 0;
      translateY = 12;
    }
    const style: React.CSSProperties = {
      position: 'fixed',
      left: rect.left + rect.width / 2,
      top: rect.bottom + 6,
      transform: `translateX(-50%) translateY(${translateY}px)`,
      zIndex: 2147483647, // Ensure toast is always on top
      minWidth: 160,
      maxWidth: 240,
      pointerEvents: 'auto',
      fontSize: 14,
      padding: '8px 18px',
      borderRadius: 6,
      background: isDark ? '#f3f4f6' : '#fff',
      border: '2px solid #22c55e',
      color: isDark ? '#111' : '#111',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      opacity, // Fully opaque for legibility
      transition: 'opacity 0.25s cubic-bezier(.4,0,.2,1), transform 0.25s cubic-bezier(.4,0,.2,1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 600,
      letterSpacing: 0.1,
      willChange: 'opacity, transform',
    };
    return (
      <div style={style} role="alert">
        {message}
      </div>
    );
  }
);

// LEGACY FILE REMOVAL SYSTEM - DISABLED
// Using new adapter detachFile method instead
// function removePreviousMcpContextFile() {
//   // Find all file chips/tabs with the filename 'mcp-tools.txt'
//   const chips = Array.from(document.querySelectorAll('span[data-mcp-context-file="true"], span')).filter(span => {
//     return span.textContent && span.textContent.trim() === 'mcp-tools.txt';
//   });
//   chips.forEach(span => {
//     // Find the closest parent that contains the remove button
//     const chipContainer = span.closest('div');
//     if (chipContainer) {
//       const removeBtn = chipContainer.querySelector('button[aria-label="Remove"]');
//       if (removeBtn) {
//         (removeBtn as HTMLButtonElement).click();
//       }
//     }
//   });
// }

export const MCPPopover: React.FC<MCPPopoverProps> = ({ toggleStateManager, adapterButtonConfig, adapterName }) => {
  const isDarkMode = useThemeDetector();
  const { status: connectionStatus, isConnected } = useConnectionStatus();
  const { refreshTools, isConnected: mcpConnected } = useMcpCommunication();

  // Use Zustand hooks for adapter and user preferences
  const { plugin: activePlugin, insertText, attachFile, isReady: isAdapterActive } = useCurrentAdapter();
  const { preferences, updatePreferences } = useUserPreferences();
  
  // Use MCP state hook to get persistent MCP toggle state
  const { mcpEnabled: mcpEnabledFromStore, setMCPEnabled } = useMCPState();

  // Debug: Log adapter state changes
  useEffect(() => {
    console.log(`[MCPPopover] Adapter state changed:`, {
      isAdapterActive,
      hasActivePlugin: !!activePlugin,
      pluginName: activePlugin?.name,
      hasInsertText: !!insertText,
      hasAttachFile: !!attachFile,
      capabilities: activePlugin?.capabilities,
      adapterName,
      hasAdapterButtonConfig: !!adapterButtonConfig
    });
  }, [isAdapterActive, activePlugin, insertText, attachFile, adapterName, adapterButtonConfig]);

  // Debug: Log instructions state for debugging
  useEffect(() => {
    console.log(`[MCPPopover] Instructions state:`, {
      hasInstructions: !!instructionsState.instructions,
      instructionsLength: instructionsState.instructions.length,
      preferences: preferences
    });
  }, [instructionsState.instructions, preferences]);

  // Color scheme for the popover
  const theme = {
    // Background colors
    mainBackground: isDarkMode ? '#2d2d2d' : '#ffffff',
    secondaryBackground: isDarkMode ? '#2d2d2d' : '#f8f9fa',
    buttonBackground: isDarkMode ? '#174ea6' : '#e8f0fe',
    buttonBackgroundHover: isDarkMode ? '#8ab4f8' : '#aecbfa',
    buttonBackgroundActive: isDarkMode ? '#8ab4f8' : '#1a73e8',
    toggleBackground: isDarkMode ? '#444' : '#dadce0',
    toggleBackgroundChecked: isDarkMode ? '#8ab4f8' : '#1a73e8',
    toggleBackgroundDisabled: isDarkMode ? '#444' : '#dadce0',

    // Text colors
    primaryText: isDarkMode ? '#e8eaed' : '#202124',
    secondaryText: isDarkMode ? '#9aa0a6' : '#5f6368',
    disabledText: isDarkMode ? '#9aa0a6' : '#5f6368',

    // Border colors
    borderColor: isDarkMode ? '#444' : '#dadce0',
    dividerColor: isDarkMode ? '#444' : '#dadce0',

    // Shadow
    boxShadow: isDarkMode
      ? '0 6px 24px rgba(20,20,20,0.25), 0 2px 8px rgba(20,20,20,0.15)'
      : '0 6px 24px rgba(60,64,67,0.10), 0 2px 8px rgba(60,64,67,0.06)',
    innerShadow: isDarkMode ? 'inset 0 1px 2px rgba(20,20,20,0.10)' : 'inset 0 1px 2px rgba(60,64,67,0.03)',
  };
  useInjectStyles();
  const [state, setState] = useState<MCPToggleState>(() => {
    // Initialize state with MCP always disabled on page load
    const initialState = toggleStateManager.getState();
    return {
      ...initialState,
      mcpEnabled: false // Always start with MCP disabled
    };
  });
  // Instructions come directly from the global state (managed by Instructions panel in sidebar)
  const [instructions, setInstructions] = useState(instructionsState.instructions || '');
  const [copyStatus, setCopyStatus] = useState<'Copy' | 'Copied!' | 'Error'>('Copy');
  const [insertStatus, setInsertStatus] = useState<'Insert' | 'Inserted!' | 'No Adapter' | 'No Content' | 'Failed'>('Insert');
  const [attachStatus, setAttachStatus] = useState<'Attach' | 'Attached!' | 'No File' |'Not Supported'| 'Error'>('Attach');
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isHoverOverlayVisible, setIsHoverOverlayVisible] = useState(false);
  const [hoverOverlayPosition, setHoverOverlayPosition] = useState({ x: 0, y: 0 });
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null) as React.RefObject<HTMLButtonElement>;
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hoverOverlayRef = useRef<HTMLDivElement>(null);
  const toastRef = useRef<ToastContainerHandle>(null);

  // Update state from manager
  const updateState = useCallback(() => {
    const currentState = toggleStateManager.getState();
    setState(prevState => ({
      ...currentState,
      mcpEnabled: mcpEnabledFromStore // Always sync with persistent MCP state from store
    }));
  }, [toggleStateManager, mcpEnabledFromStore]);

  // Sync state when MCP state changes from store (e.g., from other UI components)
  // But don't sync on initial page load - always start disabled
  useEffect(() => {
    // Only sync if this is not the initial load (when mcpEnabledFromStore might be true from persistence)
    // We want to start disabled on every page load
    if (mcpEnabledFromStore !== undefined) {
      console.log(`[MCPPopover] MCP state changed to: ${mcpEnabledFromStore}, updating MCP toggle UI`);
      setState(prevState => {
        const newState = {
          ...prevState,
          mcpEnabled: mcpEnabledFromStore
        };
        console.log(`[MCPPopover] State updated:`, newState);
        return newState;
      });
    }
  }, [mcpEnabledFromStore]);

  // Subscribe to global instructions state changes (Instructions panel is source of truth)
  useEffect(() => {
    // Initial sync
    setInstructions(instructionsState.instructions || '');
    
    // Subscribe to changes in the global instructions state
    const unsubscribe = instructionsState.subscribe(newInstructions => {
      setInstructions(newInstructions);
    });

    // Clean up subscription on unmount
    return () => {
      unsubscribe();
    };
  }, []);

  // Initialize and sync popover state - always start with MCP disabled
  // useEffect(() => {
  //   // Force MCP to start disabled on every page load
  //   const currentToggleState = toggleStateManager.getState();
  //   console.log(`[MCPPopover] Initial state sync - forcing MCP to start disabled`);
  //   // Reset MCP state in store to disabled
  //   setMCPEnabled(false, 'page-load-reset', false);
  //   // Sync automation state from user preferences
  //   const syncedState = {
  //     ...currentToggleState,
  //     mcpEnabled: false, // Always start disabled
  //     autoInsert: preferences.autoInsert || false,
  //     autoSubmit: preferences.autoSubmit || false,
  //     autoExecute: preferences.autoExecute || false,
  //   };
  //   setState(syncedState);
  //   // Also sync the legacy toggle state manager
  //   toggleStateManager.setAutoInsert(preferences.autoInsert || false);
  //   toggleStateManager.setAutoSubmit(preferences.autoSubmit || false);
  //   toggleStateManager.setAutoExecute(preferences.autoExecute || false);
  // }, [toggleStateManager, preferences.autoInsert, preferences.autoSubmit, preferences.autoExecute]); // Remove mcpEnabledFromStore dependency

  // Handlers for toggles
  const handleMCP = async (checked: boolean) => {
    console.log(`[MCPPopover] MCP toggle changed to: ${checked}`);
    setMCPEnabled(checked, 'mcp-popover-user-toggle', checked); // Show sidebar when enabling MCP
    toggleStateManager.setMCPEnabled(checked);
    // State will be updated automatically through the MCP state effect

    // Only perform auto-insert/attach when enabling MCP
    if (checked) {
      const context = instructionsState.instructions || '';
      if (!context.trim()) {
        console.warn('[MCPPopover] No context to attach.');
        return;
      }
      // Always attach as file
      if (isAdapterActive && activePlugin && attachFile && activePlugin.capabilities.includes('file-attachment')) {
        const isPerplexity = activePlugin.name === 'Perplexity';
        const isGemini = activePlugin.name === 'Gemini';
        const fileType = isPerplexity || isGemini ? 'text/plain' : 'text/markdown';
        const fileExtension = isPerplexity || isGemini ? '.txt' : '.md';
        const fileName = `mcp_superassistant_instructions${fileExtension}`;
        const file = new File([context], fileName, { type: fileType });
        try {
          const success = await attachFile(file);
          if (!success) {
            console.warn('[MCPPopover] Auto-attach failed.');
          }
        } catch (e) {
          console.error('[MCPPopover] Error during auto-attach:', e);
        }
      } else {
        console.warn('[MCPPopover] Adapter not ready or does not support file attachment.');
      }
    }
  };

  // Action buttons
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(instructions);
      setCopyStatus('Copied!');
      setTimeout(() => setCopyStatus('Copy'), 1200);
    } catch {
      setCopyStatus('Error');
      setTimeout(() => setCopyStatus('Copy'), 1200);
    }
  };


  const handleInsert = async () => {
    if (!instructions.trim()) {
      setInsertStatus('No Content');
      setTimeout(() => setInsertStatus('Insert'), 1200);
      return;
    }

    // Add more detailed debugging
    console.log(`[MCPPopover] handleInsert called - isAdapterActive: ${isAdapterActive}, activePlugin: ${!!activePlugin}, insertText: ${!!insertText}`);
    if (activePlugin) {
      console.log(`[MCPPopover] Active plugin details:`, {
        name: activePlugin.name,
        capabilities: activePlugin.capabilities,
        hasInsertText: !!activePlugin.insertText
      });
    }

    // Try with a small delay first to allow state to propagate
    if (!isAdapterActive || !activePlugin || !insertText) {
      console.log(`[MCPPopover] Adapter not immediately ready, waiting 100ms and retrying...`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (isAdapterActive && activePlugin && insertText) {
      try {
        console.log(`[MCPPopover] Attempting to insert text using ${activePlugin.name} adapter`);
        const success = await insertText(instructions);
        if (success) {
          setInsertStatus('Inserted!');
          console.log(`[MCPPopover] Text inserted successfully using ${activePlugin.name} adapter`);
        } else {
          setInsertStatus('Failed');
          console.warn(`[MCPPopover] Text insertion failed using ${activePlugin.name} adapter`);
        }
      } catch (error) {
        console.error(`[MCPPopover] Error inserting text:`, error);
        setInsertStatus('Failed');
      }
    } else {
      setInsertStatus('No Adapter');
      console.warn(`[MCPPopover] No active adapter available for text insertion. isAdapterActive: ${isAdapterActive}, activePlugin: ${!!activePlugin}, insertText: ${!!insertText}`);
      if (activePlugin) {
        console.warn(`[MCPPopover] Active plugin details:`, {
          name: activePlugin.name,
          capabilities: activePlugin.capabilities,
          hasInsertTextMethod: !!activePlugin.insertText
        });
      }
    }
    setTimeout(() => setInsertStatus('Insert'), 1200);
  };


  const handleAttach = async () => {
    // Add more detailed debugging
    console.log(`[MCPPopover] handleAttach called - isAdapterActive: ${isAdapterActive}, activePlugin: ${!!activePlugin}, attachFile: ${!!attachFile}`);
    if (activePlugin) {
      console.log(`[MCPPopover] Active plugin details for attach:`, {
        name: activePlugin.name,
        capabilities: activePlugin.capabilities,
        hasAttachFile: !!activePlugin.attachFile,
        supportsFileAttachment: activePlugin.capabilities.includes('file-attachment')
      });
    }

    if (!instructions.trim()) {
      setAttachStatus('No File');
      setTimeout(() => setAttachStatus('Attach'), 1200);
      return;
    }

    // Try with a small delay first to allow state to propagate
    if (!isAdapterActive || !activePlugin || !attachFile) {
      console.log(`[MCPPopover] Adapter not immediately ready for attachment, waiting 100ms and retrying...`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (isAdapterActive && activePlugin && attachFile) {
      if (!activePlugin.capabilities.includes('file-attachment')) {
      setAttachStatus('Not Supported');
      console.warn(`[MCPPopover] File attachment not supported by ${activePlugin.name} adapter`);
      return;
      }

      const isPerplexity = activePlugin.name === 'Perplexity';
      const isGemini = activePlugin.name === 'Gemini';
      const fileType = isPerplexity || isGemini ? 'text/plain' : 'text/markdown';
      const fileExtension = isPerplexity || isGemini ? '.txt' : '.md';
      const fileName = `mcp_superassistant_instructions${fileExtension}`;
      const file = new File([instructions], fileName, { type: fileType });
      try {
      console.log(`[MCPPopover] Attempting to attach file using ${activePlugin.name} adapter`);
      const success = await attachFile(file);
      if (success) {
        setAttachStatus('Attached!');
        console.log(`[MCPPopover] File attached successfully using ${activePlugin.name} adapter`);
      } else {
        setAttachStatus('Error');
        console.warn(`[MCPPopover] File attachment failed using ${activePlugin.name} adapter`);
      }
      } catch (error) {
      console.error(`[MCPPopover] Error attaching file:`, error);
      setAttachStatus('Error');
      }
    } else {
      setAttachStatus('No File');
      console.warn(`[MCPPopover] Cannot attach file. isAdapterActive: ${isAdapterActive}, activePlugin: ${!!activePlugin}, attachFile: ${!!attachFile}`);
      if (activePlugin) {
      console.warn(`[MCPPopover] Active plugin details:`, {
        name: activePlugin.name,
        capabilities: activePlugin.capabilities,
        hasAttachFileMethod: !!activePlugin.attachFile
      });
      }
    }
    setTimeout(() => setAttachStatus('Attach'), 1200);
  };

  // Update hover overlay position
  const updateHoverOverlayPosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const overlayWidth = 130; // fixed width from CSS
      const overlayHeight = 140; // approximate height for 3 buttons
      
      // Calculate position above the button
      let x = rect.right - overlayWidth + 10; // Align to right edge with some offset
      let y = rect.top - overlayHeight - 10; // Position above with gap
      
      // Keep within viewport bounds
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Adjust horizontal position if going off screen
      if (x < 10) {
        x = 10;
      } else if (x + overlayWidth > viewportWidth - 10) {
        x = viewportWidth - overlayWidth - 10;
      }
      
      // Adjust vertical position if going off screen
      if (y < 10) {
        y = rect.bottom + 10; // Position below if not enough space above
      }
      
      setHoverOverlayPosition({ x, y });
    }
  }, []);

  // Hover overlay handlers
  const handleMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    updateHoverOverlayPosition();
    setIsHoverOverlayVisible(true);
  }, [updateHoverOverlayPosition]);

  const handleMouseLeave = useCallback(() => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHoverOverlayVisible(false);
    }, 200);
  }, []);

  const handleHoverOverlayEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
  };

  const handleHoverOverlayLeave = () => {
    setIsHoverOverlayVisible(false);
  };

  // Popover show/hide logic
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Check if click is outside both the button and the popover
      const isButtonClick = buttonRef.current && buttonRef.current.contains(e.target as Node);
      const isPopoverClick = popoverRef.current && popoverRef.current.contains(e.target as Node);
      const isPortalClick = document.getElementById('mcp-popover-portal')?.contains(e.target as Node);

      if (!isButtonClick && !isPopoverClick && !isPortalClick) {
        setIsPopoverOpen(false);
      }
    };

    if (isPopoverOpen) {
      // Add a slight delay to avoid immediate trigger
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 10);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPopoverOpen]);

  // Update hover overlay position on scroll/resize
  useEffect(() => {
    if (isHoverOverlayVisible) {
      updateHoverOverlayPosition();
      
      const handleScrollResize = () => {
        updateHoverOverlayPosition();
      };
      
      window.addEventListener('scroll', handleScrollResize, true);
      window.addEventListener('resize', handleScrollResize);
      
      return () => {
        window.removeEventListener('scroll', handleScrollResize, true);
        window.removeEventListener('resize', handleScrollResize);
      };
    }
    return undefined;
  }, [isHoverOverlayVisible, updateHoverOverlayPosition]);

  // Cleanup hover timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Derived disabled states
  const autoExecuteDisabled = !state.mcpEnabled;

  // Determine button styling based on adapter configuration and connection status
  let buttonClassName = adapterButtonConfig?.className
    ? `${adapterButtonConfig.className}${state.mcpEnabled && isConnected && adapterButtonConfig.activeClassName ? ` ${adapterButtonConfig.activeClassName}` : ''}`
    : `mcp-main-button${state.mcpEnabled && isConnected ? '' : ' inactive'}`;
  
  // Add red border only for disconnected state
  if (!isConnected) buttonClassName += ' mcp-disconnected';

  const buttonContent = adapterButtonConfig?.contentClassName ? (
    <span className={adapterButtonConfig.contentClassName}>
      <img 
        src={chrome.runtime.getURL('icon-34.png')} 
        alt="MCP Logo" 
        className={adapterButtonConfig.iconClassName || ''}
        style={{ width: '20px', height: '20px', borderRadius: '50%' }}
      />
      <span className={adapterButtonConfig.textClassName || ''}>MCP</span>
    </span>
  ) : (
    <>
      <img 
        src={chrome.runtime.getURL('icon-34.png')} 
        alt="MCP Logo" 
        style={{ width: '20px', height: '20px', marginRight: '1px', verticalAlign: 'middle', borderRadius: '50%' }}
      />
      MCP
    </>
  );

  // Add red border style for disconnected state (very specific selector)
  useInjectStyles();
  useEffect(() => {
    if (!document.getElementById('mcp-disconnected-style')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'mcp-disconnected-style';
      styleEl.textContent = `button.mcp-disconnected, .mcp-disconnected { border: 2px solid #e53935 !important; box-shadow: 0 0 0 2px #e5393533 !important; }`;
      document.head.appendChild(styleEl);
    }
  }, []);

  // Get available tools at component level (hooks can't be called in event handlers)
  const { tools } = useAvailableTools();
  const { enableAllTools, disableAllTools, loadToolEnablementState } = useToolEnablement();

  // On click: handle different states
  const handleButtonClick = async () => {
    if (!isConnected) {
      // Disconnected state: toggle sidebar (open if closed, close if open)
      if (window.activeSidebarManager && typeof window.activeSidebarManager.getIsVisible === 'function') {
        if (window.activeSidebarManager.getIsVisible()) {
          // Sidebar is open, so close it
          if (typeof window.activeSidebarManager.hide === 'function') {
            window.activeSidebarManager.hide();
          }
        } else {
          // Sidebar is closed, so open it and focus ServerStatus
          window.activeSidebarManager.show();
          window.dispatchEvent(new CustomEvent('mcp:focus-server-status'));
          // Wait for sidebar to be mounted before opening server settings
          const openSettings = () => {
            window.dispatchEvent(new CustomEvent('mcp:open-server-settings'));
            window.removeEventListener('mcp:sidebar-mounted', openSettings);
          };
          window.addEventListener('mcp:sidebar-mounted', openSettings);
        }
      }
      return;
    }
    if (state.mcpEnabled) {
      // If MCP is enabled, disable MCP and all tools
      setMCPEnabled(false, 'mcp-popover', false);
      disableAllTools();
      await loadToolEnablementState();
      // Remove the attached context file when disabling MCP using new adapter system
      // removePreviousMcpContextFile(); // LEGACY - DISABLED
      if (activePlugin && (activePlugin as any).detachFile) {
        try {
          await (activePlugin as any).detachFile('mcp-tools.txt');
          console.log('[MCPPopover] MCP disabled, all tools disabled, and context file removed via new adapter');
        } catch (error) {
          console.warn('[MCPPopover] Failed to remove context file via new adapter:', error);
        }
      } else {
        console.log('[MCPPopover] MCP disabled, all tools disabled (no adapter detachFile method available)');
      }
      
      // Reset attachment tracking when MCP is disabled
      attachmentRef.current = null;
      console.log('[MCPPopover] Reset attachment tracking');
    } else {
      // Connected state (normal state): enable MCP functionality
      console.log('[MCPPopover] Enabling MCP functionality...');
      // Enable MCP in the store and show sidebar
      setMCPEnabled(true, 'mcp-popover', true);
      // Enable all tools and save state
      enableAllTools();
      await loadToolEnablementState();
      // Fetch tools and add them to chat context
      if (activePlugin && attachFile) {
        if (tools && tools.length > 0) {
          // Import the instruction generator to get the system context
          const { generateInstructions } = await import('../sidebar/Instructions/instructionGenerator');
          
          // Generate the complete context with system instructions prepended
          // Ensure all tools have the required fields for generateInstructions
          const toolsWithSchema = tools.map((tool: any) => ({
            name: tool.name,
            description: tool.description || '',
            schema: tool.schema || '{}'
          }));
          const systemContext = generateInstructions(toolsWithSchema, undefined, false);
          const toolsDescription = tools.map((tool: any) => 
            `- ${tool.name}: ${tool.description}`
          ).join('\n');
          const toolsContext = `Available MCP Tools:\n${toolsDescription}`;
          
          // Combine system context and tools context
          const completeContext = `${systemContext}\n\n${toolsContext}`;
          
          // Check if we've already attached this exact context recently (within 2 seconds)
          const now = Date.now();
          if (attachmentRef.current && 
              attachmentRef.current.context === completeContext && 
              now - attachmentRef.current.timestamp < 2000) {
            console.log('[MCPPopover] Skipping duplicate file attachment in handleButtonClick');
            return;
          }
          
          // removePreviousMcpContextFile(); // LEGACY - DISABLED
          const blob = new Blob([completeContext], { type: 'text/plain' });
          const file = new File([blob], 'mcp-tools.txt', { type: 'text/plain' });
          attachFile(file);
          
          // Track this attachment
          attachmentRef.current = { timestamp: now, context: completeContext };
          console.log(`[MCPPopover] Attached complete context (system + ${tools.length} tools) as file and tracked attachment`);
        } else {
          console.log('[MCPPopover] No tools available from MCP server');
        }
      } else {
        console.log('[MCPPopover] No active plugin or attachFile function available');
      }
    }
  };

  // Auto-refresh tool list every 10 seconds if MCP is connected
  // DISABLED FOR TESTING - REMOVE THIS COMMENT TO RE-ENABLE
  /*
  useEffect(() => {
    if (!mcpConnected) return;
    let interval: NodeJS.Timeout | null = setInterval(async () => {
      try {
        await refreshTools(true);
        toastRef.current?.showToast();
      } catch (e) {
        // Optionally log error
      }
    }, 10000);
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [mcpConnected, refreshTools]);
  */

  // Helper function to replace existing tool context instead of adding to it
  const replaceToolContext = useCallback(async (newContext: string) => {
    if (!isAdapterActive || !activePlugin || !insertText) return;

    try {
      // Find the current input element
      const targetElement = document.activeElement as HTMLElement;
      if (!targetElement) return;

      let currentContent = '';
      if (targetElement.tagName === 'TEXTAREA') {
        currentContent = (targetElement as HTMLTextAreaElement).value;
      } else if (targetElement.getAttribute('contenteditable') === 'true') {
        currentContent = targetElement.textContent || '';
      } else {
        currentContent = targetElement.textContent || '';
      }

      // Check if there's existing tool context to replace
      const toolContextPattern = /Available MCP Tools:[\s\S]*?(?=\n\n|$)/;
      const hasExistingContext = toolContextPattern.test(currentContent);

      if (hasExistingContext) {
        // Replace existing tool context
        const newContent = currentContent.replace(toolContextPattern, newContext);
        
        // Clear and re-insert the entire content
        if (targetElement.tagName === 'TEXTAREA') {
          (targetElement as HTMLTextAreaElement).value = newContent;
          targetElement.dispatchEvent(new InputEvent('input', { bubbles: true }));
        } else if (targetElement.getAttribute('contenteditable') === 'true') {
          targetElement.textContent = newContent;
          targetElement.dispatchEvent(new InputEvent('input', { bubbles: true }));
        }
      } else {
        // No existing context, just append normally
        await insertText(newContext);
      }
    } catch (error) {
      console.error('[MCPPopover] Error replacing tool context:', error);
      // Fallback to normal insert
      await insertText(newContext);
    }
  }, [isAdapterActive, activePlugin, insertText]);

  // Track if we've already attached a file in this session to prevent duplicates
  const attachmentRef = useRef<{ timestamp: number; context: string } | null>(null);
  
  // Effect: When tools change and MCP is enabled, refresh chat context and show toast
  const { addNotification } = useNotifications();
  useEffect(() => {
    if (!state.mcpEnabled) return;
    if (!tools || tools.length === 0) return;
    
    // Import the instruction generator to get the system context
    import('../sidebar/Instructions/instructionGenerator').then(({ generateInstructions }) => {
      // Ensure all tools have the required fields for generateInstructions
      const toolsWithSchema = tools.map((tool: any) => ({
        name: tool.name,
        description: tool.description || '',
        schema: tool.schema || '{}'
      }));
      
      // Generate the complete context with system instructions prepended
      const systemContext = generateInstructions(toolsWithSchema, undefined, false);
      const toolsDescription = tools.map((tool: any) => `- ${tool.name}: ${tool.description}`).join('\n');
      const toolsContext = `Available MCP Tools:\n${toolsDescription}`;
      
      // Combine system context and tools context
      const completeContext = `${systemContext}\n\n${toolsContext}`;
      
      // Check if we've already attached this exact context recently (within 2 seconds)
      const now = Date.now();
      if (attachmentRef.current && 
          attachmentRef.current.context === completeContext && 
          now - attachmentRef.current.timestamp < 2000) {
        console.log('[MCPPopover] Skipping duplicate file attachment (same context within 2s)');
        return;
      }
      
      if (attachFile) {
        // removePreviousMcpContextFile(); // LEGACY - DISABLED
        const blob = new Blob([completeContext], { type: 'text/plain' });
        const file = new File([blob], 'mcp-tools.txt', { type: 'text/plain' });
        attachFile(file);
        
        // Track this attachment
        attachmentRef.current = { timestamp: now, context: completeContext };
        console.log('[MCPPopover] Attached file and tracked attachment');
      }
      // Show toast notification
      toastRef.current?.showToast();
    }).catch(error => {
      console.error('[MCPPopover] Error importing instruction generator:', error);
      // Fallback to original behavior
      const toolsDescription = tools.map((tool: any) => `- ${tool.name}: ${tool.description}`).join('\n');
      const contextMessage = `Available MCP Tools:\n${toolsDescription}`;
      
      // Check for duplicate in fallback too
      const now = Date.now();
      if (attachmentRef.current && 
          attachmentRef.current.context === contextMessage && 
          now - attachmentRef.current.timestamp < 2000) {
        console.log('[MCPPopover] Skipping duplicate file attachment in fallback');
        return;
      }
      
      if (attachFile) {
        // removePreviousMcpContextFile(); // LEGACY - DISABLED
        const blob = new Blob([contextMessage], { type: 'text/plain' });
        const file = new File([blob], 'mcp-tools.txt', { type: 'text/plain' });
        attachFile(file);
        
        // Track this attachment
        attachmentRef.current = { timestamp: now, context: contextMessage };
        console.log('[MCPPopover] Attached file in fallback and tracked attachment');
      }
      toastRef.current?.showToast();
    });
  }, [tools, state.mcpEnabled]);

  // When creating the file for attachFile, add a unique marker to the file (if possible)
  // Since File objects can't have custom properties, we need to ensure the UI element (e.g., link/span) created for the file gets the marker.
  // If attachFile returns a reference or creates a DOM element, add the marker there. Otherwise, after attaching, find the element by filename and add the marker.
  // After attachFile(file):
  setTimeout(() => {
    // Try to find the file attachment element by filename and add the marker
    const fileLinks = Array.from(document.querySelectorAll('a, span, div')).filter(el => el.textContent && el.textContent.includes('mcp-tools.txt'));
    fileLinks.forEach(el => el.setAttribute('data-mcp-context-file', 'true'));
  }, 500);

  // MCP button with different states
  return (
    <>
        <button
        ref={buttonRef}
          className={buttonClassName}
        aria-label={isConnected ? "MCP SuperAssistant (Use extension icon to toggle sidebar)" : "MCP server disconnected. Click to open settings."}
        title={isConnected ? "MCP SuperAssistant - Use the extension icon to toggle the sidebar" : "MCP server disconnected. Click to open settings."}
          type="button"
        onClick={handleButtonClick}
          style={{ position: 'relative', ...adapterButtonConfig?.style }}
        >
          {buttonContent}
          {/* Render unplugged icon only in normal state (not blue, not red) */}
          {!state.mcpEnabled && isConnected && (
            <img
              src={chrome.runtime.getURL('unplugged-icon.svg')}
              alt="Unplugged"
              width={16}
              height={16}
              style={{
                position: 'absolute',
                bottom: 4,
                right: 4,
                zIndex: 9999,
                pointerEvents: 'none',
                userSelect: 'none',
                display: 'block',
              }}
              draggable={false}
              onError={e => { e.currentTarget.style.display = 'none'; }}
            />
          )}
        </button>
      <ToastContainer ref={toastRef} anchorRef={buttonRef} />
    </>
  );
};

export default MCPPopover;
