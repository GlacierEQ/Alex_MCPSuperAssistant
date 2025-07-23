import { BaseAdapterPlugin } from './base.adapter';
import type { AdapterCapability, PluginContext } from '../plugin-types';

/**
 * Gemini Adapter for Google Gemini (gemini.google.com)
 *
 * This adapter provides specialized functionality for interacting with Google Gemini's
 * chat interface, including text insertion, form submission, and file attachment capabilities.
 *
 * Migrated from the legacy adapter system to the new plugin architecture.
 * Maintains compatibility with existing functionality while integrating with Zustand stores.
 */
export class GeminiAdapter extends BaseAdapterPlugin {
  readonly name = 'GeminiAdapter';
  readonly version = '2.0.0'; // Incremented for new architecture
  readonly hostnames = ['gemini.google.com'];
  readonly capabilities: AdapterCapability[] = [
    'text-insertion',
    'form-submission',
    'file-attachment',
    'dom-manipulation',
  ];

  // CSS selectors for Gemini's UI elements
  private readonly selectors = {
    // Primary chat input selector
    CHAT_INPUT:
      'div.ql-editor.textarea.new-input-ui p, textarea[placeholder*="Ask"], textarea[placeholder*="Message"], div[contenteditable="true"][role="textbox"], textarea[spellcheck="false"]',
    // Submit button selectors (multiple fallbacks)
    SUBMIT_BUTTON:
      'button.mat-mdc-icon-button.send-button, button[aria-label*="Send"], button[aria-label*="Submit"], button.send-button, button[data-testid="send-button"]',
    // File upload related selectors
    FILE_UPLOAD_BUTTON: 'button[aria-label*="Add files"], button[aria-label*="Attach"], button[data-testid="file-upload"]',
    FILE_INPUT: 'input[type="file"]',
    // Main panel and container selectors
    MAIN_PANEL: '.chat-web, .chat-container, .main-content',
    // Drop zones for file attachment
    DROP_ZONE: 'div[xapfileselectordropzone], .text-input-field, .input-area, .ql-editor, div[contenteditable="true"]',
    // File preview elements
    FILE_PREVIEW: '.file-preview, .xap-filed-upload-preview, .attachment-preview, .file-attachment',
    // File card and close button selectors for detachment (enhanced for hover-dependent buttons)
    FILE_CARD: '.file-preview, .xap-filed-upload-preview, .attachment-preview, .file-attachment, [data-testid="file-card"], .file-card, div[class*="file"], div[class*="attachment"], div[class*="card"], div[role="button"][tabindex="0"]',
    FILE_CLOSE_BUTTON: 'button[aria-label*="Remove"], button[aria-label*="Close"], button[aria-label*="Delete"], .file-close, .remove-file, [data-testid="file-close"], svg[aria-label*="Close"], svg[aria-label*="Remove"], button[class*="close"], button[class*="remove"], button[class*="delete"], svg[class*="close"], svg[class*="remove"], svg[class*="delete"], [data-testid="close"], [data-testid="remove"], [data-testid="delete"]',
    // Button insertion points (for MCP popover)
    BUTTON_INSERTION_CONTAINER: '.chat-input-actions, .input-actions, .chat-controls, .toolbar',
    // Alternative insertion points
    FALLBACK_INSERTION: '.chat-input-container, .input-area, .chat-interface, .chat-web',
  };

  // URL patterns for navigation tracking
  private lastUrl: string = '';
  private urlCheckInterval: NodeJS.Timeout | null = null;

  // State management integration
  private mcpPopoverContainer: HTMLElement | null = null;
  private mutationObserver: MutationObserver | null = null;
  private popoverCheckInterval: NodeJS.Timeout | null = null;

  // Setup state tracking
  private storeEventListenersSetup: boolean = false;
  private domObserversSetup: boolean = false;
  private uiIntegrationSetup: boolean = false;

  // Instance tracking for debugging
  private static instanceCount = 0;
  private instanceId: number;

  // Styling state tracking
  private geminiStylesInjected: boolean = false;

  constructor() {
    super();
    GeminiAdapter.instanceCount++;
    this.instanceId = GeminiAdapter.instanceCount;
    console.log(
      `[GeminiAdapter] Instance #${this.instanceId} created. Total instances: ${GeminiAdapter.instanceCount}`,
    );
    
    // Make this adapter instance available globally for auto-detachment
    (window as any).currentGeminiAdapter = this;
  }

  async initialize(context: PluginContext): Promise<void> {
    // Guard against multiple initialization
    if (this.currentStatus === 'initializing' || this.currentStatus === 'active') {
      this.context?.logger.warn(
        `Gemini adapter instance #${this.instanceId} already initialized or active, skipping re-initialization`,
      );
      return;
    }

    await super.initialize(context);
    this.context.logger.info(`Initializing Gemini adapter instance #${this.instanceId}...`);

    // Initialize URL tracking
    this.lastUrl = window.location.href;
    this.setupUrlTracking();

    // Set up event listeners for the new architecture
    this.setupStoreEventListeners();
  }

  async activate(): Promise<void> {
    // Guard against multiple activation
    if (this.currentStatus === 'active') {
      this.context?.logger.warn(`Gemini adapter instance #${this.instanceId} already active, skipping re-activation`);
      return;
    }

    await super.activate();
    this.context.logger.info(`Activating Gemini adapter instance #${this.instanceId}...`);

    // Inject Gemini-specific button styles
    this.injectGeminiButtonStyles();

    // Set up DOM observers and UI integration
    this.setupDOMObservers();
    this.setupUIIntegration();

    // Emit activation event for store synchronization
    this.context.eventBus.emit('adapter:activated', {
      pluginName: this.name,
      timestamp: Date.now(),
    });
  }

  async deactivate(): Promise<void> {
    // Guard against double deactivation
    if (this.currentStatus === 'inactive' || this.currentStatus === 'disabled') {
      this.context?.logger.warn('Gemini adapter already inactive, skipping deactivation');
      return;
    }

    await super.deactivate();
    this.context.logger.info('Deactivating Gemini adapter...');

    // Clean up UI integration
    this.cleanupUIIntegration();
    this.cleanupDOMObservers();

    // Reset setup flags
    this.storeEventListenersSetup = false;
    this.domObserversSetup = false;
    this.uiIntegrationSetup = false;

    // Emit deactivation event
    this.context.eventBus.emit('adapter:deactivated', {
      pluginName: this.name,
      timestamp: Date.now(),
    });
  }

  async cleanup(): Promise<void> {
    await super.cleanup();
    this.context.logger.info('Cleaning up Gemini adapter...');

    // Clear URL tracking interval
    if (this.urlCheckInterval) {
      clearInterval(this.urlCheckInterval);
      this.urlCheckInterval = null;
    }

    // Clear popover check interval
    if (this.popoverCheckInterval) {
      clearInterval(this.popoverCheckInterval);
      this.popoverCheckInterval = null;
    }

    // Final cleanup
    this.cleanupUIIntegration();
    this.cleanupDOMObservers();

    // Remove injected Gemini styles
    const styleElement = document.getElementById('mcp-gemini-button-styles');
    if (styleElement) {
      styleElement.remove();
      this.geminiStylesInjected = false;
    }

    // Reset all setup flags
    this.storeEventListenersSetup = false;
    this.domObserversSetup = false;
    this.uiIntegrationSetup = false;
    this.geminiStylesInjected = false;
  }

  /**
   * Insert text into the Gemini chat input field
   * Enhanced with better selector handling and event integration
   */
  async insertText(text: string, options?: { targetElement?: HTMLElement }): Promise<boolean> {
    this.context.logger.info(
      `Attempting to insert text into Gemini chat input: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`,
    );

    let targetElement: HTMLElement | null = null;

    if (options?.targetElement) {
      targetElement = options.targetElement;
    } else {
      // Try multiple selectors for better compatibility
      const selectors = this.selectors.CHAT_INPUT.split(', ');
      for (const selector of selectors) {
        targetElement = document.querySelector(selector.trim()) as HTMLElement;
        if (targetElement) {
          this.context.logger.debug(`Found chat input using selector: ${selector.trim()}`);
          break;
        }
      }
    }

    if (!targetElement) {
      this.context.logger.error('Could not find Gemini chat input element');
      this.emitExecutionFailed('insertText', 'Chat input element not found');
      return false;
    }

    try {
      // Store the original value
      const originalValue = targetElement.textContent || '';

      // Focus the input element
      targetElement.focus();

      // Insert the text by updating the content and dispatching appropriate events
      // Append the text to the original value on a new line if there's existing content
      const newContent = originalValue ? originalValue + '\n' + text : text;
      targetElement.textContent = newContent;

      // Dispatch events to simulate user typing for better compatibility
      targetElement.dispatchEvent(new Event('input', { bubbles: true }));
      targetElement.dispatchEvent(new Event('change', { bubbles: true }));
      targetElement.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
      targetElement.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));

      // Emit success event to the new event system
      this.emitExecutionCompleted(
        'insertText',
        { text },
        {
          success: true,
          originalLength: originalValue.length,
          newLength: text.length,
          totalLength: newContent.length,
        },
      );

      this.context.logger.info(
        `Text inserted successfully. Original: ${originalValue.length}, Added: ${text.length}, Total: ${newContent.length}`,
      );
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.context.logger.error(`Error inserting text into Gemini chat input: ${errorMessage}`);
      this.emitExecutionFailed('insertText', errorMessage);
      return false;
    }
  }

  /**
   * Submit the current text in the Gemini chat input
   * Enhanced with multiple selector fallbacks and better error handling
   */
  async submitForm(options?: { formElement?: HTMLFormElement }): Promise<boolean> {
    this.context.logger.info('Attempting to submit Gemini chat input');

    let submitButton: HTMLButtonElement | null = null;

    // Try multiple selectors for better compatibility
    const selectors = this.selectors.SUBMIT_BUTTON.split(', ');
    for (const selector of selectors) {
      submitButton = document.querySelector(selector.trim()) as HTMLButtonElement;
      if (submitButton) {
        this.context.logger.debug(`Found submit button using selector: ${selector.trim()}`);
        break;
      }
    }

    if (!submitButton) {
      this.context.logger.error('Could not find Gemini submit button');
      this.emitExecutionFailed('submitForm', 'Submit button not found');
      return false;
    }

    try {
      // Check if the button is disabled
      if (submitButton.disabled) {
        this.context.logger.warn('Gemini submit button is disabled');
        this.emitExecutionFailed('submitForm', 'Submit button is disabled');
        return false;
      }

      // Check if the button is visible and clickable
      const rect = submitButton.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        this.context.logger.warn('Gemini submit button is not visible');
        this.emitExecutionFailed('submitForm', 'Submit button is not visible');
        return false;
      }

      // Click the submit button to send the message
      submitButton.click();

      // Emit success event to the new event system
      this.emitExecutionCompleted(
        'submitForm',
        {
          formElement: options?.formElement?.tagName || 'unknown',
        },
        {
          success: true,
          method: 'submitButton.click',
          buttonSelector: selectors.find(s => document.querySelector(s.trim()) === submitButton),
        },
      );

      this.context.logger.info('Gemini chat input submitted successfully');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.context.logger.error(`Error submitting Gemini chat input: ${errorMessage}`);
      this.emitExecutionFailed('submitForm', errorMessage);
      return false;
    }
  }

  /**
   * Attach a file to the Gemini chat input
   * Enhanced with better error handling and integration with new architecture
   */
  async attachFile(file: File, options?: { inputElement?: HTMLInputElement }): Promise<boolean> {
    this.context.logger.info(`Attempting to attach file: ${file.name} (${file.size} bytes, ${file.type})`);

    try {
      // Validate file before attempting attachment
      if (!file || file.size === 0) {
        this.emitExecutionFailed('attachFile', 'Invalid file: file is empty or null');
        return false;
      }

      // Check if file is already attached to prevent duplicates (Gemini-specific)
      const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      const fileNameWithExt = file.name;
      
      // Search for existing file attachments using the same selectors as detachFile
      const existingFileSelectors = [
        '.file-preview',
        '[data-test-id="file-preview"]',
        '[data-testid="file-preview"]',
        '[data-testid="file-card"]',
        '[data-test-id="file-card"]',
        '.file-card',
        '.attachment-card',
        '[data-testid="attachment"]',
        '[data-test-id="attachment"]',
        '.attachment'
      ];
      
      for (const selector of existingFileSelectors) {
        try {
          const existingFiles = document.querySelectorAll(selector);
          for (const existingFile of Array.from(existingFiles)) {
            const fileText = existingFile.textContent || '';
            if (fileText.includes(fileNameWithExt) || 
                fileText.includes(fileNameWithoutExt) ||
                fileText.toLowerCase().includes(fileNameWithoutExt.toLowerCase())) {
              this.context.logger.info(`File ${file.name} is already attached, skipping duplicate attachment`);
              this.emitExecutionCompleted(
                'attachFile',
                {
                  fileName: file.name,
                  fileType: file.type,
                  fileSize: file.size,
                  inputElement: options?.inputElement?.tagName || 'unknown',
                },
                {
                  success: true,
                  previewFound: true,
                  method: 'duplicate-prevention',
                  reason: 'file-already-attached'
                },
              );
              return true; // Return success since the file is already there
            }
          }
        } catch (error) {
          this.context.logger.debug(`Selector "${selector}" failed during duplicate check: ${error}`);
        }
      }

      // Check if file upload is supported on current page
      if (!this.supportsFileUpload()) {
        this.emitExecutionFailed('attachFile', 'File upload not supported on current page');
        return false;
      }

      // Load drop listener script into page context
      const success = await this.injectFileDropListener();
      if (!success) {
        this.emitExecutionFailed('attachFile', 'Failed to inject file drop listener');
        return false;
      }

      // Read file as DataURL and post primitives to page context
      const dataUrl = await this.readFileAsDataURL(file);

      // Post message to page context for file drop simulation
      window.postMessage(
        {
          type: 'MCP_DROP_FILE',
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          lastModified: file.lastModified,
          fileData: dataUrl,
        },
        '*',
      );

      // Check for file preview to confirm success
      const previewFound = await this.checkFilePreview();

      if (previewFound) {
        this.emitExecutionCompleted(
          'attachFile',
          {
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            inputElement: options?.inputElement?.tagName || 'unknown',
          },
          {
            success: true,
            previewFound: true,
            method: 'drag-drop-simulation',
          },
        );
        this.context.logger.info(`File attached successfully: ${file.name}`);
        return true;
      } else {
        // Still consider it successful even if preview not found (optimistic)
        this.emitExecutionCompleted(
          'attachFile',
          {
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
          },
          {
            success: true,
            previewFound: false,
            method: 'drag-drop-simulation',
          },
        );
        this.context.logger.info(`File attachment initiated (preview not confirmed): ${file.name}`);
        return true;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.context.logger.error(`Error attaching file to Gemini: ${errorMessage}`);
      this.emitExecutionFailed('attachFile', errorMessage);
      return false;
    }
  }

  /**
   * Detach/remove a file from the Gemini chat input
   * Uses Gemini-specific selectors based on actual DOM analysis
   */
  async detachFile(fileName?: string): Promise<boolean> {
    this.context.logger.info(`Attempting to detach file${fileName ? `: ${fileName}` : ''} from Gemini`);

    try {
      // Use comprehensive Gemini-specific selectors for file cards
      const geminiFileCardSelectors = [
        // Common file card selectors
        '.file-preview',
        '[data-test-id="file-preview"]',
        '[data-testid="file-preview"]',
        // Gemini-specific selectors
        '[data-testid="file-card"]',
        '[data-test-id="file-card"]',
        '.file-card',
        '.attachment-card',
        '[data-testid="attachment"]',
        '[data-test-id="attachment"]',
        '.attachment',
        // More generic but specific to file attachments
        '[data-testid*="file"]',
        '[data-test-id*="file"]',
        '[class*="file"]',
        '[class*="attachment"]',
        // Look for elements containing file names
        'div[class*="file"]',
        'div[class*="attachment"]',
        'span[class*="file"]',
        'span[class*="attachment"]'
      ];

      let fileCards: Element[] = [];
      let usedSelector = '';

      // Find file cards using comprehensive Gemini-specific selectors
      for (const selector of geminiFileCardSelectors) {
        try {
          const cards = document.querySelectorAll(selector.trim());
          if (cards.length > 0) {
            fileCards = Array.from(cards);
            usedSelector = selector.trim();
            this.context.logger.debug(`Found ${fileCards.length} file cards using selector: ${selector.trim()}`);
            
            // Log details about found cards for debugging
            fileCards.forEach((card, index) => {
              this.context.logger.debug(`File card ${index + 1}:`, {
                tagName: card.tagName,
                className: card.className,
                textContent: card.textContent?.substring(0, 100),
                dataTestId: card.getAttribute('data-testid'),
                dataTestId2: card.getAttribute('data-test-id')
              });
            });
            break;
          }
        } catch (error) {
          this.context.logger.debug(`Selector "${selector.trim()}" failed: ${error}`);
        }
      }

      // If no file cards found with selectors, try to find by filename content
      if (fileCards.length === 0 && fileName) {
        this.context.logger.debug(`No file cards found with selectors, trying to find by filename: ${fileName}`);
        
        // Remove file extension for flexible matching
        const fileNameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
        const fileNameWithExt = fileName;
        
        // Search for any element containing the filename
        const allElements = document.querySelectorAll('*');
        for (const element of Array.from(allElements)) {
          const textContent = element.textContent || '';
          
          // Try multiple matching strategies
          if (textContent.includes(fileNameWithExt) || 
              textContent.includes(fileNameWithoutExt) ||
              textContent.toLowerCase().includes(fileNameWithoutExt.toLowerCase())) {
            // Check if this element looks like a file card (has reasonable size and structure)
            const rect = element.getBoundingClientRect();
            if (rect.width > 50 && rect.height > 20) {
              fileCards.push(element);
              usedSelector = `filename-content: ${fileName}`;
              this.context.logger.debug(`Found file card by filename content: ${fileName} (matched: "${textContent.trim()}")`, {
                tagName: element.tagName,
                className: element.className,
                textContent: textContent.substring(0, 100)
              });
              break;
            }
          }
        }
      }

      if (fileCards.length === 0) {
        this.context.logger.warn('No file cards found to detach');
        this.emitExecutionFailed('detachFile', 'No file cards found');
        return false;
      }

      // If a specific filename is provided, try to find that file card
      let targetCard: Element | null = null;
      if (fileName) {
        // Remove file extension for flexible matching
        const fileNameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
        const fileNameWithExt = fileName;
        
        for (const card of fileCards) {
          const cardText = card.textContent || '';
          
          // Try multiple matching strategies
          if (cardText.includes(fileNameWithExt) || 
              cardText.includes(fileNameWithoutExt) ||
              cardText.toLowerCase().includes(fileNameWithoutExt.toLowerCase())) {
            targetCard = card;
            this.context.logger.debug(`Found target file card for: ${fileName} (matched: "${cardText.trim()}")`);
            break;
          }
        }
      } else {
        // If no specific filename, use the first file card
        targetCard = fileCards[0];
        this.context.logger.debug('Using first file card for detachment');
      }

      if (!targetCard) {
        this.context.logger.warn(`Target file card not found${fileName ? ` for: ${fileName}` : ''}`);
        this.emitExecutionFailed('detachFile', `Target file card not found${fileName ? ` for: ${fileName}` : ''}`);
        return false;
      }

      // Step 1: Enhanced hover simulation to make the "X" button visible
      this.context.logger.debug('Starting enhanced hover simulation to make close button visible');
      
      // Multiple hover event types to ensure the button becomes visible
      const hoverEvents = [
        new MouseEvent('mouseenter', { bubbles: true, cancelable: true, view: window }),
        new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }),
        new MouseEvent('mouseenter', { bubbles: true, cancelable: true, view: window, clientX: 100, clientY: 100 }),
        new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window, clientX: 100, clientY: 100 })
      ];

      // Dispatch all hover events
      for (const event of hoverEvents) {
        targetCard.dispatchEvent(event);
        this.context.logger.debug(`Dispatched hover event: ${event.type}`);
      }

      // Also try focusing the element (some UIs show close buttons on focus)
      if (targetCard instanceof HTMLElement) {
        targetCard.focus();
        this.context.logger.debug('Focused the file card element');
      }

      // Wait longer for CSS transitions and JavaScript to show the close button
      this.context.logger.debug('Waiting for hover effects to take place...');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 2: Enhanced close button detection with comprehensive selectors and debugging
      this.context.logger.debug('Searching for close button with enhanced detection...');
      
      const geminiCloseButtonSelectors = [
        'button[aria-label*="Remove"]',
        'button[aria-label*="Close"]',
        'button[aria-label*="Delete"]',
        'button[aria-label*="×"]',
        'button[aria-label*="X"]',
        '.cancel-button',
        '.close-button',
        '.remove-button',
        '.delete-button',
        '[data-test-id="cancel-button"]',
        '[data-testid="cancel-button"]',
        '[data-test-id="close-button"]',
        '[data-testid="close-button"]',
        '[data-test-id="remove-button"]',
        '[data-testid="remove-button"]',
        'svg[aria-label*="Close"]',
        'svg[aria-label*="Remove"]',
        'svg[aria-label*="Delete"]',
        'button[class*="close"]',
        'button[class*="remove"]',
        'button[class*="delete"]',
        'button[class*="cancel"]',
        'svg[class*="close"]',
        'svg[class*="remove"]',
        'svg[class*="delete"]',
        '[data-testid="close"]',
        '[data-testid="remove"]',
        '[data-testid="delete"]',
        '[data-testid="cancel"]'
      ];

      let closeButton: Element | null = null;
      let usedCloseSelector = '';
      let searchLocation = '';

      // First try to find the close button within the target card
      this.context.logger.debug('Searching for close button within the file card...');
      for (const selector of geminiCloseButtonSelectors) {
        try {
          const buttons = targetCard.querySelectorAll(selector.trim());
          if (buttons.length > 0) {
            closeButton = buttons[0];
            usedCloseSelector = selector.trim();
            searchLocation = 'within card';
            this.context.logger.debug(`Found ${buttons.length} close button(s) within file card using selector: ${selector.trim()}`);
            break;
          }
        } catch (error) {
          this.context.logger.debug(`Close button selector "${selector.trim()}" failed: ${error}`);
        }
      }

      // If not found within the card, try to find it in parent elements
      if (!closeButton) {
        this.context.logger.debug('Searching for close button in parent elements...');
        let currentParent = targetCard.parentElement;
        let parentLevel = 1;
        
        while (currentParent && parentLevel <= 3) { // Search up to 3 levels up
          for (const selector of geminiCloseButtonSelectors) {
            try {
              const buttons = currentParent.querySelectorAll(selector.trim());
              if (buttons.length > 0) {
                closeButton = buttons[0];
                usedCloseSelector = selector.trim();
                searchLocation = `parent level ${parentLevel}`;
                this.context.logger.debug(`Found ${buttons.length} close button(s) in parent level ${parentLevel} using selector: ${selector.trim()}`);
                break;
              }
            } catch (error) {
              this.context.logger.debug(`Parent close button selector "${selector.trim()}" failed: ${error}`);
            }
          }
          
          if (closeButton) break;
          currentParent = currentParent.parentElement;
          parentLevel++;
        }
      }

      // If still not found, try searching the entire document for buttons near the file card
      if (!closeButton) {
        this.context.logger.debug('Searching entire document for close buttons near the file card...');
        const cardRect = targetCard.getBoundingClientRect();
        
        for (const selector of geminiCloseButtonSelectors) {
          try {
            const allButtons = document.querySelectorAll(selector.trim());
            for (const button of Array.from(allButtons)) {
              const buttonRect = button.getBoundingClientRect();
              // Check if button is near the file card (within 100px)
              const distance = Math.sqrt(
                Math.pow(buttonRect.left - cardRect.left, 2) + 
                Math.pow(buttonRect.top - cardRect.top, 2)
              );
              
              if (distance < 100) {
                closeButton = button;
                usedCloseSelector = selector.trim();
                searchLocation = `nearby (${Math.round(distance)}px away)`;
                this.context.logger.debug(`Found close button nearby using selector: ${selector.trim()}`);
                break;
              }
            }
            if (closeButton) break;
          } catch (error) {
            this.context.logger.debug(`Nearby close button selector "${selector.trim()}" failed: ${error}`);
          }
        }
      }

      if (!closeButton) {
        this.context.logger.warn('Could not find close button for file card after comprehensive search');
        this.emitExecutionFailed('detachFile', 'Close button not found after comprehensive search');
        return false;
      }

      // Log detailed information about the found close button
      this.context.logger.info(`Found close button: ${usedCloseSelector} (${searchLocation})`);
      this.context.logger.debug(`Close button element:`, closeButton);
      this.context.logger.debug(`Close button tag: ${closeButton.tagName}`);
      this.context.logger.debug(`Close button classes: ${closeButton.className}`);
      this.context.logger.debug(`Close button aria-label: ${closeButton.getAttribute('aria-label')}`);
      this.context.logger.debug(`Close button data-testid: ${closeButton.getAttribute('data-testid')}`);

      // Step 3: Enhanced click handling for the close button
      this.context.logger.debug('Attempting to click close button to remove file');
      
      try {
        // Try multiple click methods for better compatibility
        if (closeButton instanceof HTMLElement) {
          // Method 1: Standard click
          closeButton.click();
          this.context.logger.debug('Clicked close button using standard click()');
          
          // Method 2: Also try dispatching a click event
          closeButton.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
          }));
          this.context.logger.debug('Dispatched click event on close button');
        } else {
          // Fallback for non-HTML elements
          (closeButton as any).click();
          this.context.logger.debug('Clicked close button using fallback method');
        }
        
        this.context.logger.info(`Successfully clicked close button to detach file${fileName ? `: ${fileName}` : ''}`);
      } catch (clickError) {
        this.context.logger.error(`Error clicking close button: ${clickError}`);
        this.emitExecutionFailed('detachFile', `Error clicking close button: ${clickError}`);
        return false;
      }

      // Step 4: Wait and verify the file card was removed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const cardStillExists = document.contains(targetCard);
      if (!cardStillExists) {
        this.context.logger.info(`File card successfully removed${fileName ? ` for: ${fileName}` : ''}`);
        this.emitExecutionCompleted(
          'detachFile',
          { fileName: fileName || 'unknown' },
          { success: true, method: 'close-button-click' }
        );
        return true;
      } else {
        this.context.logger.warn(`File card still exists after clicking close button${fileName ? ` for: ${fileName}` : ''}`);
        this.emitExecutionCompleted(
          'detachFile',
          { fileName: fileName || 'unknown' },
          { success: false, method: 'close-button-click', reason: 'card-still-exists' }
        );
        return false;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.context.logger.error(`Error detaching file from Gemini: ${errorMessage}`);
      this.emitExecutionFailed('detachFile', errorMessage);
      return false;
    }
  }

  /**
   * Check if the current page/URL is supported by this adapter
   * Enhanced with better pattern matching and logging
   */
  isSupported(): boolean | Promise<boolean> {
    const currentHost = window.location.hostname;
    const currentUrl = window.location.href;

    this.context.logger.debug(`Checking if Gemini adapter supports: ${currentUrl}`);

    // Check hostname first
    const isGeminiHost = this.hostnames.some(hostname => {
      if (typeof hostname === 'string') {
        return currentHost.includes(hostname);
      }
      // hostname is RegExp if it's not a string
      return (hostname as RegExp).test(currentHost);
    });

    if (!isGeminiHost) {
      this.context.logger.debug(`Host ${currentHost} not supported by Gemini adapter`);
      return false;
    }

    // Check if we're on a supported Gemini page (not just the homepage)
    const supportedPatterns = [
      /^https:\/\/gemini\.google\.com\/u\/\d+\/app\/.*/, // User-specific app pages
      /^https:\/\/gemini\.google\.com\/app\/.*/, // General app pages
      /^https:\/\/gemini\.google\.com\/chat\/.*/, // Chat pages
      /^https:\/\/gemini\.google\.com\/u\/\d+\/chat\/.*/, // User-specific chat pages
    ];

    const isSupported = supportedPatterns.some(pattern => pattern.test(currentUrl));

    if (isSupported) {
      this.context.logger.info(`Gemini adapter supports current page: ${currentUrl}`);
    } else {
      this.context.logger.debug(`URL pattern not supported: ${currentUrl}`);
    }

    return isSupported;
  }

  /**
   * Check if file upload is supported on the current page
   * Enhanced with multiple selector checking and better detection
   */
  supportsFileUpload(): boolean {
    this.context.logger.debug('Checking file upload support for Gemini');

    // Check for drop zones
    const dropZoneSelectors = this.selectors.DROP_ZONE.split(', ');
    for (const selector of dropZoneSelectors) {
      const dropZone = document.querySelector(selector.trim());
      if (dropZone) {
        this.context.logger.debug(`Found drop zone with selector: ${selector.trim()}`);
        return true;
      }
    }

    // Check for file upload buttons
    const uploadButtonSelectors = this.selectors.FILE_UPLOAD_BUTTON.split(', ');
    for (const selector of uploadButtonSelectors) {
      const uploadButton = document.querySelector(selector.trim());
      if (uploadButton) {
        this.context.logger.debug(`Found upload button with selector: ${selector.trim()}`);
        return true;
      }
    }

    // Check for file input elements
    const fileInput = document.querySelector(this.selectors.FILE_INPUT);
    if (fileInput) {
      this.context.logger.debug('Found file input element');
      return true;
    }

    this.context.logger.debug('No file upload support detected');
    return false;
  }

  // Private helper methods

  /**
   * Get Gemini-specific button styles that match the toolbox drawer items
   * Based on the Material Design Components used in Gemini's interface
   */
  private getGeminiButtonStyles(): string {
    return `
      /* Gemini MCP Button Styles - Matching toolbox-drawer-item style */
      .mcp-gemini-button-base {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        position: relative;
        box-sizing: border-box;
        min-width: 40px;
        height: 40px;
        padding: 8px 12px;
        margin: 0 2px;
        border: none;
        border-radius: 20px;
        background: transparent;
        color: #3c4043;
        font-family: 'Google Sans', Roboto, Arial, sans-serif;
        font-size: 14px;
        font-weight: 500;
        line-height: 20px;
        text-decoration: none;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.2, 0.0, 0.2, 1);
        overflow: hidden;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
        outline: none;
        /* Match toolbox drawer item appearance */
        letter-spacing: 0.0178571429em;
      }

      /* Hover state - matches Material Design ripple */
      .mcp-gemini-button-base:hover {
        background-color: rgba(60, 64, 67, 0.04);
      }

      /* Active/pressed state */
      .mcp-gemini-button-base:active {
        background-color: rgba(60, 64, 67, 0.08);
        transform: scale(0.98);
      }

      /* Focus state for accessibility */
      .mcp-gemini-button-base:focus-visible {
        outline: 2px solid #1a73e8;
        outline-offset: 2px;
      }

      /* Active toggle state - matches Gemini's toolbox drawer pressed state */
      .mcp-gemini-button-base.mcp-button-active {
        background-color: rgba(138, 180, 248, 0.2);
        color: #1557c0;
      }

      .mcp-gemini-button-base.mcp-button-active:hover {
        background-color: rgba(138, 180, 248, 0.24);
      }

      /* Button content container */
      .mcp-gemini-button-content {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        position: relative;
        z-index: 1;
      }

      /* Text styling to match GDS label */
      .mcp-gemini-button-text {
        font-size: 14px;
        font-weight: 500;
        line-height: 20px;
        letter-spacing: 0.0178571429em;
        white-space: nowrap;
      }

      /* Material ripple effect overlay */
      .mcp-gemini-button-base::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: currentColor;
        opacity: 0;
        border-radius: inherit;
        transition: opacity 0.15s cubic-bezier(0.2, 0.0, 0.2, 1);
        pointer-events: none;
      }

      .mcp-gemini-button-base:hover::before {
        opacity: 0.04;
      }

      .mcp-gemini-button-base:active::before {
        opacity: 0.08;
      }

      /* Icon styling matching Google Material Symbols */
      .mcp-gemini-button-base .mcp-button-icon {
        width: 20px;
        height: 20px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        line-height: 1;
        font-family: 'Material Symbols Outlined', 'Google Material Icons';
      }

      /* Dark mode support */
      @media (prefers-color-scheme: dark) {
        .mcp-gemini-button-base {
          color: #e8eaed;
        }

        .mcp-gemini-button-base:hover {
          background-color: rgba(232, 234, 237, 0.04);
        }

        .mcp-gemini-button-base:active {
          background-color: rgba(232, 234, 237, 0.08);
        }

        .mcp-gemini-button-base.mcp-button-active {
          background-color: rgba(138, 180, 248, 0.12);
          color: #8ab4f8;
        }

        .mcp-gemini-button-base.mcp-button-active:hover {
          background-color: rgba(138, 180, 248, 0.16);
        }
      }

      /* High contrast mode support */
      @media (prefers-contrast: high) {
        .mcp-gemini-button-base {
          border: 1px solid currentColor;
        }

        .mcp-gemini-button-base:focus-visible {
          outline-width: 3px;
        }
      }

      /* Reduced motion support */
      @media (prefers-reduced-motion: reduce) {
        .mcp-gemini-button-base {
          transition: none;
        }

        .mcp-gemini-button-base:active {
          transform: none;
        }

        .mcp-gemini-button-base::before {
          transition: none;
        }
      }

      /* Integration with Gemini's toolbox drawer layout */
      .leading-actions-wrapper .mcp-gemini-button-base,
      .input-area .mcp-gemini-button-base,
      .chat-input-actions .mcp-gemini-button-base {
        margin: 0 2px;
      }

      /* Ensure proper stacking with Gemini's UI elements */
      .mcp-gemini-button-base {
        position: relative;
        z-index: 1;
      }

      /* Match the exact styling of toolbox drawer items when in sidebar */
      .toolbox-drawer-item-button .mcp-gemini-button-base,
      .mcp-gemini-button-base.toolbox-style {
        width: 100%;
        height: 48px;
        padding: 12px 16px;
        margin: 0;
        border-radius: 0;
        justify-content: flex-start;
        gap: 12px;
        font-size: 14px;
        line-height: 20px;
      }

      .toolbox-drawer-item-button .mcp-gemini-button-base .mcp-button-icon,
      .mcp-gemini-button-base.toolbox-style .mcp-button-icon {
        width: 24px;
        height: 24px;
        font-size: 24px;
        margin-right: 12px;
      }

      .toolbox-drawer-item-button .mcp-gemini-button-base .mcp-gemini-button-text,
      .mcp-gemini-button-base.toolbox-style .mcp-gemini-button-text {
        text-align: left;
        flex: 1;
      }
    `;
  }

  /**
   * Inject Gemini-specific button styles into the page
   */
  private injectGeminiButtonStyles(): void {
    if (this.geminiStylesInjected) {
      this.context.logger.debug('Gemini button styles already injected, skipping');
      return;
    }

    try {
      const styleId = 'mcp-gemini-button-styles';
      const existingStyles = document.getElementById(styleId);
      if (existingStyles) {
        existingStyles.remove();
      }

      const styleElement = document.createElement('style');
      styleElement.id = styleId;
      styleElement.textContent = this.getGeminiButtonStyles();
      document.head.appendChild(styleElement);

      this.geminiStylesInjected = true;
      this.context.logger.info('Gemini button styles injected successfully');
    } catch (error) {
      this.context.logger.error('Failed to inject Gemini button styles:', error);
    }
  }

  private setupUrlTracking(): void {
    if (!this.urlCheckInterval) {
      this.urlCheckInterval = setInterval(() => {
        const currentUrl = window.location.href;
        if (currentUrl !== this.lastUrl) {
          this.context.logger.info(`URL changed from ${this.lastUrl} to ${currentUrl}`);

          // Emit page changed event
          if (this.onPageChanged) {
            this.onPageChanged(currentUrl, this.lastUrl);
          }

          this.lastUrl = currentUrl;
        }
      }, 1000); // Check every second
    }
  }

  // New architecture integration methods

  private setupStoreEventListeners(): void {
    if (this.storeEventListenersSetup) {
      this.context.logger.warn(`Store event listeners already set up for instance #${this.instanceId}, skipping`);
      return;
    }

    this.context.logger.debug(`Setting up store event listeners for Gemini adapter instance #${this.instanceId}`);

    // Listen for tool execution events from the store
    this.context.eventBus.on('tool:execution-completed', data => {
      this.context.logger.debug('Tool execution completed:', data);
      // Handle auto-actions based on store state
      this.handleToolExecutionCompleted(data);
    });

    // Listen for UI state changes
    this.context.eventBus.on('ui:sidebar-toggle', data => {
      this.context.logger.debug('Sidebar toggled:', data);
    });

    this.storeEventListenersSetup = true;
  }

  private setupDOMObservers(): void {
    if (this.domObserversSetup) {
      this.context.logger.warn(`DOM observers already set up for instance #${this.instanceId}, skipping`);
      return;
    }

    this.context.logger.debug(`Setting up DOM observers for Gemini adapter instance #${this.instanceId}`);

    // Set up mutation observer to detect page changes and re-inject UI if needed
    this.mutationObserver = new MutationObserver(mutations => {
      let shouldReinject = false;

      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          // Check if our MCP popover was removed
          if (!document.getElementById('mcp-popover-container')) {
            shouldReinject = true;
          }
        }
      });

      if (shouldReinject) {
        this.context.logger.debug('MCP popover removed, attempting to re-inject');
        this.setupUIIntegration();
      }
    });

    // Start observing
    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    this.domObserversSetup = true;
  }

  private setupUIIntegration(): void {
    // Allow multiple calls for UI integration (for re-injection after page changes)
    // but log it for debugging
    if (this.uiIntegrationSetup) {
      this.context.logger.debug(
        `UI integration already set up for instance #${this.instanceId}, re-injecting for page changes`,
      );
    } else {
      this.context.logger.debug(`Setting up UI integration for Gemini adapter instance #${this.instanceId}`);
      this.uiIntegrationSetup = true;
    }

    // Wait for page to be ready, then inject MCP popover
    this.waitForPageReady().then(() => {
      this.injectMCPPopoverWithRetry();
    });

    // Set up periodic check to ensure popover stays injected
    this.setupPeriodicPopoverCheck();
  }

  private async waitForPageReady(): Promise<void> {
    return new Promise(resolve => {
      const checkReady = () => {
        // Check if the page has the necessary elements
        const insertionPoint = this.findButtonInsertionPoint();
        if (insertionPoint) {
          this.context.logger.debug('Page ready for MCP popover injection');
          resolve();
        } else {
          // Retry after a short delay
          setTimeout(checkReady, 500);
        }
      };

      // Start checking immediately, but with a small initial delay
      setTimeout(checkReady, 100);
    });
  }

  private injectMCPPopoverWithRetry(maxRetries: number = 5): void {
    const attemptInjection = (attempt: number) => {
      this.context.logger.debug(`Attempting MCP popover injection (attempt ${attempt}/${maxRetries})`);

      // Check if popover already exists
      if (document.getElementById('mcp-popover-container')) {
        this.context.logger.debug('MCP popover already exists');
        return;
      }

      // Find insertion point
      const insertionPoint = this.findButtonInsertionPoint();
      if (insertionPoint) {
        this.injectMCPPopover(insertionPoint);
      } else if (attempt < maxRetries) {
        // Retry after delay
        this.context.logger.debug(`Insertion point not found, retrying in 1 second (attempt ${attempt}/${maxRetries})`);
        setTimeout(() => attemptInjection(attempt + 1), 1000);
      } else {
        this.context.logger.warn('Failed to inject MCP popover after maximum retries');
      }
    };

    attemptInjection(1);
  }

  private setupPeriodicPopoverCheck(): void {
    // Check every 5 seconds if the popover is still there
    if (!this.popoverCheckInterval) {
      this.popoverCheckInterval = setInterval(() => {
        if (!document.getElementById('mcp-popover-container')) {
          this.context.logger.debug('MCP popover missing, attempting to re-inject');
          this.injectMCPPopoverWithRetry(3); // Fewer retries for periodic checks
        }
      }, 5000);
    }
  }

  private cleanupDOMObservers(): void {
    this.context.logger.debug('Cleaning up DOM observers for Gemini adapter');

    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
  }

  private cleanupUIIntegration(): void {
    this.context.logger.debug('Cleaning up UI integration for Gemini adapter');

    // Remove MCP popover if it exists
    const popoverContainer = document.getElementById('mcp-popover-container');
    if (popoverContainer) {
      popoverContainer.remove();
    }

    this.mcpPopoverContainer = null;
  }

  private handleToolExecutionCompleted(data: any): void {
    this.context.logger.debug('Handling tool execution completion in Gemini adapter:', data);

    // Use the base class method to check if we should handle events
    if (!this.shouldHandleEvents()) {
      this.context.logger.debug('Gemini adapter should not handle events, ignoring tool execution event');
      return;
    }

    // Get current UI state from stores to determine auto-actions
    const uiState = this.context.stores.ui;
    if (uiState && data.execution) {
      // Handle auto-insert, auto-submit based on store state
      // This integrates with the new architecture's state management
      this.context.logger.debug('Tool execution handled with new architecture integration');
    }
  }

  private findButtonInsertionPoint(): { container: Element; insertAfter: Element | null } | null {
    this.context.logger.debug('Finding button insertion point for MCP popover');

    // Try primary selector first
    const wrapper = document.querySelector('.leading-actions-wrapper');
    if (wrapper) {
      this.context.logger.debug('Found insertion point: .leading-actions-wrapper');
      const btns = wrapper.querySelectorAll('button');
      const after = btns.length > 1 ? btns[1] : btns.length > 0 ? btns[0] : null;
      return { container: wrapper, insertAfter: after };
    }

    // Try fallback selectors
    const fallbackSelectors = ['.input-area .actions', '.chat-input-actions', '.conversation-input .actions'];

    for (const selector of fallbackSelectors) {
      const container = document.querySelector(selector);
      if (container) {
        this.context.logger.debug(`Found fallback insertion point: ${selector}`);
        return { container, insertAfter: null };
      }
    }

    this.context.logger.warn('Could not find suitable insertion point for MCP popover');
    return null;
  }

  private injectMCPPopover(insertionPoint: { container: Element; insertAfter: Element | null }): void {
    this.context.logger.debug('Injecting MCP popover into Gemini interface');

    try {
      // Check if popover already exists
      if (document.getElementById('mcp-popover-container')) {
        this.context.logger.debug('MCP popover already exists, skipping injection');
        return;
      }

      // Create container for the popover
      const reactContainer = document.createElement('div');
      reactContainer.id = 'mcp-popover-container';
      reactContainer.style.display = 'inline-block';
      reactContainer.style.margin = '0 4px';

      // Insert at appropriate location
      const { container, insertAfter } = insertionPoint;
      if (insertAfter && insertAfter.parentNode === container) {
        container.insertBefore(reactContainer, insertAfter.nextSibling);
        this.context.logger.debug('Inserted popover container after specified element');
      } else {
        container.appendChild(reactContainer);
        this.context.logger.debug('Appended popover container to container element');
      }

      // Store reference
      this.mcpPopoverContainer = reactContainer;

      // Render the React MCP Popover using the new architecture
      this.renderMCPPopover(reactContainer);

      this.context.logger.info('MCP popover injected and rendered successfully');
    } catch (error) {
      this.context.logger.error('Failed to inject MCP popover:', error);
    }
  }

  private renderMCPPopover(container: HTMLElement): void {
    this.context.logger.debug('Rendering MCP popover with new architecture integration');

    try {
      // Import React and ReactDOM dynamically to avoid bundling issues
      import('react')
        .then(React => {
          import('react-dom/client')
            .then(ReactDOM => {
              import('../../components/mcpPopover/mcpPopover')
                .then(({ MCPPopover }) => {
                  // Create toggle state manager that integrates with new stores
                  const toggleStateManager = this.createToggleStateManager();

                  // Create adapter button configuration for Gemini styling
                  const adapterButtonConfig = {
                    className: 'mcp-gemini-button-base',
                    contentClassName: 'mcp-gemini-button-content',
                    textClassName: 'mcp-gemini-button-text',
                    activeClassName: 'mcp-button-active',
                  };

                  // Create React root and render
                  const root = ReactDOM.createRoot(container);
                  root.render(
                    React.createElement(MCPPopover, {
                      toggleStateManager: toggleStateManager,
                      adapterButtonConfig: adapterButtonConfig,
                      adapterName: this.name,
                    }),
                  );

                  this.context.logger.info('MCP popover rendered successfully with new architecture');
                })
                .catch(error => {
                  this.context.logger.error('Failed to import MCPPopover component:', error);
                });
            })
            .catch(error => {
              this.context.logger.error('Failed to import ReactDOM:', error);
            });
        })
        .catch(error => {
          this.context.logger.error('Failed to import React:', error);
        });
    } catch (error) {
      this.context.logger.error('Failed to render MCP popover:', error);
    }
  }

  private createToggleStateManager() {
    const context = this.context;
    const adapterName = this.name;

    // Create the state manager object
    const stateManager = {
      getState: () => {
        try {
          // Get state from UI store - MCP enabled state should be the persistent MCP toggle state
          const uiState = context.stores.ui;

          // Get the persistent MCP enabled state and other preferences
          const mcpEnabled = uiState?.mcpEnabled ?? false;
          const autoSubmitEnabled = uiState?.preferences?.autoSubmit ?? false;

          context.logger.debug(`Getting MCP toggle state: mcpEnabled=${mcpEnabled}, autoSubmit=${autoSubmitEnabled}`);

          return {
            mcpEnabled: mcpEnabled, // Use the persistent MCP state
            autoInsert: autoSubmitEnabled,
            autoSubmit: autoSubmitEnabled,
            autoExecute: false, // Default for now, can be extended
          };
        } catch (error) {
          context.logger.error('Error getting toggle state:', error);
          // Return safe defaults in case of error
          return {
            mcpEnabled: false,
            autoInsert: false,
            autoSubmit: false,
            autoExecute: false,
          };
        }
      },

      setMCPEnabled: (enabled: boolean) => {
        context.logger.debug(
          `Setting MCP ${enabled ? 'enabled' : 'disabled'} - controlling sidebar visibility via MCP state`,
        );

        try {
          // Primary method: Control MCP state through UI store (which will automatically control sidebar)
          if (context.stores.ui?.setMCPEnabled) {
            context.stores.ui.setMCPEnabled(enabled, 'mcp-popover-toggle');
            context.logger.debug(`MCP state set to: ${enabled} via UI store`);
          } else {
            context.logger.warn('UI store setMCPEnabled method not available');

            // Fallback: Control sidebar visibility directly if MCP state setter not available
            if (context.stores.ui?.setSidebarVisibility) {
              context.stores.ui.setSidebarVisibility(enabled, 'mcp-popover-toggle-fallback');
              context.logger.debug(`Sidebar visibility set to: ${enabled} via UI store fallback`);
            }
          }

          // Secondary method: Control through global sidebar manager as additional safeguard
          const sidebarManager = (window as any).activeSidebarManager;
          if (sidebarManager) {
            if (enabled) {
              context.logger.debug('Showing sidebar via activeSidebarManager');
              sidebarManager.show().catch((error: any) => {
                context.logger.error('Error showing sidebar:', error);
              });
            } else {
              context.logger.debug('Hiding sidebar via activeSidebarManager');
              sidebarManager.hide().catch((error: any) => {
                context.logger.error('Error hiding sidebar:', error);
              });
            }
          } else {
            context.logger.warn('activeSidebarManager not available on window - will rely on UI store only');
          }

          // Auto-detach files when MCP is disabled
          if (!enabled) {
            context.logger.info('MCP disabled - automatically detaching any attached files');
            // Use setTimeout to ensure the state change completes first
            setTimeout(() => {
              // Try multiple ways to get the adapter instance
              let currentAdapter = null;
              
              // Method 1: Try window.currentGeminiAdapter
              if ((window as any).currentGeminiAdapter) {
                currentAdapter = (window as any).currentGeminiAdapter;
                context.logger.debug('Found adapter via window.currentGeminiAdapter');
              }
              
              // Method 2: Try to find adapter through plugin registry
              if (!currentAdapter && (window as any).mcpPluginRegistry) {
                const registry = (window as any).mcpPluginRegistry;
                const adapters = registry.getAdapters ? registry.getAdapters() : [];
                currentAdapter = adapters.find((adapter: any) => adapter.name === 'GeminiAdapter');
                if (currentAdapter) {
                  context.logger.debug('Found adapter via plugin registry');
                }
              }
              
              // Method 3: Try to find adapter through global store
              if (!currentAdapter && context.stores?.adapter) {
                const adapter = context.stores.adapter;
                if (adapter && adapter.name === 'GeminiAdapter') {
                  currentAdapter = adapter;
                  context.logger.debug('Found adapter via stores.adapter');
                }
              }
              
              if (currentAdapter && typeof currentAdapter.detachFile === 'function') {
                context.logger.info('Calling detachFile on Gemini adapter');
                currentAdapter.detachFile().catch((error: any) => {
                  context.logger.error('Error auto-detaching file:', error);
                });
              } else {
                context.logger.warn('Current Gemini adapter not available for auto-detachment. Available methods:',
                  {
                    windowAdapter: !!(window as any).currentGeminiAdapter,
                    pluginRegistry: !!(window as any).mcpPluginRegistry,
                    storesAdapter: !!context.stores?.adapter
                  }
                );
              }
            }, 100);
          }

          context.logger.info(
            `MCP toggle completed: MCP ${enabled ? 'enabled' : 'disabled'}, sidebar ${enabled ? 'shown' : 'hidden'}`,
          );
        } catch (error) {
          context.logger.error('Error in setMCPEnabled:', error);
        }

        stateManager.updateUI();
      },

      setAutoInsert: (enabled: boolean) => {
        context.logger.debug(`Setting Auto Insert ${enabled ? 'enabled' : 'disabled'}`);

        // Update preferences through store
        if (context.stores.ui?.updatePreferences) {
          context.stores.ui.updatePreferences({ autoSubmit: enabled });
        }

        stateManager.updateUI();
      },

      setAutoSubmit: (enabled: boolean) => {
        context.logger.debug(`Setting Auto Submit ${enabled ? 'enabled' : 'disabled'}`);

        // Update preferences through store
        if (context.stores.ui?.updatePreferences) {
          context.stores.ui.updatePreferences({ autoSubmit: enabled });
        }

        stateManager.updateUI();
      },

      setAutoExecute: (enabled: boolean) => {
        context.logger.debug(`Setting Auto Execute ${enabled ? 'enabled' : 'disabled'}`);
        // Can be extended to handle auto execute functionality
        stateManager.updateUI();
      },

      updateUI: () => {
        context.logger.debug('Updating MCP popover UI');

        // Dispatch custom event to update the popover
        const popoverContainer = document.getElementById('mcp-popover-container');
        if (popoverContainer) {
          const currentState = stateManager.getState();
          const event = new CustomEvent('mcp:update-toggle-state', {
            detail: { toggleState: currentState },
          });
          popoverContainer.dispatchEvent(event);
        }
      },
    };

    return stateManager;
  }

  /**
   * Public method to manually inject MCP popover (for debugging or external calls)
   */
  public injectMCPPopoverManually(): void {
    this.context.logger.info('Manual MCP popover injection requested');
    this.injectMCPPopoverWithRetry();
  }

  /**
   * Check if MCP popover is currently injected
   */
  public isMCPPopoverInjected(): boolean {
    return !!document.getElementById('mcp-popover-container');
  }

  private async injectFileDropListener(): Promise<boolean> {
    try {
      const listenerUrl = this.context.chrome.runtime.getURL('dragDropListener.js');
      const scriptEl = document.createElement('script');
      scriptEl.src = listenerUrl;

      await new Promise<void>((resolve, reject) => {
        scriptEl.onload = () => resolve();
        scriptEl.onerror = () => reject(new Error('Failed to load drop listener script'));
        (document.head || document.documentElement).appendChild(scriptEl);
      });

      scriptEl.remove();
      return true;
    } catch (error) {
      this.context.logger.error('Failed to inject file drop listener:', error);
      return false;
    }
  }

  private readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  private async checkFilePreview(): Promise<boolean> {
    return new Promise(resolve => {
      setTimeout(() => {
        const filePreview = document.querySelector(this.selectors.FILE_PREVIEW);
        if (filePreview) {
          this.context.logger.info('File preview element found after attachment');
          resolve(true);
        } else {
          this.context.logger.warn('File preview element not found after attachment');
          resolve(false);
        }
      }, 500);
    });
  }

  private emitExecutionCompleted(toolName: string, parameters: any, result: any): void {
    this.context.eventBus.emit('tool:execution-completed', {
      execution: {
        id: this.generateCallId(),
        toolName,
        parameters,
        result,
        timestamp: Date.now(),
        status: 'success',
      },
    });
  }

  private emitExecutionFailed(toolName: string, error: string): void {
    this.context.eventBus.emit('tool:execution-failed', {
      toolName,
      error,
      callId: this.generateCallId(),
    });
  }

  private generateCallId(): string {
    return `gemini-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Check if the sidebar is properly available after navigation
   */
  private checkAndRestoreSidebar(): void {
    this.context.logger.info('Checking sidebar state after page navigation');

    try {
      // Check if there's an active sidebar manager
      const activeSidebarManager = (window as any).activeSidebarManager;

      if (!activeSidebarManager) {
        this.context.logger.warn('No active sidebar manager found after navigation');
        return;
      }

      // Sidebar manager exists, just ensure MCP popover connection is working
      this.ensureMCPPopoverConnection();
    } catch (error) {
      this.context.logger.error('Error checking sidebar state after navigation:', error);
    }
  }

  /**
   * Ensure MCP popover is properly connected to the sidebar after navigation
   */
  private ensureMCPPopoverConnection(): void {
    this.context.logger.info('Ensuring MCP popover connection after navigation');

    try {
      // Check if MCP popover is still injected
      if (!this.isMCPPopoverInjected()) {
        this.context.logger.info('MCP popover missing after navigation, re-injecting');
        this.injectMCPPopoverWithRetry(3);
      } else {
        this.context.logger.info('MCP popover is still present after navigation');
      }
    } catch (error) {
      this.context.logger.error('Error ensuring MCP popover connection:', error);
    }
  }

  // Event handlers - Enhanced for new architecture integration
  onPageChanged?(url: string, oldUrl?: string): void {
    this.context.logger.info(`Gemini page changed: from ${oldUrl || 'N/A'} to ${url}`);

    // Update URL tracking
    this.lastUrl = url;

    // Re-check support and re-inject UI if needed
    const stillSupported = this.isSupported();
    if (stillSupported) {
      // Re-inject styles after page change
      this.injectGeminiButtonStyles();

      // Re-setup UI integration after page change
      setTimeout(() => {
        this.setupUIIntegration();
      }, 1000); // Give page time to load

      // Check if sidebar exists and restore it if needed
      setTimeout(() => {
        this.checkAndRestoreSidebar();
      }, 1500); // Additional delay to ensure page is fully loaded
    } else {
      this.context.logger.warn('Page no longer supported after navigation');
    }

    // Emit page change event to stores
    this.context.eventBus.emit('app:site-changed', {
      site: url,
      hostname: window.location.hostname,
    });
  }

  onHostChanged?(newHost: string, oldHost?: string): void {
    this.context.logger.info(`Gemini host changed: from ${oldHost || 'N/A'} to ${newHost}`);

    // Re-check if the adapter is still supported
    const stillSupported = this.isSupported();
    if (!stillSupported) {
      this.context.logger.warn('Gemini adapter no longer supported on this host/page');
      // Emit deactivation event using available event type
      this.context.eventBus.emit('adapter:deactivated', {
        pluginName: this.name,
        timestamp: Date.now(),
      });
    } else {
      // Re-setup for new host
      this.setupUIIntegration();
    }
  }

  onToolDetected?(tools: any[]): void {
    this.context.logger.info(`Tools detected in Gemini adapter:`, tools);

    // Forward to tool store
    tools.forEach(tool => {
      this.context.stores.tool?.addDetectedTool?.(tool);
    });
  }
}
