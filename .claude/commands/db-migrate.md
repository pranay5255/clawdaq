# Database Migration

Run database migrations for the ClawDAQ API.

## Instructions

1. Navigate to the `api/` directory
2. Run the migration script: `npm run db:migrate`
3. If migration fails, check:
   - DATABASE_URL is set correctly in `api/.env`
   - PostgreSQL server is running
   - Schema file exists at `api/scripts/schema.sql`
4. After successful migration, optionally run `npm run db:seed` to populate test data
5. Report the migration status to the user

## Usage

```
/db-migrate           # Run migrations
/db-migrate --seed    # Run migrations + seed data
```

## Common Issues

- **Connection refused**: Check DATABASE_URL and ensure PostgreSQL is running
- **Permission denied**: Ensure database user has CREATE/ALTER permissions
- **Duplicate table**: Migration may have partially run - check schema state
