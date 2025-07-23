export function analyzeDOMStructure() {
  console.log('🔍 DOM Structure Analysis for Gemini');
  
  // Find all input elements
  const inputs = document.querySelectorAll('input, textarea, [contenteditable="true"], [role="textbox"]');
  console.log(`Found ${inputs.length} potential input elements`);
  
  inputs.forEach((input, index) => {
    console.log(`\n--- Input Element ${index + 1} ---`);
    console.log('Element:', input);
    console.log('Tag:', input.tagName);
    console.log('Type:', (input as HTMLInputElement).type || 'N/A');
    console.log('Role:', input.getAttribute('role'));
    console.log('Contenteditable:', input.getAttribute('contenteditable'));
    console.log('ID:', input.id);
    console.log('Class:', input.className);
    console.log('Data attributes:', Array.from(input.attributes).filter(attr => attr.name.startsWith('data-')));
    
    // Check if element is in Shadow DOM
    let shadowRoot = null;
    let parent = input.parentElement;
    while (parent) {
      if (parent.shadowRoot) {
        shadowRoot = parent.shadowRoot;
        break;
      }
      parent = parent.parentElement;
    }
    
    if (shadowRoot) {
      console.log('📍 Found in Shadow DOM!');
      console.log('Shadow Root:', shadowRoot);
      console.log('Shadow Host:', shadowRoot.host);
    } else {
      console.log('📍 In regular DOM');
    }
    
    // Check if element is visible and interactive
    const rect = input.getBoundingClientRect();
    console.log('Visible:', rect.width > 0 && rect.height > 0);
    console.log('Position:', { x: rect.x, y: rect.y, width: rect.width, height: rect.height });
    console.log('Computed styles:', window.getComputedStyle(input));
  });
  
  // Look for file attachment areas
  console.log('\n🔍 Searching for file attachment areas...');
  const dropZones = document.querySelectorAll('[data-testid*="drop"], [data-testid*="upload"], [data-testid*="file"], [class*="drop"], [class*="upload"], [class*="file"]');
  console.log(`Found ${dropZones.length} potential drop zones`);
  
  dropZones.forEach((zone, index) => {
    console.log(`\n--- Drop Zone ${index + 1} ---`);
    console.log('Element:', zone);
    console.log('Tag:', zone.tagName);
    console.log('Data-testid:', zone.getAttribute('data-testid'));
    console.log('Class:', zone.className);
    
    // Check for Shadow DOM
    let shadowRoot = null;
    let parent = zone.parentElement;
    while (parent) {
      if (parent.shadowRoot) {
        shadowRoot = parent.shadowRoot;
        break;
      }
      parent = parent.parentElement;
    }
    
    if (shadowRoot) {
      console.log('📍 Found in Shadow DOM!');
    } else {
      console.log('📍 In regular DOM');
    }
  });
  
  // Look for file preview/attachment cards
  console.log('\n🔍 Searching for file attachment cards...');
  const fileCards = document.querySelectorAll('[data-testid*="attachment"], [data-testid*="file"], [class*="attachment"], [class*="file-card"], [class*="file-preview"]');
  console.log(`Found ${fileCards.length} potential file cards`);
  
  fileCards.forEach((card, index) => {
    console.log(`\n--- File Card ${index + 1} ---`);
    console.log('Element:', card);
    console.log('Tag:', card.tagName);
    console.log('Data-testid:', card.getAttribute('data-testid'));
    console.log('Class:', card.className);
    console.log('Text content:', card.textContent?.substring(0, 100));
    
    // Look for close buttons within this card
    const closeButtons = card.querySelectorAll('button, [role="button"], [aria-label*="close"], [aria-label*="remove"], [data-testid*="close"], [data-testid*="remove"]');
    console.log(`Found ${closeButtons.length} potential close buttons in this card`);
    
    closeButtons.forEach((btn, btnIndex) => {
      console.log(`  Close Button ${btnIndex + 1}:`, btn);
      console.log(`  Aria-label:`, btn.getAttribute('aria-label'));
      console.log(`  Data-testid:`, btn.getAttribute('data-testid'));
      console.log(`  Class:`, btn.className);
    });
    
    // Check for Shadow DOM
    let shadowRoot = null;
    let parent = card.parentElement;
    while (parent) {
      if (parent.shadowRoot) {
        shadowRoot = parent.shadowRoot;
        break;
      }
      parent = parent.parentElement;
    }
    
    if (shadowRoot) {
      console.log('📍 Found in Shadow DOM!');
    } else {
      console.log('📍 In regular DOM');
    }
  });
  
  // Check for any Shadow DOM roots
  console.log('\n🔍 Checking for Shadow DOM roots...');
  const shadowRoots = [];
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) => {
        if (node.shadowRoot) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      }
    }
  );
  
  let node;
  while (node = walker.nextNode()) {
    shadowRoots.push(node as Element);
  }
  
  console.log(`Found ${shadowRoots.length} Shadow DOM roots`);
  shadowRoots.forEach((host, index) => {
    console.log(`Shadow DOM ${index + 1}:`, host);
    console.log('Host tag:', host.tagName);
    console.log('Host class:', host.className);
    console.log('Shadow root:', host.shadowRoot);
  });
}

// Function to analyze a specific element and its Shadow DOM if present
export function analyzeElement(element: Element) {
  console.log('🔍 Analyzing specific element:', element);
  console.log('Tag:', element.tagName);
  console.log('Class:', element.className);
  console.log('ID:', element.id);
  console.log('Data attributes:', Array.from(element.attributes).filter(attr => attr.name.startsWith('data-')));
  
  // Check if element itself has Shadow DOM
  if (element.shadowRoot) {
    console.log('📍 Element has Shadow DOM!');
    console.log('Shadow root:', element.shadowRoot);
    console.log('Shadow root children:', element.shadowRoot.children);
    
    // Recursively analyze Shadow DOM contents
    Array.from(element.shadowRoot.children).forEach((child, index) => {
      console.log(`Shadow child ${index + 1}:`, child);
      if (child.shadowRoot) {
        console.log(`  Child ${index + 1} also has Shadow DOM!`);
      }
    });
  } else {
    console.log('📍 Element does not have Shadow DOM');
  }
  
  // Check if element is inside a Shadow DOM
  let shadowRoot = null;
  let parent = element.parentElement;
  while (parent) {
    if (parent.shadowRoot) {
      shadowRoot = parent.shadowRoot;
      break;
    }
    parent = parent.parentElement;
  }
  
  if (shadowRoot) {
    console.log('📍 Element is inside Shadow DOM!');
    console.log('Shadow host:', shadowRoot.host);
  } else {
    console.log('📍 Element is in regular DOM');
  }
} 