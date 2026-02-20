// Options page script

// Default settings
const defaultSettings = {
  autoDetect: true,
  showInPopup: true,
  highlightCurrent: true,
  smoothScroll: true
};

// Load settings
async function loadSettings() {
  const settings = await chrome.storage.sync.get(defaultSettings);

  document.getElementById('autoDetect').checked = settings.autoDetect;
  document.getElementById('showInPopup').checked = settings.showInPopup;
  document.getElementById('highlightCurrent').checked = settings.highlightCurrent;
  document.getElementById('smoothScroll').checked = settings.smoothScroll;
}

// Save settings
async function saveSettings() {
  const settings = {
    autoDetect: document.getElementById('autoDetect').checked,
    showInPopup: document.getElementById('showInPopup').checked,
    highlightCurrent: document.getElementById('highlightCurrent').checked,
    smoothScroll: document.getElementById('smoothScroll').checked
  };

  await chrome.storage.sync.set(settings);

  // Show saved indicator
  const saveBtn = document.getElementById('saveBtn');
  const originalText = saveBtn.textContent;
  saveBtn.textContent = 'Saved!';
  saveBtn.classList.add('saved');

  setTimeout(() => {
    saveBtn.textContent = originalText;
    saveBtn.classList.remove('saved');
  }, 1500);
}

// Handle upgrade button (placeholder for Paddle integration)
function handleUpgrade() {
  alert('Paddle payment integration coming soon...');
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();

  document.getElementById('saveBtn').addEventListener('click', saveSettings);
  document.getElementById('upgradeBtn').addEventListener('click', handleUpgrade);
});
