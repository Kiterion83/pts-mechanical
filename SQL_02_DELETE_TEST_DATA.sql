-- ============================================================================
-- CANCELLA TUTTI I DATI DI TEST
-- Esegui questo script per rimuovere tutti i dati con prefisso "TEST-"
-- ============================================================================

-- Prima elimina le dipendenze
DELETE FROM squad_members WHERE squad_id IN (
  SELECT id FROM squads WHERE name LIKE 'TEST-%'
);

DELETE FROM squad_foreman_history WHERE squad_id IN (
  SELECT id FROM squads WHERE name LIKE 'TEST-%'
);

DELETE FROM squads WHERE name LIKE 'TEST-%';

DELETE FROM personnel_project_assignments WHERE badge_number LIKE 'TEST-%';

DELETE FROM personnel WHERE badge_number LIKE 'TEST-%';

DELETE FROM companies WHERE code LIKE 'TEST-%';

DELETE FROM areas WHERE code LIKE 'TEST-%';

DELETE FROM project_holidays WHERE project_id IN (
  SELECT id FROM projects WHERE code LIKE 'TEST-%'
);

DELETE FROM user_project_roles WHERE project_id IN (
  SELECT id FROM projects WHERE code LIKE 'TEST-%'
);

DELETE FROM projects WHERE code LIKE 'TEST-%';

-- Cancella anche il progetto demo iniziale se esiste
DELETE FROM user_project_roles WHERE project_id IN (
  SELECT id FROM projects WHERE code = 'PRJ-DEMO-001'
);

DELETE FROM areas WHERE project_id IN (
  SELECT id FROM projects WHERE code = 'PRJ-DEMO-001'
);

DELETE FROM projects WHERE code = 'PRJ-DEMO-001';

-- Verifica
SELECT 'Progetti rimasti:' as info, COUNT(*) as count FROM projects;
SELECT 'Personnel rimasti:' as info, COUNT(*) as count FROM personnel;
SELECT 'Squads rimasti:' as info, COUNT(*) as count FROM squads;
