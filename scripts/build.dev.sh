git pull
git branch -v
docker compose -f docker-compose.dev.yml build --no-cache
docker compose -f docker-compose.dev.yml up -d
docker exec -it commitflow-api npx prisma db push
docker exec -it commitflow-api npm i
docker exec -it commitflow-ui npm i