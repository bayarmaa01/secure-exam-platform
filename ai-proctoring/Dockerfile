# FREE AI PROCTORING SERVICE
# No OpenAI API required - uses local OpenCV models

FROM python:3.11-slim

WORKDIR /app

# Install minimal system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy free requirements
COPY requirements-free.txt .
RUN pip install --no-cache-dir -r requirements-free.txt

# Copy free AI application
COPY main-free.py .
COPY .env.free.example .env

# Create models directory for optional DNN models
RUN mkdir -p models

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Run free AI service
CMD ["uvicorn", "main-free:app", "--host", "0.0.0.0", "--port", "5000"]
