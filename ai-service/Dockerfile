FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 7000
ENV AI_SERVICE_SECRET=ai-secret-key
CMD ["python", "app.py"]
