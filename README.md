# 📦 PTS v3.0 - Istruzioni Complete

## 🗄️ STEP 1: Esegui SQL in Supabase

### 1.1 Script di Migrazione (OBBLIGATORIO)
Vai in **Supabase → SQL Editor → New query** e incolla il contenuto di:
`SQL_01_MIGRATION.sql`

Questo script:
- Aggiunge nuovi ruoli (pm, site_manager, pem, engineer, planner)
- Rinomina `subcontractors` → `companies` + aggiunge `is_main`
- Crea `personnel_project_assignments` per storico assegnazioni
- Crea `squad_foreman_history` per storico caposquadra
- Crea `role_permissions` per gestione permessi
- Crea view e funzioni helper
- Migra dati esistenti

### 1.2 Per Cancellare i Dati di Test (quando vuoi)
Esegui: `SQL_02_DELETE_TEST_DATA.sql`

---

## 🔄 STEP 2: Aggiorna Repository GitHub

### IMPORTANTE: Lavora sul branch `develop`!

### Opzione A: Sostituisci tutto il repository
1. Scarica il file zip
2. Elimina tutti i file esistenti tranne `.git`
3. Estrai i nuovi file
4. Commit e push

### Opzione B: Aggiorna file per file

#### File di Configurazione (root):
- `package.json` - SOSTITUISCI
- `vite.config.js` - SOSTITUISCI
- `tailwind.config.js` - SOSTITUISCI
- `postcss.config.js` - SOSTITUISCI
- `index.html` - SOSTITUISCI
- `.env.example` - SOSTITUISCI
- `.gitignore` - SOSTITUISCI

#### Cartella `public/`:
- `favicon.svg` - SOSTITUISCI

#### Cartella `src/`:
- `main.jsx` - SOSTITUISCI
- `index.css` - SOSTITUISCI
- `App.jsx` - SOSTITUISCI

#### Cartella `src/lib/`:
- `supabase.js` - SOSTITUISCI

#### Cartella `src/i18n/`:
- `config.js` - SOSTITUISCI
- `locales/it.json` - SOSTITUISCI
- `locales/en.json` - SOSTITUISCI

#### Cartella `src/hooks/` (NUOVA):
- `usePermissions.js` - NUOVO

#### Cartella `src/contexts/`:
- `ProjectContext.jsx` - SOSTITUISCI

#### Cartella `src/components/`:
- `Layout.jsx` - SOSTITUISCI
- `Header.jsx` - SOSTITUISCI
- `Sidebar.jsx` - SOSTITUISCI
- `BottomNav.jsx` - SOSTITUISCI
- `LoadingScreen.jsx` - SOSTITUISCI
- `ProtectedRoute.jsx` - NUOVO
- `ProjectFormModal.jsx` - SOSTITUISCI

#### Cartella `src/pages/`:
- `Login.jsx` - SOSTITUISCI
- `Dashboard.jsx` - SOSTITUISCI
- `Projects.jsx` - SOSTITUISCI
- `ProjectDetail.jsx` - SOSTITUISCI
- `Companies.jsx` - NUOVO
- `Personnel.jsx` - NUOVO (placeholder)
- `Squads.jsx` - NUOVO (placeholder)
- `Equipment.jsx` - NUOVO (placeholder)
- `WorkPackages.jsx` - NUOVO (placeholder)
- `DailyReports.jsx` - NUOVO (placeholder)
- `MaterialRequests.jsx` - NUOVO (placeholder)
- `MTO.jsx` - NUOVO (placeholder)
- `PlaceholderPages.jsx` - NUOVO

---

## ✅ STEP 3: Merge e Deploy

1. Su GitHub, vai alla tab **Pull requests**
2. Clicca **New pull request**
3. base: `main` ← compare: `develop`
4. Clicca **Create pull request**
5. Clicca **Merge pull request**
6. Vercel farà il deploy automaticamente

---

## 🎯 Funzionalità Implementate in v3.0

### ✅ Bug Fix
| # | Fix |
|---|-----|
| 1 | Pulsante + festività ora funziona (cambio da form submit a onClick) |
| 2 | Layout festività fixato (niente più quadrato bianco) |
| 3 | Niente overlap elementi UI |
| 4 | Tutte le traduzioni EN complete |
| 5 | Click su card progetto → vai al dettaglio |

### ✅ Nuova Architettura Menu

**Menu Principale** (tutti):
- Dashboard
- MTO
- Work Packages
- Rapportini
- Richieste Materiale

**Impostazioni** (solo Admin → Planner):
- Progetti
- Aziende
- Personale
- Squadre
- Mezzi

### ✅ Sistema Permessi
| Ruolo | Settings | Crea WP |
|-------|----------|---------|
| Admin | ✅ | ✅ |
| PM | ✅ | ✅ |
| Site Manager | ✅ | ✅ |
| CM | ✅ | ✅ |
| PEM | ✅ | ✅ |
| Engineer | ✅ | ✅ |
| Planner | ✅ | ❌ |
| Supervisor | ❌ | ❌ |
| Foreman | ❌ | ❌ |

### ✅ Nuova Pagina Aziende
- Registra azienda principale del progetto
- Registra subcontractors
- Flag `is_main` per identificare principale

### ✅ Nuovo Schema Database
- `companies` (ex subcontractors) con `is_main`
- `personnel_project_assignments` per storico completo
- `squad_foreman_history` per cambio caposquadra
- `role_permissions` per gestione permessi
- View e funzioni helper

---

## 📁 Struttura File Completa

```
pts-mechanical/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── BottomNav.jsx
│   │   ├── Header.jsx
│   │   ├── Layout.jsx
│   │   ├── LoadingScreen.jsx
│   │   ├── ProjectFormModal.jsx
│   │   ├── ProtectedRoute.jsx
│   │   └── Sidebar.jsx
│   ├── contexts/
│   │   └── ProjectContext.jsx
│   ├── hooks/
│   │   └── usePermissions.js
│   ├── i18n/
│   │   ├── config.js
│   │   └── locales/
│   │       ├── en.json
│   │       └── it.json
│   ├── lib/
│   │   └── supabase.js
│   ├── pages/
│   │   ├── Companies.jsx
│   │   ├── Dashboard.jsx
│   │   ├── DailyReports.jsx
│   │   ├── Equipment.jsx
│   │   ├── Login.jsx
│   │   ├── MaterialRequests.jsx
│   │   ├── MTO.jsx
│   │   ├── Personnel.jsx
│   │   ├── PlaceholderPages.jsx
│   │   ├── ProjectDetail.jsx
│   │   ├── Projects.jsx
│   │   ├── Squads.jsx
│   │   └── WorkPackages.jsx
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
└── vite.config.js
```

---

## ⚠️ Note Importanti

1. **Esegui PRIMA lo script SQL** - Il frontend dipende dalle nuove tabelle

2. **Vercel Environment Variables** - Assicurati che siano configurate:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

3. **Ruoli esistenti** - Se hai utenti con ruoli vecchi, verifica che siano compatibili

4. **Foreman/Supervisor** - Non vedranno più il menu Impostazioni

5. **Route cambiate**:
   - `/projects` → `/settings/projects`
   - `/personnel` → `/settings/personnel`
   - `/squads` → `/settings/squads`
   - `/equipment` → `/settings/equipment`

---

## 🔜 Prossimi Passi

1. Implementare pagina Personnel completa
2. Implementare pagina Squads completa
3. Implementare Work Packages con permessi "Crea"
4. Implementare logica trasferimento personale
5. Implementare storico foreman squadre
