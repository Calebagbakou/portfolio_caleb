# ---------------------------------------------------------------
#  Backend Caleb Creative — API + administration + site statique
#  Build :  docker build -t caleb-api -f server/Dockerfile .
#  Run   :  docker run -p 4000:4000 --env-file server/.env \
#             -v caleb_data:/data -v caleb_uploads:/uploads caleb-api
# ---------------------------------------------------------------
FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PORT=4000 \
    DATABASE_FILE=/data/caleb.db \
    UPLOAD_DIR=/uploads

WORKDIR /app

# Dépendances du backend (better-sqlite3 utilise un binaire précompilé)
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# Code du backend + site statique + administration
COPY server ./server
COPY admin ./admin
COPY assets ./assets
COPY boutique ./boutique
COPY index.html script.js style.css ./

RUN mkdir -p /data /uploads && chown -R node:node /data /uploads /app
USER node

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/src/index.js"]
