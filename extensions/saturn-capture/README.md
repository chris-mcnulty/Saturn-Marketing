# Saturn Content Capture - Browser Extension

A Chromium-compatible browser extension for capturing web content and images for Saturn marketing campaigns.

## Installation (Side-loading)

1. Open Chrome or Edge
2. Navigate to `chrome://extensions/` (or `edge://extensions/`)
3. Enable "Developer mode" (toggle in top-right)
4. Click "Load unpacked"
5. Select the `extensions/saturn-capture` directory
6. The Saturn Capture icon appears in your toolbar

## Usage

### Capturing Content Assets
1. Navigate to any webpage
2. Click the Saturn Capture icon in the toolbar
3. Click "Capture This Page" to grab the page title, URL, and meta description
4. The captured item appears in the Content Assets tab

### Capturing Image Assets
1. Right-click any image on a webpage
2. Select "Capture Image for Saturn" from the context menu
3. The image URL, page title, and alt text are captured
4. Switch to the Image Assets tab in the popup to see captured images

### Editing & Managing
- Click "Edit" on any item to modify its title, URL, description, or tags
- Click the "×" button to remove individual items
- Use "Clear All" to reset a list after exporting

### Exporting CSV
- Click "Export CSV" to download a CSV file compatible with Saturn's import
- Content assets CSV: `url`, `title`, `description` columns
- Image assets CSV: `image_url`, `title`, `description`, `tags` columns
