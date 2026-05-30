# Dockerfile untuk Desa Kalemago Backend

FROM node:20-alpine

WORKDIR /app

# Copy package files dulu (untuk caching layer)
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy seluruh source code
COPY . .

# Expose port (Fly.io akan map ke 8080)
EXPOSE 8080

# Jalankan aplikasi
CMD ["node", "server.js"]
