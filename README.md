# Four Pillars AI - Landing Page

A modern, interactive landing page for the Four Pillars of AI demo collection.

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
