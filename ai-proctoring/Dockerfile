FROM python:3.11-slim

WORKDIR /app

# Install minimal system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --disable-pip-version-check -r requirements.txt \
    && find /usr/local/lib/python3.11/site-packages -name "*.pyc" -delete \
    && find /usr/local/lib/python3.11/site-packages -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true

# Copy AI service
COPY main.py .

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run AI service
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
