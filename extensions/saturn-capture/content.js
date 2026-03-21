chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getPageMeta") {
    const metaDesc =
      document.querySelector('meta[name="description"]')?.getAttribute("content") ||
      document.querySelector('meta[property="og:description"]')?.getAttribute("content") ||
      "";
    sendResponse({
      title: document.title,
      url: window.location.href,
      description: metaDesc,
    });
  }

  if (request.action === "startImagePicker") {
    startImagePicker();
    sendResponse({ started: true });
  }

  return true;
});

function startImagePicker() {
  if (document.getElementById("saturn-image-picker-overlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "saturn-image-picker-overlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483646;cursor:crosshair;background:rgba(129,15,251,0.05)";

  const banner = document.createElement("div");
  banner.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:2147483647;background:linear-gradient(135deg,#810FFB,#E60CB3);color:white;text-align:center;padding:10px 16px;font-family:sans-serif;font-size:14px;font-weight:600";
  banner.textContent = "Click an image to capture it for Saturn. Press Escape to cancel.";
  overlay.appendChild(banner);

  let highlighted = null;

  function highlightImage(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (highlighted) {
      highlighted.style.outline = highlighted._saturnOrigOutline || "";
      highlighted = null;
    }
    if (el && el.tagName === "IMG") {
      highlighted = el;
      el._saturnOrigOutline = el.style.outline;
      el.style.outline = "3px solid #810FFB";
    }
  }

  function handleClick(e) {
    e.preventDefault();
    e.stopPropagation();
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el && el.tagName === "IMG") {
      chrome.runtime.sendMessage({
        action: "imageCaptured",
        data: {
          imageUrl: el.src || el.currentSrc,
          pageUrl: window.location.href,
          title: document.title,
          altText: el.alt || "",
          tags: "",
          capturedAt: new Date().toISOString(),
        },
      });
    }
    cleanup();
  }

  function handleKey(e) {
    if (e.key === "Escape") {
      cleanup();
    }
  }

  function cleanup() {
    if (highlighted) {
      highlighted.style.outline = highlighted._saturnOrigOutline || "";
    }
    overlay.removeEventListener("mousemove", highlightImage);
    overlay.removeEventListener("click", handleClick);
    document.removeEventListener("keydown", handleKey);
    overlay.remove();
  }

  overlay.addEventListener("mousemove", highlightImage);
  overlay.addEventListener("click", handleClick);
  document.addEventListener("keydown", handleKey);
  document.body.appendChild(overlay);
}
