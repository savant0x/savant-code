FROM oven/bun:1.3.14-debian

USER root
WORKDIR /app

RUN apt-get update \
  && apt-get install --no-install-recommends --yes \
    build-essential \
    ca-certificates \
    git \
    libfontconfig1-dev \
    libgif-dev \
    libjpeg-dev \
    libpango1.0-dev \
    librsvg2-dev \
    libsqlite3-dev \
    pkg-config \
    python3 \
  && rm -rf /var/lib/apt/lists/*

COPY . .

# The install lifecycle configures repository hooks. A clean Docker build
# context intentionally excludes the host .git directory, so provide the
# minimal local repository metadata needed by that lifecycle step.
RUN git init . \
  && bun install --frozen-lockfile \
  && bun run ci \
  && chown -R bun:bun /app

USER bun

CMD ["bun", "run", "dev"]
