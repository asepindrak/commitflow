git pull
git branch -v
docker compose -f docker-compose.dev.yml build backend --no-cache
docker compose -f docker-compose.dev.yml up -d
docker exec -it commitflow-api npm i