chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "saturn-capture-image",
    title: "Capture Image for Saturn",
    contexts: ["image"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "saturn-capture-image" && tab?.id) {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (srcUrl) => {
        const images = document.querySelectorAll("img");
        let altText = "";
        for (const img of images) {
          if (img.src === srcUrl || img.currentSrc === srcUrl) {
            altText = img.alt || "";
            break;
          }
        }
        return {
          altText,
          pageTitle: document.title,
          pageUrl: window.location.href,
        };
      },
      args: [info.srcUrl],
    });

    const pageData = results?.[0]?.result || {};
    const item = {
      imageUrl: info.srcUrl,
      pageUrl: pageData.pageUrl || tab.url || "",
      title: pageData.pageTitle || tab.title || "",
      altText: pageData.altText || "",
      tags: "",
      capturedAt: new Date().toISOString(),
    };

    const { imageAssets = [] } = await chrome.storage.local.get("imageAssets");
    imageAssets.push(item);
    await chrome.storage.local.set({ imageAssets });

    chrome.action.setBadgeText({ text: "+" });
    chrome.action.setBadgeBackgroundColor({ color: "#810FFB" });
    setTimeout(() => chrome.action.setBadgeText({ text: "" }), 1500);
  }
});
