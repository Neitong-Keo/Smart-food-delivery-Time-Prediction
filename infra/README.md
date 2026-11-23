# Infrastructure Notes

Phase 1 container definitions live alongside each application:

- `apps/web/Dockerfile` and `apps/web/.dockerignore`
- `apps/backend/Dockerfile` and `apps/backend/.dockerignore`
- Root `docker-compose.yml` orchestrates both services on host ports `3600` (web) and `8600` (API).

## VPS deployment

The VPS runs a dedicated `smart-food-delivery` Compose project from `/opt/smart-food-delivery`. The web app proxies `/api` to the private FastAPI container, so the site and API share one origin. Port `38600` is bound to `127.0.0.1` for the deploy smoke test only. Never bind it to a public address.

### Public HTTPS

`https://ml-final-projecct.saovisal.me` goes through the VPS's shared nginx (`camcyber-ai-nginx-1`), which owns ports 80 and 443. The web container joins that stack's `camcyber-ai-ingress` network under the alias `smart-food-delivery-web`. The shared stack's tracked files are never edited:

- `ingress-sync.sh` copies a separate `conf.d/smart-food-delivery.conf` and this domain's certificate into the nginx container. It reloads nginx only after `nginx -t` passes and restores the previous files otherwise.
- `smart-food-delivery-ingress.timer` reruns the script every five minutes, which reinstalls the files if that container is recreated.
- The certificate uses a separate certbot configuration in `letsencrypt/`, so the shared stack's renewal hooks (which stop its nginx) never run for it. nginx forwards this domain's ACME challenges to certbot on the ingress gateway, port `38680`. `smart-food-delivery-cert.timer` renews it.

Issue the certificate once, after the HTTP-only virtual host is installed:

```bash
cd /opt/smart-food-delivery
certbot certonly --standalone --non-interactive --agree-tos --register-unsafely-without-email \
  --config-dir letsencrypt --work-dir letsencrypt/work --logs-dir letsencrypt/logs \
  --http-01-address "$(docker network inspect -f '{{(index .IPAM.Config 0).Gateway}}' camcyber-ai-ingress)" \
  --http-01-port 38680 --key-type ecdsa -d ml-final-projecct.saovisal.me
./ingress-sync.sh
``` The model and its summary metrics are mounted read-only from `model/`, outside Git. Keep those artifacts on the VPS across deployments.

Provision the deployment directory once. Install `deploy-vps.sh`, `compose.vps.yml` and `ingress-sync.sh` from this directory, install and enable the units in `systemd/`, clone this public repository as `source.git` using `git clone --bare`, and copy the trusted `model.joblib` and `metrics.json` into `model/`. The VPS needs Docker Compose, Bash, Git, curl, flock, and Python 3.

For an initial release from a review branch, run the installed script with the full commit SHA and branch ref:

```bash
/opt/smart-food-delivery/deploy-vps.sh --initial <commit-sha> refs/heads/<branch>
```

For CI, provision a dedicated SSH key restricted to the deployment command. Keep the private key in the GitHub Actions secret `SMART_DELIVERY_SSH_KEY`. Set `SMART_DELIVERY_HOST` to the VPS address and `SMART_DELIVERY_KNOWN_HOSTS` to the verified SSH host key entry. Add the deploy public key to the VPS with this prefix:

```text
restrict,command="/opt/smart-food-delivery/deploy-vps.sh --github" ssh-ed25519 <public-key>
```

Once the workflow is on `main`, a push to `main` deploys the tested commit after the backend and frontend jobs pass. The VPS verifies the commit against the branch tip and builds the images before switching containers. It keeps the previous images available for rollback if the release fails its health checks. Changes to the installed deployment script or Compose configuration are applied explicitly on the VPS after review.

