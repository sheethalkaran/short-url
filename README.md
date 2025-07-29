# Short URL Service

A full-stack application for creating and managing short URLs, featuring authentication, rate limiting, analytics, and a user dashboard.

## Features

- Shorten long URLs
- User authentication (login/register)
- Rate limiting per user
- Analytics and monitoring
- Dashboard for managing URLs
- Redis caching for performance
- Dockerized backend, frontend, and Nginx reverse proxy

## Tech Stack

- **Backend:** Node.js, Express, Redis
- **Frontend:** HTML, CSS, JavaScript
- **Containerization:** Docker, Docker Compose
- **Reverse Proxy:** Nginx

## Getting Started


### Setup

1. Clone the repository:
   ```sh
   git clone https://github.com/sheethalkaran/short-url.git
   cd short-url
   ```

2. Build and start the services:
   ```sh
   docker-compose up --build
   ```

## Project Structure

```
backend/      # Node.js API server
frontend/     # Static frontend files
Dockerfile*   # Docker configuration
nginx.conf    # Nginx reverse proxy config
redis.conf    # Redis configuration
```

## API Endpoints

- `POST /api/auth/register` — Register new user
- `POST /api/auth/login` — Login
- `POST /api/url/shorten` — Shorten a URL
- `GET /:shortUrl` — Redirect to original URL
- `GET /api/url/user` — Get user’s URLs

