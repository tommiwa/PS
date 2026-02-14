#!/bin/bash
# Build all MCP App HTML files using vite-plugin-singlefile
# Each HTML file is bundled into a self-contained file in dist/

cd "$(dirname "$0")"
mkdir -p dist

echo "Building MCP App UIs..."

for html in spots-search.html my-bookings.html parking-stats.html; do
  echo "  Building $html..."
  INPUT="$html" npx vite build --config vite.config.ts 2>&1 | grep -E "(built|error|Error)"
done

echo "MCP Apps build complete. Files in mcp-apps/dist/"
ls -la dist/*.html 2>/dev/null
