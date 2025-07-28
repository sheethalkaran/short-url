FROM nginx:alpine

# Ensure proper permissions for nginx directories
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    mkdir -p /var/run/nginx && \
    chown -R nginx:nginx /var/run/nginx

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy the frontend files
COPY . /usr/share/nginx/html


# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]