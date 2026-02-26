// send2iPhone — Chrome Extension Background Service Worker
// Right-click any image → send it to your iPhone via iMessage.
// Recipient (phone/email) is stored in chrome.storage.sync and sent with each request.

const BRIDGE_URL = "http://localhost:7890/send";

// ─── Context menu ─────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "send-to-iphone",
    title: "📱 Send to iPhone",
    contexts: ["image"],
  });
  console.log("[send2iPhone] Context menu registered.");
});

// ─── Handle click ─────────────────────────────────────────────────────────────
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "send-to-iphone") return;

  const imageUrl = info.srcUrl;
  if (!imageUrl) {
    showNotification("Error", "No image URL found.");
    return;
  }

  // Get saved recipient
  const { recipient } = await chrome.storage.sync.get(["recipient"]);

  if (!recipient) {
    // First-run: open popup so user can enter their number
    showNotification(
      "Setup Required",
      "Click the send2iPhone icon in your toolbar to enter your iPhone number or Apple ID."
    );
    // Open the popup programmatically isn't possible, but we can open options
    chrome.action.openPopup?.() ||
      chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
    return;
  }

  console.log(`[send2iPhone] Sending image to ${recipient}: ${imageUrl}`);
  showNotification("Sending…", "Sending image to your iPhone…");

  try {
    const response = await fetch(BRIDGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl, recipient }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      showNotification("Sent! ✅", "Image sent to your iPhone via iMessage.");
    } else {
      showNotification("Failed ❌", data.error || "Unknown error from bridge server.");
    }
  } catch (err) {
    console.error("[send2iPhone] Bridge error:", err);
    showNotification(
      "Bridge Offline ❌",
      "Local bridge server is not running.\n\nRun: cd bridge && node server.js"
    );
  }
});

// ─── Notification helper ──────────────────────────────────────────────────────
function showNotification(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icon-128.png",
    title: `send2iPhone — ${title}`,
    message,
  });
}
