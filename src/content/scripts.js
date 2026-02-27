// Content script for extracting TOC from Twitter/X articles

let tocData = [];
let headerElements = [];
let tocPanel = null;

// TOC Panel Class - manages floating pinnable panel
class TOCPanel {
  constructor() {
    this.panel = null;
    this.isVisible = false;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.defaultPosition = { x: 20, y: 100 };
  }

  async init() {
    // Load saved position
    const storage = await chrome.storage.local.get('tocPanelPosition');
    this.position = storage.tocPanelPosition || this.defaultPosition;
    this.create();
  }

  create() {
    // Remove existing panel if any
    if (this.panel) {
      this.panel.remove();
    }

    // Create panel element
    this.panel = document.createElement('div');
    this.panel.id = 'twitter-toc-panel';
    this.panel.className = 'twitter-toc-panel';
    this.panel.style.cssText = `
      position: fixed;
      z-index: 999999;
      width: 280px;
      max-height: 60vh;
      background: var(--bg-primary, #ffffff);
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      display: none;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    `;

    // Apply saved position
    this.panel.style.left = this.position.x + 'px';
    this.panel.style.top = this.position.y + 'px';

    // Create header with drag handle and close button
    const header = document.createElement('div');
    header.className = 'toc-panel-header';
    header.innerHTML = `
      <span class="drag-handle" title="Drag to move">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.5"/>
          <circle cx="15" cy="6" r="1.5"/>
          <circle cx="9" cy="12" r="1.5"/>
          <circle cx="15" cy="12" r="1.5"/>
          <circle cx="9" cy="18" r="1.5"/>
          <circle cx="15" cy="18" r="1.5"/>
        </svg>
      </span>
      <span class="panel-title">Contents</span>
      <button class="close-btn" title="Hide panel">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <path d="M14 1.41L12.59 0 7 5.59 1.41 0 0 1.41 5.59 7 0 12.59 1.41 14 7 8.41 12.59 14 14 12.59 8.41 7z"/>
        </svg>
      </button>
    `;

    // Create body with TOC list
    const body = document.createElement('div');
    body.className = 'toc-panel-body';

    this.panel.appendChild(header);
    this.panel.appendChild(body);

    document.body.appendChild(this.panel);

    // Add event listeners
    this.setupEventListeners(header);
  }

  setupEventListeners(header) {
    const dragHandle = header.querySelector('.drag-handle');
    const closeBtn = header.querySelector('.close-btn');

    // Drag functionality
    dragHandle.addEventListener('mousedown', (e) => this.startDrag(e));
    document.addEventListener('mousemove', (e) => this.drag(e));
    document.addEventListener('mouseup', () => this.endDrag());

    // Close button
    closeBtn.addEventListener('click', () => this.hide());
  }

  startDrag(e) {
    this.isDragging = true;
    const rect = this.panel.getBoundingClientRect();
    this.dragOffset.x = e.clientX - rect.left;
    this.dragOffset.y = e.clientY - rect.top;
    this.panel.classList.add('dragging');
    e.preventDefault();
  }

  drag(e) {
    if (!this.isDragging) return;

    let newX = e.clientX - this.dragOffset.x;
    let newY = e.clientY - this.dragOffset.y;

    // Keep within viewport bounds
    const maxX = window.innerWidth - this.panel.offsetWidth - 10;
    const maxY = window.innerHeight - this.panel.offsetHeight - 10;
    newX = Math.max(10, Math.min(newX, maxX));
    newY = Math.max(10, Math.min(newY, maxY));

    this.panel.style.left = newX + 'px';
    this.panel.style.top = newY + 'px';
  }

  endDrag() {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.panel.classList.remove('dragging');

    // Save position
    this.position = {
      x: parseInt(this.panel.style.left),
      y: parseInt(this.panel.style.top)
    };
    chrome.storage.local.set({ tocPanelPosition: this.position });
  }

  show(toc) {
    if (!this.panel) {
      this.create();
    }

    // Update TOC content
    const body = this.panel.querySelector('.toc-panel-body');
    body.innerHTML = this.renderTOC(toc);
    this.panel.style.display = 'flex';
    this.isVisible = true;

    // Add click handlers to TOC items
    body.querySelectorAll('.toc-item').forEach((item, index) => {
      item.addEventListener('click', () => {
        scrollToHeader(index);
      });
    });
  }

  renderTOC(toc) {
    if (!toc || toc.length === 0) {
      return '<div class="toc-empty">No sections found</div>';
    }

    return `
      <ul class="toc-list">
        ${toc.map((item, index) => `
          <li class="toc-item level-${item.level}" data-index="${index}">
            ${item.text}
          </li>
        `).join('')}
      </ul>
    `;
  }

  hide() {
    if (this.panel) {
      this.panel.style.display = 'none';
    }
    this.isVisible = false;
    chrome.storage.local.set({ tocPanelVisible: false });
  }

  toggle(toc) {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show(toc);
      chrome.storage.local.set({ tocPanelVisible: true });
    }
  }

  destroy() {
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }
  }
}

// Get heading level from element (handles Twitter/X custom classes)
function getHeaderLevel(header) {
  if (header.classList.contains('longform-header-one')) return 2;
  if (header.classList.contains('longform-header-two')) return 3;
  if (header.classList.contains('longform-header-three')) return 4;
  // Fallback for standard h2-h6
  return parseInt(header.tagName.charAt(1));
}

// Extract headers from the article
function extractTOC() {
  const article = document.querySelector('article');

  if (!article) {
    console.log('[TOC] No article element found');
    return [];
  }

  const toc = [];
  headerElements = [];

  console.log('[TOC] Article found, extracting headers...');

  // First, try to find the article title using data-testid="twitter-article-title"
  let titleText = null;
  let titleElement = document.querySelector('[data-testid="twitter-article-title"]');

  // If not found, try h1 outside of nav/header/footer
  if (!titleElement) {
    const h1Elements = document.querySelectorAll('h1');
    for (const h1 of h1Elements) {
      if (!h1.closest('nav') && !h1.closest('footer') && !h1.closest('header')) {
        const text = h1.textContent?.trim();
        if (text && text.length >= 2 && !/^\d+$/.test(text) && text.length < 200) {
          titleElement = h1;
          break;
        }
      }
    }
  }

  // Get the text from the title element
  if (titleElement) {
    titleText = titleElement.textContent?.trim();
  }

  // Add article title as level 1 if found
  if (titleText && titleText.length >= 2 && !/^\d+$/.test(titleText)) {
    headerElements.push({
      id: 'toc-header-title',
      element: titleElement,
      text: titleText,
      level: 1
    });
    toc.push({
      id: 'toc-header-title',
      text: titleText,
      level: 1
    });
  }

  // Get all other headers (h2-h6) from the article
  const headers = article.querySelectorAll('.longform-header-one, .longform-header-two, .longform-header-three, h2, h3, h4, h5, h6');
  console.log(`[TOC] Found ${headers.length} headers`);

  headers.forEach((header, index) => {
    if (header.closest('nav') || header.closest('footer') || header.closest('header')) {
      return;
    }

    const text = header.textContent?.trim();

    if (!text || text.length < 2) {
      return;
    }

    if (/^\d+$/.test(text)) {
      return;
    }

    const level = getHeaderLevel(header);
    const id = `toc-header-${index}`;

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

  console.log('[TOC] Extracted TOC:', toc);
  return toc;
}

// Scroll to specific header by index
function scrollToHeader(index) {
  const header = headerElements[index];
  if (header && header.element) {
    // Get the element's position
    const rect = header.element.getBoundingClientRect();
    // Calculate scroll position with offset for Twitter's fixed header (approx 60px)
    const offset = 70;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const targetScroll = rect.top + scrollTop - offset;

    window.scrollTo({
      top: targetScroll,
      behavior: 'smooth'
    });

    header.element.style.transition = 'background-color 0.3s ease';
    header.element.style.backgroundColor = 'rgba(29, 155, 240, 0.2)';

    setTimeout(() => {
      header.element.style.backgroundColor = '';
    }, 2000);
  }
}

// Initialize
async function init() {
  // Wait for page to fully load
  setTimeout(() => {
    tocData = extractTOC();
  }, 1500);

  // Initialize TOC Panel
  tocPanel = new TOCPanel();
  await tocPanel.init();

  // Check if panel was visible before
  const storage = await chrome.storage.local.get('tocPanelVisible');
  if (storage.tocPanelVisible && tocData.length > 0) {
    tocPanel.show(tocData);
  }

  // Watch for dynamic content (SPA navigation)
  const observer = new MutationObserver((mutations) => {
    clearTimeout(window.tocExtractTimeout);
    window.tocExtractTimeout = setTimeout(() => {
      tocData = extractTOC();
      if (tocPanel.isVisible) {
        tocPanel.show(tocData);
      }
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
    tocData = extractTOC();
    sendResponse({ toc: tocData, isPanelVisible: tocPanel?.isVisible || false });
  } else if (message.action === 'scrollTo') {
    scrollToHeader(message.index);
    sendResponse({ success: true });
  } else if (message.action === 'togglePanel') {
    tocData = extractTOC();
    tocPanel.toggle(tocData);
    sendResponse({ isVisible: tocPanel.isVisible });
  } else if (message.action === 'showPanel') {
    tocData = extractTOC();
    tocPanel.show(tocData);
    sendResponse({ isVisible: true });
  } else if (message.action === 'hidePanel') {
    tocPanel.hide();
    sendResponse({ isVisible: false });
  }

  return true;
});

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for Extension.js hot reload
export default function main() {
  return () => {
    if (tocPanel) {
      tocPanel.destroy();
    }
  };
}
