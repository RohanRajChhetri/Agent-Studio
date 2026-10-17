# A2A Executive Conference Minutes & Master Deliverable

**Mission Topic**: Design a complete CI/CD pipeline for a microservices app with automated testing, Docker builds, and blue-green deployments
**Mission ID**: `h-mission-92k7zgg`
**Date / Timestamp**: 04/10/2026, 4:21:32 am
**Presiding Orchestrator**: Atlas (orchestrator)
**Dedicated Artifacts Folder**: `agent-workspace/conference/`
**Subtasks Executed**: 3 subtasks across 3 specialists
**Total Duration**: 35 seconds

---

## 1. Conference Participants & Hierarchy
- **Executive Orchestrator**: Atlas (orchestrator)
- **DevCore** (specialist | Department: Engineering)
- **Nova** (specialist | Department: Growth)
- **Ledger** (worker | Department: Operations)

---

## 2. Master Executive Deliverable & Architectural Decisions
# Master Executive Deliverable: Production CI/CD, Observability, and Blue-Green Deployment Pipeline

## 1. Executive Summary & Architecture Overview

This master deliverable integrates the contributions of **DevCore** (CI Pipeline & Containerization), **Nova** (Telemetry & Stakeholder Communication), and **Ledger** (Kubernetes Blue-Green Deployments & Traffic Shifting). 

The primary mission is to deliver a zero-downtime, fully automated CI/CD pipeline for TypeScript/Node.js microservices. By combining multi-stage distroless Docker builds, ephemeral GitHub Actions test runners, OpenTelemetry-backed release webhooks, and Istio-managed blue-green deployments, engineering teams can ship updates continuously while maintaining strict adherence to production SLOs.

```
[ GitHub Actions CI ] 
       │ (Lint, Test, Buildx)
       ▼
[ GHCR Container Registry ] 
       │ (Distroless Image)
       ▼
[ Kubernetes Preview (Green) ] 
       │ (Automated Health Smoke Test)
       ▼
[ Istio Traffic Shifting / Cutover ] 
       │ (Zero-Downtime Promotion)
       ▼
[ OpenTelemetry & Slack Relay ] (Post-Deployment Telemetry & Notification)
```

---

## 2. Consolidated Technical Plan & Combined Implementation

### Part A: Multi-Stage Dockerfile (`Dockerfile`)
Optimized for zero-shell security, small footprint, and fast execution using Node.js 20 and Google distroless base images.

```dockerfile
# Stage 1: Build Environment
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build

# Stage 2: Dependencies Pruning
FROM node:20-alpine AS pruner
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Stage 3: Production Runtime
FROM gcr.io/distroless/nodejs20-debian12:nonroot
WORKDIR /app
COPY --from=pruner /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

USER nonroot:nonroot
EXPOSE 3000
ENV NODE_ENV=production
CMD ["dist/index.js"]
```

### Part B: GitHub Actions CI/CD Workflow (`.github/workflows/pipeline.yml`)
Automates linting, isolated integration testing with PostgreSQL/Redis service containers, and multi-arch image publishing.

```yaml
name: Microservice CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
    tags: [ 'v*.*.*' ]
  pull_request:
    branches: [ main, develop ]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  validate-and-test:
    name: Lint & Test Suite
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_DB: test_db
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: password
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Run Linter & Type Check
        run: |
          npm run lint
          npm run typecheck

      - name: Run Unit & Integration Tests
        env:
          DATABASE_URL: postgres://postgres:password@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379
        run: npm run test:ci

  build-and-push:
    name: Container Build & Push
    needs: validate-and-test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract Metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=sha,prefix=sha-,format=short

      - name: Build and Push Docker Image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### Part C: Kubernetes Blue-Green Deployment & Istio Routing
Isolates production traffic (Blue) from new deployments (Green) using dedicated preview services and weighted Istio VirtualServices.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-green
  namespace: production
  labels:
    app: api
    version: green
spec:
  replicas: 5
  selector:
    matchLabels:
      app: api
      version: green
  template:
    metadata:
      labels:
        app: api
        version: green
    spec:
      containers:
      - name: api
        image: ghcr.io/enterprise/api:v2.5.0
        ports:
        - containerPort: 8080
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 3
        livenessProbe:
          httpGet:
            path: /health/live
            port: 8080
          initialDelaySeconds: 15
          periodSeconds: 10
---
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: api-virtualservice
  namespace: production
spec:
  hosts:
  - "api.enterprise.internal"
  gateways:
  - production-gateway
  http:
  - route:
    - destination:
        host: api-service
        subset: blue
      weight: 100
    - destination:
        host: api-service
        subset: green
      weight: 0
```

### Part D: Automated Release Webhook & Telemetry Integration
Python service verifying post-deployment health via Prometheus/OpenTelemetry before dispatching rich-formatted Slack notifications.

```python
import os
import requests
from typing import Dict, Any

SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL", "https://hooks.slack.com/services/T00/B00/XX")
OTEL_METRICS_ENDPOINT = os.getenv("OTEL_METRICS_ENDPOINT", "http://prometheus.monitoring.svc:9090/api/v1/query")

def query_deployment_health(service_name: str) -> Dict[str, Any]:
    try:
        query = f'sum(rate(http_requests_total{{service="{service_name}", status=~"5.."}}[5m]))'
        response = requests.get(OTEL_METRICS_ENDPOINT, params={"query": query}, timeout=5)
        data = response.json()
        error_rate = float(data["data"]["result"][0]["value"][1]) if data.get("data", {}).get("result") else 0.0
        return {"error_rate": error_rate, "status": "healthy" if error_rate < 0.01 else "degraded"}
    except Exception as e:
        return {"error_rate": None, "status": "unknown", "error": str(e)}

def broadcast_release(event_payload: Dict[str, Any]) -> bool:
    service_name = event_payload.get("service_name")
    health = query_deployment_health(service_name)
    # Payload generation omitted for brevity; posts Block Kit JSON to Slack
    return True
```

---

## 3. Risk Mitigation & Verification Checklist

| Risk Scenario | Operational Impact | Mitigation Strategy | Verification Method |
| :--- | :--- | :--- | :--- |
| **Database Migration Desync** | Split-brain or schema locking errors | Enforce Expand-and-Contract pattern; run migrations as isolated K8s Jobs. | Pre-deployment schema compatibility dry-run. |
| **Telemetry False Positives** | Erroneous automated rollbacks during cold start | Enforce a mandatory 180-second soak period post-cutover before evaluating metrics. | Prometheus alert rule evaluation windows. |
| **Webhook Rate Limiting** | Dropped release notifications | Implement a Redis-backed token bucket queue for chat integrations. | Load test webhook dispatcher under simulated concurrent release storms. |
| **Distroless Debugging Block** | Inability to inspect runtime containers during failure | Deploy ephemeral debug containers (`kubectl debug`) with shell utilities attached to pod namespaces. | Run synthetic debug drills in staging. |

---

## 4. Next Steps & Milestone Roadmap

### Phase 1: Repository Bootstrapping & Secret Provisioning (Day 1 - 2)
1. Initialize GitHub Actions repository secrets (`GHCR_PAT`, `SLACK_WEBHOOK_URL`, `PROMETHEUS_CREDENTIALS`).
2. Configure Kubernetes namespaces (`production`), Istio gateway ingress, and base service DNS entries.

### Phase 2: Pipeline Staging & Smoke Testing (Day 3 - 4)
1. Deploy the multi-stage Dockerfile build action and verify image caching velocities via GitHub Actions cache (`type=gha`).
2. Validate preview environment health check scripts (`/health/ready` and `/health/live`) against staging clusters.

### Phase 3: Canary & Blue-Green Traffic Cutover Drill (Day 5)
1. Execute a test deployment of version `v2.5.0` to the Green deployment group.
2. Run automated Istio weight shifting (`blue: 0, green: 100`) while monitoring RED metrics in Grafana.
3. Simulate an error threshold breach (> 0.5% 5xx) to verify instant rollback automation.

---

## 3. Detailed Specialist Reports & Tactical Artifacts
### Work Package: Microservice CI Pipeline & Docker Containerization
- **Assigned Specialist**: DevCore (specialist)
- **Directive**: Design and implement the automated GitHub Actions CI pipeline for compiling microservices, running unit and integration test suites, and building optimized, multi-stage Docker images pushed to the container registry.
- **Status**: completed (Execution Time: 6s)

#### Specialist Report:
### Executive Summary

Transitioning from mid-level software engineering to senior-level technical mastery requires rigorous implementation of production-grade infrastructure, starting with robust build and delivery pipelines. This report delivers the automated GitHub Actions CI pipeline and multi-stage Docker containerization strategy for a TypeScript/Node.js microservice architecture. 

The primary objectives are minimizing image vulnerability surfaces, ensuring zero-downtime test execution via service containers, and optimizing layer caching for sub-minute build velocities.

---

### Production Dockerfile Architecture

To achieve minimal image size and maximum runtime security, we utilize a multi-stage `Dockerfile` adhering to distroless principles. The build stage compiles TypeScript artifacts, while the runtime stage contains strictly production dependencies and compiled JavaScript.

```dockerfile
# Stage 1: Build Environment
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies needed for native modules if any
RUN apk add --no-cache python3 make g++

# Copy package manifests and lockfile
COPY package*.json tsconfig.json ./
RUN npm ci

# Copy source code and build
COPY src ./src
RUN npm run build

# Stage 2: Dependencies Pruning
FROM node:20-alpine AS pruner
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Stage 3: Production Runtime
FROM gcr.io/distroless/nodejs20-debian12:nonroot
WORKDIR /app

# Copy pruned node_modules and compiled output
COPY --from=pruner /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

USER nonroot:nonroot
EXPOSE 3000

ENV NODE_ENV=production
CMD ["dist/index.js"]
```

---

### Automated GitHub Actions CI/CD Pipeline

The GitHub Actions workflow automates code linting, parallelized unit/integration testing with backing services (PostgreSQL and Redis), and multi-arch Docker image publishing with GitHub Packages (GHCR) integration.

```yaml
name: Microservice CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
    tags: [ 'v*.*.*' ]
  pull_request:
    branches: [ main, develop ]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  validate-and-test:
    name: Lint & Test Suite
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_DB: test_db
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: password
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Run Linter & Type Check
        run: |
          npm run lint
          npm run typecheck

      - name: Run Unit & Integration Tests
        env:
          DATABASE_URL: postgres://postgres:password@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379
        run: npm run test:ci

  build-and-push:
    name: Container Build & Push
    needs: validate-and-test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract Metadata (Tags, Labels)
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=sha,prefix=sha-,format=short

      - name: Build and Push Docker Image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

---

### Pipeline Architecture & Security Considerations

| Stage | Security Control / Optimization | Operational Benefit |
| :--- | :--- | :--- |
| **Lint & Compile** | Static analysis (`eslint`, `tsc`) | Catches syntax and type anomalies before test overhead. |
| **Test Services** | Isolated ephemeral containers (`postgres`, `redis`) | Guarantees reproducible test state without external resource contention. |
| **Multi-Stage Build** | Distroless runtime (`gcr.io/distroless/...`) | Reduces image attack surface by stripping shell utilities, package managers, and root access. |
| **Registry Push** | GitHub Actions Cache (`type=gha`) | Accelerates build execution times by caching intermediate layers. |

### Operational Caveats

1. **Distroless Debugging**: Because distroless images contain no shell (`sh` or `bash`), runtime container debugging must be performed using ephemeral debug containers (`kubectl debug` or `docker run --pid=container:...`).
2. **Database Migrations**: Database schema migrations should run as an isolated Kubernetes Job or init-container rather than embedded inside the application startup process to prevent split-brain issues in horizontally scaled microservices.


### Work Package: Deployment Telemetry & Release Communication Workflow
- **Assigned Specialist**: Nova (specialist)
- **Directive**: Configure automated release notification webhooks, uptime telemetry dashboards, and change-log summarization workflows to broadcast deployment success metrics and status updates to internal engineering channels.
- **Status**: completed (Execution Time: 8s)

#### Specialist Report:
### Executive Summary

Modern engineering teams require closed-loop release communication workflows that bridge the gap between continuous delivery pipelines and internal stakeholder visibility. When deploying software engineering changes to production, real-time observability telemetry (OpenTelemetry, RED/USE metrics frameworks) must seamlessly integrate with release messaging channels. 

This technical report outlines a production-ready workflow for automating release notification webhooks, configuring uptime telemetry dashboards, and generating AI-assisted change-log summarization payloads to broadcast deployment metrics across enterprise chat infrastructure.

### System Architecture & Pipeline Design

To achieve zero-touch, highly reliable release communication, the deployment pipeline integrates with an event-driven telemetry relay. 

```
[ CI/CD Pipeline (GitHub Actions / GitLab) ]
       │
       ▼ (1. Build & Deploy Event)
[ Release Orchestrator / Webhook Gateway ]
       │
       ├────────────────────────┐
       ▼                        ▼
[ OpenTelemetry Collector ]   [ AI Summarization Engine ]
       │                        │
       ▼ (RED/USE Metrics)      ▼ (Structured Markdown)
[ Grafana Dashboards ]       [ Chat API (Slack / Teams) ]
```

#### 1. Pipeline Trigger & Metadata Payload
Upon successful deployment to production, the CI/CD environment generates a structured JSON payload containing commit shas, pull request titles, author metadata, and OpenTelemetry trace context.

#### 2. Telemetry Verification & Dashboards
The deployment triggers a verification check against Prometheus/OpenTelemetry metrics endpoints, ensuring that error rates (RED method: Rate, Errors, Duration) remain stable post-release.

#### 3. Change-Log Summarization & Broadcast
Raw git diffs are parsed and filtered to remove dependency bumps and chore commits, then passed through a summarization prompt to produce executive-ready release notes.

---

### Implementation: Automated Release Webhook & Summarizer

Below is a production-ready Python service (designed for serverless deployment or containerized microservices) that processes deployment webhooks, queries deployment metrics, and posts a rich-formatted release card to Slack.

```python
import os
import json
import requests
from typing import Dict, Any

SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL", "https://hooks.slack.com/services/T00/B00/XX")
OTEL_METRICS_ENDPOINT = os.getenv("OTEL_METRICS_ENDPOINT", "http://prometheus.monitoring.svc:9090/api/v1/query")

def query_deployment_health(service_name: str) -> Dict[str, Any]:
    """Queries Prometheus/OpenTelemetry for post-deployment error rate and latency."""
    try:
        # Example query for HTTP error rate (5xx over last 5 minutes)
        query = f'sum(rate(http_requests_total{{service="{service_name}", status=~"5.."}}[5m]))'
        response = requests.get(OTEL_METRICS_ENDPOINT, params={"query": query}, timeout=5)
        data = response.json()
        
        if data["status"] == "success" and data["data"]["result"]:
            error_rate = float(data["data"]["result"][0]["value"][1])
        else:
            error_rate = 0.0
            
        return {"error_rate": error_rate, "status": "healthy" if error_rate < 0.01 else "degraded"}
    except Exception as e:
        return {"error_rate": None, "status": "unknown", "error": str(e)}

def generate_slack_payload(deployment_meta: Dict[str, Any], health: Dict[str, Any]) -> Dict[str, Any]:
    """Constructs a Block Kit payload for enterprise release announcements."""
    service = deployment_meta.get("service_name", "unknown-service")
    version = deployment_meta.get("version", "v0.0.0")
    author = deployment_meta.get("author", "Engineering")
    commit_sha = deployment_meta.get("commit_sha", "0000000")
    summary = deployment_meta.get("summary", "No summary provided.")
    
    health_emoji = "🟢" if health.get("status") == "healthy" else "🟡"
    error_display = f"{health.get('error_rate', 0)*100:.2f}%" if health.get("error_rate") is not None else "N/A"

    blocks = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"🚀 Deployment Successful: {service} ({version})"
            }
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Author:*\n{author}"},
                {"type": "mrkdwn", "text": f"*Commit:*\n`{commit_sha[:7]}`"},
                {"type": "mrkdwn", "text": f"*Telemetry Status:*\n{health_emoji} {health.get('status').title()}"},
                {"type": "mrkdwn", "text": f"*5m Error Rate:*\n{error_display}"}
            ]
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*Release Summary:*\n{summary}"
            }
        },
        {
            "type": "divider"
        }
    ]
    return {"blocks": blocks}

def broadcast_release(event_payload: Dict[str, Any]) -> bool:
    """Orchestrates telemetry checks and webhook dispatch."""
    service_name = event_payload.get("service_name")
    health = query_deployment_health(service_name)
    payload = generate_slack_payload(event_payload, health)
    
    response = requests.post(SLACK_WEBHOOK_URL, json=payload, timeout=10)
    return response.status_code == 200
```

---

### Observability & Telemetry Framework

To ensure releases do not degrade production SLOs, telemetry must be continuously tracked across three core pillars:

| Metric Category | Telemetry Signal | Target Threshold | Action on Breach |
| :--- | :--- | :--- | :--- |
| **RED Metrics (Rate)** | `http_requests_total` | Baseline ± 20% | Trigger traffic anomaly warning |
| **RED Metrics (Errors)** | `http_requests_5xx` | `< 0.1%` of total traffic | Automated rollback recommendation |
| **RED Metrics (Duration)**| `http_request_duration_seconds` | `p99 < 350ms` | Performance regression alert |
| **Infrastructure (USE)** | CPU/Memory Saturation | `< 80%` utilization | Scale-out event emission |

#### Grafana Dashboard Configuration Snippet
The release notification webhook automatically injects annotations into Grafana dashboards at the exact timestamp of deployment:

```json
{
  "dashboard": "production-service-overview",
  "time": "now",
  "tags": ["deployment", "release"],
  "text": "Deployed version v1.4.2 by @author"
}
```

---

### Operational Caveats & Risk Mitigation

1. **Webhook Storms & Rate Limiting:** 
   * *Risk:* Concurrent microservice deployments can saturate chat webhook endpoints (e.g., Slack 1 req/sec limit per channel).
   * *Mitigation:* Implement a Redis-backed queue with token bucket rate-limiting for all outbound release notifications.
2. **False Positive Health Checks:** 
   * *Risk:* Querying telemetry immediately post-deployment can catch transient DNS or container cold-start errors.
   * *Mitigation:* Introduce a mandatory 180-second soak period before evaluating the post-deployment error rate threshold.
3. **Sensitive Data Leakage:** 
   * *Risk:* Automated change-log summaries might pull commit messages containing internal credentials or PII.
   * *Mitigation:* Apply regex sanitization filters over git commit subjects before feeding text into the summarization model.


### Work Package: Blue-Green Deployment Infrastructure & Rollback Strategy
- **Assigned Specialist**: Ledger (worker)
- **Directive**: Architect the production Kubernetes manifests and traffic-shifting router configurations (Istio/Nginx) for zero-downtime blue-green deployments, accompanied by automated health checks and instant rollback runbooks.
- **Status**: completed (Execution Time: 8s)

#### Specialist Report:
### Executive Summary

Zero-downtime deployments require absolute isolation between staging (Green) and production (Blue) environments, combined with state-aware traffic shifting and deterministic rollback mechanics. This architecture specification outlines the production Kubernetes manifests, service mesh routing configurations (Istio), automated health validation loops, and instant rollback procedures designed to eliminate deployment regressions and user-facing downtime.

---

### 1. Kubernetes Architecture & Manifests

To achieve clean environment isolation without duplicating ingress controllers or external load balancers, we utilize Kubernetes Services with dynamic label selectors. The ingress points to a stable service (`api-service`), which dynamically targets either the Blue or Green deployment via the `version` label.

#### Deployment Manifests (Blue & Green)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-blue
  namespace: production
  labels:
    app: api
    version: blue
spec:
  replicas: 5
  selector:
    matchLabels:
      app: api
      version: blue
  template:
    metadata:
<div>
      labels:
        app: api
        version: blue
    spec:
      containers:
      - name: api
        image: registry.internal/core/api:v2.4.0
        ports:
        - containerPort: 8080
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 3
        livenessProbe:
          httpGet:
            path: /health/live
            port: 8080
          initialDelaySeconds: 15
          periodSeconds: 10
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-green
  namespace: production
  labels:
    app: api
    version: green
spec:
  replicas: 5
  selector:
    matchLabels:
      app: api
      version: green
  template:
    metadata:
      labels:
        app: api
        version: green
    spec:
      containers:
      - name: api
        image: registry.internal/core/api:v2.5.0
        ports:
        - containerPort: 8080
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 3
        livenessProbe:
          httpGet:
            path: /health/live
            port: 8080
          initialDelaySeconds: 15
          periodSeconds: 10
```

#### Stable & Preview Services

```yaml
apiVersion: v1
kind: Service
metadata:
  name: api-service
  namespace: production
spec:
  ports:
  - port: 80
    targetPort: 8080
    name: http
  selector:
    app: api
    version: blue # Points to Blue initially; toggled to green upon verification
---
apiVersion: v1
kind: Service
metadata:
  name: api-preview
  namespace: production
spec:
  ports:
  - port: 80
    targetPort: 8080
    name: http
  selector:
    app: api
    version: green # Dedicated endpoint for pre-promotion testing
```

---

### 2. Traffic-Shifting Router Configuration (Istio Service Mesh)

For advanced traffic management, canary testing, and weighted splitting prior to full cutover, Istio VirtualServices provide fine-grained control over routing topologies.

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: api-virtualservice
  namespace: production
spec:
  hosts:
  - "api.enterprise.internal"
  gateways:
  - production-gateway
  http:
  - route:
    - destination:
        host: api-service
        subset: blue
      weight: 100
    - destination:
        host: api-service
        subset: green
      weight: 0
---
apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata:
  name: api-destinationrule
  namespace: production
spec:
  host: api-service
  subsets:
  - name: blue
    labels:
      version: blue
  - name: green
    labels:
      version: green
```

---

### 3. Automated Health Verification Loop

Before shifting production traffic to the Green deployment, automated smoke tests and telemetry verification must execute against the preview environment.

```bash
#!/usr/bin/env bash
set -euo pipefail

PREVIEW_URL="http://api-preview.production.svc.cluster.local"
MAX_RETRIES=12
DELAY=5

echo "[-] Initializing pre-promotion health verification for Green environment..."

for ((i=1; i<=MAX_RETRIES; i++)); do
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$PREVIEW_URL/health/ready")
    
    if [ "$HTTP_STATUS" -eq 200 ]; then
        echo "[+] Health check passed (Attempt $i/$MAX_RETRIES). Service is ready."
        exit 0
    fi
    
    echo "[!] Attempt $i failed with status $HTTP_STATUS. Retrying in ${DELAY}s..."
    sleep $DELAY
done

echo "[-] ERROR: Health verification failed. Aborting deployment."
exit 1
```

---

### 4. Instant Rollback Runbook

If metrics degrade (e.g., error rate $HTTP_5xx > 0.5\%$ or latency p99 $> 500\text{ms}$) following traffic cutover, execute the immediate rollback protocol.

#### Step 1: Immediate Traffic Reversion (Istio)
```bash
cat <<EOF | kubectl apply -f -
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: api-virtualservice
  namespace: production
spec:
  hosts:
  - "api.enterprise.internal"
  http:
  - route:
    - destination:
        host: api-service
        subset: blue
      weight: 100
    - destination:
        host: api-service
        subset: green
      weight: 0
EOF
```

#### Step 2: Fallback Selector Switch (Kubernetes Native)
If operating without a service mesh, patch the main service selector instantly:
```bash
kubectl patch service api-service -n production --type='json' \
  -p='[{"op": "replace", "path": "/spec/selector/version", "value": "blue"}]'
```

#### Step 3: Post-Mortem Metric Validation
Verify recovery across Prometheus metrics:
```promql
sum(rate(http_requests_total{status=~"5.*", version="blue"}[2m])) 
/ 
sum(rate(http_requests_total{version="blue"}[2m]))
```

---

### 5. Operational Caveats & State Management

1. **Database Schema Migrations**: 
   - Databases must follow the **Expand and Contract (Backward Compatible)** pattern. 
   - Never drop columns or rename tables until the Blue deployment is completely decommissioned. Version $N$ and Version $N+1$ must coexist against the same schema or use multi-version concurrency control (MVCC).
2. **Persistent State & Caching**: 
   - Stateful workloads or local cache dependencies must avoid write locks that prevent parallel instances from running concurrently during the verification window.
3. **Resource Quotas**: 
   - Ensure the Kubernetes cluster has sufficient node capacity to run both Blue (e.g., 5 replicas) and Green (5 replicas) simultaneously during the migration window (total 100% capacity overhead during transition).


---
*Recorded autonomously by Agent Studio OS A2A Protocol Engine*
