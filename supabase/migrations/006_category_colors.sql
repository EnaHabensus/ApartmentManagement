ALTER TABLE expense_categories ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#3B82F6';

UPDATE expense_categories SET color = '#3B82F6' WHERE name = 'Režije';
UPDATE expense_categories SET color = '#10B981' WHERE name = 'Sredstva za čišćenje';
UPDATE expense_categories SET color = '#F59E0B' WHERE name = 'Parking';
UPDATE expense_categories SET color = '#EF4444' WHERE name = 'Popravci i održavanje';
UPDATE expense_categories SET color = '#8B5CF6' WHERE name = 'Ostalo';
