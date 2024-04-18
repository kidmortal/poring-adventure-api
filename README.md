[![wakatime](https://wakatime.com/badge/user/df445858-58a6-4172-a4be-3b67be4d426e/project/018e8aac-dd22-43ba-8f11-07288bb6fc98.svg)](https://wakatime.com/badge/user/df445858-58a6-4172-a4be-3b67be4d426e/project/018e8aac-dd22-43ba-8f11-07288bb6fc98)

## Poring adventure app service

## running local

you gonna need these envs

these are optional if you wanna use turso to host your database, leave empty and it will create a .db on the build folder

```bash
TURSO_DATABASE_URL=""
TURSO_AUTH_TOKEN=""
```

these are required for the authentication system and validate requests, you can get it on firebase

```bash
TYPE="service_account"
PROJECT_ID=""
PRIVATE_KEY_ID=""
PRIVATE_KEY=""
CLIENT_EMAIL=""
CLIENT_ID=""
CLIENT_CERT_URL=""
UTH_URI="https://accounts.google.com/o/oauth2/auth"
TOKEN_URI="https://oauth2.googleapis.com/token"
AUTH_CERT_URL="https://www.googleapis.com/oauth2/v1/certs"
UNIVERSAL_DOMAIN="googleapis.com"
```

### after all that. just

```bash
docker build -t poring-adventure .

docker run -d -p 8000:8000 poring-adventure
```

### others

how to generate a new migration on tursodb

```bash
npx prisma migrate dev --name init
```

```bash
turso db shell default < ./src/core/prisma/migrations/{migration_folder}/migration.sql
```
