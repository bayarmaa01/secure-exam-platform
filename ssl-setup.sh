#!/bin/bash

# SSL Setup for Secure Exam Platform
# Uses Let's Encrypt for free SSL certificates

set -e

DOMAIN="secure-exam.duckdns.org"
EMAIL="admin@${DOMAIN}"
SSL_DIR="./nginx/ssl"

echo "🔒 Setting up SSL for ${DOMAIN}..."

# Install Certbot if not present
if ! command -v certbot &> /dev/null; then
    echo "📦 Installing Certbot..."
    sudo apt-get update
    sudo apt-get install -y certbot python3-certbot-nginx
fi

# Create SSL directory if not exists
mkdir -p ${SSL_DIR}

# Obtain SSL certificate
echo "📜 Obtaining SSL certificate for ${DOMAIN}..."
sudo certbot certonly \
    --standalone \
    --preferred-challenges http-01 \
    --email ${EMAIL} \
    --agree-tos \
    --no-eff-email \
    -d ${DOMAIN} \
    --cert-name ${DOMAIN}

# Copy certificates to nginx directory
echo "📋 Copying certificates to nginx..."
sudo cp /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ${SSL_DIR}/cert.pem
sudo cp /etc/letsencrypt/live/${DOMAIN}/privkey.pem ${SSL_DIR}/key.pem
sudo chown -R $(whoami):$(whoami) ${SSL_DIR}

# Setup auto-renewal
echo "⏰ Setting up auto-renewal..."
(crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet && docker-compose restart nginx") | crontab -

echo "✅ SSL setup complete!"
echo "📝 Certificate location: ${SSL_DIR}"
echo "🔄 Auto-renewal: Daily at 12:00 PM"
echo ""
echo "🌐 Next steps:"
echo "1. Update DuckDNS A record to point to your server IP"
echo "2. Run: docker-compose down -v && docker-compose up -d --build"
echo "3. Test: https://${DOMAIN}"
