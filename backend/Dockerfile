FROM node:20-slim

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --include=dev

COPY . .

RUN npx prisma generate

EXPOSE 4004

CMD ["sh", "-c", "node node_modules/prisma/build/index.js db push && node server.js"]
