// send2iPhone Popup Script
// Manages recipient config + bridge status check.

const BRIDGE_URL = "http://localhost:7890";

const recipientInput = document.getElementById("recipient");
const saveBtn = document.getElementById("saveBtn");
const statusDot = document.getElementById("statusDot");
const statusBar = document.getElementById("statusBar");

// ─── Load saved recipient ─────────────────────────────────────────────────────
chrome.storage.sync.get(["recipient"], (data) => {
    if (data.recipient) {
        recipientInput.value = data.recipient;
    }
});

// ─── Save recipient ───────────────────────────────────────────────────────────
saveBtn.addEventListener("click", () => {
    const recipient = recipientInput.value.trim();
    if (!recipient) {
        recipientInput.focus();
        recipientInput.style.borderColor = "#FF0000";
        recipientInput.style.boxShadow = "inset 0 0 20px rgba(255,0,0,0.15)";
        setTimeout(() => {
            recipientInput.style.borderColor = "#2A2A2A";
            recipientInput.style.boxShadow = "none";
        }, 1500);
        return;
    }

    chrome.storage.sync.set({ recipient }, () => {
        saveBtn.textContent = "SAVED ✓";
        saveBtn.classList.add("saved");
        setTimeout(() => {
            saveBtn.textContent = "SAVE →";
            saveBtn.classList.remove("saved");
        }, 2000);
    });
});

// Enter key saves
recipientInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveBtn.click();
});

// ─── Bridge status check ──────────────────────────────────────────────────────
async function checkBridge() {
    try {
        const res = await fetch(BRIDGE_URL, { signal: AbortSignal.timeout(2000) });
        if (res.ok) {
            statusDot.className = "status-dot online";
            statusBar.className = "status-bar online";
            statusBar.innerHTML = "<span>● BRIDGE ONLINE</span>";
        } else {
            throw new Error();
        }
    } catch {
        statusDot.className = "status-dot offline";
        statusBar.className = "status-bar offline";
        statusBar.innerHTML = "<span>● BRIDGE OFFLINE</span>";
    }
}

checkBridge();
