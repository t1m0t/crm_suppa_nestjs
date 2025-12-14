# Intro

DB is postgres v17
Migration tool is drizzle-kit

# Init DB
1- Create DB and superuser role along with main schema that will hold app tables
```sql
create database crm_suppa;
\c crm_suppa
CREATE ROLE crm_suppa_superuser WITH LOGIN SUPERUSER PASSWORD 'superuser_password';
CREATE SCHEMA IF NOT EXISTS main;
```
2- Create migration user
```sql
CREATE USER migration_user_supp_crm_supp_crm WITH PASSWORD 'your_secure_migration_password';
GRANT ALL PRIVILEGES ON SCHEMA main TO migration_user_supp_crm;
GRANT CREATE ON SCHEMA main TO migration_user_supp_crm;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA main TO migration_user_supp_crm;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA main TO migration_user_supp_crm;
```
3- Create app user
```sql
CREATE USER app_user_supp_crm WITH PASSWORD 'your_secure_app_password';
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA main FROM app_user_supp_crm;
GRANT SELECT, UPDATE, DELETE, INSERT ON ALL TABLES IN SCHEMA main TO app_user_supp_crm;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA map_data.TO app_user_supp_crm;
```

## Apply grants for future created object
```sql
ALTER DEFAULT PRIVILEGES FOR USER migration_user_supp_crm IN SCHEMA main
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user_supp_crm;

ALTER DEFAULT PRIVILEGES FOR USER migration_user_supp_crm IN SCHEMA main
  GRANT USAGE ON SEQUENCES TO app_user_supp_crm;
```
