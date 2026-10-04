# Stream Detector — Render One-Service Deployment

This version is designed to run as ONE Render Web Service:
Frontend + Express API + Playwright + Chromium.

## Deploy with Render

1. Upload this project to a GitHub repository.
2. In Render Dashboard choose **New → Web Service**.
3. Connect the GitHub repository.
4. Select **Docker** as the runtime.
5. Choose **Free** plan.
6. Leave the Dockerfile path as `Dockerfile`.
7. Health Check Path: `/api/health`
8. Click **Create Web Service**.

Render will build the Playwright Chromium image and start the app.

## Verify

After deployment, open:

`https://YOUR-SERVICE.onrender.com/api/health`

You should receive JSON similar to:

`{"ok":true,"service":"stream-detector"}`

Then open:

`https://YOUR-SERVICE.onrender.com`

The frontend and `/api/scan` are same-origin, so no Netlify API URL or CORS configuration is needed.

## Free plan note

Render Free web services can spin down after 15 minutes without inbound traffic. The next request can take about a minute while the service wakes up. Free instances also have limited resources, so this is best for testing/light use.

## Scope

Use only on websites and streams you own or are authorized to inspect. This tool does not bypass DRM, authentication, paywalls, signed-URL protections, or other access controls.


## GitHub mobile
All deploy files are intentionally in the repository root, so they can be selected/uploaded together from GitHub mobile without nested folders.
