FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy python requirements
COPY requirements.txt requirements-ai.txt* ./

# Install core runtime dependencies
RUN pip install --no-cache-dir --default-timeout=1000 -r requirements.txt

# Conditionally install heavy AI dependencies if INSTALL_AI is set to true
ARG INSTALL_AI=false
RUN if [ "$INSTALL_AI" = "true" ] ; then \
    pip install --no-cache-dir --default-timeout=1000 -r requirements-ai.txt ; \
    fi

# Copy backend files
COPY . .

# Expose port (metadata)
EXPOSE 8000

# Run uvicorn using shell form to resolve the dynamic PORT environment variable (Render compatibility)
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
