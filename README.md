# Tracker frontend

React + TypeScript + Vite dashboard for the Raspberry Pi tracker backend.
HTTP requests use `/api/v1/...`; live updates use `/api/v1/ws/dashboard/`.
Both use the browser's current origin, with Vite forwarding `/api` to the backend.
Opening the app over HTTPS automatically uses secure WebSockets (`wss`).

## Environment

From this directory, run `cp -n .env.example .env`, then edit `.env`:

```dotenv
# Address reached by the Vite server, not by the browser.
# Same machine: http://127.0.0.1:4004
# Backend on another Pi: http://<PI_LAN_IP>:4004
# Origin only: do not append /api/v1.
API_PROXY_TARGET=http://127.0.0.1:4004

# Exact public frontend hostname(s), comma-separated; no scheme, port, or path.
# Example: tracker.example.com (replace with your Cloudflare hostname).
# Localhost and LAN IP addresses work without this setting.
DEV_ALLOWED_HOSTS=

```

Restart Vite after changing `.env`. These variables configure the Vite server;
no `VITE_` variable is needed. Never put MongoDB credentials in frontend variables.
The backend's separate environment is documented in [its README](../tracker-backend/README.md).

## Run locally or on your network

Start the backend on port 4004 using its README. Then, in this directory:

```bash
npm ci
npm run dev -- --host 0.0.0.0
```

On this computer open `http://localhost:5173`. On another device on the same LAN,
open `http://<FRONTEND_LAN_IP>:5173`. On Linux, `hostname -I` lists local addresses;
choose the LAN address reachable by the other device. `0.0.0.0` is the bind address,
not the address to enter in a browser. Allow TCP 5173 through the host firewall if needed.
Vite uses a fixed port and fails if 5173 is occupied, keeping the tunnel target predictable.

If the backend runs on another Raspberry Pi, set
`API_PROXY_TARGET=http://<PI_LAN_IP>:4004` and run Uvicorn there with `--host 0.0.0.0`.
The frontend server must be able to reach that Pi on TCP 4004. If both projects run
on the same machine, keep `API_PROXY_TARGET=http://127.0.0.1:4004`.

## Cloudflare Tunnel

For the single frontend route shown in the dashboard:

| Field | Value |
| --- | --- |
| Public hostname | Your actual hostname, e.g. `tracker.example.com` |
| Path | Leave blank |
| Service URL | `http://localhost:5173` when cloudflared runs on the frontend machine |

Set `DEV_ALLOWED_HOSTS=tracker.example.com` using your actual hostname, then restart Vite.
If cloudflared runs on another machine, use `http://<FRONTEND_LAN_IP>:5173` as its
Service URL and run Vite with `--host 0.0.0.0`. In a container, localhost refers to
that container; use an address reachable from the connector.

Open `https://<YOUR_PUBLIC_HOSTNAME>` without `:5173`. Requests follow:

```text
Browser -> Cloudflare -> Vite :5173 -> /api (HTTP + WebSocket) -> backend :4004
```

No separate backend tunnel or path rule is needed for this setup. The local Service
URL remains HTTP even though the public URL is HTTPS. The screenshot's hostname
is not visible, so replace the example with your real hostname.

## Verify and troubleshoot

```bash
# Run on the frontend machine; use the Pi address if the backend is remote.
curl http://127.0.0.1:4004/api/v1/health
curl http://localhost:5173/api/v1/health
# Replace with your real hostname:
curl https://tracker.example.com/api/v1/health
```

Each should return `{"status":"healthy"}`. In browser developer tools, confirm
`/api/v1/ws/dashboard/` upgrades with status 101 and receives live updates.
A blocked-host response means `DEV_ALLOWED_HOSTS` needs the exact public hostname.
A proxy connection error means the backend is stopped or `API_PROXY_TARGET` is unreachable.

This routing is for the Vite development server. `npm run build` creates static
files; a production host must also proxy `/api` with WebSocket support to the backend.

References: [Vite server options](https://vite.dev/config/server-options),
[Cloudflare Tunnel setup](https://developers.cloudflare.com/tunnel/setup/).
