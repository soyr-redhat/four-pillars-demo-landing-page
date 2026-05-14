# Four Pillars AI - Landing Page

A modern, interactive landing page for the Four Pillars of AI demo collection, featuring embedded interactive minigames that demonstrate LLM inference optimization techniques.

## Features

### Main Landing Page
- **Auto-detecting Route URLs:** Automatically detects your OpenShift cluster domain and generates proper route URLs for deployed demos
- **Dark/Light Mode Toggle:** User-selectable theme with persistent preference
- **Red Hat Branding:** Custom Red Hat logo favicon and branded design
- **Responsive Design:** Mobile-friendly layout with clean, modern aesthetics

### Active Demos
- **Factory Floor Tycoon** → Prefill/Decode Disaggregation demo (`factory-floor-tycoon` namespace)
- **Speed Showdown** → Continuous Batching + Prefix Caching demo (`speed-showdown` namespace)
- **Real or Fake?** → Quantization + Compression demo (embedded minigame)

### Coming Soon
- **Traffic Control** → Distributed LLM Deployment

### Embedded Minigames
Interactive demos built with React/TypeScript that teach LLM inference optimization through hands-on simulations:

1. **Speculative Decoding** - Live race simulation showing draft-model speculation
2. **Quantization + Compression** - Pixel identification quiz demonstrating bit-depth reduction
3. **Sparsification** - Neural network pruning sandbox with live benchmark scores
4. **Prefill/Decode Disaggregation** - Factory throughput simulation
5. **Continuous Batching + Prefix Caching** - Speed typing challenge with cache hits
6. **GuideLLM Benchmarking** - *(coming soon)*

See [minigames/README](./minigames/README) for detailed information about each demo.

## Tech Stack

### Frontend
- **Landing Page:** Pure HTML/CSS/JavaScript (no build step required)
- **Minigames:** Vite + React + TypeScript with zero external dependencies
- **Fonts:** Red Hat Display, Red Hat Text, Red Hat Mono (via Google Fonts)
- **Design:** Red Hat branded color scheme (`#EE0000`) with per-technique accent colors

### Backend & Infrastructure
- **Development Server:** Node.js (`dev-server.mjs`) with live reload
- **Production Server:** NGINX on UBI9 with optimized static file serving
- **Container:** Red Hat Universal Base Image (UBI) 9
- **Deployment:** OpenShift with automatic ImageStream triggers

## Development

### Prerequisites
- Node.js (for development server and minigames build)

### Quick Start

```bash
# Install dependencies and start dev server
npm install
npm run dev
```

The dev server will:
1. Build the minigames app
2. Start a local server on port 8888
3. Serve both the landing page and embedded minigames

### Available Scripts

```bash
npm run dev                 # Build minigames and start dev server
npm run build:minigames     # Build minigames production bundle
npm run watch:minigames     # Build minigames in watch mode
```

### Project Structure

```
/
├── frontend/              # Landing page HTML/CSS/JS
│   ├── index.html        # Main landing page
│   ├── nginx.d/          # NGINX configuration
│   └── public/           # Static assets
├── minigames/            # React app with interactive demos
│   ├── src/
│   │   ├── pages/        # One file per demo
│   │   ├── components/   # Shared UI components
│   │   ├── data/         # Quiz/prompt datasets
│   │   └── styles/       # Global styles
│   └── package.json
├── deployment/           # OpenShift deployment manifests
│   └── deployment.yaml
├── dev-server.mjs        # Development server
└── package.json          # Root package config
```

## Deployment

### Building the Container

```bash
# Using Podman/Docker
podman build -f frontend/Containerfile -t landing-page:latest .
```

### Deploying to OpenShift

```bash
# Apply deployment manifests
oc apply -f deployment/deployment.yaml
```

The deployment includes:
- Deployment with 2 replicas
- Service on port 8080
- Route with edge TLS termination
- Health probes (liveness and readiness)
- Resource limits (128Mi memory, 100m CPU)

## Container Architecture

The production container uses a multi-stage approach:
1. Builds the minigames React app
2. Copies static assets to NGINX document root
3. Serves via NGINX on port 8080

NGINX is configured to:
- Serve the landing page at `/`
- Serve minigames at `/minigames/`
- Handle SPA routing with fallback to index.html
- Optimize static file caching
