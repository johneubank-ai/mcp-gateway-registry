# Troubleshooting Guide

This guide covers common issues and solutions for the MCP Gateway & Registry.

## Quick Diagnostics

### Health Check Commands

```bash
# Check all services status
docker-compose ps

# Check specific service logs
docker-compose logs -f registry
docker-compose logs -f auth-server
docker-compose logs -f nginx

# Test registry endpoint
curl -I http://localhost:7860/health

# Test gateway endpoints
curl -I http://localhost:8080/currenttime/health
```

## Common Issues

### 1. "Cannot connect to registry at localhost:7860"

**Symptoms:**
- Browser shows "This site can't be reached"
- Connection refused errors

**Diagnosis:**
```bash
# Check if registry service is running
docker-compose ps registry

# Check if port is bound
netstat -tulpn | grep :7860

# Check registry logs
docker-compose logs registry
```

**Solutions:**
1. **Service not running:**
   ```bash
   docker-compose up -d registry
   ```

2. **Port conflict:**
   ```bash
   # Find what's using the port
   lsof -i :7860
   # Kill the process or change port in docker-compose.yml
   ```

3. **Container build issues:**
   ```bash
   docker-compose build --no-cache registry
   docker-compose up -d registry
   ```

### 2. "Authentication failed" or "Access denied"

**Symptoms:**
- Login page shows "Invalid credentials"
- 403 Forbidden errors
- Cognito authentication redirects fail

**Diagnosis:**
```bash
# Check auth server logs
docker-compose logs auth-server

# Verify environment variables
docker-compose exec auth-server env | grep COGNITO

# Test auth server endpoint
curl -I http://localhost:8090/health
```

**Solutions:**

#### For Basic Auth (Development):
1. **Check credentials in .env file:**
   ```bash
   grep -E "ADMIN_USER|ADMIN_PASSWORD" .env
   ```

2. **Reset admin password:**
   ```bash
   # Edit .env file
   ADMIN_PASSWORD=new-secure-password
   # Restart auth server
   docker-compose restart auth-server
   ```

#### For Cognito Auth (Production):
1. **Verify Cognito configuration:**
   ```bash
   # Check all required variables are set
   grep -E "COGNITO_" .env
   ```

2. **Test Cognito connectivity:**
   ```bash
   # From inside auth-server container
   docker-compose exec auth-server python -c "
   import boto3
   import os
   client = boto3.client('cognito-idp', region_name=os.getenv('AWS_REGION'))
   print('Cognito connection successful')
   "
   ```

3. **Check user group membership:**
   - Verify user exists in Cognito User Pool
   - Confirm user is in correct group (e.g., `mcp-registry-admin`)
   - Check group mappings in `auth_server/scopes.yml`

### 3. "MCP server not responding" or "Server health check failed"

**Symptoms:**
- MCP servers show "Unhealthy" status in registry
- Tool discovery returns empty results
- Agent connections fail

**Diagnosis:**
```bash
# Check MCP server status
docker-compose ps currenttime fininfo realserverfaketools

# Test MCP server endpoints directly
curl -I http://localhost:8000/health  # currenttime
curl -I http://localhost:8001/health  # fininfo
curl -I http://localhost:8002/health  # realserverfaketools

# Check MCP server logs
docker-compose logs currenttime
```

**Solutions:**

1. **Restart unhealthy servers:**
   ```bash
   docker-compose restart currenttime fininfo realserverfaketools
   ```

2. **Check server configuration:**
   ```bash
   # Verify server registration in registry
   curl http://localhost:7860/api/servers
   ```

3. **Network connectivity issues:**
   ```bash
   # Test internal Docker network
   docker-compose exec nginx ping currenttime
   docker-compose exec nginx ping fininfo
   ```

4. **Port conflicts:**
   ```bash
   # Check if ports are available
   netstat -tulpn | grep -E ":8000|:8001|:8002"
   ```

### 4. "SSL/HTTPS certificate errors"

**Symptoms:**
- "Your connection is not private" browser warnings
- SSL certificate validation errors
- HTTPS endpoints not accessible

**Diagnosis:**
```bash
# Check SSL certificate files
ls -la /home/ubuntu/ssl_data/certs/
ls -la /home/ubuntu/ssl_data/private/

# Test SSL configuration
openssl s_client -connect your-domain.com:443 -servername your-domain.com
```

**Solutions:**

1. **For development (HTTP only):**
   ```bash
   # Use HTTP endpoints instead
   # Registry: http://localhost:7860
   # Gateway: http://localhost:8080
   ```

2. **For production SSL issues:**
   ```bash
   # Verify certificate files exist and are readable
   sudo chmod 644 /home/ubuntu/ssl_data/certs/*
   sudo chmod 600 /home/ubuntu/ssl_data/private/*
   
   # Restart nginx to reload certificates
   docker-compose restart nginx
   ```

3. **Self-signed certificate for testing:**
   ```bash
   # Generate self-signed certificate
   sudo mkdir -p /home/ubuntu/ssl_data/{certs,private}
   sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
     -keyout /home/ubuntu/ssl_data/private/server.key \
     -out /home/ubuntu/ssl_data/certs/server.crt \
     -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
   ```

### 5. "Docker build failures" or "Image not found"

**Symptoms:**
- `docker-compose build` fails
- "No such image" errors
- Build context errors

**Diagnosis:**
```bash
# Check Docker daemon status
docker info

# Check available disk space
df -h

# Check Docker images
docker images | grep mcp
```

**Solutions:**

1. **Clean Docker cache:**
   ```bash
   docker system prune -a
   docker-compose build --no-cache
   ```

2. **Check Dockerfile syntax:**
   ```bash
   # Validate individual Dockerfiles
   docker build -t test-build ./registry/
   docker build -t test-build ./auth_server/
   ```

3. **Memory/disk space issues:**
   ```bash
   # Free up space
   docker system prune -a --volumes
   
   # Check available memory
   free -h
   ```

## Performance Issues

### 1. "Slow response times"

**Diagnosis:**
```bash
# Check system resources
htop
docker stats

# Test response times
time curl http://localhost:7860/api/servers
```

**Solutions:**
1. **Increase container resources:**
   ```yaml
   # In docker-compose.yml
   services:
     registry:
       deploy:
         resources:
           limits:
             memory: 2G
             cpus: '1.0'
   ```

2. **Optimize database queries:**
   - Check registry logs for slow queries
   - Consider adding database indexes

### 2. "High memory usage"

**Diagnosis:**
```bash
# Check container memory usage
docker stats --no-stream

# Check system memory
free -h
```

**Solutions:**
1. **Restart memory-heavy containers:**
   ```bash
   docker-compose restart registry
   ```

2. **Adjust container limits:**
   ```yaml
   # In docker-compose.yml
   services:
     registry:
       mem_limit: 1g
   ```

## Getting Help

### Enable Debug Logging

```bash
# Add to .env file
LOG_LEVEL=DEBUG

# Restart services
docker-compose restart
```

### Collect Diagnostic Information

```bash
# Create diagnostic report
cat > diagnostic-report.txt << EOF
=== System Information ===
$(uname -a)
$(docker --version)
$(docker-compose --version)

=== Service Status ===
$(docker-compose ps)

=== Recent Logs ===
$(docker-compose logs --tail=50)

=== Environment Variables ===
$(grep -v "SECRET\|PASSWORD" .env)

=== Network Status ===
$(netstat -tulpn | grep -E ":7860|:8080|:8090")
EOF

echo "Diagnostic report saved to diagnostic-report.txt"
```

### Contact Support

When reporting issues, please include:

1. **Environment details:**
   - Operating system and version
   - Docker and Docker Compose versions
   - Deployment method (local/EC2/EKS)

2. **Error information:**
   - Complete error messages
   - Relevant log entries
   - Steps to reproduce

3. **Configuration:**
   - Sanitized environment variables (remove secrets)
   - Custom configuration files
   - Network setup details

For additional help:
- Check the [GitHub Issues](https://github.com/agentic-community/mcp-gateway-registry/issues)
- Review the [documentation](../README.md)
- Join the community discussions