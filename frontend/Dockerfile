FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY frontend/package.json frontend/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm install

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build --workspace @handtalk-challenge/frontend

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/frontend/.next ./frontend/.next
COPY --from=build /app/frontend/public ./frontend/public
COPY --from=build /app/frontend/package.json ./frontend/package.json
COPY --from=build /app/frontend/next.config.ts ./frontend/next.config.ts
COPY --from=build /app/frontend/next-env.d.ts ./frontend/next-env.d.ts
COPY --from=build /app/frontend/tsconfig.json ./frontend/tsconfig.json
CMD ["npm", "run", "start", "--workspace", "@handtalk-challenge/frontend"]

