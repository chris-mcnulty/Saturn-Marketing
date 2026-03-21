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
  return true;
});
