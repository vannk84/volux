#!/bin/bash
# Local development server for Volux website
# Serves the docs/ folder on localhost

PORT=${1:-8000}

echo "🚀 Starting Volux website locally..."
echo "📁 Serving: docs/"
echo "🌐 URL: http://localhost:$PORT"
echo ""
echo "Press Ctrl+C to stop"
echo ""

cd docs && python3 -m http.server $PORT
