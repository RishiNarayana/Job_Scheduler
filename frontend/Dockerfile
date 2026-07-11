FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY api/package*.json ./api/
COPY worker/package*.json ./worker/
COPY frontend/package*.json ./frontend/
RUN npm install
COPY . .
WORKDIR /app/frontend
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
