-- ============================================
-- BCI ParkShare Production Data Population Script
-- Generated: 2025-12-18T00:41:25.381Z
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
INSERT INTO departments (name, slug, is_active) VALUES ('Capital Markets & Credit Investments', 'capital-markets-credit-investments', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO departments (name, slug, is_active) VALUES ('Compliance', 'compliance', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO departments (name, slug, is_active) VALUES ('Corporate Investment Risk', 'corporate-investment-risk', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO departments (name, slug, is_active) VALUES ('Corporate Operations', 'corporate-operations', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO departments (name, slug, is_active) VALUES ('Credit Risk & Analytics', 'credit-risk-analytics', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO departments (name, slug, is_active) VALUES ('Finance', 'finance', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO departments (name, slug, is_active) VALUES ('Human Resources', 'human-resources', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO departments (name, slug, is_active) VALUES ('Infrastructure', 'infrastructure', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO departments (name, slug, is_active) VALUES ('Infrastructure & Renewable Resources', 'infrastructure-renewable-resources', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO departments (name, slug, is_active) VALUES ('Investment Operations', 'investment-operations', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO departments (name, slug, is_active) VALUES ('Investment Strategy & Risk', 'investment-strategy-risk', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO departments (name, slug, is_active) VALUES ('Legal', 'legal', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO departments (name, slug, is_active) VALUES ('Legal Affairs & General Counsel', 'legal-affairs-general-counsel', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO departments (name, slug, is_active) VALUES ('Office of the CEO', 'office-of-the-ceo', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO departments (name, slug, is_active) VALUES ('Private Equity', 'private-equity', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO departments (name, slug, is_active) VALUES ('Technology', 'technology', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO departments (name, slug, is_active) VALUES ('only for the month of January then Sarah Fung', 'only-for-the-month-of-january-then-sarah-fung', true) ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- 3. USERS
-- ============================================
-- Note: Users will be created with placeholder data.
-- They will be fully populated when they log in via OIDC.


INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Jon Perry',
  'jon.perry@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'infrastructure' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Adam Myles',
  'adam.myles@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'capital-markets-credit-investments' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Debra Martin',
  'debra.martin@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'technology' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Murray Duncan',
  'murray.duncan@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'finance' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Sara Heck',
  'sara.heck@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'investment-operations' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Jeff Coates',
  'jeff.coates@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'infrastructure-renewable-resources' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Steven Henderson',
  'steven.henderson@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'investment-strategy-risk' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Tony Payne',
  'tony.payne@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'technology' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Lincoln Webb',
  'lincoln.webb@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'infrastructure' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Jeremy Trickett',
  'jeremy.trickett@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'legal' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Rechelle Effendy',
  'rechelle.effendy@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'finance' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Norine Hale',
  'norine.hale@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'human-resources' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Samir Ben Tekaya',
  'samir.tekaya@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'investment-strategy-risk' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Mark Johnston',
  'mark.johnston@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'private-equity' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Winston Lin',
  'winston.lin@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'finance' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'David Dobell',
  'david.dobell@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'capital-markets-credit-investments' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Ke Min',
  'ke.min@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'investment-strategy-risk' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Rod Prat',
  'rod.prat@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'capital-markets-credit-investments' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Jeff Morris',
  'jeff.morris@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'capital-markets-credit-investments' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'David McGowan',
  'david.mcgowan@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'investment-strategy-risk' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Daryl Thompson',
  'daryl.thompson@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'finance' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Amandeep Hundal',
  'amandeep.hundal@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'capital-markets-credit-investments' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Samir Dhrolia',
  'samir.dhrolia@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'capital-markets-credit-investments' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Jennifer Hartfield',
  'jennifer.hartfield@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'corporate-operations' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Jeff Antonik',
  'jeff.antonik@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'capital-markets-credit-investments' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Denis Miron',
  'denis.miron@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'capital-markets-credit-investments' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Lindsay Wakelin',
  'lindsay.wakelin@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'investment-operations' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Himani Gambhir',
  'himani.gambhir@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'investment-strategy-risk' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Jerry Divoky',
  'jerry.divoky@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'infrastructure' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Chelsea Gagne',
  'chelsea.gagne@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'corporate-operations' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'COO Parking Spot #2',
  'coo.#2@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'corporate-operations' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Gordon Fyfe',
  'gordon.fyfe@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'office-of-the-ceo' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Shauna Lukaitis',
  'shauna.lukaitis@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'corporate-operations' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Daniel Garant',
  'daniel.garant@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'capital-markets-credit-investments' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Umar Malik',
  'umar.malik@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'private-equity' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Ramy Rayes',
  'ramy.rayes@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'investment-strategy-risk' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Michel Drolet',
  'michel.drolet@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'credit-risk-analytics' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Monique Brosseau',
  'monique.brosseau@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'investment-operations' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Jessica Goddard',
  'jessica.goddard@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'finance' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Andrew Morris',
  'andrew.morris@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'finance' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Joel McCallum',
  'joel.mccallum@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'investment-operations' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Kelly Chaplin',
  'kelly.chaplin@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'private-equity' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Valentyn Shmygelskyy',
  'valentyn.shmygelskyy@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'private-equity' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Ian Wanke',
  'ian.wanke@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'private-equity' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Lindsay Holland',
  'lindsay.holland@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'legal-affairs-general-counsel' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Brianna Wright',
  'brianna.wright@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'only-for-the-month-of-january-then-sarah-fung' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'P2',
  'p2@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'general' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Susan Golyak',
  'susan.golyak@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'capital-markets-credit-investments' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Taylor MacDougal',
  'taylor.macdougal@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'capital-markets-credit-investments' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Hind Breen',
  'hind.breen@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'legal-affairs-general-counsel' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Jill O Connell',
  'jill.connell@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'human-resources' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Bhupinder Dulku',
  'bhupinder.dulku@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'investment-strategy-risk' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Evan Mitchell',
  'evan.mitchell@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'capital-markets-credit-investments' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Lana Meyer',
  'lana.meyer@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'finance' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Donna Mueller',
  'donna.mueller@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'finance' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Bob Sangha',
  'bob.sangha@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'investment-operations' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Natalie Fairbrother',
  'natalie.fairbrother@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'finance' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Michelle Loveless',
  'michelle.loveless@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'human-resources' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Matt Murray',
  'matt.murray@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'investment-strategy-risk' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Emily Lapinski',
  'emily.lapinski@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'general' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Scott Bulmer',
  'scott.bulmer@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'technology' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Maren Rix',
  'maren.rix@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'finance' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Eric Wan',
  'eric.wan@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'capital-markets-credit-investments' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Michael Cavallin',
  'michael.cavallin@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'technology' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Maria Hla-Tin',
  'maria.hla-tin@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'office-of-the-ceo' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Andrea Zhang',
  'andrea.zhang@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'capital-markets-credit-investments' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Elizabeth Slawinska',
  'elizabeth.slawinska@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'capital-markets-credit-investments' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Devin Blackmore',
  'devin.blackmore@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'finance' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Talya Christbason',
  'talya.christbason@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'technology' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Hardeep Bamara',
  'hardeep.bamara@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'capital-markets-credit-investments' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Caglar Somek',
  'caglar.somek@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'capital-markets-credit-investments' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Michael Mercier',
  'michael.mercier@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'legal' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Johann Kuntze',
  'johann.kuntze@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'investment-strategy-risk' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Saina Singera',
  'saina.singera@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'finance' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Amy Chang',
  'amy.chang@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'capital-markets-credit-investments' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Sean Mcllmoyle',
  'sean.mcllmoyle@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'finance' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Cameron Elford',
  'cameron.elford@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'technology' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Tannis Harper',
  'tannis.harper@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'human-resources' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Megan Scholz',
  'megan.scholz@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'compliance' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'WPS',
  'wps@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'general' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Matthew Kaeshammer',
  'matthew.kaeshammer@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'finance' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Teeravit Chintawongvanich',
  'teeravit.chintawongvanich@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'credit-risk-analytics' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Armon Alamolhoda',
  'armon.alamolhoda@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'capital-markets-credit-investments' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Baldeep Waraich',
  'baldeep.waraich@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'technology' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Jenny Gan',
  'jenny.gan@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'finance' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Steve Fedberg',
  'steve.fedberg@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'technology' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'John Lee',
  'john.lee@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'private-equity' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Paul Hodson',
  'paul.hodson@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'technology' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Gerard Daniel',
  'gerard.daniel@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'corporate-investment-risk' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Chris Reid',
  'chris.reid@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'investment-strategy-risk' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Lauren Fradgley',
  'lauren.fradgley@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'capital-markets-credit-investments' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Lisa Whish',
  'lisa.whish@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'legal' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Mihail Garchev',
  'mihail.garchev@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'investment-strategy-risk' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Karen Ward',
  'karen.ward@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'human-resources' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Sarah Dorrington',
  'sarah.dorrington@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'capital-markets-credit-investments' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Allison Knowles',
  'allison.knowles@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'investment-operations' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Asad Rawra',
  'asad.rawra@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'private-equity' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Maggie Sewagudde-Peden',
  'maggie.sewagudde-peden@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'investment-operations' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Sarah Wilde Moreau',
  'sarah.moreau@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'private-equity' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'David Antonik',
  'david.antonik@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'credit-risk-analytics' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Rob Blazey',
  'rob.blazey@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'investment-strategy-risk' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Sarah Cunningham',
  'sarah.cunningham@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'legal' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Jesus Alva',
  'jesus.alva@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'investment-operations' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Cathy Lin',
  'cathy.lin@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'legal' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Allan Ashford',
  'allan.ashford@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'legal' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Wendy Ramlochan',
  'wendy.ramlochan@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'investment-strategy-risk' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Aaron Leskiw',
  'aaron.leskiw@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'technology' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Hazlitt Gill',
  'hazlitt.gill@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'capital-markets-credit-investments' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Miriam Abdelli',
  'miriam.abdelli@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'investment-strategy-risk' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Gina Dennison',
  'gina.dennison@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'investment-operations' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Rachel Vaughan',
  'rachel.vaughan@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'investment-strategy-risk' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Daisy Klaibert',
  'daisy.klaibert@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'capital-markets-credit-investments' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Alan Cooper',
  'alan.cooper@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'capital-markets-credit-investments' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

INSERT INTO users (name, email, roles, department, is_active, created_at)
VALUES (
  'Tyler Folliott',
  'tyler.folliott@bci.ca',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE slug = 'capital-markets-credit-investments' LIMIT 1),
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  roles = CASE 
    WHEN NOT ('owner' = ANY(users.roles)) THEN array_append(users.roles, 'owner')
    ELSE users.roles
  END,
  department = COALESCE(EXCLUDED.department, users.department);

-- ============================================
-- 4. PARKING SPOTS
-- ============================================
-- Note: All spots are at Victoria location (location_id = 1)
-- Adjust location_id if needed for your setup.


INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P32',
  '32',
  1,
  (SELECT id FROM spot_types WHERE slug = 'tesla-chargers' LIMIT 1),
  true,
  true,
  'Electric Vehicle Parking *TESLA*'
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P33',
  '33',
  1,
  (SELECT id FROM spot_types WHERE slug = 'tesla-chargers' LIMIT 1),
  true,
  true,
  'Electric Vehicle Parking *TESLA*'
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P34',
  '34',
  1,
  (SELECT id FROM spot_types WHERE slug = 'tesla-chargers' LIMIT 1),
  true,
  true,
  'Electric Vehicle Parking *TESLA*'
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P37',
  '37',
  1,
  (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  true,
  true,
  'Electric Vehicle Parking'
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P38',
  '38',
  1,
  (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  true,
  true,
  'Electric Vehicle Parking'
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P39',
  '39',
  1,
  (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  true,
  true,
  'Electric Vehicle Parking'
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P40',
  '40',
  1,
  (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  true,
  true,
  'Electric Vehicle Parking'
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P41',
  '41',
  1,
  (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  true,
  true,
  'Electric Vehicle Parking'
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P42',
  '42',
  1,
  (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  true,
  true,
  'EV stall'
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P43',
  '43',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P44',
  '44',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P45',
  '45',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P46',
  '46',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P47',
  '47',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P48',
  '48',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P49',
  '49',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P50',
  '50',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  'Capital Markets & Credit Investments Spot'
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P51',
  '51',
  1,
  (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  true,
  true,
  'Electric Vehicle Parking'
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P52',
  '52',
  1,
  (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  true,
  true,
  'Electric Vehicle Parking'
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P53',
  '53',
  1,
  (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  true,
  true,
  'Electric Vehicle Parking'
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P54',
  '54',
  1,
  (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  true,
  true,
  'Electric Vehicle Parking'
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P55',
  '55',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P56',
  '56',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P57',
  '57',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  'Capital Markets & Credit Investments Spot'
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P58',
  '58',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P59',
  '59',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  'Capital Markets & Credit Investments Spot'
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P60',
  '60',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  'Capital Markets & Credit Investments Spot'
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P61',
  '61',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P62',
  '62',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P84',
  '84',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P85',
  '85',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P86',
  '86',
  1,
  (SELECT id FROM spot_types WHERE slug = 'accessible' LIMIT 1),
  true,
  true,
  'FOR BOARD MEMBER USE / Wheelchair Parking'
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P87',
  '87',
  1,
  (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  true,
  true,
  'CEO PARKING - Electric - EV'
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P88',
  '88',
  1,
  (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  true,
  true,
  'COO PARKING - Electric - EV'
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P89',
  '89',
  1,
  (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  true,
  true,
  'EVP PARKING'
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P90',
  '90',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P91',
  '91',
  1,
  (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  true,
  true,
  'EVP PARKING - Electric - EV'
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P92',
  '92',
  1,
  (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  true,
  true,
  'SVP PARKING - Electric - EV'
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P93',
  '93',
  1,
  (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  true,
  true,
  'SVP PARKING - Electric - EV'
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P94',
  '94',
  1,
  (SELECT id FROM spot_types WHERE slug = 'ev-chargers' LIMIT 1),
  true,
  true,
  'EVP PARKING - Electric - EV'
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P95',
  '95',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P96',
  '96',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P97',
  '97',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P98',
  '98',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P99',
  '99',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P100',
  '100',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P101',
  '101',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P102',
  '102',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'undefined',
  'undefined',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P134',
  '134',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P135',
  '135',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P136',
  '136',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P137',
  '137',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P138',
  '138',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P139',
  '139',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P140',
  '140',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P141',
  '141',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P142',
  '142',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P143',
  '143',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P144',
  '144',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P145',
  '145',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P146',
  '146',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P147',
  '147',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P148',
  '148',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P149',
  '149',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P150',
  '150',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P151',
  '151',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P152',
  '152',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P153',
  '153',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P154',
  '154',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P155',
  '155',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P156',
  '156',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P157',
  '157',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P158',
  '158',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P159',
  '159',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P160',
  '160',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P161',
  '161',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P162',
  '162',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P163',
  '163',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P164',
  '164',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P165',
  '165',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P166',
  '166',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P167',
  '167',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P168',
  '168',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P169',
  '169',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P170',
  '170',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P171',
  '171',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P172',
  '172',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P173',
  '173',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P174',
  '174',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P175',
  '175',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P176',
  '176',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P177',
  '177',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P181',
  '181',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P182',
  '182',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P183',
  '183',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P184',
  '184',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P185',
  '185',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P186',
  '186',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P187',
  '187',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P188',
  '188',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P189',
  '189',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P190',
  '190',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P191',
  '191',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P192',
  '192',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P193',
  '193',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P194',
  '194',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P195',
  '195',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P196',
  '196',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P197',
  '197',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P198',
  '198',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P199',
  '199',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P200',
  '200',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P201',
  '201',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P202',
  '202',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P203',
  '203',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  'Capital Markets & Credit Investments Spot'
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

INSERT INTO parking_spots (
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  notes
)
VALUES (
  'P204',
  '204',
  1,
  (SELECT id FROM spot_types WHERE slug = 'regular' LIMIT 1),
  true,
  true,
  NULL
)
ON CONFLICT (spot_number) DO UPDATE SET
  seat_number = EXCLUDED.seat_number,
  spot_type_id = EXCLUDED.spot_type_id,
  notes = EXCLUDED.notes;

-- ============================================
-- 5. SPOT ASSIGNMENTS
-- ============================================

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'jon.perry@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P32'
  AND (SELECT id FROM users WHERE email = 'jon.perry@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'adam.myles@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P33'
  AND (SELECT id FROM users WHERE email = 'adam.myles@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'debra.martin@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P34'
  AND (SELECT id FROM users WHERE email = 'debra.martin@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'murray.duncan@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P37'
  AND (SELECT id FROM users WHERE email = 'murray.duncan@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'sara.heck@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P38'
  AND (SELECT id FROM users WHERE email = 'sara.heck@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'jeff.coates@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P39'
  AND (SELECT id FROM users WHERE email = 'jeff.coates@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'steven.henderson@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P40'
  AND (SELECT id FROM users WHERE email = 'steven.henderson@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'tony.payne@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P42'
  AND (SELECT id FROM users WHERE email = 'tony.payne@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'lincoln.webb@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P43'
  AND (SELECT id FROM users WHERE email = 'lincoln.webb@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'jeremy.trickett@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P44'
  AND (SELECT id FROM users WHERE email = 'jeremy.trickett@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'rechelle.effendy@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P45'
  AND (SELECT id FROM users WHERE email = 'rechelle.effendy@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'norine.hale@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P46'
  AND (SELECT id FROM users WHERE email = 'norine.hale@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'samir.tekaya@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P47'
  AND (SELECT id FROM users WHERE email = 'samir.tekaya@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'mark.johnston@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P48'
  AND (SELECT id FROM users WHERE email = 'mark.johnston@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'winston.lin@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P49'
  AND (SELECT id FROM users WHERE email = 'winston.lin@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'david.dobell@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P50'
  AND (SELECT id FROM users WHERE email = 'david.dobell@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'ke.min@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P51'
  AND (SELECT id FROM users WHERE email = 'ke.min@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'rod.prat@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P52'
  AND (SELECT id FROM users WHERE email = 'rod.prat@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'jeff.morris@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P53'
  AND (SELECT id FROM users WHERE email = 'jeff.morris@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'david.mcgowan@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P54'
  AND (SELECT id FROM users WHERE email = 'david.mcgowan@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'daryl.thompson@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P55'
  AND (SELECT id FROM users WHERE email = 'daryl.thompson@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'amandeep.hundal@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P56'
  AND (SELECT id FROM users WHERE email = 'amandeep.hundal@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'samir.dhrolia@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P57'
  AND (SELECT id FROM users WHERE email = 'samir.dhrolia@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'jennifer.hartfield@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P58'
  AND (SELECT id FROM users WHERE email = 'jennifer.hartfield@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'jeff.antonik@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P59'
  AND (SELECT id FROM users WHERE email = 'jeff.antonik@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'denis.miron@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P60'
  AND (SELECT id FROM users WHERE email = 'denis.miron@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'lindsay.wakelin@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P61'
  AND (SELECT id FROM users WHERE email = 'lindsay.wakelin@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'himani.gambhir@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P62'
  AND (SELECT id FROM users WHERE email = 'himani.gambhir@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'jerry.divoky@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P84'
  AND (SELECT id FROM users WHERE email = 'jerry.divoky@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'chelsea.gagne@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P85'
  AND (SELECT id FROM users WHERE email = 'chelsea.gagne@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'coo.#2@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P86'
  AND (SELECT id FROM users WHERE email = 'coo.#2@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'gordon.fyfe@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P87'
  AND (SELECT id FROM users WHERE email = 'gordon.fyfe@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'shauna.lukaitis@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P88'
  AND (SELECT id FROM users WHERE email = 'shauna.lukaitis@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'daniel.garant@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P89'
  AND (SELECT id FROM users WHERE email = 'daniel.garant@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'umar.malik@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P90'
  AND (SELECT id FROM users WHERE email = 'umar.malik@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'ramy.rayes@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P91'
  AND (SELECT id FROM users WHERE email = 'ramy.rayes@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'michel.drolet@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P92'
  AND (SELECT id FROM users WHERE email = 'michel.drolet@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'monique.brosseau@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P93'
  AND (SELECT id FROM users WHERE email = 'monique.brosseau@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'jessica.goddard@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P95'
  AND (SELECT id FROM users WHERE email = 'jessica.goddard@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'andrew.morris@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P96'
  AND (SELECT id FROM users WHERE email = 'andrew.morris@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'joel.mccallum@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P97'
  AND (SELECT id FROM users WHERE email = 'joel.mccallum@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'kelly.chaplin@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P98'
  AND (SELECT id FROM users WHERE email = 'kelly.chaplin@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'valentyn.shmygelskyy@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P99'
  AND (SELECT id FROM users WHERE email = 'valentyn.shmygelskyy@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'ian.wanke@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P100'
  AND (SELECT id FROM users WHERE email = 'ian.wanke@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'lindsay.holland@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P101'
  AND (SELECT id FROM users WHERE email = 'lindsay.holland@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'brianna.wright@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P102'
  AND (SELECT id FROM users WHERE email = 'brianna.wright@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'p2@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'undefined'
  AND (SELECT id FROM users WHERE email = 'p2@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'susan.golyak@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P134'
  AND (SELECT id FROM users WHERE email = 'susan.golyak@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'taylor.macdougal@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P135'
  AND (SELECT id FROM users WHERE email = 'taylor.macdougal@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'hind.breen@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P136'
  AND (SELECT id FROM users WHERE email = 'hind.breen@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'jill.connell@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P137'
  AND (SELECT id FROM users WHERE email = 'jill.connell@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'bhupinder.dulku@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P138'
  AND (SELECT id FROM users WHERE email = 'bhupinder.dulku@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'evan.mitchell@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P139'
  AND (SELECT id FROM users WHERE email = 'evan.mitchell@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'lana.meyer@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P140'
  AND (SELECT id FROM users WHERE email = 'lana.meyer@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'donna.mueller@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P141'
  AND (SELECT id FROM users WHERE email = 'donna.mueller@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'bob.sangha@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P142'
  AND (SELECT id FROM users WHERE email = 'bob.sangha@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'natalie.fairbrother@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P143'
  AND (SELECT id FROM users WHERE email = 'natalie.fairbrother@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'michelle.loveless@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P144'
  AND (SELECT id FROM users WHERE email = 'michelle.loveless@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'matt.murray@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P145'
  AND (SELECT id FROM users WHERE email = 'matt.murray@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'emily.lapinski@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P146'
  AND (SELECT id FROM users WHERE email = 'emily.lapinski@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'scott.bulmer@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P147'
  AND (SELECT id FROM users WHERE email = 'scott.bulmer@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'maren.rix@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P148'
  AND (SELECT id FROM users WHERE email = 'maren.rix@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'eric.wan@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P149'
  AND (SELECT id FROM users WHERE email = 'eric.wan@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'michael.cavallin@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P150'
  AND (SELECT id FROM users WHERE email = 'michael.cavallin@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'maria.hla-tin@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P151'
  AND (SELECT id FROM users WHERE email = 'maria.hla-tin@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'andrea.zhang@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P152'
  AND (SELECT id FROM users WHERE email = 'andrea.zhang@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'elizabeth.slawinska@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P153'
  AND (SELECT id FROM users WHERE email = 'elizabeth.slawinska@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'devin.blackmore@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P154'
  AND (SELECT id FROM users WHERE email = 'devin.blackmore@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'talya.christbason@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P155'
  AND (SELECT id FROM users WHERE email = 'talya.christbason@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'hardeep.bamara@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P156'
  AND (SELECT id FROM users WHERE email = 'hardeep.bamara@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'caglar.somek@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P157'
  AND (SELECT id FROM users WHERE email = 'caglar.somek@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'michael.mercier@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P158'
  AND (SELECT id FROM users WHERE email = 'michael.mercier@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'johann.kuntze@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P159'
  AND (SELECT id FROM users WHERE email = 'johann.kuntze@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'saina.singera@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P160'
  AND (SELECT id FROM users WHERE email = 'saina.singera@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'amy.chang@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P161'
  AND (SELECT id FROM users WHERE email = 'amy.chang@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'sean.mcllmoyle@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P162'
  AND (SELECT id FROM users WHERE email = 'sean.mcllmoyle@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'cameron.elford@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P163'
  AND (SELECT id FROM users WHERE email = 'cameron.elford@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'tannis.harper@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P164'
  AND (SELECT id FROM users WHERE email = 'tannis.harper@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'megan.scholz@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P165'
  AND (SELECT id FROM users WHERE email = 'megan.scholz@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'wps@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P166'
  AND (SELECT id FROM users WHERE email = 'wps@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'matthew.kaeshammer@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P167'
  AND (SELECT id FROM users WHERE email = 'matthew.kaeshammer@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'teeravit.chintawongvanich@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P168'
  AND (SELECT id FROM users WHERE email = 'teeravit.chintawongvanich@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'armon.alamolhoda@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P169'
  AND (SELECT id FROM users WHERE email = 'armon.alamolhoda@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'baldeep.waraich@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P170'
  AND (SELECT id FROM users WHERE email = 'baldeep.waraich@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'jenny.gan@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P171'
  AND (SELECT id FROM users WHERE email = 'jenny.gan@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'steve.fedberg@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P172'
  AND (SELECT id FROM users WHERE email = 'steve.fedberg@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'john.lee@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P173'
  AND (SELECT id FROM users WHERE email = 'john.lee@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'paul.hodson@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P174'
  AND (SELECT id FROM users WHERE email = 'paul.hodson@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'gerard.daniel@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P175'
  AND (SELECT id FROM users WHERE email = 'gerard.daniel@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'chris.reid@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P176'
  AND (SELECT id FROM users WHERE email = 'chris.reid@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'lauren.fradgley@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P177'
  AND (SELECT id FROM users WHERE email = 'lauren.fradgley@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'lisa.whish@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P181'
  AND (SELECT id FROM users WHERE email = 'lisa.whish@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'mihail.garchev@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P182'
  AND (SELECT id FROM users WHERE email = 'mihail.garchev@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'karen.ward@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P183'
  AND (SELECT id FROM users WHERE email = 'karen.ward@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'sarah.dorrington@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P184'
  AND (SELECT id FROM users WHERE email = 'sarah.dorrington@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'wps@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P185'
  AND (SELECT id FROM users WHERE email = 'wps@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'allison.knowles@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P186'
  AND (SELECT id FROM users WHERE email = 'allison.knowles@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'asad.rawra@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P187'
  AND (SELECT id FROM users WHERE email = 'asad.rawra@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'maggie.sewagudde-peden@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P188'
  AND (SELECT id FROM users WHERE email = 'maggie.sewagudde-peden@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'sarah.moreau@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P189'
  AND (SELECT id FROM users WHERE email = 'sarah.moreau@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'david.antonik@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P190'
  AND (SELECT id FROM users WHERE email = 'david.antonik@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'rob.blazey@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P191'
  AND (SELECT id FROM users WHERE email = 'rob.blazey@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'sarah.cunningham@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P192'
  AND (SELECT id FROM users WHERE email = 'sarah.cunningham@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'jesus.alva@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P193'
  AND (SELECT id FROM users WHERE email = 'jesus.alva@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'cathy.lin@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P194'
  AND (SELECT id FROM users WHERE email = 'cathy.lin@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'allan.ashford@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P195'
  AND (SELECT id FROM users WHERE email = 'allan.ashford@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'wendy.ramlochan@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P196'
  AND (SELECT id FROM users WHERE email = 'wendy.ramlochan@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'aaron.leskiw@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P197'
  AND (SELECT id FROM users WHERE email = 'aaron.leskiw@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'hazlitt.gill@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P198'
  AND (SELECT id FROM users WHERE email = 'hazlitt.gill@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'miriam.abdelli@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P199'
  AND (SELECT id FROM users WHERE email = 'miriam.abdelli@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'gina.dennison@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P200'
  AND (SELECT id FROM users WHERE email = 'gina.dennison@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'rachel.vaughan@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P201'
  AND (SELECT id FROM users WHERE email = 'rachel.vaughan@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'daisy.klaibert@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P202'
  AND (SELECT id FROM users WHERE email = 'daisy.klaibert@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'alan.cooper@bci.ca' LIMIT 1),
  is_available = false
WHERE spot_number = 'P203'
  AND (SELECT id FROM users WHERE email = 'alan.cooper@bci.ca' LIMIT 1) IS NOT NULL;

UPDATE parking_spots
SET 
  assigned_user_id = (SELECT id FROM users WHERE email = 'tyler.folliott@bci.ca' LIMIT 1),
  is_available = false
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
-- SELECT COUNT(*) FROM parking_spots WHERE assigned_user_id IS NOT NULL;