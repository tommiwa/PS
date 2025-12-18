-- ============================================
-- BCI ParkShare Production Data Population Script
-- Generated: 2025-12-18T00:58:01.520Z
-- ============================================

-- IMPORTANT: Review this script before running!
-- This will insert data into your production database.

-- ============================================
-- 1. SPOT TYPES
-- ============================================

INSERT INTO spot_types (name, slug, description, is_active) VALUES
  ('Regular', 'regular', 'Standard parking spot', true),
  ('EV Chargers', 'ev-chargers', 'Electric vehicle charging station', true),
  ('Tesla Chargers', 'tesla-chargers', 'Tesla-specific charging station', true),
  ('Accessible', 'accessible', 'Wheelchair accessible parking', true),
  ('Reserved', 'reserved', 'Reserved for executives/special use', true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

-- ============================================
-- 2. DEPARTMENTS
-- ============================================
INSERT INTO departments (name) VALUES ('Capital Markets & Credit Investments') ON CONFLICT (name) DO NOTHING;
INSERT INTO departments (name) VALUES ('Compliance') ON CONFLICT (name) DO NOTHING;
INSERT INTO departments (name) VALUES ('Corporate Investment Risk') ON CONFLICT (name) DO NOTHING;
INSERT INTO departments (name) VALUES ('Corporate Operations') ON CONFLICT (name) DO NOTHING;
INSERT INTO departments (name) VALUES ('Credit Risk & Analytics') ON CONFLICT (name) DO NOTHING;
INSERT INTO departments (name) VALUES ('Finance') ON CONFLICT (name) DO NOTHING;
INSERT INTO departments (name) VALUES ('Human Resources') ON CONFLICT (name) DO NOTHING;
INSERT INTO departments (name) VALUES ('Infrastructure') ON CONFLICT (name) DO NOTHING;
INSERT INTO departments (name) VALUES ('Infrastructure & Renewable Resources') ON CONFLICT (name) DO NOTHING;
INSERT INTO departments (name) VALUES ('Investment Operations') ON CONFLICT (name) DO NOTHING;
INSERT INTO departments (name) VALUES ('Investment Strategy & Risk') ON CONFLICT (name) DO NOTHING;
INSERT INTO departments (name) VALUES ('Legal') ON CONFLICT (name) DO NOTHING;
INSERT INTO departments (name) VALUES ('Legal Affairs & General Counsel') ON CONFLICT (name) DO NOTHING;
INSERT INTO departments (name) VALUES ('Office of the CEO') ON CONFLICT (name) DO NOTHING;
INSERT INTO departments (name) VALUES ('Private Equity') ON CONFLICT (name) DO NOTHING;
INSERT INTO departments (name) VALUES ('Technology') ON CONFLICT (name) DO NOTHING;
INSERT INTO departments (name) VALUES ('only for the month of January then Sarah Fung') ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 3. USERS
-- ============================================
-- Note: Users will be created with placeholder data.
-- They will be fully populated when they log in via OIDC.


INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'jon.perry@bci.ca',
  'Jon',
  'Perry',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Infrastructure' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'adam.myles@bci.ca',
  'Adam',
  'Myles',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Capital Markets & Credit Investments' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'debra.martin@bci.ca',
  'Debra',
  'Martin',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Technology' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'murray.duncan@bci.ca',
  'Murray',
  'Duncan',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Finance' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'sara.heck@bci.ca',
  'Sara',
  'Heck',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Investment Operations' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'jeff.coates@bci.ca',
  'Jeff',
  'Coates',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Infrastructure & Renewable Resources' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'steven.henderson@bci.ca',
  'Steven',
  'Henderson',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Investment Strategy & Risk' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'tony.payne@bci.ca',
  'Tony',
  'Payne',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Technology' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'lincoln.webb@bci.ca',
  'Lincoln',
  'Webb',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Infrastructure' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'jeremy.trickett@bci.ca',
  'Jeremy',
  'Trickett',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Legal' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'rechelle.effendy@bci.ca',
  'Rechelle',
  'Effendy',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Finance' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'norine.hale@bci.ca',
  'Norine',
  'Hale',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Human Resources' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'samir.tekaya@bci.ca',
  'Samir',
  'Ben Tekaya',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Investment Strategy & Risk' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'mark.johnston@bci.ca',
  'Mark',
  'Johnston',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Private Equity' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'winston.lin@bci.ca',
  'Winston',
  'Lin',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Finance' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'david.dobell@bci.ca',
  'David',
  'Dobell',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Capital Markets & Credit Investments' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'ke.min@bci.ca',
  'Ke',
  'Min',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Investment Strategy & Risk' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'rod.prat@bci.ca',
  'Rod',
  'Prat',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Capital Markets & Credit Investments' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'jeff.morris@bci.ca',
  'Jeff',
  'Morris',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Capital Markets & Credit Investments' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'david.mcgowan@bci.ca',
  'David',
  'McGowan',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Investment Strategy & Risk' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'daryl.thompson@bci.ca',
  'Daryl',
  'Thompson',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Finance' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'amandeep.hundal@bci.ca',
  'Amandeep',
  'Hundal',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Capital Markets & Credit Investments' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'samir.dhrolia@bci.ca',
  'Samir',
  'Dhrolia',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Capital Markets & Credit Investments' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'jennifer.hartfield@bci.ca',
  'Jennifer',
  'Hartfield',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Corporate Operations' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'jeff.antonik@bci.ca',
  'Jeff',
  'Antonik',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Capital Markets & Credit Investments' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'denis.miron@bci.ca',
  'Denis',
  'Miron',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Capital Markets & Credit Investments' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'lindsay.wakelin@bci.ca',
  'Lindsay',
  'Wakelin',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Investment Operations' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'himani.gambhir@bci.ca',
  'Himani',
  'Gambhir',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Investment Strategy & Risk' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'jerry.divoky@bci.ca',
  'Jerry',
  'Divoky',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Infrastructure' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'chelsea.gagne@bci.ca',
  'Chelsea',
  'Gagne',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Corporate Operations' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'coo.#2@bci.ca',
  'COO',
  'Parking Spot #2',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Corporate Operations' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'gordon.fyfe@bci.ca',
  'Gordon',
  'Fyfe',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Office of the CEO' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'shauna.lukaitis@bci.ca',
  'Shauna',
  'Lukaitis',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Corporate Operations' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'daniel.garant@bci.ca',
  'Daniel',
  'Garant',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Capital Markets & Credit Investments' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'umar.malik@bci.ca',
  'Umar',
  'Malik',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Private Equity' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'ramy.rayes@bci.ca',
  'Ramy',
  'Rayes',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Investment Strategy & Risk' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'michel.drolet@bci.ca',
  'Michel',
  'Drolet',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Credit Risk & Analytics' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'monique.brosseau@bci.ca',
  'Monique',
  'Brosseau',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Investment Operations' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'jessica.goddard@bci.ca',
  'Jessica',
  'Goddard',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Finance' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'andrew.morris@bci.ca',
  'Andrew',
  'Morris',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Finance' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'joel.mccallum@bci.ca',
  'Joel',
  'McCallum',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Investment Operations' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'kelly.chaplin@bci.ca',
  'Kelly',
  'Chaplin',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Private Equity' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'valentyn.shmygelskyy@bci.ca',
  'Valentyn',
  'Shmygelskyy',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Private Equity' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'ian.wanke@bci.ca',
  'Ian',
  'Wanke',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Private Equity' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'lindsay.holland@bci.ca',
  'Lindsay',
  'Holland',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Legal Affairs & General Counsel' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'brianna.wright@bci.ca',
  'Brianna',
  'Wright',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'only for the month of January then Sarah Fung' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'p2@bci.ca',
  'P2',
  '',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'General' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'susan.golyak@bci.ca',
  'Susan',
  'Golyak',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Capital Markets & Credit Investments' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'taylor.macdougal@bci.ca',
  'Taylor',
  'MacDougal',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Capital Markets & Credit Investments' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'hind.breen@bci.ca',
  'Hind',
  'Breen',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Legal Affairs & General Counsel' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'jill.connell@bci.ca',
  'Jill',
  'O Connell',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Human Resources' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'bhupinder.dulku@bci.ca',
  'Bhupinder',
  'Dulku',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Investment Strategy & Risk' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'evan.mitchell@bci.ca',
  'Evan',
  'Mitchell',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Capital Markets & Credit Investments' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'lana.meyer@bci.ca',
  'Lana',
  'Meyer',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Finance' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'donna.mueller@bci.ca',
  'Donna',
  'Mueller',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Finance' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'bob.sangha@bci.ca',
  'Bob',
  'Sangha',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Investment Operations' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'natalie.fairbrother@bci.ca',
  'Natalie',
  'Fairbrother',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Finance' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'michelle.loveless@bci.ca',
  'Michelle',
  'Loveless',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Human Resources' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'matt.murray@bci.ca',
  'Matt',
  'Murray',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Investment Strategy & Risk' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'emily.lapinski@bci.ca',
  'Emily',
  'Lapinski',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'General' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'scott.bulmer@bci.ca',
  'Scott',
  'Bulmer',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Technology' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'maren.rix@bci.ca',
  'Maren',
  'Rix',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Finance' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'eric.wan@bci.ca',
  'Eric',
  'Wan',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Capital Markets & Credit Investments' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'michael.cavallin@bci.ca',
  'Michael',
  'Cavallin',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Technology' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'maria.hla-tin@bci.ca',
  'Maria',
  'Hla-Tin',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Office of the CEO' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'andrea.zhang@bci.ca',
  'Andrea',
  'Zhang',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Capital Markets & Credit Investments' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'elizabeth.slawinska@bci.ca',
  'Elizabeth',
  'Slawinska',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Capital Markets & Credit Investments' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'devin.blackmore@bci.ca',
  'Devin',
  'Blackmore',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Finance' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'talya.christbason@bci.ca',
  'Talya',
  'Christbason',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Technology' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'hardeep.bamara@bci.ca',
  'Hardeep',
  'Bamara',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Capital Markets & Credit Investments' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'caglar.somek@bci.ca',
  'Caglar',
  'Somek',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Capital Markets & Credit Investments' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'michael.mercier@bci.ca',
  'Michael',
  'Mercier',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Legal' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'johann.kuntze@bci.ca',
  'Johann',
  'Kuntze',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Investment Strategy & Risk' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'saina.singera@bci.ca',
  'Saina',
  'Singera',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Finance' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'amy.chang@bci.ca',
  'Amy',
  'Chang',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Capital Markets & Credit Investments' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'sean.mcllmoyle@bci.ca',
  'Sean',
  'Mcllmoyle',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Finance' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'cameron.elford@bci.ca',
  'Cameron',
  'Elford',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Technology' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'tannis.harper@bci.ca',
  'Tannis',
  'Harper',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Human Resources' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'megan.scholz@bci.ca',
  'Megan',
  'Scholz',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Compliance' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'wps@bci.ca',
  'WPS',
  '',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'General' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'matthew.kaeshammer@bci.ca',
  'Matthew',
  'Kaeshammer',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Finance' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'teeravit.chintawongvanich@bci.ca',
  'Teeravit',
  'Chintawongvanich',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Credit Risk & Analytics' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'armon.alamolhoda@bci.ca',
  'Armon',
  'Alamolhoda',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Capital Markets & Credit Investments' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'baldeep.waraich@bci.ca',
  'Baldeep',
  'Waraich',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Technology' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'jenny.gan@bci.ca',
  'Jenny',
  'Gan',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Finance' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'steve.fedberg@bci.ca',
  'Steve',
  'Fedberg',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Technology' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'john.lee@bci.ca',
  'John',
  'Lee',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Private Equity' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'paul.hodson@bci.ca',
  'Paul',
  'Hodson',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Technology' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'gerard.daniel@bci.ca',
  'Gerard',
  'Daniel',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Corporate Investment Risk' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'chris.reid@bci.ca',
  'Chris',
  'Reid',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Investment Strategy & Risk' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'lauren.fradgley@bci.ca',
  'Lauren',
  'Fradgley',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Capital Markets & Credit Investments' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'lisa.whish@bci.ca',
  'Lisa',
  'Whish',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Legal' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'mihail.garchev@bci.ca',
  'Mihail',
  'Garchev',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Investment Strategy & Risk' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'karen.ward@bci.ca',
  'Karen',
  'Ward',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Human Resources' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'sarah.dorrington@bci.ca',
  'Sarah',
  'Dorrington',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Capital Markets & Credit Investments' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'allison.knowles@bci.ca',
  'Allison',
  'Knowles',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Investment Operations' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'asad.rawra@bci.ca',
  'Asad',
  'Rawra',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Private Equity' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'maggie.sewagudde-peden@bci.ca',
  'Maggie',
  'Sewagudde-Peden',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Investment Operations' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'sarah.moreau@bci.ca',
  'Sarah',
  'Wilde Moreau',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Private Equity' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'david.antonik@bci.ca',
  'David',
  'Antonik',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Credit Risk & Analytics' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'rob.blazey@bci.ca',
  'Rob',
  'Blazey',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Investment Strategy & Risk' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'sarah.cunningham@bci.ca',
  'Sarah',
  'Cunningham',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Legal' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'jesus.alva@bci.ca',
  'Jesus',
  'Alva',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Investment Operations' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'cathy.lin@bci.ca',
  'Cathy',
  'Lin',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Legal' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'allan.ashford@bci.ca',
  'Allan',
  'Ashford',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Legal' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'wendy.ramlochan@bci.ca',
  'Wendy',
  'Ramlochan',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Investment Strategy & Risk' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'aaron.leskiw@bci.ca',
  'Aaron',
  'Leskiw',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Technology' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'hazlitt.gill@bci.ca',
  'Hazlitt',
  'Gill',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Capital Markets & Credit Investments' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'miriam.abdelli@bci.ca',
  'Miriam',
  'Abdelli',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Investment Strategy & Risk' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'gina.dennison@bci.ca',
  'Gina',
  'Dennison',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Investment Operations' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'rachel.vaughan@bci.ca',
  'Rachel',
  'Vaughan',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Investment Strategy & Risk' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'daisy.klaibert@bci.ca',
  'Daisy',
  'Klaibert',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Capital Markets & Credit Investments' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'alan.cooper@bci.ca',
  'Alan',
  'Cooper',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Capital Markets & Credit Investments' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  'tyler.folliott@bci.ca',
  'Tyler',
  'Folliott',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = 'Capital Markets & Credit Investments' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);

-- ============================================
-- 4. PARKING SPOTS
-- ============================================
-- Note: All spots are at Victoria location (location_id = 1)
-- Adjust location_id if needed for your setup.


INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P32',
  '32',
  1,
  (SELECT id FROM spot_types WHERE slug = 'tesla-chargers' LIMIT 1),
  true,
  true,
  'Electric Vehicle Parking *TESLA*'
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P32');

UPDATE parking_spots SET
  seat_number = '32',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'tesla-chargers' LIMIT 1),
  description = 'Electric Vehicle Parking *TESLA*'
WHERE spot_number = 'P32';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P33',
  '33',
  1,
  (SELECT id FROM spot_types WHERE slug = 'tesla-chargers' LIMIT 1),
  true,
  true,
  'Electric Vehicle Parking *TESLA*'
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P33');

UPDATE parking_spots SET
  seat_number = '33',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'tesla-chargers' LIMIT 1),
  description = 'Electric Vehicle Parking *TESLA*'
WHERE spot_number = 'P33';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P34',
  '34',
  1,
  (SELECT id FROM spot_types WHERE slug = 'tesla-chargers' LIMIT 1),
  true,
  true,
  'Electric Vehicle Parking *TESLA*'
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P34');

UPDATE parking_spots SET
  seat_number = '34',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'tesla-chargers' LIMIT 1),
  description = 'Electric Vehicle Parking *TESLA*'
WHERE spot_number = 'P34';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P37',
  '37',
  1,
  (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  true,
  true,
  'Electric Vehicle Parking'
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P37');

UPDATE parking_spots SET
  seat_number = '37',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  description = 'Electric Vehicle Parking'
WHERE spot_number = 'P37';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P38',
  '38',
  1,
  (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  true,
  true,
  'Electric Vehicle Parking'
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P38');

UPDATE parking_spots SET
  seat_number = '38',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  description = 'Electric Vehicle Parking'
WHERE spot_number = 'P38';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P39',
  '39',
  1,
  (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  true,
  true,
  'Electric Vehicle Parking'
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P39');

UPDATE parking_spots SET
  seat_number = '39',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  description = 'Electric Vehicle Parking'
WHERE spot_number = 'P39';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P40',
  '40',
  1,
  (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  true,
  true,
  'Electric Vehicle Parking'
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P40');

UPDATE parking_spots SET
  seat_number = '40',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  description = 'Electric Vehicle Parking'
WHERE spot_number = 'P40';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P41',
  '41',
  1,
  (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  true,
  true,
  'Electric Vehicle Parking'
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P41');

UPDATE parking_spots SET
  seat_number = '41',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  description = 'Electric Vehicle Parking'
WHERE spot_number = 'P41';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P42',
  '42',
  1,
  (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  true,
  true,
  'EV stall'
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P42');

UPDATE parking_spots SET
  seat_number = '42',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  description = 'EV stall'
WHERE spot_number = 'P42';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P43',
  '43',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P43');

UPDATE parking_spots SET
  seat_number = '43',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P43';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P44',
  '44',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P44');

UPDATE parking_spots SET
  seat_number = '44',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P44';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P45',
  '45',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P45');

UPDATE parking_spots SET
  seat_number = '45',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P45';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P46',
  '46',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P46');

UPDATE parking_spots SET
  seat_number = '46',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P46';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P47',
  '47',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P47');

UPDATE parking_spots SET
  seat_number = '47',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P47';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P48',
  '48',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P48');

UPDATE parking_spots SET
  seat_number = '48',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P48';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P49',
  '49',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P49');

UPDATE parking_spots SET
  seat_number = '49',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P49';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P50',
  '50',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  'Capital Markets & Credit Investments Spot'
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P50');

UPDATE parking_spots SET
  seat_number = '50',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = 'Capital Markets & Credit Investments Spot'
WHERE spot_number = 'P50';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P51',
  '51',
  1,
  (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  true,
  true,
  'Electric Vehicle Parking'
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P51');

UPDATE parking_spots SET
  seat_number = '51',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  description = 'Electric Vehicle Parking'
WHERE spot_number = 'P51';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P52',
  '52',
  1,
  (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  true,
  true,
  'Electric Vehicle Parking'
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P52');

UPDATE parking_spots SET
  seat_number = '52',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  description = 'Electric Vehicle Parking'
WHERE spot_number = 'P52';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P53',
  '53',
  1,
  (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  true,
  true,
  'Electric Vehicle Parking'
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P53');

UPDATE parking_spots SET
  seat_number = '53',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  description = 'Electric Vehicle Parking'
WHERE spot_number = 'P53';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P54',
  '54',
  1,
  (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  true,
  true,
  'Electric Vehicle Parking'
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P54');

UPDATE parking_spots SET
  seat_number = '54',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  description = 'Electric Vehicle Parking'
WHERE spot_number = 'P54';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P55',
  '55',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P55');

UPDATE parking_spots SET
  seat_number = '55',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P55';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P56',
  '56',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P56');

UPDATE parking_spots SET
  seat_number = '56',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P56';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P57',
  '57',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  'Capital Markets & Credit Investments Spot'
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P57');

UPDATE parking_spots SET
  seat_number = '57',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = 'Capital Markets & Credit Investments Spot'
WHERE spot_number = 'P57';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P58',
  '58',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P58');

UPDATE parking_spots SET
  seat_number = '58',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P58';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P59',
  '59',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  'Capital Markets & Credit Investments Spot'
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P59');

UPDATE parking_spots SET
  seat_number = '59',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = 'Capital Markets & Credit Investments Spot'
WHERE spot_number = 'P59';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P60',
  '60',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  'Capital Markets & Credit Investments Spot'
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P60');

UPDATE parking_spots SET
  seat_number = '60',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = 'Capital Markets & Credit Investments Spot'
WHERE spot_number = 'P60';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P61',
  '61',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P61');

UPDATE parking_spots SET
  seat_number = '61',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P61';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P62',
  '62',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P62');

UPDATE parking_spots SET
  seat_number = '62',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P62';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P84',
  '84',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P84');

UPDATE parking_spots SET
  seat_number = '84',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P84';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P85',
  '85',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P85');

UPDATE parking_spots SET
  seat_number = '85',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P85';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P86',
  '86',
  1,
  (SELECT id FROM spot_types WHERE slug = 'accessible' LIMIT 1),
  true,
  true,
  'FOR BOARD MEMBER USE / Wheelchair Parking'
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P86');

UPDATE parking_spots SET
  seat_number = '86',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'accessible' LIMIT 1),
  description = 'FOR BOARD MEMBER USE / Wheelchair Parking'
WHERE spot_number = 'P86';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P87',
  '87',
  1,
  (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  true,
  true,
  'CEO PARKING - Electric - EV'
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P87');

UPDATE parking_spots SET
  seat_number = '87',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  description = 'CEO PARKING - Electric - EV'
WHERE spot_number = 'P87';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P88',
  '88',
  1,
  (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  true,
  true,
  'COO PARKING - Electric - EV'
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P88');

UPDATE parking_spots SET
  seat_number = '88',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  description = 'COO PARKING - Electric - EV'
WHERE spot_number = 'P88';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P89',
  '89',
  1,
  (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  true,
  true,
  'EVP PARKING'
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P89');

UPDATE parking_spots SET
  seat_number = '89',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  description = 'EVP PARKING'
WHERE spot_number = 'P89';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P90',
  '90',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P90');

UPDATE parking_spots SET
  seat_number = '90',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P90';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P91',
  '91',
  1,
  (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  true,
  true,
  'EVP PARKING - Electric - EV'
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P91');

UPDATE parking_spots SET
  seat_number = '91',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  description = 'EVP PARKING - Electric - EV'
WHERE spot_number = 'P91';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P92',
  '92',
  1,
  (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  true,
  true,
  'SVP PARKING - Electric - EV'
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P92');

UPDATE parking_spots SET
  seat_number = '92',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  description = 'SVP PARKING - Electric - EV'
WHERE spot_number = 'P92';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P93',
  '93',
  1,
  (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  true,
  true,
  'SVP PARKING - Electric - EV'
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P93');

UPDATE parking_spots SET
  seat_number = '93',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  description = 'SVP PARKING - Electric - EV'
WHERE spot_number = 'P93';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P94',
  '94',
  1,
  (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  true,
  true,
  'EVP PARKING - Electric - EV'
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P94');

UPDATE parking_spots SET
  seat_number = '94',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  description = 'EVP PARKING - Electric - EV'
WHERE spot_number = 'P94';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P95',
  '95',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P95');

UPDATE parking_spots SET
  seat_number = '95',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P95';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P96',
  '96',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P96');

UPDATE parking_spots SET
  seat_number = '96',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P96';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P97',
  '97',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P97');

UPDATE parking_spots SET
  seat_number = '97',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P97';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P98',
  '98',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P98');

UPDATE parking_spots SET
  seat_number = '98',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P98';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P99',
  '99',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P99');

UPDATE parking_spots SET
  seat_number = '99',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P99';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P100',
  '100',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P100');

UPDATE parking_spots SET
  seat_number = '100',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P100';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P101',
  '101',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P101');

UPDATE parking_spots SET
  seat_number = '101',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P101';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P102',
  '102',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P102');

UPDATE parking_spots SET
  seat_number = '102',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P102';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'undefined',
  'undefined',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'undefined');

UPDATE parking_spots SET
  seat_number = 'undefined',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'undefined';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P134',
  '134',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P134');

UPDATE parking_spots SET
  seat_number = '134',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P134';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P135',
  '135',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P135');

UPDATE parking_spots SET
  seat_number = '135',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P135';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P136',
  '136',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P136');

UPDATE parking_spots SET
  seat_number = '136',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P136';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P137',
  '137',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P137');

UPDATE parking_spots SET
  seat_number = '137',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P137';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P138',
  '138',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P138');

UPDATE parking_spots SET
  seat_number = '138',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P138';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P139',
  '139',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P139');

UPDATE parking_spots SET
  seat_number = '139',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P139';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P140',
  '140',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P140');

UPDATE parking_spots SET
  seat_number = '140',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P140';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P141',
  '141',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P141');

UPDATE parking_spots SET
  seat_number = '141',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P141';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P142',
  '142',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P142');

UPDATE parking_spots SET
  seat_number = '142',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P142';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P143',
  '143',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P143');

UPDATE parking_spots SET
  seat_number = '143',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P143';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P144',
  '144',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P144');

UPDATE parking_spots SET
  seat_number = '144',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P144';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P145',
  '145',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P145');

UPDATE parking_spots SET
  seat_number = '145',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P145';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P146',
  '146',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P146');

UPDATE parking_spots SET
  seat_number = '146',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P146';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P147',
  '147',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P147');

UPDATE parking_spots SET
  seat_number = '147',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P147';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P148',
  '148',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P148');

UPDATE parking_spots SET
  seat_number = '148',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P148';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P149',
  '149',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P149');

UPDATE parking_spots SET
  seat_number = '149',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P149';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P150',
  '150',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P150');

UPDATE parking_spots SET
  seat_number = '150',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P150';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P151',
  '151',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P151');

UPDATE parking_spots SET
  seat_number = '151',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P151';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P152',
  '152',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P152');

UPDATE parking_spots SET
  seat_number = '152',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P152';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P153',
  '153',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P153');

UPDATE parking_spots SET
  seat_number = '153',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P153';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P154',
  '154',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P154');

UPDATE parking_spots SET
  seat_number = '154',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P154';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P155',
  '155',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P155');

UPDATE parking_spots SET
  seat_number = '155',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P155';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P156',
  '156',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P156');

UPDATE parking_spots SET
  seat_number = '156',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P156';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P157',
  '157',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P157');

UPDATE parking_spots SET
  seat_number = '157',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P157';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P158',
  '158',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P158');

UPDATE parking_spots SET
  seat_number = '158',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P158';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P159',
  '159',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P159');

UPDATE parking_spots SET
  seat_number = '159',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P159';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P160',
  '160',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P160');

UPDATE parking_spots SET
  seat_number = '160',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P160';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P161',
  '161',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P161');

UPDATE parking_spots SET
  seat_number = '161',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P161';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P162',
  '162',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P162');

UPDATE parking_spots SET
  seat_number = '162',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P162';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P163',
  '163',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P163');

UPDATE parking_spots SET
  seat_number = '163',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P163';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P164',
  '164',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P164');

UPDATE parking_spots SET
  seat_number = '164',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P164';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P165',
  '165',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P165');

UPDATE parking_spots SET
  seat_number = '165',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P165';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P166',
  '166',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P166');

UPDATE parking_spots SET
  seat_number = '166',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P166';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P167',
  '167',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P167');

UPDATE parking_spots SET
  seat_number = '167',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P167';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P168',
  '168',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P168');

UPDATE parking_spots SET
  seat_number = '168',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P168';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P169',
  '169',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P169');

UPDATE parking_spots SET
  seat_number = '169',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P169';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P170',
  '170',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P170');

UPDATE parking_spots SET
  seat_number = '170',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P170';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P171',
  '171',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P171');

UPDATE parking_spots SET
  seat_number = '171',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P171';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P172',
  '172',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P172');

UPDATE parking_spots SET
  seat_number = '172',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P172';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P173',
  '173',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P173');

UPDATE parking_spots SET
  seat_number = '173',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P173';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P174',
  '174',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P174');

UPDATE parking_spots SET
  seat_number = '174',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P174';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P175',
  '175',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P175');

UPDATE parking_spots SET
  seat_number = '175',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P175';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P176',
  '176',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P176');

UPDATE parking_spots SET
  seat_number = '176',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P176';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P177',
  '177',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P177');

UPDATE parking_spots SET
  seat_number = '177',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P177';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P181',
  '181',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P181');

UPDATE parking_spots SET
  seat_number = '181',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P181';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P182',
  '182',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P182');

UPDATE parking_spots SET
  seat_number = '182',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P182';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P183',
  '183',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P183');

UPDATE parking_spots SET
  seat_number = '183',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P183';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P184',
  '184',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P184');

UPDATE parking_spots SET
  seat_number = '184',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P184';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P185',
  '185',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P185');

UPDATE parking_spots SET
  seat_number = '185',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P185';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P186',
  '186',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P186');

UPDATE parking_spots SET
  seat_number = '186',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P186';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P187',
  '187',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P187');

UPDATE parking_spots SET
  seat_number = '187',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P187';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P188',
  '188',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P188');

UPDATE parking_spots SET
  seat_number = '188',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P188';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P189',
  '189',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P189');

UPDATE parking_spots SET
  seat_number = '189',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P189';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P190',
  '190',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P190');

UPDATE parking_spots SET
  seat_number = '190',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P190';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P191',
  '191',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P191');

UPDATE parking_spots SET
  seat_number = '191',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P191';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P192',
  '192',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P192');

UPDATE parking_spots SET
  seat_number = '192',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P192';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P193',
  '193',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P193');

UPDATE parking_spots SET
  seat_number = '193',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P193';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P194',
  '194',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P194');

UPDATE parking_spots SET
  seat_number = '194',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P194';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P195',
  '195',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P195');

UPDATE parking_spots SET
  seat_number = '195',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P195';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P196',
  '196',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P196');

UPDATE parking_spots SET
  seat_number = '196',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P196';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P197',
  '197',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P197');

UPDATE parking_spots SET
  seat_number = '197',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P197';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P198',
  '198',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P198');

UPDATE parking_spots SET
  seat_number = '198',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P198';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P199',
  '199',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P199');

UPDATE parking_spots SET
  seat_number = '199',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P199';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P200',
  '200',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P200');

UPDATE parking_spots SET
  seat_number = '200',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P200';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P201',
  '201',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P201');

UPDATE parking_spots SET
  seat_number = '201',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P201';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P202',
  '202',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P202');

UPDATE parking_spots SET
  seat_number = '202',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P202';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P203',
  '203',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  'Capital Markets & Credit Investments Spot'
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P203');

UPDATE parking_spots SET
  seat_number = '203',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = 'Capital Markets & Credit Investments Spot'
WHERE spot_number = 'P203';

INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  'P204',
  '204',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = 'P204');

UPDATE parking_spots SET
  seat_number = '204',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  description = NULL
WHERE spot_number = 'P204';

-- ============================================
-- 5. SPOT ASSIGNMENTS (owner_id)
-- ============================================

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'jon.perry@bci.ca' LIMIT 1)
WHERE spot_number = 'P32'
  AND (SELECT id FROM users WHERE email = 'jon.perry@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'adam.myles@bci.ca' LIMIT 1)
WHERE spot_number = 'P33'
  AND (SELECT id FROM users WHERE email = 'adam.myles@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'debra.martin@bci.ca' LIMIT 1)
WHERE spot_number = 'P34'
  AND (SELECT id FROM users WHERE email = 'debra.martin@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'murray.duncan@bci.ca' LIMIT 1)
WHERE spot_number = 'P37'
  AND (SELECT id FROM users WHERE email = 'murray.duncan@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'sara.heck@bci.ca' LIMIT 1)
WHERE spot_number = 'P38'
  AND (SELECT id FROM users WHERE email = 'sara.heck@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'jeff.coates@bci.ca' LIMIT 1)
WHERE spot_number = 'P39'
  AND (SELECT id FROM users WHERE email = 'jeff.coates@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'steven.henderson@bci.ca' LIMIT 1)
WHERE spot_number = 'P40'
  AND (SELECT id FROM users WHERE email = 'steven.henderson@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'tony.payne@bci.ca' LIMIT 1)
WHERE spot_number = 'P42'
  AND (SELECT id FROM users WHERE email = 'tony.payne@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'lincoln.webb@bci.ca' LIMIT 1)
WHERE spot_number = 'P43'
  AND (SELECT id FROM users WHERE email = 'lincoln.webb@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'jeremy.trickett@bci.ca' LIMIT 1)
WHERE spot_number = 'P44'
  AND (SELECT id FROM users WHERE email = 'jeremy.trickett@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'rechelle.effendy@bci.ca' LIMIT 1)
WHERE spot_number = 'P45'
  AND (SELECT id FROM users WHERE email = 'rechelle.effendy@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'norine.hale@bci.ca' LIMIT 1)
WHERE spot_number = 'P46'
  AND (SELECT id FROM users WHERE email = 'norine.hale@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'samir.tekaya@bci.ca' LIMIT 1)
WHERE spot_number = 'P47'
  AND (SELECT id FROM users WHERE email = 'samir.tekaya@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'mark.johnston@bci.ca' LIMIT 1)
WHERE spot_number = 'P48'
  AND (SELECT id FROM users WHERE email = 'mark.johnston@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'winston.lin@bci.ca' LIMIT 1)
WHERE spot_number = 'P49'
  AND (SELECT id FROM users WHERE email = 'winston.lin@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'david.dobell@bci.ca' LIMIT 1)
WHERE spot_number = 'P50'
  AND (SELECT id FROM users WHERE email = 'david.dobell@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'ke.min@bci.ca' LIMIT 1)
WHERE spot_number = 'P51'
  AND (SELECT id FROM users WHERE email = 'ke.min@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'rod.prat@bci.ca' LIMIT 1)
WHERE spot_number = 'P52'
  AND (SELECT id FROM users WHERE email = 'rod.prat@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'jeff.morris@bci.ca' LIMIT 1)
WHERE spot_number = 'P53'
  AND (SELECT id FROM users WHERE email = 'jeff.morris@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'david.mcgowan@bci.ca' LIMIT 1)
WHERE spot_number = 'P54'
  AND (SELECT id FROM users WHERE email = 'david.mcgowan@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'daryl.thompson@bci.ca' LIMIT 1)
WHERE spot_number = 'P55'
  AND (SELECT id FROM users WHERE email = 'daryl.thompson@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'amandeep.hundal@bci.ca' LIMIT 1)
WHERE spot_number = 'P56'
  AND (SELECT id FROM users WHERE email = 'amandeep.hundal@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'samir.dhrolia@bci.ca' LIMIT 1)
WHERE spot_number = 'P57'
  AND (SELECT id FROM users WHERE email = 'samir.dhrolia@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'jennifer.hartfield@bci.ca' LIMIT 1)
WHERE spot_number = 'P58'
  AND (SELECT id FROM users WHERE email = 'jennifer.hartfield@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'jeff.antonik@bci.ca' LIMIT 1)
WHERE spot_number = 'P59'
  AND (SELECT id FROM users WHERE email = 'jeff.antonik@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'denis.miron@bci.ca' LIMIT 1)
WHERE spot_number = 'P60'
  AND (SELECT id FROM users WHERE email = 'denis.miron@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'lindsay.wakelin@bci.ca' LIMIT 1)
WHERE spot_number = 'P61'
  AND (SELECT id FROM users WHERE email = 'lindsay.wakelin@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'himani.gambhir@bci.ca' LIMIT 1)
WHERE spot_number = 'P62'
  AND (SELECT id FROM users WHERE email = 'himani.gambhir@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'jerry.divoky@bci.ca' LIMIT 1)
WHERE spot_number = 'P84'
  AND (SELECT id FROM users WHERE email = 'jerry.divoky@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'chelsea.gagne@bci.ca' LIMIT 1)
WHERE spot_number = 'P85'
  AND (SELECT id FROM users WHERE email = 'chelsea.gagne@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'coo.#2@bci.ca' LIMIT 1)
WHERE spot_number = 'P86'
  AND (SELECT id FROM users WHERE email = 'coo.#2@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'gordon.fyfe@bci.ca' LIMIT 1)
WHERE spot_number = 'P87'
  AND (SELECT id FROM users WHERE email = 'gordon.fyfe@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'shauna.lukaitis@bci.ca' LIMIT 1)
WHERE spot_number = 'P88'
  AND (SELECT id FROM users WHERE email = 'shauna.lukaitis@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'daniel.garant@bci.ca' LIMIT 1)
WHERE spot_number = 'P89'
  AND (SELECT id FROM users WHERE email = 'daniel.garant@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'umar.malik@bci.ca' LIMIT 1)
WHERE spot_number = 'P90'
  AND (SELECT id FROM users WHERE email = 'umar.malik@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'ramy.rayes@bci.ca' LIMIT 1)
WHERE spot_number = 'P91'
  AND (SELECT id FROM users WHERE email = 'ramy.rayes@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'michel.drolet@bci.ca' LIMIT 1)
WHERE spot_number = 'P92'
  AND (SELECT id FROM users WHERE email = 'michel.drolet@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'monique.brosseau@bci.ca' LIMIT 1)
WHERE spot_number = 'P93'
  AND (SELECT id FROM users WHERE email = 'monique.brosseau@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'jessica.goddard@bci.ca' LIMIT 1)
WHERE spot_number = 'P95'
  AND (SELECT id FROM users WHERE email = 'jessica.goddard@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'andrew.morris@bci.ca' LIMIT 1)
WHERE spot_number = 'P96'
  AND (SELECT id FROM users WHERE email = 'andrew.morris@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'joel.mccallum@bci.ca' LIMIT 1)
WHERE spot_number = 'P97'
  AND (SELECT id FROM users WHERE email = 'joel.mccallum@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'kelly.chaplin@bci.ca' LIMIT 1)
WHERE spot_number = 'P98'
  AND (SELECT id FROM users WHERE email = 'kelly.chaplin@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'valentyn.shmygelskyy@bci.ca' LIMIT 1)
WHERE spot_number = 'P99'
  AND (SELECT id FROM users WHERE email = 'valentyn.shmygelskyy@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'ian.wanke@bci.ca' LIMIT 1)
WHERE spot_number = 'P100'
  AND (SELECT id FROM users WHERE email = 'ian.wanke@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'lindsay.holland@bci.ca' LIMIT 1)
WHERE spot_number = 'P101'
  AND (SELECT id FROM users WHERE email = 'lindsay.holland@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'brianna.wright@bci.ca' LIMIT 1)
WHERE spot_number = 'P102'
  AND (SELECT id FROM users WHERE email = 'brianna.wright@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'p2@bci.ca' LIMIT 1)
WHERE spot_number = 'undefined'
  AND (SELECT id FROM users WHERE email = 'p2@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'susan.golyak@bci.ca' LIMIT 1)
WHERE spot_number = 'P134'
  AND (SELECT id FROM users WHERE email = 'susan.golyak@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'taylor.macdougal@bci.ca' LIMIT 1)
WHERE spot_number = 'P135'
  AND (SELECT id FROM users WHERE email = 'taylor.macdougal@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'hind.breen@bci.ca' LIMIT 1)
WHERE spot_number = 'P136'
  AND (SELECT id FROM users WHERE email = 'hind.breen@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'jill.connell@bci.ca' LIMIT 1)
WHERE spot_number = 'P137'
  AND (SELECT id FROM users WHERE email = 'jill.connell@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'bhupinder.dulku@bci.ca' LIMIT 1)
WHERE spot_number = 'P138'
  AND (SELECT id FROM users WHERE email = 'bhupinder.dulku@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'evan.mitchell@bci.ca' LIMIT 1)
WHERE spot_number = 'P139'
  AND (SELECT id FROM users WHERE email = 'evan.mitchell@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'lana.meyer@bci.ca' LIMIT 1)
WHERE spot_number = 'P140'
  AND (SELECT id FROM users WHERE email = 'lana.meyer@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'donna.mueller@bci.ca' LIMIT 1)
WHERE spot_number = 'P141'
  AND (SELECT id FROM users WHERE email = 'donna.mueller@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'bob.sangha@bci.ca' LIMIT 1)
WHERE spot_number = 'P142'
  AND (SELECT id FROM users WHERE email = 'bob.sangha@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'natalie.fairbrother@bci.ca' LIMIT 1)
WHERE spot_number = 'P143'
  AND (SELECT id FROM users WHERE email = 'natalie.fairbrother@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'michelle.loveless@bci.ca' LIMIT 1)
WHERE spot_number = 'P144'
  AND (SELECT id FROM users WHERE email = 'michelle.loveless@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'matt.murray@bci.ca' LIMIT 1)
WHERE spot_number = 'P145'
  AND (SELECT id FROM users WHERE email = 'matt.murray@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'emily.lapinski@bci.ca' LIMIT 1)
WHERE spot_number = 'P146'
  AND (SELECT id FROM users WHERE email = 'emily.lapinski@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'scott.bulmer@bci.ca' LIMIT 1)
WHERE spot_number = 'P147'
  AND (SELECT id FROM users WHERE email = 'scott.bulmer@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'maren.rix@bci.ca' LIMIT 1)
WHERE spot_number = 'P148'
  AND (SELECT id FROM users WHERE email = 'maren.rix@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'eric.wan@bci.ca' LIMIT 1)
WHERE spot_number = 'P149'
  AND (SELECT id FROM users WHERE email = 'eric.wan@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'michael.cavallin@bci.ca' LIMIT 1)
WHERE spot_number = 'P150'
  AND (SELECT id FROM users WHERE email = 'michael.cavallin@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'maria.hla-tin@bci.ca' LIMIT 1)
WHERE spot_number = 'P151'
  AND (SELECT id FROM users WHERE email = 'maria.hla-tin@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'andrea.zhang@bci.ca' LIMIT 1)
WHERE spot_number = 'P152'
  AND (SELECT id FROM users WHERE email = 'andrea.zhang@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'elizabeth.slawinska@bci.ca' LIMIT 1)
WHERE spot_number = 'P153'
  AND (SELECT id FROM users WHERE email = 'elizabeth.slawinska@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'devin.blackmore@bci.ca' LIMIT 1)
WHERE spot_number = 'P154'
  AND (SELECT id FROM users WHERE email = 'devin.blackmore@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'talya.christbason@bci.ca' LIMIT 1)
WHERE spot_number = 'P155'
  AND (SELECT id FROM users WHERE email = 'talya.christbason@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'hardeep.bamara@bci.ca' LIMIT 1)
WHERE spot_number = 'P156'
  AND (SELECT id FROM users WHERE email = 'hardeep.bamara@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'caglar.somek@bci.ca' LIMIT 1)
WHERE spot_number = 'P157'
  AND (SELECT id FROM users WHERE email = 'caglar.somek@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'michael.mercier@bci.ca' LIMIT 1)
WHERE spot_number = 'P158'
  AND (SELECT id FROM users WHERE email = 'michael.mercier@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'johann.kuntze@bci.ca' LIMIT 1)
WHERE spot_number = 'P159'
  AND (SELECT id FROM users WHERE email = 'johann.kuntze@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'saina.singera@bci.ca' LIMIT 1)
WHERE spot_number = 'P160'
  AND (SELECT id FROM users WHERE email = 'saina.singera@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'amy.chang@bci.ca' LIMIT 1)
WHERE spot_number = 'P161'
  AND (SELECT id FROM users WHERE email = 'amy.chang@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'sean.mcllmoyle@bci.ca' LIMIT 1)
WHERE spot_number = 'P162'
  AND (SELECT id FROM users WHERE email = 'sean.mcllmoyle@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'cameron.elford@bci.ca' LIMIT 1)
WHERE spot_number = 'P163'
  AND (SELECT id FROM users WHERE email = 'cameron.elford@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'tannis.harper@bci.ca' LIMIT 1)
WHERE spot_number = 'P164'
  AND (SELECT id FROM users WHERE email = 'tannis.harper@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'megan.scholz@bci.ca' LIMIT 1)
WHERE spot_number = 'P165'
  AND (SELECT id FROM users WHERE email = 'megan.scholz@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'wps@bci.ca' LIMIT 1)
WHERE spot_number = 'P166'
  AND (SELECT id FROM users WHERE email = 'wps@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'matthew.kaeshammer@bci.ca' LIMIT 1)
WHERE spot_number = 'P167'
  AND (SELECT id FROM users WHERE email = 'matthew.kaeshammer@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'teeravit.chintawongvanich@bci.ca' LIMIT 1)
WHERE spot_number = 'P168'
  AND (SELECT id FROM users WHERE email = 'teeravit.chintawongvanich@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'armon.alamolhoda@bci.ca' LIMIT 1)
WHERE spot_number = 'P169'
  AND (SELECT id FROM users WHERE email = 'armon.alamolhoda@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'baldeep.waraich@bci.ca' LIMIT 1)
WHERE spot_number = 'P170'
  AND (SELECT id FROM users WHERE email = 'baldeep.waraich@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'jenny.gan@bci.ca' LIMIT 1)
WHERE spot_number = 'P171'
  AND (SELECT id FROM users WHERE email = 'jenny.gan@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'steve.fedberg@bci.ca' LIMIT 1)
WHERE spot_number = 'P172'
  AND (SELECT id FROM users WHERE email = 'steve.fedberg@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'john.lee@bci.ca' LIMIT 1)
WHERE spot_number = 'P173'
  AND (SELECT id FROM users WHERE email = 'john.lee@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'paul.hodson@bci.ca' LIMIT 1)
WHERE spot_number = 'P174'
  AND (SELECT id FROM users WHERE email = 'paul.hodson@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'gerard.daniel@bci.ca' LIMIT 1)
WHERE spot_number = 'P175'
  AND (SELECT id FROM users WHERE email = 'gerard.daniel@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'chris.reid@bci.ca' LIMIT 1)
WHERE spot_number = 'P176'
  AND (SELECT id FROM users WHERE email = 'chris.reid@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'lauren.fradgley@bci.ca' LIMIT 1)
WHERE spot_number = 'P177'
  AND (SELECT id FROM users WHERE email = 'lauren.fradgley@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'lisa.whish@bci.ca' LIMIT 1)
WHERE spot_number = 'P181'
  AND (SELECT id FROM users WHERE email = 'lisa.whish@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'mihail.garchev@bci.ca' LIMIT 1)
WHERE spot_number = 'P182'
  AND (SELECT id FROM users WHERE email = 'mihail.garchev@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'karen.ward@bci.ca' LIMIT 1)
WHERE spot_number = 'P183'
  AND (SELECT id FROM users WHERE email = 'karen.ward@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'sarah.dorrington@bci.ca' LIMIT 1)
WHERE spot_number = 'P184'
  AND (SELECT id FROM users WHERE email = 'sarah.dorrington@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'wps@bci.ca' LIMIT 1)
WHERE spot_number = 'P185'
  AND (SELECT id FROM users WHERE email = 'wps@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'allison.knowles@bci.ca' LIMIT 1)
WHERE spot_number = 'P186'
  AND (SELECT id FROM users WHERE email = 'allison.knowles@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'asad.rawra@bci.ca' LIMIT 1)
WHERE spot_number = 'P187'
  AND (SELECT id FROM users WHERE email = 'asad.rawra@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'maggie.sewagudde-peden@bci.ca' LIMIT 1)
WHERE spot_number = 'P188'
  AND (SELECT id FROM users WHERE email = 'maggie.sewagudde-peden@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'sarah.moreau@bci.ca' LIMIT 1)
WHERE spot_number = 'P189'
  AND (SELECT id FROM users WHERE email = 'sarah.moreau@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'david.antonik@bci.ca' LIMIT 1)
WHERE spot_number = 'P190'
  AND (SELECT id FROM users WHERE email = 'david.antonik@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'rob.blazey@bci.ca' LIMIT 1)
WHERE spot_number = 'P191'
  AND (SELECT id FROM users WHERE email = 'rob.blazey@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'sarah.cunningham@bci.ca' LIMIT 1)
WHERE spot_number = 'P192'
  AND (SELECT id FROM users WHERE email = 'sarah.cunningham@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'jesus.alva@bci.ca' LIMIT 1)
WHERE spot_number = 'P193'
  AND (SELECT id FROM users WHERE email = 'jesus.alva@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'cathy.lin@bci.ca' LIMIT 1)
WHERE spot_number = 'P194'
  AND (SELECT id FROM users WHERE email = 'cathy.lin@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'allan.ashford@bci.ca' LIMIT 1)
WHERE spot_number = 'P195'
  AND (SELECT id FROM users WHERE email = 'allan.ashford@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'wendy.ramlochan@bci.ca' LIMIT 1)
WHERE spot_number = 'P196'
  AND (SELECT id FROM users WHERE email = 'wendy.ramlochan@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'aaron.leskiw@bci.ca' LIMIT 1)
WHERE spot_number = 'P197'
  AND (SELECT id FROM users WHERE email = 'aaron.leskiw@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'hazlitt.gill@bci.ca' LIMIT 1)
WHERE spot_number = 'P198'
  AND (SELECT id FROM users WHERE email = 'hazlitt.gill@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'miriam.abdelli@bci.ca' LIMIT 1)
WHERE spot_number = 'P199'
  AND (SELECT id FROM users WHERE email = 'miriam.abdelli@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'gina.dennison@bci.ca' LIMIT 1)
WHERE spot_number = 'P200'
  AND (SELECT id FROM users WHERE email = 'gina.dennison@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'rachel.vaughan@bci.ca' LIMIT 1)
WHERE spot_number = 'P201'
  AND (SELECT id FROM users WHERE email = 'rachel.vaughan@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'daisy.klaibert@bci.ca' LIMIT 1)
WHERE spot_number = 'P202'
  AND (SELECT id FROM users WHERE email = 'daisy.klaibert@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'alan.cooper@bci.ca' LIMIT 1)
WHERE spot_number = 'P203'
  AND (SELECT id FROM users WHERE email = 'alan.cooper@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = 'tyler.folliott@bci.ca' LIMIT 1)
WHERE spot_number = 'P204'
  AND (SELECT id FROM users WHERE email = 'tyler.folliott@bci.ca' LIMIT 1) IS NOT NULL;

-- ============================================
-- SUMMARY
-- ============================================
-- Spot Types: 5
-- Departments: 17
-- Users: 114
-- Parking Spots: 117
-- Assigned Spots: 115
-- Unassigned Spots: 2

-- Verify the data:
-- SELECT COUNT(*) FROM users;
-- SELECT COUNT(*) FROM parking_spots;
-- SELECT COUNT(*) FROM parking_spots WHERE owner_id IS NOT NULL;