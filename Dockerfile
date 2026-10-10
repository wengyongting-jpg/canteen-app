FROM node:22-alpine

# alpine 下若无 prebuilt 则本地编译 better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

EXPOSE 3000
CMD ["npm", "start"]
