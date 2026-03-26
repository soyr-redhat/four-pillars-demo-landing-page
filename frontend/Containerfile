FROM registry.access.redhat.com/ubi9/nginx-124:latest

# Copy the HTML file
COPY index.html /opt/app-root/src/

# Expose port 8080
EXPOSE 8080

# Run nginx
CMD ["nginx", "-g", "daemon off;"]
