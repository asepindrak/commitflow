git pull
git branch -v
docker compose -f docker-compose.dev.yml build frontend --no-cache
docker compose -f docker-compose.dev.yml up -d
docker exec -it commitflow-ui npm i