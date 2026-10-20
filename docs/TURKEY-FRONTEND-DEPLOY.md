# Turkey VPS deployment — NEXORA frontend only

Destination: existing Turkey VPS **206.1.101.60**, shared with the Bybit bot.
This document does **not** authorize touching existing Bybit services, nginx sites or firewall rules.

## Isolation and security
- Create a **dedicated unprivileged Linux user** `nexora-deploy` after inspecting existing server configuration. No sudo permission for CI.
- Dedicated home directory only: `/home/nexora-deploy/nexora-frontend/`.
- GitHub uploads static assets to `releases/<commit-sha>/` and atomically switches `current` symlink.
- Existing Bybit systemd services, containers, volumes, ports, directories, proxies and credentials must remain untouched.
- The workflow is committed and auto-triggered on push; **it cannot deploy until secrets/environment are configured**.

## GitHub deployment settings
In NADERAZIMI/nexora-frontend -> Settings -> Environments -> create `turkey-frontend`.
Configure environment secrets:
- `NEXORA_DEPLOY_HOST` = `206.1.101.60`
- `NEXORA_DEPLOY_USER` = `nexora-deploy` (after server user setup)
- `NEXORA_DEPLOY_SSH_KEY` = private half of a purpose-built ED25519 deploy key; **never place it in source or chat**.
- `NEXORA_SSH_KNOWN_HOSTS` = independently verified host public key entry for the server; do not blindly trust unverified `ssh-keyscan` output.

Optional environment variable `NEXORA_SSH_PORT`, defaults to 22.
Recommend an environment reviewer during initial rollout, then remove approval gating when tested.

## Web serving
The workflow only deploys static files. A distinct Nginx virtual host/server name and DNS/HTTPS must be provisioned **after examining existing sites**. Do not overwrite default site, reload Nginx or allocate ports until conflict checks pass.
Document root:
`/home/nexora-deploy/nexora-frontend/current`
Nginx needs permission to traverse/read the dedicated static files.

### Frontend public MEXC proxy
Vite's `server.proxy` works **only in development**; for deployed static assets, requests to `/mexc-public/api/v3/*` require a dedicated Nginx upstream rule to `https://api.mexc.com/api/v3/*`.
Proxy must be **read-only**, allow only `GET` (and optionally `HEAD`), restrict the allowed paths to `exchangeInfo`, `ticker/price`, `depth`, and `klines`, and have request timeouts and basic rate limits. No API keys, authenticated endpoints or account/order APIs.
Do not add this route to an existing Bybit site. Use an isolated NEXORA vhost.

## Before activating
1. SSH into Turkey VPS with the owner's existing admin method and inspect Linux OS, SSH port, web server and other services.
2. Create dedicated user, SSH key and folders without modifying other accounts.
3. Check CI `npm run build` succeeds and fix any failing TypeScript/build errors.
4. Verify Nginx test `nginx -t` before reload.
5. Configure HTTPS and only then share NEXORA preview URL.
6. Commit a harmless frontend change; verify Actions build/deploy, URL, market feed, and rollback.

## Rollback
Via the dedicated deploy account, atomically point the `current` symlink back to a previously known good `releases/<sha>`. This changes no other service.

## Limitation
Current frontend market data uses experimental **MEXC public Spot** APIs only. NEXORA backend is independent and unchanged. Real user funds/trading never go through this workflow.
