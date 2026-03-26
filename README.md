# Four Pillars AI - Landing Page

A modern, interactive landing page for the Four Pillars of AI demo collection.

## Design

**Aesthetic Direction:** Mission Control / Technical Command Center
- Industrial-precision geometric design with Red Hat branding
- Technical grid overlays and system-module cards
- High contrast dark theme with strategic red accent strikes
- Sharp animations and purposeful micro-interactions
- Red Hat Display + Red Hat Text typography (official brand fonts)

## Features

- **Interactive Demo Cards:** Click to launch each active demo in a new tab
- **Status Indicators:** Real-time status badges for active and coming soon demos
- **Responsive Design:** Adapts seamlessly to all screen sizes
- **Keyboard Navigation:** Press 1-2 to quickly launch demos
- **Subtle Animations:** Scan lines, pulse effects, and hover states
- **Technical Aesthetics:** Grid backgrounds, accent lines, and monospace elements

## Deployment

### Prerequisites
- OpenShift cluster access
- Namespace: `four-pillars-demo-webapp-landing-page`

### Deploy to OpenShift

1. **Create namespace:**
```bash
oc new-project four-pillars-demo-webapp-landing-page
```

2. **Create ImageStream:**
```bash
oc create imagestream landing-page -n four-pillars-demo-webapp-landing-page
```

3. **Create build and start:**
```bash
oc new-build --name=landing-page \
  --binary=true \
  --strategy=docker \
  -n four-pillars-demo-webapp-landing-page

oc start-build landing-page \
  --from-dir=frontend/ \
  --follow \
  -n four-pillars-demo-webapp-landing-page
```

4. **Deploy application:**
```bash
oc apply -f deployment/deployment.yaml
```

5. **Get route URL:**
```bash
oc get route four-pillars-landing -n four-pillars-demo-webapp-landing-page
```

## Demo Links

The landing page automatically detects your OpenShift cluster domain and generates proper route URLs for:
- **Factory Floor Tycoon** → `factory-floor-tycoon` namespace
- **Speed Showdown** → `speed-showdown` namespace

Coming soon demos (currently disabled):
- **Real or Fake?** → Synthetic Data Generation
- **Traffic Control** → Distributed LLM Deployment

## Tech Stack

- **Frontend:** Pure HTML/CSS/JavaScript (no build step required)
- **Fonts:** Red Hat Display, Red Hat Text, JetBrains Mono (via Google Fonts)
- **Server:** NGINX on UBI9
- **Container:** Red Hat Universal Base Image (UBI) 9
