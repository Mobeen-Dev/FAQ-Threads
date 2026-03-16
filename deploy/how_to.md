sudo docker compose --env-file deploy/.env.production -f deploy/docker-compose.deploy.yml up -d --build

 
● Perfect — next steps:

   1. Verify containers:

   sudo docker compose --env-file deploy/.env.production -f deploy/docker-compose.deploy.yml ps

   1. Check health:

   curl http://localhost:4004/health
   curl http://localhost:3004/login
