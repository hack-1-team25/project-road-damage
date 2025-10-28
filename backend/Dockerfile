FROM python:3.11-slim

# Install system dependencies including ffmpeg for video processing
RUN apt-get update && apt-get install -y \
    postgresql-client \
    libpq-dev \
    gcc \
    ffmpeg \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create storage directories
RUN mkdir -p /app/storage/videos \
    /app/storage/gps \
    /app/storage/frames \
    /app/storage/processed

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
