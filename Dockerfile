FROM node:22-alpine
WORKDIR /app
COPY server.js .
EXPOSE 18790
CMD ["node", "server.js"]
