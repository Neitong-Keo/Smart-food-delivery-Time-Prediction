# Infrastructure Notes

Phase 1 container definitions live alongside each application:

- `apps/web/Dockerfile` and `apps/web/.dockerignore`
- `apps/backend/Dockerfile` and `apps/backend/.dockerignore`
- Root `docker-compose.yml` orchestrates both services on host ports `3600` (web) and `8600` (API).

Future deployment manifests, reverse proxy configs, or CI/CD infrastructure definitions belong in this directory.

