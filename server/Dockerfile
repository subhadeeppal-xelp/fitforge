FROM node:22-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
ENV NODE_ENV=production
EXPOSE 4000
CMD ["sh", "-c", "node src/migrate.js && node src/index.js"]
