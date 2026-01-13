-- ============================================================================
-- PTS DATABASE MIGRATION v3.0
-- Nuova architettura con gestione storico personale e permessi ruoli
-- ============================================================================

-- ============================================================================
-- PARTE 1: BACKUP E PREPARAZIONE
-- ============================================================================

-- Prima verifichiamo cosa abbiamo
SELECT 'Progetti esistenti:' as info, COUNT(*) FROM projects;
SELECT 'Personnel esistente:' as info, COUNT(*) FROM personnel;
SELECT 'Subcontractors esistenti:' as info, COUNT(*) FROM subcontractors;
SELECT 'Squads esistenti:' as info, COUNT(*) FROM squads;

-- ============================================================================
-- PARTE 2: NUOVI TIPI ENUM PER RUOLI
-- ============================================================================

-- Aggiorna i ruoli disponibili
DO $$ 
BEGIN
    -- Verifica se il tipo esiste e aggiorna
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        -- Aggiungi nuovi valori se non esistono
        BEGIN
            ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'pm';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        BEGIN
            ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'site_manager';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        BEGIN
            ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'pem';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        BEGIN
            ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'engineer';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        BEGIN
            ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'planner';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
    END IF;
END $$;

-- ============================================================================
-- PARTE 3: RINOMINA SUBCONTRACTORS -> COMPANIES
-- ============================================================================

-- Rinomina la tabella
ALTER TABLE IF EXISTS subcontractors RENAME TO companies;

-- Aggiungi colonna is_main se non esiste
ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_main BOOLEAN DEFAULT false;

-- Aggiorna l'indice se esiste
DROP INDEX IF EXISTS idx_subcontractors_project;
CREATE INDEX IF NOT EXISTS idx_companies_project ON companies(project_id);
CREATE INDEX IF NOT EXISTS idx_companies_is_main ON companies(project_id, is_main) WHERE is_main = true;

-- Aggiorna foreign key in personnel (se esiste)
-- Prima verifichiamo se la colonna si chiama ancora subcontractor_id
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'personnel' AND column_name = 'subcontractor_id') THEN
        ALTER TABLE personnel RENAME COLUMN subcontractor_id TO company_id;
    END IF;
END $$;

-- ============================================================================
-- PARTE 4: MODIFICA TABELLA PERSONNEL
-- ============================================================================

-- Aggiungi colonne mancanti a personnel
ALTER TABLE personnel ADD COLUMN IF NOT EXISTS username VARCHAR(100);
ALTER TABLE personnel ADD COLUMN IF NOT EXISTS can_login BOOLEAN DEFAULT false;
ALTER TABLE personnel ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id);

-- Crea indice per username
CREATE UNIQUE INDEX IF NOT EXISTS idx_personnel_username ON personnel(username) WHERE username IS NOT NULL;

-- ============================================================================
-- PARTE 5: NUOVA TABELLA PERSONNEL_PROJECT_ASSIGNMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS personnel_project_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    personnel_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    badge_number VARCHAR(50) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'operator',
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'transferred', 'terminated')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Badge univoco per progetto (solo per assegnazioni attive)
    CONSTRAINT unique_badge_per_project UNIQUE (project_id, badge_number)
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_ppa_personnel ON personnel_project_assignments(personnel_id);
CREATE INDEX IF NOT EXISTS idx_ppa_project ON personnel_project_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_ppa_active ON personnel_project_assignments(project_id, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_ppa_company ON personnel_project_assignments(company_id);

-- Trigger per updated_at
CREATE OR REPLACE FUNCTION update_ppa_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ppa_updated_at ON personnel_project_assignments;
CREATE TRIGGER trigger_ppa_updated_at
    BEFORE UPDATE ON personnel_project_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_ppa_updated_at();

-- RLS per personnel_project_assignments
ALTER TABLE personnel_project_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view assignments for their projects" ON personnel_project_assignments
    FOR SELECT USING (
        project_id IN (
            SELECT project_id FROM user_project_roles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage assignments" ON personnel_project_assignments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_project_roles 
            WHERE user_id = auth.uid() 
            AND project_id = personnel_project_assignments.project_id
            AND role IN ('admin', 'pm', 'site_manager', 'cm', 'pem', 'engineer', 'planner')
        )
    );

-- ============================================================================
-- PARTE 6: NUOVA TABELLA SQUAD_FOREMAN_HISTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS squad_foreman_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    squad_id UUID NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
    foreman_assignment_id UUID NOT NULL REFERENCES personnel_project_assignments(id) ON DELETE CASCADE,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sfh_squad ON squad_foreman_history(squad_id);
CREATE INDEX IF NOT EXISTS idx_sfh_foreman ON squad_foreman_history(foreman_assignment_id);
CREATE INDEX IF NOT EXISTS idx_sfh_active ON squad_foreman_history(squad_id, end_date) WHERE end_date IS NULL;

-- RLS per squad_foreman_history
ALTER TABLE squad_foreman_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view foreman history for their projects" ON squad_foreman_history
    FOR SELECT USING (
        squad_id IN (
            SELECT s.id FROM squads s
            JOIN user_project_roles upr ON s.project_id = upr.project_id
            WHERE upr.user_id = auth.uid()
        )
    );

-- ============================================================================
-- PARTE 7: TABELLA ROLE_PERMISSIONS (per gestire permessi)
-- ============================================================================

CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role VARCHAR(50) NOT NULL UNIQUE,
    can_access_settings BOOLEAN DEFAULT false,
    can_create_wp BOOLEAN DEFAULT false,
    can_view_all_projects BOOLEAN DEFAULT true,
    can_manage_personnel BOOLEAN DEFAULT false,
    can_manage_squads BOOLEAN DEFAULT false,
    can_manage_companies BOOLEAN DEFAULT false,
    description TEXT
);

-- Inserisci permessi per ogni ruolo
INSERT INTO role_permissions (role, can_access_settings, can_create_wp, can_view_all_projects, can_manage_personnel, can_manage_squads, can_manage_companies, description)
VALUES 
    ('admin', true, true, true, true, true, true, 'Amministratore completo'),
    ('pm', true, true, true, true, true, true, 'Project Manager'),
    ('site_manager', true, true, true, true, true, true, 'Site Manager'),
    ('cm', true, true, true, true, true, true, 'Construction Manager'),
    ('pem', true, true, true, true, true, true, 'Project Engineering Manager'),
    ('engineer', true, true, true, true, true, false, 'Engineer'),
    ('planner', true, false, true, true, true, false, 'Planner'),
    ('supervisor', false, false, false, false, false, false, 'Supervisor'),
    ('foreman', false, false, false, false, false, false, 'Foreman'),
    ('sub_foreman', false, false, false, false, false, false, 'Sub Foreman'),
    ('operator', false, false, false, false, false, false, 'Operatore'),
    ('helper', false, false, false, false, false, false, 'Aiutante'),
    ('storekeeper', false, false, false, false, false, false, 'Magazziniere')
ON CONFLICT (role) DO UPDATE SET
    can_access_settings = EXCLUDED.can_access_settings,
    can_create_wp = EXCLUDED.can_create_wp,
    can_view_all_projects = EXCLUDED.can_view_all_projects,
    can_manage_personnel = EXCLUDED.can_manage_personnel,
    can_manage_squads = EXCLUDED.can_manage_squads,
    can_manage_companies = EXCLUDED.can_manage_companies,
    description = EXCLUDED.description;

-- ============================================================================
-- PARTE 8: MIGRAZIONE DATI ESISTENTI
-- ============================================================================

-- Migra personnel esistenti in personnel_project_assignments
-- (solo se hanno project_id e non sono già stati migrati)
INSERT INTO personnel_project_assignments (personnel_id, project_id, company_id, badge_number, role, start_date, status)
SELECT 
    p.id,
    p.project_id,
    p.company_id,
    p.badge_number,
    p.position,
    COALESCE(p.hire_date, p.created_at::date, CURRENT_DATE),
    CASE WHEN p.status = 'active' THEN 'active' ELSE 'completed' END
FROM personnel p
WHERE p.project_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM personnel_project_assignments ppa 
    WHERE ppa.personnel_id = p.id AND ppa.project_id = p.project_id
)
ON CONFLICT (project_id, badge_number) DO NOTHING;

-- Migra foreman attuali delle squadre in squad_foreman_history
INSERT INTO squad_foreman_history (squad_id, foreman_assignment_id, start_date)
SELECT 
    s.id,
    ppa.id,
    s.created_at::date
FROM squads s
JOIN personnel_project_assignments ppa ON ppa.personnel_id = s.foreman_id AND ppa.project_id = s.project_id
WHERE s.foreman_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM squad_foreman_history sfh WHERE sfh.squad_id = s.id AND sfh.end_date IS NULL
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- PARTE 9: VIEW UTILI
-- ============================================================================

-- View per vedere personale attivo per progetto
CREATE OR REPLACE VIEW v_project_personnel AS
SELECT 
    ppa.id as assignment_id,
    ppa.project_id,
    ppa.badge_number,
    ppa.role,
    ppa.start_date,
    ppa.end_date,
    ppa.status as assignment_status,
    p.id as personnel_id,
    p.first_name,
    p.last_name,
    p.first_name || ' ' || p.last_name as full_name,
    p.email,
    p.phone,
    p.username,
    p.can_login,
    c.id as company_id,
    c.company_name,
    c.is_main as is_main_company
FROM personnel_project_assignments ppa
JOIN personnel p ON ppa.personnel_id = p.id
LEFT JOIN companies c ON ppa.company_id = c.id
WHERE ppa.status = 'active';

-- View per vedere foreman attuale di ogni squadra
CREATE OR REPLACE VIEW v_squad_current_foreman AS
SELECT 
    s.id as squad_id,
    s.name as squad_name,
    s.project_id,
    sfh.id as history_id,
    ppa.personnel_id,
    p.first_name || ' ' || p.last_name as foreman_name,
    ppa.badge_number as foreman_badge,
    sfh.start_date as foreman_since
FROM squads s
LEFT JOIN squad_foreman_history sfh ON sfh.squad_id = s.id AND sfh.end_date IS NULL
LEFT JOIN personnel_project_assignments ppa ON sfh.foreman_assignment_id = ppa.id
LEFT JOIN personnel p ON ppa.personnel_id = p.id;

-- ============================================================================
-- PARTE 10: FUNZIONI HELPER
-- ============================================================================

-- Funzione per ottenere permessi utente
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id UUID, p_project_id UUID)
RETURNS TABLE (
    role VARCHAR,
    can_access_settings BOOLEAN,
    can_create_wp BOOLEAN,
    can_view_all_projects BOOLEAN,
    can_manage_personnel BOOLEAN,
    can_manage_squads BOOLEAN,
    can_manage_companies BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        upr.role::VARCHAR,
        rp.can_access_settings,
        rp.can_create_wp,
        rp.can_view_all_projects,
        rp.can_manage_personnel,
        rp.can_manage_squads,
        rp.can_manage_companies
    FROM user_project_roles upr
    JOIN role_permissions rp ON upr.role = rp.role
    WHERE upr.user_id = p_user_id
    AND upr.project_id = p_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Funzione per trasferire persona a nuovo progetto
CREATE OR REPLACE FUNCTION transfer_personnel_to_project(
    p_personnel_id UUID,
    p_from_project_id UUID,
    p_to_project_id UUID,
    p_new_badge VARCHAR,
    p_new_role VARCHAR,
    p_new_company_id UUID,
    p_transfer_date DATE DEFAULT CURRENT_DATE
)
RETURNS UUID AS $$
DECLARE
    v_new_assignment_id UUID;
BEGIN
    -- Chiudi assegnazione precedente
    UPDATE personnel_project_assignments
    SET end_date = p_transfer_date - INTERVAL '1 day',
        status = 'transferred'
    WHERE personnel_id = p_personnel_id
    AND project_id = p_from_project_id
    AND status = 'active';
    
    -- Crea nuova assegnazione
    INSERT INTO personnel_project_assignments (
        personnel_id, project_id, company_id, badge_number, role, start_date, status
    ) VALUES (
        p_personnel_id, p_to_project_id, p_new_company_id, p_new_badge, p_new_role, p_transfer_date, 'active'
    )
    RETURNING id INTO v_new_assignment_id;
    
    RETURN v_new_assignment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Funzione per cambiare foreman di una squadra
CREATE OR REPLACE FUNCTION change_squad_foreman(
    p_squad_id UUID,
    p_new_foreman_assignment_id UUID,
    p_change_date DATE DEFAULT CURRENT_DATE
)
RETURNS VOID AS $$
BEGIN
    -- Chiudi storia foreman precedente
    UPDATE squad_foreman_history
    SET end_date = p_change_date - INTERVAL '1 day'
    WHERE squad_id = p_squad_id
    AND end_date IS NULL;
    
    -- Crea nuova storia
    INSERT INTO squad_foreman_history (squad_id, foreman_assignment_id, start_date)
    VALUES (p_squad_id, p_new_foreman_assignment_id, p_change_date);
    
    -- Aggiorna anche squads.foreman_id per compatibilità
    UPDATE squads
    SET foreman_id = (
        SELECT personnel_id FROM personnel_project_assignments WHERE id = p_new_foreman_assignment_id
    )
    WHERE id = p_squad_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Funzione per promuovere/cambiare ruolo persona nello stesso progetto
CREATE OR REPLACE FUNCTION change_personnel_role(
    p_assignment_id UUID,
    p_new_role VARCHAR,
    p_change_date DATE DEFAULT CURRENT_DATE
)
RETURNS UUID AS $$
DECLARE
    v_assignment RECORD;
    v_new_assignment_id UUID;
BEGIN
    -- Ottieni assegnazione attuale
    SELECT * INTO v_assignment FROM personnel_project_assignments WHERE id = p_assignment_id;
    
    -- Chiudi assegnazione precedente
    UPDATE personnel_project_assignments
    SET end_date = p_change_date - INTERVAL '1 day',
        status = 'completed',
        notes = COALESCE(notes, '') || ' Ruolo cambiato in ' || p_new_role
    WHERE id = p_assignment_id;
    
    -- Crea nuova assegnazione con nuovo ruolo
    INSERT INTO personnel_project_assignments (
        personnel_id, project_id, company_id, badge_number, role, start_date, status, notes
    ) VALUES (
        v_assignment.personnel_id, 
        v_assignment.project_id, 
        v_assignment.company_id, 
        v_assignment.badge_number, 
        p_new_role, 
        p_change_date, 
        'active',
        'Promosso/Cambiato da ' || v_assignment.role
    )
    RETURNING id INTO v_new_assignment_id;
    
    RETURN v_new_assignment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- PARTE 11: VERIFICA FINALE
-- ============================================================================

SELECT '=== MIGRAZIONE COMPLETATA ===' as status;
SELECT 'Companies:' as tabella, COUNT(*) as count FROM companies;
SELECT 'Personnel:' as tabella, COUNT(*) as count FROM personnel;
SELECT 'Assignments:' as tabella, COUNT(*) as count FROM personnel_project_assignments;
SELECT 'Foreman History:' as tabella, COUNT(*) as count FROM squad_foreman_history;
SELECT 'Role Permissions:' as tabella, COUNT(*) as count FROM role_permissions;
