# Production-ready Dockerfile for React frontend
FROM node:20 AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ENV NODE_OPTIONS=--openssl-legacy-provider
RUN npm run build   # builds optimized static files into /app/build

# NGINX stage to serve frontend
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
