how to generate a new migration on tursodb

```bash
npx prisma migrate dev --name init
```

```bash
turso db shell default < ./src/prisma/migrations/{migration_folder}/migration.sql
```
