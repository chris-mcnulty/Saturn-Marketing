# Saturn Content Capture - Browser Extension

A Chromium-compatible browser extension for capturing web content and images for Saturn marketing campaigns.

## Installation (Side-loading)

1. Open Chrome or Edge
2. Navigate to `chrome://extensions/` (or `edge://extensions/`)
3. Enable "Developer mode" (toggle in top-right)
4. Click "Load unpacked"
5. Select the `extensions/saturn-capture` directory
6. The Saturn Capture icon appears in your toolbar

## Setup - Connect to Saturn

1. Click the Saturn Capture icon in your toolbar
2. Go to the Settings tab (gear icon)
3. Enter your Saturn URL (e.g., `https://your-app.replit.app`)
4. Enter your Saturn email and password
5. Click "Connect to Saturn"
6. The connection bar at the top will turn green when connected

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

### Sending to Saturn
1. After capturing content or images, click "Send to Saturn"
2. Assets are pushed directly to your Saturn instance
3. Content assets go to your Assets library
4. Image assets go to your Brand Assets library
5. Duplicates are automatically skipped
6. Successfully sent items are cleared from the extension

### Editing & Managing
- Click "Edit" on any item to modify its title, URL, description, or tags
- Click the "x" button to remove individual items
- Use "Clear" to reset a list

### Exporting CSV (Alternative)
- Click "Export CSV" to download a CSV file compatible with Saturn's CSV import
- Content assets CSV: `url`, `title`, `description` columns
- Image assets CSV: `image_url`, `title`, `description`, `tags` columns
