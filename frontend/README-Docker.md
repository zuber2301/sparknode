# Frontend Docker Build Optimization

## Overview
This document outlines the optimized Docker build process for the SparkNode frontend application.

## Key Improvements

### 1. Layer Caching
- **Package installation**: Uses `--mount=type=cache` for npm cache
- **Build cache**: Vite cache is mounted to speed up rebuilds
- **Multi-stage builds**: Separate builder and production stages

### 2. Build Optimization
- **Source filtering**: `.dockerignore` excludes unnecessary files
- **Dependency optimization**: Explicit include lists in `vite.config.js`
- **Chunk splitting**: Manual chunks for better caching
- **Minification**: Terser with console/debugger removal

### 3. Security
- **Non-root user**: Nginx runs as `nextjs` user
- **Security headers**: Comprehensive CSP and security headers
- **Health checks**: Proper health check endpoints

### 4. Caching Strategy
- **Static assets**: Long-term caching (1 year) for hashed assets
- **HTML**: No-cache for index.html to ensure fresh builds
- **API responses**: No-cache for dynamic content

## Build Commands

### Production Build
```bash
# Standard production build
docker-compose build frontend
docker-compose up -d frontend

# Force rebuild (bypass cache)
docker-compose build --no-cache frontend
```

### Development Build
```bash
# Hot reloading development server
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up frontend

# Or use the convenience script
npm run docker:dev
```

## Cache Management

### Clear Build Cache
```bash
# Clear Docker build cache
docker builder prune -f

# Clear npm cache
docker-compose exec frontend npm cache clean --force

# Clear Vite cache
docker-compose exec frontend rm -rf node_modules/.vite
```

### Optimize for Development
```bash
# Use development override for hot reloading
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# This mounts source files and runs Vite dev server
```

## Troubleshooting

### Build Issues
1. **Slow builds**: Check if cache mounts are working
2. **Cache not used**: Ensure `.dockerignore` isn't excluding necessary files
3. **Dependencies issues**: Clear npm cache and rebuild

### Runtime Issues
1. **Changes not reflected**: Check if using production vs development build
2. **API connection**: Verify `VITE_API_URL` environment variable
3. **Caching problems**: Hard refresh browser or clear browser cache

## Environment Variables

### Production
- `VITE_API_URL=https://app.sparknode.io` (overridden by nginx sub_filter)

### Development
- `VITE_API_URL=http://localhost:7100`
- `NODE_ENV=development`

## File Structure
```
frontend/
├── Dockerfile          # Production build
├── Dockerfile.dev      # Development build
├── .dockerignore       # Exclude files from build context
├── nginx.conf          # Production nginx config
├── vite.config.js      # Vite configuration with optimizations
└── package.json        # Updated scripts
```