-- Script to create/update parking spots 140-204 (excluding 152, 163, 178-180)
-- Sets location to Level 2 (location_id = 2) and prefixes spot numbers with "P"

-- First, update existing spots 201-204 to have P prefix
UPDATE parking_spots SET spot_number = 'P' || spot_number WHERE spot_number IN ('201', '202', '203', '204');

-- Insert spots 140-151 (P140-P151)
INSERT INTO parking_spots (id, spot_number, location_id, spot_type_id, is_bci_managed, is_active, is_bookable)
VALUES
  ('spot-P140', 'P140', 2, 1, true, true, true),
  ('spot-P141', 'P141', 2, 1, true, true, true),
  ('spot-P142', 'P142', 2, 1, true, true, true),
  ('spot-P143', 'P143', 2, 1, true, true, true),
  ('spot-P144', 'P144', 2, 1, true, true, true),
  ('spot-P145', 'P145', 2, 1, true, true, true),
  ('spot-P146', 'P146', 2, 1, true, true, true),
  ('spot-P147', 'P147', 2, 1, true, true, true),
  ('spot-P148', 'P148', 2, 1, true, true, true),
  ('spot-P149', 'P149', 2, 1, true, true, true),
  ('spot-P150', 'P150', 2, 1, true, true, true),
  ('spot-P151', 'P151', 2, 1, true, true, true);

-- Insert spots 153-162 (P153-P162)
INSERT INTO parking_spots (id, spot_number, location_id, spot_type_id, is_bci_managed, is_active, is_bookable)
VALUES
  ('spot-P153', 'P153', 2, 1, true, true, true),
  ('spot-P154', 'P154', 2, 1, true, true, true),
  ('spot-P155', 'P155', 2, 1, true, true, true),
  ('spot-P156', 'P156', 2, 1, true, true, true),
  ('spot-P157', 'P157', 2, 1, true, true, true),
  ('spot-P158', 'P158', 2, 1, true, true, true),
  ('spot-P159', 'P159', 2, 1, true, true, true),
  ('spot-P160', 'P160', 2, 1, true, true, true),
  ('spot-P161', 'P161', 2, 1, true, true, true),
  ('spot-P162', 'P162', 2, 1, true, true, true);

-- Insert spots 164-177 (P164-P177)
INSERT INTO parking_spots (id, spot_number, location_id, spot_type_id, is_bci_managed, is_active, is_bookable)
VALUES
  ('spot-P164', 'P164', 2, 1, true, true, true),
  ('spot-P165', 'P165', 2, 1, true, true, true),
  ('spot-P166', 'P166', 2, 1, true, true, true),
  ('spot-P167', 'P167', 2, 1, true, true, true),
  ('spot-P168', 'P168', 2, 1, true, true, true),
  ('spot-P169', 'P169', 2, 1, true, true, true),
  ('spot-P170', 'P170', 2, 1, true, true, true),
  ('spot-P171', 'P171', 2, 1, true, true, true),
  ('spot-P172', 'P172', 2, 1, true, true, true),
  ('spot-P173', 'P173', 2, 1, true, true, true),
  ('spot-P174', 'P174', 2, 1, true, true, true),
  ('spot-P175', 'P175', 2, 1, true, true, true),
  ('spot-P176', 'P176', 2, 1, true, true, true),
  ('spot-P177', 'P177', 2, 1, true, true, true);

-- Insert spots 181-200 (P181-P200)
INSERT INTO parking_spots (id, spot_number, location_id, spot_type_id, is_bci_managed, is_active, is_bookable)
VALUES
  ('spot-P181', 'P181', 2, 1, true, true, true),
  ('spot-P182', 'P182', 2, 1, true, true, true),
  ('spot-P183', 'P183', 2, 1, true, true, true),
  ('spot-P184', 'P184', 2, 1, true, true, true),
  ('spot-P185', 'P185', 2, 1, true, true, true),
  ('spot-P186', 'P186', 2, 1, true, true, true),
  ('spot-P187', 'P187', 2, 1, true, true, true),
  ('spot-P188', 'P188', 2, 1, true, true, true),
  ('spot-P189', 'P189', 2, 1, true, true, true),
  ('spot-P190', 'P190', 2, 1, true, true, true),
  ('spot-P191', 'P191', 2, 1, true, true, true),
  ('spot-P192', 'P192', 2, 1, true, true, true),
  ('spot-P193', 'P193', 2, 1, true, true, true),
  ('spot-P194', 'P194', 2, 1, true, true, true),
  ('spot-P195', 'P195', 2, 1, true, true, true),
  ('spot-P196', 'P196', 2, 1, true, true, true),
  ('spot-P197', 'P197', 2, 1, true, true, true),
  ('spot-P198', 'P198', 2, 1, true, true, true),
  ('spot-P199', 'P199', 2, 1, true, true, true),
  ('spot-P200', 'P200', 2, 1, true, true, true);
