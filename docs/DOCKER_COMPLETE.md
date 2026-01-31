# ============================================
# Complete Dockerized Deployment Guide
# ============================================

## 🚀 One-Command Deployment

The entire Evalio stack (Frontend + Backend + Worker + Database + Cache) runs with a single command!

### Prerequisites

- Docker Desktop running
- 8GB RAM minimum
- Ports available: 3000 (Frontend), 5000 (Backend), 27017 (MongoDB), 6379 (Redis)

---

## 📦 Quick Start

### 1. Configure Environment

```bash
cp .env.docker .env
```

Edit `.env` and set your credentials (minimum required):
```env
JWT_SECRET=your-secret-at-least-32-characters-long
GEMINI_API_KEY=your-gemini-api-key
CLOUDINARY_URL=cloudinary://key:secret@cloud
```

### 2. Build All Images

```bash
# Build backend API
docker build -t evalio-backend:latest .

# Build background worker
docker build -f Dockerfile.worker -t evalio-worker:latest .

# Build frontend
cd frontend
docker build -t evalio-frontend:latest .
cd ..
```

### 3. Start Everything

```bash
docker-compose up -d
```

### 4. Access the Application

- **Frontend (React):** http://localhost:3000
- **Backend API:** http://localhost:5000
- **API Health:** http://localhost:5000/health

---

## 🎯 What Gets Deployed

### 5 Services in Private Network:

1. **evalio-frontend** (Port 3000)
   - React application with Nginx
   - Production-optimized build
   - Gzip compression enabled
   - 43MB image size

2. **evalio-backend** (Port 5000)
   - Node.js Express API server
   - JWT authentication
   - REST endpoints
   - 333MB image size

3. **evalio-worker**
   - Background job processor
   - Python ML evaluation engine
   - Redis queue consumer
   - 1.58GB image size

4. **evalio-mongodb** (Port 27017)
   - MongoDB 7.0 database
   - Persistent volume storage
   - Authentication enabled

5. **evalio-redis** (Port 6379)
   - Redis 7 cache & queue
   - AOF persistence
   - Password protected

---

## 📊 Service Health Checks

All services include health monitoring:

```bash
# Check all services
docker-compose ps

# Expected output:
# NAME              STATUS
# evalio-frontend   Up (healthy)
# evalio-backend    Up (healthy)
# evalio-worker     Up
# evalio-mongodb    Up (healthy)
# evalio-redis      Up (healthy)
```

### Verify Services

```bash
# Frontend health
curl http://localhost:3000/health
# → OK

# Backend health
curl http://localhost:5000/health
# → {"status":"ok"}

# View logs
docker-compose logs -f
```

---

## 🔧 Management Commands

### Start/Stop

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Stop and remove volumes (⚠️ deletes data)
docker-compose down -v

# Restart specific service
docker-compose restart backend
docker-compose restart frontend
```

### Logs

```bash
# All logs
docker-compose logs -f

# Specific service
docker-compose logs -f frontend
docker-compose logs -f backend
docker-compose logs -f worker

# Last 50 lines
docker-compose logs --tail=50 backend
```

### Updates

```bash
# Rebuild after code changes
docker-compose down
docker build -t evalio-backend:latest .
docker build -t evalio-frontend:latest ./frontend
docker-compose up -d

# Or rebuild specific service
docker-compose up -d --build frontend
```

### Debugging

```bash
# Shell into container
docker exec -it evalio-frontend sh
docker exec -it evalio-backend sh

# MongoDB shell
docker exec -it evalio-mongodb mongosh -u admin -p <password>

# Redis CLI
docker exec -it evalio-redis redis-cli -a <password>

# View resource usage
docker stats
```

---

## 🌐 Network Architecture

All services communicate through private `evalio-network`:

```
┌─────────────────────────────────────────────────────┐
│                  evalio-network                     │
│  (Bridge Network - Internal DNS Resolution)         │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐       │
│  │ frontend │→ │ backend  │→ │  mongodb   │       │
│  │ :3000    │  │ :5000    │  │  :27017    │       │
│  └──────────┘  └──────────┘  └────────────┘       │
│                      ↓                              │
│                 ┌────────┐    ┌──────────┐         │
│                 │ worker │ ←→ │  redis   │         │
│                 └────────┘    │  :6379   │         │
│                                └──────────┘         │
└─────────────────────────────────────────────────────┘

Only frontend and backend ports exposed to host
Internal services communicate via service names
```

---

## 💾 Persistent Data

Data is stored in named Docker volumes:

```bash
# List volumes
docker volume ls | grep evalio

# Backup volumes
docker run --rm -v evalio-mongodb-data:/data -v $(pwd):/backup alpine tar czf /backup/mongodb-backup.tar.gz /data

# Restore volumes
docker run --rm -v evalio-mongodb-data:/data -v $(pwd):/backup alpine tar xzf /backup/mongodb-backup.tar.gz -C /
```

---

## 🔒 Security Features

- **Non-root containers:** All services run as non-root users
- **Private network:** Internal services not exposed to host
- **Environment-driven:** No hardcoded secrets
- **Alpine Linux:** Minimal attack surface
- **Health checks:** Automatic restart on failure
- **Password protection:** MongoDB and Redis require auth

---

## 🚨 Troubleshooting

### Frontend won't start - Port 3000 in use

```bash
# Windows
netstat -ano | findstr :3000
Stop-Process -Id <PID> -Force

# Linux/Mac
lsof -ti:3000 | xargs kill -9

# Or use different port
# In .env: FRONTEND_PORT=3001
```

### Backend won't start - JWT_SECRET too short

```bash
# Generate proper secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Update .env
JWT_SECRET=<generated-secret>
```

### Worker failing - MongoDB authentication

```bash
# Clear volumes and restart
docker-compose down -v
docker-compose up -d
```

### Images not found

```bash
# Rebuild all images
docker build -t evalio-backend:latest .
docker build -f Dockerfile.worker -t evalio-worker:latest .
docker build -t evalio-frontend:latest ./frontend
```

### Out of memory

```bash
# Increase Docker memory limit in Docker Desktop
# Settings → Resources → Memory: 8GB minimum
```

---

## 📈 Performance

### Resource Usage (Idle)

| Service   | Memory | CPU  | Disk  |
|-----------|--------|------|-------|
| Frontend  | 10MB   | <1%  | 43MB  |
| Backend   | 100MB  | <1%  | 333MB |
| Worker    | 300MB  | <1%  | 1.6GB |
| MongoDB   | 150MB  | <1%  | 1GB   |
| Redis     | 10MB   | <1%  | 50MB  |
| **Total** | ~570MB | <5%  | ~3GB  |

### Startup Times

- MongoDB: ~8 seconds
- Redis: ~8 seconds
- Backend: ~15 seconds (waits for DB)
- Worker: ~20 seconds (waits for DB + Redis)
- Frontend: ~5 seconds

---

## 🎓 Development Workflow

### Local Development with Docker

```bash
# Start only infrastructure (DB + Redis)
docker-compose up -d mongodb redis

# Run backend locally
npm install
npm run dev

# Run frontend locally
cd frontend
npm install
npm start

# Run tests
npm test
```

### Hot Reload (Development)

For development with hot reload, mount source code:

```yaml
# docker-compose.override.yml
services:
  backend:
    volumes:
      - ./src:/app/src
    command: npm run dev
```

---

## 🌍 Production Deployment

### Cloud Platforms

**AWS ECS:**
```bash
# Push images to ECR
docker tag evalio-frontend:latest <aws-account>.dkr.ecr.us-east-1.amazonaws.com/evalio-frontend:latest
docker push <aws-account>.dkr.ecr.us-east-1.amazonaws.com/evalio-frontend:latest

# Create ECS task definitions using docker-compose.yml
```

**Google Cloud Run:**
```bash
# Push to GCR
docker tag evalio-frontend:latest gcr.io/<project-id>/evalio-frontend:latest
docker push gcr.io/<project-id>/evalio-frontend:latest

# Deploy
gcloud run deploy evalio-frontend --image gcr.io/<project-id>/evalio-frontend:latest
```

**Kubernetes:**
```bash
# Generate k8s manifests
kompose convert -f docker-compose.yml

# Deploy
kubectl apply -f .
```

---

## ✅ Verification Checklist

After `docker-compose up -d`:

- [ ] All 5 containers running: `docker-compose ps`
- [ ] Frontend accessible: http://localhost:3000
- [ ] Backend healthy: `curl http://localhost:5000/health`
- [ ] Frontend healthy: `curl http://localhost:3000/health`
- [ ] Worker connected: `docker-compose logs worker | grep "ready"`
- [ ] No errors in logs: `docker-compose logs --tail=50`
- [ ] Can access databases from containers
- [ ] Volumes persist after restart

---

## 🎉 Success!

If all services are healthy, you now have a complete production-ready application running!

**What you can do:**
1. Open http://localhost:3000
2. Sign up as teacher/student
3. Create exams (teacher)
4. Submit answers (student)
5. AI evaluates submissions
6. Teacher reviews and overrides

**Stack Running:**
- ✅ React Frontend (Production Build)
- ✅ Node.js Backend (API Server)
- ✅ Python ML Worker (Evaluation Engine)
- ✅ MongoDB (Database)
- ✅ Redis (Queue & Cache)

All in containers, all with one command! 🚀
