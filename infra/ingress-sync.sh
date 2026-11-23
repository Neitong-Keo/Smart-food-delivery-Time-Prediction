#!/usr/bin/env bash
# Install this project's virtual host and certificate into the VPS's shared
# nginx container without editing that stack's tracked configuration.
#
# The shared nginx renders only its own template into conf.d, so a separate
# conf.d file survives restarts but not a container recreation. A systemd timer
# runs this script every few minutes to put the files back when needed. Every
# change is checked with `nginx -t` and rolled back if the check fails, so the
# shared ingress is only ever reloaded with a valid configuration.
set -euo pipefail

base=$(cd -- "$(dirname -- "$0")" && pwd)
domain=ml-final-projecct.saovisal.me
nginx=camcyber-ai-nginx-1
network=camcyber-ai-ingress
acme_port=38680
live=$base/letsencrypt/live/$domain
conf_path=/etc/nginx/conf.d/smart-food-delivery.conf
cert_dir=/etc/nginx/smart-food-delivery

exec 8>"$base/ingress.lock"
flock 8

if [[ $(docker inspect -f '{{.State.Running}}' "$nginx" 2>/dev/null) != true ]]; then
  echo "$nginx is not running; nothing to install." >&2
  exit 0
fi
gateway=$(docker network inspect -f '{{(index .IPAM.Config 0).Gateway}}' "$network")

tls=false
[[ -s $live/fullchain.pem && -s $live/privkey.pem ]] && tls=true

render_conf() {
  local fallback='return 404;'
  $tls && fallback='return 301 https://$host$request_uri;'
  cat <<EOF
# Managed by /opt/smart-food-delivery/ingress-sync.sh. Do not edit here.
server {
    listen 80;
    server_name $domain;

    # Only this domain's ACME challenges reach the host's certbot.
    location /.well-known/acme-challenge/ {
        proxy_pass http://$gateway:$acme_port;
    }

    location / {
        $fallback
    }
}
EOF
  $tls || return 0
  cat <<EOF

server {
    listen 443 ssl;
    http2 on;
    server_name $domain;

    ssl_certificate     $cert_dir/fullchain.pem;
    ssl_certificate_key $cert_dir/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    # A variable defers the Docker DNS lookup, so nginx still starts while
    # this project's containers are down.
    resolver 127.0.0.11 ipv6=off valid=10s;
    client_max_body_size 1m;

    location / {
        set \$smart_food_delivery_web smart-food-delivery-web:3600;
        proxy_pass http://\$smart_food_delivery_web;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;
    }
}
EOF
}

stage=$(mktemp -d)
trap 'rm -rf -- "$stage"' EXIT
mkdir "$stage/certs"
render_conf >"$stage/site.conf"
$tls && cp -L "$live/fullchain.pem" "$live/privkey.pem" "$stage/certs/"

installed() { docker exec "$nginx" cat "$1" 2>/dev/null || true; }
changed=false
cmp -s <(installed "$conf_path") "$stage/site.conf" || changed=true
if $tls; then
  for file in fullchain.pem privkey.pem; do
    cmp -s <(installed "$cert_dir/$file") "$stage/certs/$file" || changed=true
  done
fi
$changed || exit 0

docker exec "$nginx" sh -c "
  rm -rf $cert_dir.prev $cert_dir.conf.prev
  if [ -d $cert_dir ]; then cp -a $cert_dir $cert_dir.prev; fi
  if [ -f $conf_path ]; then cp $conf_path $cert_dir.conf.prev; fi
  mkdir -p $cert_dir
"
$tls && docker cp "$stage/certs/." "$nginx:$cert_dir/"
docker exec "$nginx" chmod 600 "$cert_dir/privkey.pem" 2>/dev/null || true
docker cp "$stage/site.conf" "$nginx:$conf_path"

if ! docker exec "$nginx" nginx -t; then
  echo 'nginx rejected the new configuration; restoring the previous files.' >&2
  docker exec "$nginx" sh -c "
    rm -rf $cert_dir
    if [ -d $cert_dir.prev ]; then mv $cert_dir.prev $cert_dir; fi
    if [ -f $cert_dir.conf.prev ]; then mv $cert_dir.conf.prev $conf_path; else rm -f $conf_path; fi
  "
  exit 1
fi
docker exec "$nginx" nginx -s reload
docker exec "$nginx" rm -rf "$cert_dir.prev" "$cert_dir.conf.prev"
echo "Installed the $domain virtual host (TLS: $tls) and reloaded nginx."
