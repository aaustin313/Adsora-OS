#!/bin/bash
# Adsora OS — Hetzner Server Setup Script
# Run this as root on a fresh Ubuntu 24.04 server

set -e

echo "=== Step 1: System update ==="
apt update && apt upgrade -y
apt install -y curl git build-essential ufw

echo "=== Step 2: Install Node.js 20 ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

echo "=== Step 3: Install code-server (browser IDE) ==="
curl -fsSL https://code-server.dev/install.sh | sh

echo "=== Step 4: Install Claude Code ==="
npm install -g @anthropic-ai/claude-code

echo "=== Step 5: Install pm2 (process manager) ==="
npm install -g pm2

echo "=== Step 6: Install Tailscale (secure access) ==="
curl -fsSL https://tailscale.com/install.sh | sh
echo ">>> Run 'tailscale up' after this script finishes to connect <<<"

echo "=== Step 7: Clone Adsora OS ==="
mkdir -p /opt/adsora
cd /opt/adsora
git clone https://github.com/aaustin313/Adsora-OS.git . || echo "Repo already cloned"
npm install

echo "=== Step 8: Configure code-server ==="
mkdir -p ~/.config/code-server
cat > ~/.config/code-server/config.yaml << 'CONF'
bind-addr: 0.0.0.0:8080
auth: password
password: changeme-adsora-2026
cert: false
CONF
echo ">>> IMPORTANT: Change the code-server password in ~/.config/code-server/config.yaml <<<"

echo "=== Step 9: Set up systemd services ==="

# code-server service
cat > /etc/systemd/system/code-server.service << 'SVC'
[Unit]
Description=code-server (browser IDE)
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/code-server
Restart=always
Environment=HOME=/root

[Install]
WantedBy=multi-user.target
SVC

systemctl daemon-reload
systemctl enable code-server
systemctl start code-server

echo "=== Step 10: Start Adsora OS with pm2 ==="
cd /opt/adsora
# Don't start yet — .env needs to be copied first
echo ">>> Copy your .env file to /opt/adsora/.env before starting <<<"
echo ">>> Then run: cd /opt/adsora && pm2 start src/index.js --name adsora --watch && pm2 save && pm2 startup <<<"

echo "=== Step 11: Firewall ==="
ufw allow 22/tcp
ufw --force enable
echo ">>> After Tailscale is up, run: ufw allow in on tailscale0 <<<"

echo ""
echo "============================================"
echo "  SETUP COMPLETE — Next steps:"
echo "============================================"
echo "1. Run: tailscale up"
echo "   (follow the link to authenticate)"
echo ""
echo "2. Copy .env from your Mac:"
echo "   scp .env root@YOUR_SERVER_IP:/opt/adsora/.env"
echo ""
echo "3. Change code-server password:"
echo "   nano ~/.config/code-server/config.yaml"
echo ""
echo "4. Start Adsora OS:"
echo "   cd /opt/adsora && pm2 start src/index.js --name adsora --watch"
echo "   pm2 save && pm2 startup"
echo ""
echo "5. Access code-server at:"
echo "   http://TAILSCALE_IP:8080"
echo ""
echo "6. Open terminal in code-server and run: claude"
echo "============================================"
