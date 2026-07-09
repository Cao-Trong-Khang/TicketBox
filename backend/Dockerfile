FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm install

COPY . .

EXPOSE 3000

CMD ["sh", "-c", "npm run build && npm run start"]
