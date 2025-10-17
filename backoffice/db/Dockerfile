FROM postgres:17

RUN apt-get update \
    && apt-get install -y postgresql-17-postgis-3 \
    && rm -rf /var/lib/apt/lists/*

# Optional: Auto-enable PostGIS on database creation
COPY ./init-postgis.sh /docker-entrypoint-initdb.d/
