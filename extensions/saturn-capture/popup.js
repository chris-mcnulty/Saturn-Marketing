let currentTab = "content";
let editingType = null;
let editingIndex = -1;

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupButtons();
  loadLists();
  loadConnectionStatus();
});

function setupTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      currentTab = tab.dataset.tab;
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      document.querySelectorAll(".tab-content").forEach((tc) => tc.classList.remove("active"));
      document.getElementById(`tab-${currentTab}`).classList.add("active");
    });
  });
}

function setupButtons() {
  document.getElementById("capture-content").addEventListener("click", captureContent);
  document.getElementById("capture-image").addEventListener("click", captureImage);
  document.getElementById("export-content").addEventListener("click", () => exportCsv("content"));
  document.getElementById("clear-content").addEventListener("click", () => clearAll("content"));
  document.getElementById("export-images").addEventListener("click", () => exportCsv("images"));
  document.getElementById("clear-images").addEventListener("click", () => clearAll("images"));
  document.getElementById("edit-cancel").addEventListener("click", closeEdit);
  document.getElementById("edit-save").addEventListener("click", saveEdit);

  document.getElementById("send-content").addEventListener("click", () => sendToSaturn("content"));
  document.getElementById("send-images").addEventListener("click", () => sendToSaturn("images"));
  document.getElementById("settings-connect").addEventListener("click", connectToSaturn);
  document.getElementById("settings-disconnect").addEventListener("click", disconnectFromSaturn);

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.imageAssets || changes.contentAssets) {
      loadLists();
    }
  });
}

async function loadConnectionStatus() {
  const { saturnToken, saturnUrl, saturnUserName, saturnEmail } =
    await chrome.storage.local.get(["saturnToken", "saturnUrl", "saturnUserName", "saturnEmail"]);

  const bar = document.getElementById("connection-bar");
  const dot = document.getElementById("connection-dot");
  const text = document.getElementById("connection-text");

  bar.style.display = "flex";

  if (saturnToken && saturnUrl) {
    dot.classList.add("connected");
    text.textContent = `Connected as ${saturnUserName || saturnEmail}`;
    showConnectedSettings(saturnUserName, saturnEmail, saturnUrl);
    updateSendButtons(true);
  } else {
    dot.classList.remove("connected");
    text.textContent = "Not connected — set up in Settings";
    showLoginSettings();
    updateSendButtons(false);
  }
}

function updateSendButtons(connected) {
  const sendContent = document.getElementById("send-content");
  const sendImages = document.getElementById("send-images");
  const brandToggle = document.getElementById("brand-assets-toggle");
  sendContent.disabled = !connected;
  sendImages.disabled = !connected;
  if (!connected) {
    sendContent.title = "Connect to Saturn in Settings first";
    sendImages.title = "Connect to Saturn in Settings first";
    if (brandToggle) brandToggle.style.display = "none";
  } else {
    sendContent.title = "";
    sendImages.title = "";
    if (brandToggle) brandToggle.style.display = "flex";
  }
}

function showConnectedSettings(name, email, url) {
  document.getElementById("settings-login-form").style.display = "none";
  document.getElementById("settings-connected").style.display = "block";
  document.getElementById("connected-name").textContent = name || "Saturn User";
  document.getElementById("connected-email").textContent = email || "";
  document.getElementById("connected-url").textContent = url || "";
}

function showLoginSettings() {
  document.getElementById("settings-login-form").style.display = "block";
  document.getElementById("settings-connected").style.display = "none";
}

async function connectToSaturn() {
  const urlInput = document.getElementById("settings-url");
  const emailInput = document.getElementById("settings-email");
  const passwordInput = document.getElementById("settings-password");
  const errorEl = document.getElementById("settings-error");
  const connectBtn = document.getElementById("settings-connect");

  let baseUrl = urlInput.value.trim().replace(/\/+$/, "");
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!baseUrl || !email || !password) {
    errorEl.textContent = "All fields are required.";
    errorEl.style.display = "block";
    return;
  }

  if (!baseUrl.startsWith("http")) {
    baseUrl = "https://" + baseUrl;
  }

  errorEl.style.display = "none";
  connectBtn.disabled = true;
  connectBtn.innerHTML = '<span class="spinner"></span> Connecting...';

  try {
    const resp = await fetch(`${baseUrl}/api/extension/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(data.error || "Login failed");
    }

    await chrome.storage.local.set({
      saturnUrl: baseUrl,
      saturnToken: data.token,
      saturnUserName: data.userName,
      saturnEmail: data.email,
    });

    passwordInput.value = "";
    loadConnectionStatus();
    showFeedback("Connected to Saturn!");
  } catch (err) {
    errorEl.textContent = err.message || "Failed to connect. Check the URL and credentials.";
    errorEl.style.display = "block";
  } finally {
    connectBtn.disabled = false;
    connectBtn.innerHTML = "Connect to Saturn";
  }
}

async function disconnectFromSaturn() {
  await chrome.storage.local.remove(["saturnToken", "saturnUrl", "saturnUserName", "saturnEmail"]);
  loadConnectionStatus();
  showFeedback("Disconnected from Saturn.");
}

async function sendToSaturn(type) {
  const { saturnToken, saturnUrl } = await chrome.storage.local.get(["saturnToken", "saturnUrl"]);
  if (!saturnToken || !saturnUrl) {
    showFeedback("Connect to Saturn first in Settings.");
    return;
  }

  const key = type === "content" ? "contentAssets" : "imageAssets";
  const data = await chrome.storage.local.get(key);
  const items = data[key] || [];

  if (items.length === 0) {
    showFeedback("No items to send.");
    return;
  }

  const btn = document.getElementById(type === "content" ? "send-content" : "send-images");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Sending...';

  try {
    const body = {};
    if (type === "content") {
      body.contentAssets = items;
      const addToBrand = document.getElementById("add-to-brand-assets");
      if (addToBrand && addToBrand.checked) {
        body.addToBrandAssets = true;
      }
    } else {
      body.imageAssets = items;
    }

    const resp = await fetch(`${saturnUrl}/api/extension/push-assets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${saturnToken}`,
      },
      body: JSON.stringify(body),
    });

    if (resp.status === 401) {
      await chrome.storage.local.remove(["saturnToken"]);
      loadConnectionStatus();
      showFeedback("Session expired. Please reconnect in Settings.");
      return;
    }

    const result = await resp.json();

    if (!resp.ok) {
      throw new Error(result.error || "Failed to send");
    }

    const r = type === "content" ? result.results.content : result.results.images;
    const msg = `Sent! ${r.created} added, ${r.skipped} already existed.`;
    showFeedback(msg);

    if (r.created > 0) {
      await chrome.storage.local.set({ [key]: [] });
      loadLists();
    }
  } catch (err) {
    showFeedback("Error: " + (err.message || "Send failed"));
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M1.5 1.5l13 6.5-13 6.5V9l8-1-8-1V1.5z"/></svg> Send to Saturn`;
  }
}

async function captureContent() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  let pageData;
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: "getPageMeta" });
    pageData = response;
  } catch {
    pageData = {
      title: tab.title || "",
      url: tab.url || "",
      description: "",
    };
  }

  const item = {
    url: pageData.url || tab.url || "",
    title: pageData.title || tab.title || "",
    description: pageData.description || "",
    ogImage: pageData.ogImage || "",
    capturedAt: new Date().toISOString(),
  };

  const { contentAssets = [] } = await chrome.storage.local.get("contentAssets");

  const duplicate = contentAssets.some((a) => a.url === item.url);
  if (duplicate) {
    showFeedback("This page is already captured.");
    return;
  }

  contentAssets.push(item);
  await chrome.storage.local.set({ contentAssets });
  loadLists();
  showFeedback("Page captured!");
}

async function captureImage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  try {
    await chrome.tabs.sendMessage(tab.id, { action: "startImagePicker" });
    window.close();
  } catch {
    showFeedback("Cannot capture on this page.");
  }
}

async function loadLists() {
  const { contentAssets = [], imageAssets = [] } = await chrome.storage.local.get([
    "contentAssets",
    "imageAssets",
  ]);

  document.getElementById("content-count").textContent = contentAssets.length;
  document.getElementById("image-count").textContent = imageAssets.length;

  renderContentList(contentAssets);
  renderImageList(imageAssets);
}

function renderContentList(items) {
  const list = document.getElementById("content-list");
  const empty = document.getElementById("content-empty");
  const actions = document.getElementById("content-actions");

  if (items.length === 0) {
    list.innerHTML = "";
    empty.style.display = "block";
    actions.style.display = "none";
    return;
  }

  empty.style.display = "none";
  actions.style.display = "flex";

  list.innerHTML = items
    .map(
      (item, i) => `
    <div class="item">
      <div class="item-header">
        <span class="item-title">${escHtml(item.title || "Untitled")}</span>
        <div class="item-controls">
          <button class="btn btn-secondary btn-sm" data-action="edit" data-type="content" data-index="${i}">Edit</button>
          <button class="btn btn-clear btn-sm" data-action="delete" data-type="content" data-index="${i}">&times;</button>
        </div>
      </div>
      <a class="item-url" href="${escHtml(item.url)}" target="_blank">${escHtml(item.url)}</a>
      ${item.description ? `<p class="item-desc">${escHtml(item.description)}</p>` : ""}
    </div>
  `
    )
    .join("");

  list.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", handleItemAction);
  });
}

function renderImageList(items) {
  const list = document.getElementById("image-list");
  const empty = document.getElementById("image-empty");
  const actions = document.getElementById("image-actions");

  if (items.length === 0) {
    list.innerHTML = "";
    empty.style.display = "block";
    actions.style.display = "none";
    return;
  }

  empty.style.display = "none";
  actions.style.display = "flex";

  list.innerHTML = items
    .map(
      (item, i) => `
    <div class="item">
      <div class="item-header">
        <span class="item-title">${escHtml(item.title || item.altText || "Untitled Image")}</span>
        <div class="item-controls">
          <button class="btn btn-secondary btn-sm" data-action="edit" data-type="images" data-index="${i}">Edit</button>
          <button class="btn btn-clear btn-sm" data-action="delete" data-type="images" data-index="${i}">&times;</button>
        </div>
      </div>
      <img class="item-image-preview" src="${escHtml(item.imageUrl)}" alt="${escHtml(item.altText || "")}" />
      ${item.pageUrl ? `<div class="item-url">${escHtml(item.pageUrl)}</div>` : ""}
      ${item.tags ? `<div class="item-tags">${item.tags.split(",").map((t) => `<span class="item-tag">${escHtml(t.trim())}</span>`).join("")}</div>` : ""}
    </div>
  `
    )
    .join("");

  list.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", handleItemAction);
  });
}

async function handleItemAction(e) {
  const btn = e.currentTarget;
  const action = btn.dataset.action;
  const type = btn.dataset.type;
  const index = parseInt(btn.dataset.index);

  if (action === "delete") {
    await deleteItem(type, index);
  } else if (action === "edit") {
    openEdit(type, index);
  }
}

async function deleteItem(type, index) {
  const key = type === "content" ? "contentAssets" : "imageAssets";
  const data = await chrome.storage.local.get(key);
  const items = data[key] || [];
  items.splice(index, 1);
  await chrome.storage.local.set({ [key]: items });
  loadLists();
}

async function openEdit(type, index) {
  editingType = type;
  editingIndex = index;

  const key = type === "content" ? "contentAssets" : "imageAssets";
  const data = await chrome.storage.local.get(key);
  const items = data[key] || [];
  const item = items[index];
  if (!item) return;

  const fields = document.getElementById("edit-fields");
  document.getElementById("edit-title").textContent =
    type === "content" ? "Edit Content Asset" : "Edit Image Asset";

  if (type === "content") {
    fields.innerHTML = `
      <div class="edit-field">
        <label>Title</label>
        <input type="text" id="edit-item-title" value="${escAttr(item.title || "")}" />
      </div>
      <div class="edit-field">
        <label>URL</label>
        <input type="text" id="edit-item-url" value="${escAttr(item.url || "")}" />
      </div>
      <div class="edit-field">
        <label>Description</label>
        <textarea id="edit-item-desc">${escHtml(item.description || "")}</textarea>
      </div>
    `;
  } else {
    fields.innerHTML = `
      <div class="edit-field">
        <label>Title</label>
        <input type="text" id="edit-item-title" value="${escAttr(item.title || "")}" />
      </div>
      <div class="edit-field">
        <label>Image URL</label>
        <input type="text" id="edit-item-imageUrl" value="${escAttr(item.imageUrl || "")}" />
      </div>
      <div class="edit-field">
        <label>Alt Text / Description</label>
        <textarea id="edit-item-desc">${escHtml(item.altText || "")}</textarea>
      </div>
      <div class="edit-field">
        <label>Tags (comma separated)</label>
        <input type="text" id="edit-item-tags" value="${escAttr(item.tags || "")}" />
      </div>
    `;
  }

  document.getElementById("edit-overlay").style.display = "flex";
}

function closeEdit() {
  document.getElementById("edit-overlay").style.display = "none";
  editingType = null;
  editingIndex = -1;
}

async function saveEdit() {
  const key = editingType === "content" ? "contentAssets" : "imageAssets";
  const data = await chrome.storage.local.get(key);
  const items = data[key] || [];
  const item = items[editingIndex];
  if (!item) return;

  if (editingType === "content") {
    item.title = document.getElementById("edit-item-title").value;
    item.url = document.getElementById("edit-item-url").value;
    item.description = document.getElementById("edit-item-desc").value;
  } else {
    item.title = document.getElementById("edit-item-title").value;
    item.imageUrl = document.getElementById("edit-item-imageUrl").value;
    item.altText = document.getElementById("edit-item-desc").value;
    item.tags = document.getElementById("edit-item-tags").value;
  }

  await chrome.storage.local.set({ [key]: items });
  closeEdit();
  loadLists();
}

async function exportCsv(type) {
  const key = type === "content" ? "contentAssets" : "imageAssets";
  const data = await chrome.storage.local.get(key);
  const items = data[key] || [];
  if (items.length === 0) return;

  let csv;
  let filename;

  if (type === "content") {
    csv = "url,title,description\n";
    csv += items
      .map(
        (item) =>
          `${csvField(item.url)},${csvField(item.title)},${csvField(item.description)}`
      )
      .join("\n");
    filename = `saturn-content-assets-${dateStamp()}.csv`;
  } else {
    csv = "image_url,title,description,tags\n";
    csv += items
      .map(
        (item) =>
          `${csvField(item.imageUrl)},${csvField(item.title)},${csvField(item.altText || "")},${csvField(item.tags || "")}`
      )
      .join("\n");
    filename = `saturn-image-assets-${dateStamp()}.csv`;
  }

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showFeedback("CSV exported!");
}

async function clearAll(type) {
  const key = type === "content" ? "contentAssets" : "imageAssets";
  await chrome.storage.local.set({ [key]: [] });
  loadLists();
  showFeedback("List cleared.");
}

function showFeedback(msg) {
  const existing = document.querySelector(".feedback-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = "feedback-toast";
  toast.textContent = msg;
  toast.style.cssText =
    "position:fixed;bottom:12px;left:50%;transform:translateX(-50%);background:#810FFB;color:white;padding:6px 16px;border-radius:8px;font-size:12px;font-weight:600;z-index:200;animation:fadeIn 0.2s;max-width:340px;text-align:center";
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

function csvField(value) {
  if (!value) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function escHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escAttr(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function dateStamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}
