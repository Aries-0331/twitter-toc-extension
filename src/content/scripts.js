// Content script for extracting TOC from Twitter/X articles

let tocData = [];
let headerElements = [];

// Extract headers from the article
function extractTOC() {
  // Find the article container
  const article = document.querySelector('article');

  if (!article) {
    return [];
  }

  // Query all semantic header tags within the article
  const headers = article.querySelectorAll('h1, h2, h3, h4, h5, h6');

  const toc = [];
  headerElements = [];

  headers.forEach((header, index) => {
    // Skip navigation, footer, or other non-content headers
    if (header.closest('nav') || header.closest('footer') || header.closest('header')) {
      return;
    }

    // Get the text content
    const text = header.textContent?.trim();

    // Skip empty headers or very short ones (likely not real titles)
    if (!text || text.length < 2) {
      return;
    }

    // Skip headers that are just numbers
    if (/^\d+$/.test(text)) {
      return;
    }

    // Get the header level (h1 = 1, h2 = 2, etc.)
    const level = parseInt(header.tagName.charAt(1));

    // Generate a unique ID for this header
    const id = `toc-header-${index}`;

    // Store the element reference for scrolling
    headerElements.push({
      id,
      element: header,
      text,
      level
    });

    toc.push({
      id,
      text,
      level
    });
  });

  return toc;
}

// Scroll to specific header by index
function scrollToHeader(index) {
  const header = headerElements[index];
  if (header && header.element) {
    header.element.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });

    // Add a temporary highlight
    header.element.style.transition = 'background-color 0.3s ease';
    header.element.style.backgroundColor = 'rgba(29, 155, 240, 0.2)';

    setTimeout(() => {
      header.element.style.backgroundColor = '';
    }, 2000);
  }
}

// Initialize
function init() {
  // Wait for page to fully load
  setTimeout(() => {
    tocData = extractTOC();
    console.log('Twitter TOC: Found', tocData.length, 'headers');
  }, 1500);

  // Also watch for dynamic content (SPA navigation)
  const observer = new MutationObserver((mutations) => {
    // Debounce the extraction
    clearTimeout(window.tocExtractTimeout);
    window.tocExtractTimeout = setTimeout(() => {
      tocData = extractTOC();
    }, 1000);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Listen for messages from popup or background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getTOC') {
    // Re-extract TOC in case page has changed
    tocData = extractTOC();
    sendResponse({ toc: tocData });
  } else if (message.action === 'scrollTo') {
    scrollToHeader(message.index);
    sendResponse({ success: true });
  }

  return true;
});

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
