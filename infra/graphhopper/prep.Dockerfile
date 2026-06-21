# One-shot init container: download the OSM extract and crop it to the bbox.
FROM debian:bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends osmium-tool curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY infra/graphhopper/prep.sh /prep.sh
RUN chmod +x /prep.sh
ENTRYPOINT ["/prep.sh"]
