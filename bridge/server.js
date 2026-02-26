#!/usr/bin/env node

// send2iPhone Bridge Server
// Receives image URLs + recipient from the Chrome extension
// and sends them via iMessage using AppleScript.
// Zero external dependencies.

const http = require("http");
const https = require("https");
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

// ─── Config ───────────────────────────────────────────────────────────────────
const PORT = 7890;
const ENV_PATH = path.join(__dirname, ".env");
const APPLESCRIPT_PATH = path.join(__dirname, "send-image.applescript");

function loadFallbackRecipient() {
    try {
        const env = fs.readFileSync(ENV_PATH, "utf8");
        const match = env.match(/^PHONE_NUMBER=(.+)$/m);
        if (match) return match[1].trim();
    } catch { }
    return null;
}

// ─── Download image to temp file ──────────────────────────────────────────────
function downloadImage(imageUrl) {
    return new Promise((resolve, reject) => {
        function doRequest(url, redirectCount = 0) {
            if (redirectCount > 5) return reject(new Error("Too many redirects"));

            const proto = url.startsWith("https") ? https : http;
            proto.get(url, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    return doRequest(res.headers.location, redirectCount + 1);
                }

                if (res.statusCode !== 200) {
                    return reject(new Error(`HTTP ${res.statusCode} downloading image`));
                }

                const contentType = res.headers["content-type"] || "image/png";
                const extMap = {
                    "image/jpeg": ".jpg",
                    "image/jpg": ".jpg",
                    "image/png": ".png",
                    "image/gif": ".gif",
                    "image/webp": ".webp",
                    "image/svg+xml": ".svg",
                    "image/bmp": ".bmp",
                };
                const ext = extMap[contentType] || ".png";
                const tmpPath = path.join(os.tmpdir(), `send2iphone_${Date.now()}${ext}`);

                const fileStream = fs.createWriteStream(tmpPath);
                res.pipe(fileStream);
                fileStream.on("finish", () => {
                    fileStream.close();
                    resolve(tmpPath);
                });
                fileStream.on("error", (err) => {
                    fs.unlink(tmpPath, () => { });
                    reject(err);
                });
            }).on("error", reject);
        }

        doRequest(imageUrl);
    });
}

// ─── Send via AppleScript ─────────────────────────────────────────────────────
function sendViaIMessage(recipient, imagePath) {
    return new Promise((resolve, reject) => {
        execFile("osascript", [APPLESCRIPT_PATH, recipient, imagePath], (err, stdout, stderr) => {
            fs.unlink(imagePath, () => { });

            if (err) {
                console.error("[Bridge] AppleScript error:", stderr || err.message);
                return reject(new Error(stderr || err.message));
            }
            console.log("[Bridge] AppleScript output:", stdout.trim());
            resolve(stdout.trim());
        });
    });
}

// ─── HTTP Server ──────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        return res.end();
    }

    if (req.method === "POST" && req.url === "/send") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", async () => {
            try {
                const { imageUrl, recipient: reqRecipient } = JSON.parse(body);

                if (!imageUrl) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ success: false, error: "Missing imageUrl" }));
                }

                // Recipient from request body, or fall back to .env
                const recipient = reqRecipient || loadFallbackRecipient();
                if (!recipient) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(
                        JSON.stringify({
                            success: false,
                            error: "No recipient configured. Click the send2iPhone extension icon to set your phone number or Apple ID.",
                        })
                    );
                }

                console.log(`[Bridge] Downloading: ${imageUrl}`);
                const imagePath = await downloadImage(imageUrl);

                console.log(`[Bridge] Sending to ${recipient} via iMessage...`);
                await sendViaIMessage(recipient, imagePath);

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: true, message: "Image sent via iMessage!" }));
            } catch (err) {
                console.error("[Bridge] Error:", err.message);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
        });
        return;
    }

    // Health check
    if (req.method === "GET" && req.url === "/") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ status: "send2iPhone bridge running", port: PORT }));
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
});

server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
        console.log(`\n  ⚠️  Port ${PORT} is already in use. Killing old process...`);
        const { execSync } = require("child_process");
        try {
            execSync(`lsof -ti:${PORT} | xargs kill -9 2>/dev/null`);
            console.log("  ✅ Old process killed. Restarting...\n");
            setTimeout(() => server.listen(PORT, "127.0.0.1"), 500);
        } catch {
            console.error(`  ❌ Could not free port ${PORT}. Kill it manually:\n     lsof -ti:${PORT} | xargs kill -9\n`);
            process.exit(1);
        }
    } else {
        console.error("Server error:", err);
        process.exit(1);
    }
});

server.listen(PORT, "127.0.0.1", () => {
    console.log(`\n  📱 send2iPhone bridge server running on http://localhost:${PORT}`);
    console.log(`  🛑 Press Ctrl+C to stop\n`);
});
