FROM node:22-alpine
WORKDIR /app
COPY server.js icon.svg apple-touch-icon.png ./
USER node
EXPOSE 18790
CMD ["node", "server.js"]
