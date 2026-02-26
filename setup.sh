#!/bin/bash
# send2iPhone Setup Script
# Configures your phone number and optionally installs a LaunchAgent for auto-start.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BRIDGE_DIR="$SCRIPT_DIR/bridge"
ENV_FILE="$BRIDGE_DIR/.env"
PLIST_NAME="com.send2iphone.bridge"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"

echo ""
echo "  📱 send2iPhone Setup"
echo "  ═══════════════════"
echo ""

# ─── Step 1: Phone Number ─────────────────────────────────────────────────────
if [ -f "$ENV_FILE" ]; then
    CURRENT=$(grep -oP '(?<=PHONE_NUMBER=).+' "$ENV_FILE" 2>/dev/null || echo "")
    if [ -n "$CURRENT" ]; then
        echo "  Current phone number: $CURRENT"
        read -p "  Change it? (y/N): " CHANGE
        if [[ ! "$CHANGE" =~ ^[Yy]$ ]]; then
            PHONE="$CURRENT"
        fi
    fi
fi

if [ -z "$PHONE" ]; then
    read -p "  Enter your iPhone phone number (e.g. +1234567890): " PHONE
    if [ -z "$PHONE" ]; then
        echo "  ❌ Phone number is required. Exiting."
        exit 1
    fi
fi

echo "PHONE_NUMBER=$PHONE" > "$ENV_FILE"
echo "  ✅ Phone number saved to bridge/.env"
echo ""

# ─── Step 2: LaunchAgent (auto-start on login) ────────────────────────────────
read -p "  Auto-start bridge server on login? (Y/n): " AUTOSTART

if [[ ! "$AUTOSTART" =~ ^[Nn]$ ]]; then
    NODE_PATH=$(which node)

    cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$PLIST_NAME</string>
    <key>ProgramArguments</key>
    <array>
        <string>$NODE_PATH</string>
        <string>$BRIDGE_DIR/server.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$BRIDGE_DIR</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/send2iphone.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/send2iphone.err</string>
</dict>
</plist>
EOF

    launchctl unload "$PLIST_PATH" 2>/dev/null || true
    launchctl load "$PLIST_PATH"

    echo "  ✅ LaunchAgent installed and started"
    echo "  📋 Logs: /tmp/send2iphone.log"
else
    echo "  ⏭️  Skipped auto-start. Run manually with:"
    echo "     cd bridge && node server.js"
fi

echo ""
echo "  ─────────────────────────────────────────────"
echo "  🎉 Setup complete!"
echo ""
echo "  Next steps:"
echo "  1. Open Chrome → chrome://extensions"
echo "  2. Enable 'Developer mode' (top right)"
echo "  3. Click 'Load unpacked' → select the extension/ folder"
echo "  4. Right-click any image → '📱 Send to iPhone'"
echo ""
