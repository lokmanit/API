#!/usr/bin/env bash
# ==============================================================================
# Outbound Telephony API - 1-Click Environment Setup Script
# Works on: Linux (Ubuntu/Debian/CentOS/Fedora) and macOS
# ==============================================================================

set -e

echo ""
echo "=========================================================="
echo "  🚀 OUTBOUND TELEPHONY REST API - LOCAL SETUP WIZARD"
echo "  Trunk: RanksTel SIP (202.40.176.2:5060)"
echo "  Caller ID / Account: 09617552229"
echo "=========================================================="
echo ""

# 1. Check Node.js
echo "▶ [1/4] Checking Node.js runtime..."
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js is not installed!"
  echo "Please install Node.js 18 or higher (https://nodejs.org or run 'curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs')"
  exit 1
fi

NODE_VER=$(node -v)
echo "✅ Node.js found: $NODE_VER"

# 2. Check npm and install dependencies
echo ""
echo "▶ [2/4] Installing project dependencies..."
npm install --silent
echo "✅ Dependencies installed successfully."

# 3. Environment & Secrets setup
echo ""
echo "▶ [3/4] Configuring environment (.env)..."
if [ ! -f .env ]; then
  echo "Creating .env from .env.example..."
  cp .env.example .env
fi

# Ensure data directory exists
mkdir -p data

echo "✅ Environment file (.env) and data storage ready."

# 4. Instructions
echo ""
echo "=========================================================="
echo "  🎉 SETUP COMPLETE!"
echo "=========================================================="
echo ""
echo "To start your local Telephony Server, run:"
echo "   npm run dev"
echo ""
echo "The server will start at: http://localhost:3000"
echo "API Token: call_api_sec_token_9f8d7c6b5a4"
echo ""
echo "----------------------------------------------------------"
echo "🌐 CONNECTING MUMBAI AGENT SERVER (Shared IP / NAT Tunnel):"
echo "----------------------------------------------------------"
echo "To give your local machine a free, secure public HTTPS URL"
echo "for your Mumbai server without port-forwarding, run in another terminal:"
echo ""
echo "   npx cloudflared tunnel --url http://localhost:3000"
echo ""
echo "It will output an HTTPS URL (e.g., https://abc-123.trycloudflare.com)."
echo "Your Mumbai Agent can then send requests to:"
echo "   POST https://abc-123.trycloudflare.com/api/call"
echo "=========================================================="
echo ""
