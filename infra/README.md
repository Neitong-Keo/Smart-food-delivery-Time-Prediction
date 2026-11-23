# Infrastructure Notes

Phase 1 container definitions live alongside each application:

- `apps/web/Dockerfile` and `apps/web/.dockerignore`
- `apps/backend/Dockerfile` and `apps/backend/.dockerignore`
- Root `docker-compose.yml` orchestrates both services on host ports `3600` (web) and `8600` (API).

## VPS deployment

The VPS runs a dedicated `smart-food-delivery` Compose project from `/opt/smart-food-delivery`. Port `38600` serves the web app and proxies `/api` to the private FastAPI container. It binds to `127.0.0.1` by default; set `WEB_BIND` in an optional `deploy.env` beside the script to bind the address the shared reverse proxy can reach instead. Never bind it to a public address. The model and its summary metrics are mounted read-only from `model/`, outside Git. Keep those artifacts on the VPS across deployments.

Provision the deployment directory once. Install `deploy-vps.sh` and `compose.vps.yml` from this directory, clone this public repository as `source.git` using `git clone --bare`, and copy the trusted `model.joblib` and `metrics.json` into `model/`. The VPS needs Docker Compose, Bash, Git, curl, flock, and Python 3.

For an initial release from a review branch, run the installed script with the full commit SHA and branch ref:

```bash
/opt/smart-food-delivery/deploy-vps.sh --initial <commit-sha> refs/heads/<branch>
```

For CI, provision a dedicated SSH key restricted to the deployment command. Keep the private key in the GitHub Actions secret `SMART_DELIVERY_SSH_KEY`. Set `SMART_DELIVERY_HOST` to the VPS address and `SMART_DELIVERY_KNOWN_HOSTS` to the verified SSH host key entry. Add the deploy public key to the VPS with this prefix:

```text
restrict,command="/opt/smart-food-delivery/deploy-vps.sh --github" ssh-ed25519 <public-key>
```

Once the workflow is on `main`, a push to `main` deploys the tested commit after the backend and frontend jobs pass. The VPS verifies the commit against the branch tip and builds the images before switching containers. It keeps the previous images available for rollback if the release fails its health checks. Changes to the installed deployment script or Compose configuration are applied explicitly on the VPS after review.

