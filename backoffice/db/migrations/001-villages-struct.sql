-- migrate:up
--
-- ============================================
-- backoffice_data.district > backoffice_data > village
-- Soft deletes (deleted_at)
-- Timestamps + auto updated_at trigger
-- contact with JSONB address + GIN index
-- Many-to-many: contact <-> village (village_contact)
-- visit table linked to village
-- ============================================

-- --------------------------------------------
-- Trigger function to update updated_at
-- --------------------------------------------
CREATE OR REPLACE FUNCTION backoffice_data.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------
-- backoffice_data.district table
-- --------------------------------------------
CREATE TABLE backoffice_data.district (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

DROP TRIGGER IF EXISTS trg_district_backoffice_data.set_updated_at()
ON backoffice_data.district;

CREATE TRIGGER trg_district_backoffice_data.set_updated_at()
BEFORE UPDATE ON backoffice_data.district
FOR EACH ROW
EXECUTE FUNCTION backoffice_data.set_updated_at(;

-- --------------------------------------------
-- backoffice_data table
-- --------------------------------------------
CREATE TABLE backoffice_data.tahsil (
    id SERIAL PRIMARY KEY,
    id_district INT NOT NULL REFERENCES backoffice_data.district(id),
    name TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,

    UNIQUE (id_district, name)
);

CREATE INDEX IF NOT EXISTS idx_backoffice_data_id_district ON backoffice_data.tahsil(id_district);

DROP TRIGGER IF EXISTS trg_tahsil_backoffice_data.set_updated_at()
ON backoffice_data.tahsil;

CREATE TRIGGER trg_tahsil_backoffice_data.set_updated_at()
BEFORE UPDATE ON backoffice_data.tahsil
FOR EACH ROW
EXECUTE FUNCTION backoffice_data.set_updated_at();

-- --------------------------------------------
-- village table
-- --------------------------------------------
CREATE TABLE backoffice_data.village (
    id SERIAL PRIMARY KEY,
    id_tahsil INT NOT NULL REFERENCES backoffice_data.tahsil(id),
    name TEXT NOT NULL,

    -- FK to map_data.planet_osm_point(osm_id), nullable
    id_map_data_point BIGINT NULL
        REFERENCES map_data.planet_osm_point(osm_id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,

    UNIQUE (id_tahsil, name)
);

CREATE INDEX if not exists idx_village_id_tahsil ON backoffice_data.village(id_tahsil);
CREATE INDEX if not exists idx_village_id_map_data_point ON backoffice_data.village(id_map_data_point);

DROP TRIGGER IF EXISTS trg_village_backoffice_data.set_updated_at()
ON backoffice_data.village;

CREATE TRIGGER trg_village_backoffice_data.set_updated_at()
BEFORE UPDATE ON backoffice_data.village
FOR EACH ROW
EXECUTE FUNCTION backoffice_data.set_updated_at();

-- --------------------------------------------
-- contact table
-- --------------------------------------------
CREATE TABLE backoffice_data.contact (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,

    surname TEXT NULL,
    phone TEXT NULL,
    email TEXT NULL,
    address JSONB NULL,
    date_of_birth DATE NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX if not exists idx_contact_address_gin ON backoffice_data.contact USING GIN (address);

DROP TRIGGER IF EXISTS trg_contact_backoffice_data.set_updated_at()
ON backoffice_data.contact;

CREATE TRIGGER trg_contact_backoffice_data.set_updated_at()
BEFORE UPDATE ON backoffice_data.contact
FOR EACH ROW
EXECUTE FUNCTION backoffice_data.set_updated_at();

-- --------------------------------------------
-- village_contact pivot table
-- --------------------------------------------
CREATE TABLE backoffice_data.village_contact (
    id SERIAL PRIMARY KEY,
    id_village INT NOT NULL REFERENCES backoffice_data.village(id),
    id_contact INT NOT NULL REFERENCES backoffice_data.contact(id),

    is_sirpanch BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,

    UNIQUE (id_village, id_contact)
);

CREATE INDEX if not exists idx_village_contact_village ON backoffice_data.village_contact(id_village);
CREATE INDEX if not exists idx_village_contact_contact ON backoffice_data.village_contact(id_contact);

DROP TRIGGER IF EXISTS trg_village_contact_backoffice_data.set_updated_at()
ON backoffice_data.district;

CREATE TRIGGER trg_village_contact_backoffice_data.set_updated_at()
BEFORE UPDATE ON backoffice_data.village_contact
FOR EACH ROW
EXECUTE FUNCTION backoffice_data.set_updated_at();

-- --------------------------------------------
-- visit table
-- --------------------------------------------
CREATE TABLE backoffice_data.visit (
    id SERIAL PRIMARY KEY,
    id_village INT NOT NULL REFERENCES backoffice_data.village(id),

    planned_on DATE NULL,
    done_on DATE NULL,

    planned_description TEXT NULL,
    visited_report TEXT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX if not exists idx_visit_id_village ON backoffice_data.visit(id_village);

DROP TRIGGER IF EXISTS trg_visit_backoffice_data.set_updated_at()
ON backoffice_data.visit;

CREATE TRIGGER trg_visit_backoffice_data.set_updated_at()
BEFORE UPDATE ON backoffice_data.visit
FOR EACH ROW
EXECUTE FUNCTION backoffice_data.set_updated_at();

