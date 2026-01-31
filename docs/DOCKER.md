# Docker Deployment Guide

## Overview

This document explains how to build and run the Evalio backend using Docker containers.

## Prerequisites

- Docker Engine 20.10+ or Docker Desktop
- Docker Compose V2+ (optional, for multi-container setup)

## Quick Start

### 1. Build the Backend Image

```bash
docker build -t evalio-backend:latest .
```

**Build Arguments (optional):**
```bash
docker build \
  --build-arg NODE_ENV=production \
  -t evalio-backend:latest .
```

### 2. Run the Container

```bash
docker run -d \
  --name evalio-backend \
  -p 5000:5000 \
  --env-file .env \
  evalio-backend:latest
```

### 3. Check Health

```bash
curl http://localhost:5000/health
```

## Dockerfile Architecture

### Multi-Stage Build

The Dockerfile uses a **3-stage build** for optimal image size and security:

1. **Dependencies Stage**
   - Installs production dependencies only
   - Uses `npm ci --only=production` for deterministic builds
   - ~200MB layer (cached for faster rebuilds)

2. **Build Stage** (optional)
   - Installs all dependencies including dev dependencies
   - Runs linting, type checking, and tests
   - Discarded in final image

3. **Production Stage**
   - Minimal Alpine Linux base (~50MB)
   - Only production code and dependencies
   - Non-root user for security
   - Health checks configured

### Security Features

✅ **Non-root user** - Runs as `nodejs:nodejs` (UID 1001)  
✅ **Signal handling** - Uses `dumb-init` for proper SIGTERM/SIGINT  
✅ **No secrets** - Environment variables loaded at runtime  
✅ **Minimal surface** - Alpine base with only required packages  
✅ **Read-only filesystem** - Can be mounted read-only (except /tmp)

### Image Size

- **Base:** ~50MB (Node 20 Alpine)
- **Dependencies:** ~200MB
- **Application:** ~10MB
- **Total:** ~260MB

## Environment Variables

The container requires these environment variables:

```bash
# Server
PORT=5000
NODE_ENV=production

# Database
MONGO_URI=mongodb://mongo:27017/evalio

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Authentication
JWT_SECRET=<secure-random-string>

# External Services
CLOUDINARY_URL=cloudinary://key:secret@cloud
GEMINI_API_KEY=<your-api-key>
AI_PROVIDER=gemini

# CORS
CORS_ORIGIN=https://your-frontend-domain.com
```

## Running the Worker

The evaluation worker runs as a separate container:

### Build Worker Image

```bash
docker build -f Dockerfile.worker -t evalio-worker:latest .
```

### Run Worker Container

```bash
docker run -d \
  --name evalio-worker \
  --env-file .env \
  evalio-worker:latest
```

## Container Management

### View Logs

```bash
# Backend logs
docker logs evalio-backend -f

# Worker logs
docker logs evalio-worker -f
```

### Stop Containers

```bash
docker stop evalio-backend evalio-worker
```

### Remove Containers

```bash
docker rm evalio-backend evalio-worker
```

### Restart Containers

```bash
docker restart evalio-backend evalio-worker
```

## Health Checks

The container includes built-in health checks:

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3
```

Check health status:

```bash
docker inspect --format='{{.State.Health.Status}}' evalio-backend
```

## Performance Tuning

### Resource Limits

```bash
docker run -d \
  --name evalio-backend \
  --memory="512m" \
  --cpus="1.0" \
  -p 5000:5000 \
  evalio-backend:latest
```

### Node.js Memory Settings

```bash
docker run -d \
  --name evalio-backend \
  -e NODE_OPTIONS="--max-old-space-size=512" \
  -p 5000:5000 \
  evalio-backend:latest
```

## Production Best Practices

### 1. Use Specific Image Tags

```bash
docker build -t evalio-backend:1.0.0 .
docker tag evalio-backend:1.0.0 evalio-backend:latest
```

### 2. Enable Logging Driver

```bash
docker run -d \
  --log-driver=json-file \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  evalio-backend:latest
```

### 3. Use Secrets Management

```bash
# Using Docker secrets (Swarm mode)
echo "your-jwt-secret" | docker secret create jwt_secret -

docker service create \
  --name evalio-backend \
  --secret jwt_secret \
  -e JWT_SECRET_FILE=/run/secrets/jwt_secret \
  evalio-backend:latest
```

### 4. Enable Auto-Restart

```bash
docker run -d \
  --restart=unless-stopped \
  --name evalio-backend \
  evalio-backend:latest
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker logs evalio-backend

# Inspect container
docker inspect evalio-backend

# Check exit code
docker ps -a | grep evalio-backend
```

### Health Check Failing

```bash
# Execute health check manually
docker exec evalio-backend node -e "require('http').get('http://localhost:5000/health', (r) => {console.log(r.statusCode)})"

# Check if port is accessible
docker exec evalio-backend nc -zv localhost 5000
```

### Database Connection Issues

```bash
# Verify network connectivity
docker exec evalio-backend ping mongo -c 3

# Check environment variables
docker exec evalio-backend env | grep MONGO
```

### High Memory Usage

```bash
# Monitor resource usage
docker stats evalio-backend

# Get Node.js heap snapshot
docker exec evalio-backend node --expose-gc -e "require('v8').writeHeapSnapshot()"
```

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Build Docker image
  run: docker build -t evalio-backend:${{ github.sha }} .

- name: Run tests in container
  run: |
    docker run --rm \
      -e NODE_ENV=test \
      evalio-backend:${{ github.sha }} \
      npm test

- name: Push to registry
  run: |
    docker tag evalio-backend:${{ github.sha }} your-registry/evalio-backend:latest
    docker push your-registry/evalio-backend:latest
```

## Next Steps

After building the Docker images:

1. ✅ Test locally with `docker run`
2. ✅ Set up Docker Compose for multi-container orchestration
3. ✅ Deploy to production (Docker Swarm, Kubernetes, or cloud platform)
4. ✅ Set up monitoring and logging
5. ✅ Configure automated backups

See [docker-compose.yml](../docker-compose.yml) for multi-container setup.
