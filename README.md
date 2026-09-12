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

The dashboard reconnects dropped WebSockets with a 1–30 second retry delay and
refreshes when the page becomes visible again. A heartbeat checks for connections
that stopped carrying messages. While connecting or disconnected, visible pages
also refresh their data every 5 seconds; healthy WebSockets use push updates.
The backend must include the matching `ping`/`pong` handler. Restart the backend
after updating it, then reload the browser page.

If refreshing loads correct data but button presses do not update the page, inspect
the **dashboard** WebSocket in the Network panel (the Vite hot-reload socket is
separate). Check for a successful connection and `status_update`, `state_update`,
and heartbeat replies. A single cancelled handshake during development does not
prove all connections failed; inspect the surviving connection.

Run connection recovery checks with `npm run test:socket`.

## Long-running dashboard performance

Live counters share one one-second clock. Completed session rows do not subscribe,
and the clock stops when the page is hidden or no live counters are mounted. On
return, it catches up from timestamps. The goal ring uses a lightweight SVG circle
instead of recalculating Recharts axes and layout each second. Duration text stays
live every second, including the open activity tooltip; activity bars update every
10 seconds between API updates. The tooltip reads the latest raw API point rather
than Recharts' cached hover payload. Older activity responses get their active
category from the current session, using the shared sessions query. Clock-in/out
and range changes still update the
chart immediately. Historical chart segments and date formatters are reused.
Connection and focus refreshes are grouped, with no overlapping refresh
batches and one follow-up if a real state change arrives during a request.

Run `npm run test:performance` for timer cleanup, hidden-tab recovery, and request
coalescing checks. These are deterministic regression checks, not a measurement
of Safari's memory usage. If a resource warning returns, capture Safari Web
Inspector's Timelines recording while idle and after switching tabs to identify
CPU activity or memory growth. Serving Vite development mode also includes hot
reload and React development checks; production hosting should serve the built
assets with the same `/api` HTTP and WebSocket proxy.

This routing is for the Vite development server. `npm run build` creates static
files; a production host must also proxy `/api` with WebSocket support to the backend.

## Checking Lighthouse results

Audit a built version in a browser profile with extensions disabled. Development
mode serves raw source modules, React development checks, and Vite hot reload;
extension scripts also appear in Lighthouse's JavaScript treemap. Their sizes
should not be attributed to the application's production bundle.

For a local build check, keep the backend running and run:

```bash
npm run build
npm run preview -- --host 0.0.0.0 --port 4173 --strictPort
```

Open `http://<FRONTEND_LAN_IP>:4173` from your computer, verify that the dashboard
loads and receives live updates, then run Lighthouse there. Preview inherits the
existing `/api` HTTP and WebSocket proxy. This leaves the development server and
public tunnel on port 5173 unchanged. Local results exclude Cloudflare/network
latency, so also audit the public hostname after production hosting is configured.

Preview is for testing, not permanent production hosting. The production server
must serve `dist`, fall back to `index.html` for app routes, serve `robots.txt`
as plain text, and proxy `/api` (including WebSockets) to port 4004 before applying
the app fallback. Cache hashed `/assets/` files long-term and revalidate HTML.
Confirm that the public page no longer loads `/@vite/client` or `/src/main.tsx`.

A startup Lighthouse score does not establish a memory leak. For that, compare
memory after repeated navigation, tab hiding/restoring, and socket reconnects,
allowing garbage collection between measurements.

References: [Vite server options](https://vite.dev/config/server-options),
[Vite build and preview](https://vite.dev/guide/static-deploy.html),
[Cloudflare Tunnel setup](https://developers.cloudflare.com/tunnel/setup/).
