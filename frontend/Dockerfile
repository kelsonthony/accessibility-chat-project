FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY frontend/package.json frontend/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm install

FROM node:24-alpine AS build
WORKDIR /app
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build --workspace @handtalk-challenge/frontend

FROM node:24-alpine AS runner
WORKDIR /app/frontend
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ../node_modules
COPY --from=build /app/frontend/.next ./.next
COPY --from=build /app/frontend/public ./public
COPY --from=build /app/frontend/package.json ./package.json
COPY --from=build /app/frontend/next.config.ts ./next.config.ts
COPY --from=build /app/frontend/next-env.d.ts ./next-env.d.ts
COPY --from=build /app/frontend/tsconfig.json ./tsconfig.json
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0", "--port", "3000"]
