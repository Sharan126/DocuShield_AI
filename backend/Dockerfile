FROM python:3.11-slim

WORKDIR /app

# Set Python environment variables for optimization and Docker compatibility
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy Python requirements
COPY requirements.txt requirements-ai.txt* ./

# Install core runtime dependencies
RUN pip install --default-timeout=1000 -r requirements.txt

# Conditionally install heavy AI dependencies if INSTALL_AI is set to true
ARG INSTALL_AI=false
RUN if [ "$INSTALL_AI" = "true" ] ; then \
        pip install --default-timeout=1000 -r requirements-ai.txt ; \
    fi

# Copy backend files
COPY . .

# Expose port (metadata)
EXPOSE 8000

# Run uvicorn via sh -c to resolve the dynamic PORT environment variable (Render compatibility)
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
