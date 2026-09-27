# SMARTER-AI Production Deployment Guide

## 1. Environment Hardening
- Ensure `.env` is secure and not committed.
- Configure `JWT_SECRET` with a strong random string.
- Set `ALLOWED_HOSTS` in FastAPI settings.

## 2. CI/CD Configuration (GitHub Actions)
- Define workflows for:
  - `lint`: Run eslint/mypy.
  - `test`: Run pytest/vitest.
  - `build`: Build Docker images.

## 3. Performance Optimization
- Enable Redis caching for AI responses.
- Configure Nginx caching for static frontend assets.
- Monitor container resource limits (CPU/RAM).

## 4. Readiness Gates
- Use `GET /health` for simple uptime checks.
- Use `GET /ready` for load balancer readiness probes.
- Use `GET /api/v1/operations/readiness` in CI/CD smoke tests to inspect non-secret controls before promoting an environment.
- Treat `blocked` status as a failed deployment gate in production.

## 5. Security and Cache Controls
- Public cache headers should be limited to health/readiness probes and immutable frontend assets.
- Authenticated API responses should remain `Cache-Control: no-store`.
- Disable `CREATE_DEFAULT_ADMIN` and `AUTO_CREATE_TABLES` in production.
- Configure `ALLOWED_HOSTS`, explicit CORS origins, strong JWT secrets, TLS termination, and HSTS.

## 6. Observability Roadmap
- Install Prometheus instrumentation in production images when metrics scraping is required.
- Forward structured API logs to centralized logging.
- Add Redis, database, Qdrant, AI provider, voice, and worker checks into the readiness model as infrastructure is deployed.
