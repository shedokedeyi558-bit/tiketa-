#!/bin/bash

# TicketHub Backend - Dependencies Installation Script
# This script installs all required dependencies for the backend

echo "=========================================="
echo "TicketHub Backend - Dependencies Setup"
echo "=========================================="
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install Node.js and npm first."
    exit 1
fi

echo "✅ npm found: $(npm --version)"
echo ""

# Navigate to backend directory
cd "$(dirname "$0")" || exit 1

echo "📦 Installing dependencies..."
echo ""

# Install all dependencies
npm install

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Dependencies installed successfully!"
    echo ""
    echo "📋 Installed packages:"
    npm list --depth=0
    echo ""
    echo "🚀 Next steps:"
    echo "1. Configure .env file with Supabase credentials"
    echo "2. Run 'npm start' to start the server"
    echo "3. Run 'npm run dev' for development mode"
    echo ""
else
    echo ""
    echo "❌ Installation failed. Please check the error messages above."
    exit 1
fi
