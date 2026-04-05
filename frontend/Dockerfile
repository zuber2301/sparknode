# Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies with cache mount for faster builds
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production=false --no-audit --no-fund

# Copy source code
COPY . .

# Set environment variable for production build
ENV NODE_ENV=production
ENV VITE_API_URL=https://app.sparknode.io

# Build the application with cache mount
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=cache,target=/app/node_modules/.vite \
    npm run build

# Production stage - serve with nginx
FROM nginx:alpine AS production

# Install security updates
RUN apk add --no-cache \
    curl \
    && rm -rf /var/cache/apk/*

# Create nginx user and directories with proper permissions
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 && \
    mkdir -p /var/cache/nginx /var/log/nginx /var/run && \
    chown -R nextjs:nodejs /var/cache/nginx /var/log/nginx /var/run /etc/nginx

# Copy built app to nginx
COPY --from=builder --chown=nextjs:nodejs /app/dist /usr/share/nginx/html

# Copy nginx config
COPY --chown=nextjs:nodejs nginx.conf /etc/nginx/conf.d/default.conf


# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
