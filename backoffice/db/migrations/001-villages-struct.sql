-- migrate:up
--
-- ============================================
-- district > tahsil > village
-- Soft deletes (deleted_at)
-- Timestamps + auto updated_at trigger
-- contact with JSONB address + GIN index
-- Many-to-many: contact <-> village (village_contact)
-- visit table linked to village
-- Village now references map_data.planet_osm_point(osm_id)
-- ============================================

-- --------------------------------------------
-- Trigger function to update updated_at
-- --------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------
-- district table
-- --------------------------------------------
CREATE TABLE district (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TRIGGER trg_district_set_updated_at
BEFORE UPDATE ON district
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- --------------------------------------------
-- tahsil table
-- --------------------------------------------
CREATE TABLE tahsil (
    id SERIAL PRIMARY KEY,
    id_district INT NOT NULL REFERENCES district(id),
    name TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,

    UNIQUE (id_district, name)
);

CREATE INDEX idx_tahsil_id_district ON tahsil(id_district);

CREATE TRIGGER trg_tahsil_set_updated_at
BEFORE UPDATE ON tahsil
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- --------------------------------------------
-- village table
-- --------------------------------------------
CREATE TABLE village (
    id SERIAL PRIMARY KEY,
    id_tahsil INT NOT NULL REFERENCES tahsil(id),
    name TEXT NOT NULL,

    -- FK to map_data.planet_osm_point(osm_id), nullable
    id_map_data_point BIGINT NULL
        REFERENCES map_data.planet_osm_point(osm_id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,

    UNIQUE (id_tahsil, name)
);

CREATE INDEX idx_village_id_tahsil ON village(id_tahsil);
CREATE INDEX idx_village_id_map_data_point ON village(id_map_data_point);

CREATE TRIGGER trg_village_set_updated_at
BEFORE UPDATE ON village
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- --------------------------------------------
-- contact table
-- --------------------------------------------
CREATE TABLE contact (
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

CREATE INDEX idx_contact_address_gin ON contact USING GIN (address);

CREATE TRIGGER trg_contact_set_updated_at
BEFORE UPDATE ON contact
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- --------------------------------------------
-- village_contact pivot table
-- --------------------------------------------
CREATE TABLE village_contact (
    id SERIAL PRIMARY KEY,
    id_village INT NOT NULL REFERENCES village(id),
    id_contact INT NOT NULL REFERENCES contact(id),

    is_sirpanch BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,

    UNIQUE (id_village, id_contact)
);

CREATE INDEX idx_village_contact_village ON village_contact(id_village);
CREATE INDEX idx_village_contact_contact ON village_contact(id_contact);

CREATE TRIGGER trg_village_contact_set_updated_at
BEFORE UPDATE ON village_contact
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- --------------------------------------------
-- visit table
-- --------------------------------------------
CREATE TABLE visit (
    id SERIAL PRIMARY KEY,
    id_village INT NOT NULL REFERENCES village(id),

    planned_on DATE NULL,
    done_on DATE NULL,

    planned_description TEXT NULL,
    visited_report TEXT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX idx_visit_id_village ON visit(id_village);

CREATE TRIGGER trg_visit_set_updated_at
BEFORE UPDATE ON visit
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();



