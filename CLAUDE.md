# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
# Start local development server
npm start

# Deploy to Cloudflare Workers
npm run deploy

# Run all tests
npm test
```

## Architecture

This is a CORS proxy service built for Cloudflare Workers that allows controlled cross-origin requests.

### Core Components

- **Entry Point** (`src/index.ts`): Cloudflare Worker entry that delegates to the handler
- **Request Handler** (`src/handler.ts`): Main logic for CORS proxying with three key functions:
  - `handleOptions`: Manages CORS preflight requests
  - `handleAllowedMethods`: Proxies allowed HTTP methods (GET, HEAD, POST) to target endpoints
  - `handleRequest`: Entry point that validates requests against allowlists

### Security Controls

The proxy implements three allowlist mechanisms configured via environment variables:
- `ENDPOINT_ALLOWLIST`: JSON array of allowed target hosts
- `CONTENT_TYPE_ALLOWLIST`: JSON array of allowed response content types  
- `PATH_ALLOWLIST`: JSON array of regex patterns for allowed paths

### Request Flow

1. Requests can specify target URL via query parameter (`?url=`) or path (`/targeturl`)
2. Target is validated against endpoint and path allowlists
3. For allowed requests, the proxy forwards the request with modified headers
4. Responses include proper CORS headers for browser compatibility

### Testing

Tests use Vitest with `@cloudflare/vitest-pool-workers` to run inside the actual Workers runtime (workerd). Configuration is in `vitest.config.ts`.