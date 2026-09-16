FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY plk-stations-all.json ./
COPY pl-rail-network.json ./
COPY rail-router.js ./
COPY server.js ./
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]
