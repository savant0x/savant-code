FROM node:22.20.0-bookworm-slim@sha256:b21fe589dfbe5cc39365d0544b9be3f1f33f55f3c86c87a76ff65a02f8f5848e AS node-tools

FROM oven/bun:1.3.14-debian@sha256:9dba1a1b43ce28c9d7931bfc4eb00feb63b0114720a0277a8f939ae4dfc9db6f

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
    tini \
  && rm -rf /var/lib/apt/lists/*

# Release-wrapper tests exercise a real npm-pack boundary.
COPY --from=node-tools /usr/local/ /usr/local/
COPY . .

# The install lifecycle configures repository hooks. A clean Docker build
# context intentionally excludes the host .git directory, so provide the
# minimal local repository metadata needed by that lifecycle step.
RUN git init . \
  && bun install --frozen-lockfile \
  && bun run ci \
  && chown -R bun:bun /app

USER bun

ENV NEXT_PUBLIC_CB_ENVIRONMENT=dev \
    NEXT_PUBLIC_SAVANT_CODE_APP_URL=http://localhost:3000 \
    NEXT_PUBLIC_WEB_PORT=3000

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["bun", "run", "dev"]
