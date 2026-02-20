// Popup entry point
document.addEventListener('DOMContentLoaded', async () => {
  const root = document.getElementById('root');

  // Get current tab info
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isTwitter = tab?.url?.includes('x.com') || tab?.url?.includes('twitter.com');

  if (!isTwitter) {
    root.innerHTML = `
      <div class="container">
        <div class="header">
          <h1>Twitter TOC</h1>
        </div>
        <div class="content">
          <p class="hint">Please use this extension on Twitter/X</p>
        </div>
      </div>
    `;
    return;
  }

  // Request TOC data from content script
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getTOC' });

    if (response && response.toc && response.toc.length > 0) {
      renderTOC(response.toc);
    } else {
      renderEmpty('No table of contents found. Make sure you are on a long-form article.');
    }
  } catch (error) {
    console.error('Failed to get TOC:', error);
    renderEmpty('Unable to get TOC. Please refresh the page and try again.');
  }

  function renderTOC(toc) {
    root.innerHTML = `
      <div class="container">
        <div class="header">
          <h1>Contents</h1>
          <span class="count">${toc.length} sections</span>
        </div>
        <ul class="toc-list">
          ${toc.map((item, index) => `
            <li class="toc-item" data-index="${index}" data-id="${item.id}" style="padding-left: ${(item.level - 1) * 12}px">
              <a href="#" class="toc-link">${item.text}</a>
            </li>
          `).join('')}
        </ul>
      </div>
    `;

    // Add click handlers
    root.querySelectorAll('.toc-link').forEach(link => {
      link.addEventListener('click', async (e) => {
        e.preventDefault();
        const index = e.target.closest('.toc-item').dataset.index;
        await chrome.tabs.sendMessage(tab.id, {
          action: 'scrollTo',
          index: parseInt(index)
        });
        window.close();
      });
    });
  }

  function renderEmpty(message) {
    root.innerHTML = `
      <div class="container">
        <div class="header">
          <h1>Twitter TOC</h1>
        </div>
        <div class="content">
          <p class="empty">${message}</p>
        </div>
      </div>
    `;
  }
});
