# CRM FG Medios — Guía para Claude

## Descripción del proyecto

CRM propietario de FG Medios (`cperilli@fgmedios.com`). Construido con Next.js 14 App Router, Supabase y desplegado en Netlify. Integra automatizaciones de leads vía n8n y comunicación por WhatsApp.

**URL producción:** `https://crm.fgmedios.com.ar`  
**Netlify project:** `crm-fg-mejorado` → `crm-fg-mejorado.netlify.app` (sigue activo)  
**GitHub:** `https://github.com/caito1975/Crm-FG-Mejorado-`  
**Supabase project:** `resxhwxubboicfpoftjp` (caito1975's Org)

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 14 App Router (TypeScript) |
| Auth + DB | Supabase (PostgreSQL + RLS + Realtime) |
| Deploy | Netlify (auto-deploy desde GitHub `main`) |
| Estilos | CSS variables propias en `app/globals.css` (sin Tailwind activo) |
| Automatización | n8n (workflows CRM-02 y CRM-04) |
| WhatsApp | Integración vía n8n + webhook |
| Calendario | Google Calendar OAuth2 |
| Email | Gmail OAuth2 |

---

## Estructura de archivos clave

```
app/
  (app)/                        # Rutas autenticadas
    layout.tsx                  # Server: resuelve workspace, pasa theme al AppShell
    dashboard/page.tsx          # Server: carga datos + calcula teamStats
    pipeline/page.tsx           # Server: carga stages/deals/contacts
    contacts/page.tsx
    contacts/[id]/page.tsx
    reports/page.tsx
    settings/page.tsx
    tasks/page.tsx
    team/page.tsx
    historial/page.tsx
    inbox/page.tsx
    calendar/page.tsx
  (auth)/login  /register
  api/
    leads/inbound/route.ts      # Webhook n8n → crea/actualiza contactos
    integrations/
      google/connect/route.ts   # Inicia OAuth Google
      google/callback/route.ts  # Recibe código OAuth, guarda tokens
      calendar/slots/route.ts   # Devuelve horarios disponibles
      calendar/book/route.ts    # Crea evento en Google Calendar
      calendar/create/route.ts  # Crea evento desde CRM
      calendar/sync/route.ts
      gmail/send/route.ts
      gmail/sync/route.ts
    team/
      create-user/route.ts      # Crea auth user para vendedor nuevo
      invite/route.ts
      set-password/route.ts
    wa/send/route.ts            # Envía WhatsApp

components/
  layout/
    AppShell.tsx                # CLIENT: sincroniza theme desde Supabase → localStorage
    Sidebar.tsx
    Topbar.tsx
  dashboard/DashboardClient.tsx # CLIENT: polling 30s + realtime
  pipeline/
    KanbanBoard.tsx             # CLIENT: DnD + polling 30s + realtime
    KanbanBoardClient.tsx       # Wrapper dynamic() para evitar SSR
    KanbanColumn.tsx
    DealCard.tsx
    DealModal.tsx
  reports/ReportsClient.tsx     # CLIENT: polling 30s
  contacts/
    ContactsTable.tsx
    ContactDetail.tsx
    ContactModal.tsx
  settings/SettingsClient.tsx   # Maneja theme/density/currency + integraciones
  team/TeamAdminClient.tsx

lib/
  types.ts                      # Todos los tipos TypeScript + DEFAULT_STAGES
  useCurrency.ts                # Hook formatAmount según crm-currency localStorage
  supabase/
    client.ts                   # createClient() para componentes client
    server.ts                   # createClient() para server components
    workspace.ts                # getWorkspaceOwnerId(), getAssignableMembers()
    schema.sql                  # Schema base
    migration_crm02.sql → migration_crm10_fix_vendor_rls.sql

middleware.ts                   # Auth guard — excluye /api/ para n8n
```

---

## Modelo de datos (tablas principales)

### `contacts`
- `user_id` → owner del workspace
- `assigned_to` → `auth.users.id` del vendedor asignado (puede ser null)
- `status`: `'cliente' | 'oportunidad' | 'lead' | 'archivado' | 'enviado' | 'no_enviado' | 'interesado' | 'contactar'`
- `value` → monto total de deals activos del contacto (calculado al mover deals)

### `deals`
- `user_id` → owner del workspace
- `assigned_to` → `auth.users.id` del vendedor asignado (**crítico: debe estar seteado por CRM-04**)
- `stage_id` → referencia a `pipeline_stages.id` (ej: `'contactar'`, `'ganado'`, `'perdido'`)
- `amount`, `probability`, `close_date`, `owner_name`

### `team_members`
- `owner_id` → owner del workspace
- `member_user_id` → `auth.users.id` del vendedor (se llena al aceptar invitación)
- `email`, `name`, `role`, `status` (`'activo' | 'inactivo' | 'invitado'`)
- `deals_count` → incrementado por CRM-04 vía n8n

### `pipeline_stages`
- Customizables por workspace. Defaults en `lib/types.ts` → `DEFAULT_STAGES`
- IDs fijos usados en lógica: `'ganado'`, `'perdido'`, `'contactar'`, `'enviado'`

### `integrations`
- `user_id`, `provider` (`'gmail' | 'google_calendar'`), `access_token`, `refresh_token`, `token_expiry`
- Unique constraint `(user_id, provider)`

### `historial_leads`
- Log de cambios de estado. `tipo`: `'ASIGNACION' | 'CAMBIO_ESTADO' | 'NOTA' | 'LLAMADA' | 'EMAIL'`

---

## RLS (Row Level Security) — estado actual

Aplicadas via `migration_crm10_fix_vendor_rls.sql`:

| Tabla | Política | Regla |
|-------|----------|-------|
| `team_members` | `Own team` | `auth.uid() = owner_id` |
| `team_members` | `member_can_read_own` (**SELECT**) | `member_user_id = auth.uid()` |
| `contacts` | `contacts_owner` | `auth.uid() = user_id` |
| `contacts` | `contacts_vendor` | `is_workspace_member(user_id) AND assigned_to = auth.uid()` |
| `deals` | `deals_owner` | `auth.uid() = user_id` |
| `deals` | `deals_vendor` | `is_workspace_member(user_id) AND assigned_to = auth.uid()` |
| `tasks` | `workspace_tasks` | `auth.uid() = user_id OR is_workspace_member(user_id)` |
| `activities` | `workspace_activities` | `auth.uid() = user_id OR is_workspace_member(user_id)` |
| `pipeline_stages` | `workspace_stages` | `auth.uid() = user_id OR is_workspace_member(user_id)` |
| `historial_leads` | `Own historial` + `Workspace historial` | owner todo, vendor SELECT |

**Función helper:** `is_workspace_member(owner_uid uuid)` → busca en `team_members` si `auth.uid()` es miembro activo del workspace.

**IMPORTANTE:** Sin la política `member_can_read_own` en `team_members`, los vendedores no pueden resolver su `workspaceId` y ven el CRM vacío.

---

## Multi-tenant: Owner vs Vendor

`lib/supabase/workspace.ts` → `getWorkspaceOwnerId(supabase, user)`:
- Si el user tiene registro en `team_members.member_user_id` → es **vendor**, retorna `{ workspaceId: owner_id, isOwner: false }`
- Si no → es **owner**, retorna `{ workspaceId: user.id, isOwner: true }`

Todos los server components usan `workspaceId` (no `user.id`) para queries. Los vendors reciben `isOwner: false` y ven solo sus datos asignados vía RLS.

---

## Realtime y polling

Supabase Realtime usa `auth.uid()` para filtrar eventos. Para vendors, `auth.uid() ≠ workspace user_id`, por lo que los eventos realtime son bloqueados por RLS.

**Solución implementada:** Polling de 30 segundos en todos los clientes:
- `KanbanBoard.tsx` → canal `pipeline-realtime` + `setInterval(fetchDeals, 30_000)`
- `DashboardClient.tsx` → canal `dashboard-realtime` + `setInterval(fetchAll, 30_000)`
- `ReportsClient.tsx` → canal `reports-realtime` + `setInterval(fetchAll, 30_000)`

---

## Tema / Apariencia

**Flujo de persistencia:**
1. `app/layout.tsx` → inline script en `<head>` aplica tema desde `localStorage` antes del hydrate (evita flash)
2. `app/(app)/layout.tsx` → lee `user.user_metadata.crm_theme/density/currency` (server-side)
3. `AppShell.tsx` → recibe preferencias y en cada mount las escribe a `localStorage` + aplica al DOM
4. `SettingsClient.tsx` → al cambiar tema: `localStorage` + `supabase.auth.updateUser({ data: { crm_theme } })`

**Fuente de verdad:** Supabase `user_metadata`. localStorage es cache para velocidad.  
**Valores:** `'Oscuro' | 'Claro' | 'Sistema'` — aplicado como `data-theme="dark"` en `<html>`  
**CSS:** variables en `app/globals.css` → `:root` (claro) y `[data-theme="dark"]` (oscuro)

---

## n8n Workflows

### CRM-02 (Receptor Supabase)
Recibe leads desde WhatsApp → crea/actualiza contacto → asigna vendedor.

**Lógica de asignación:**
1. Si el contacto tiene `company`, busca otros contactos de la misma empresa con `assigned_to` → asigna al mismo vendedor (company-sticky)
2. Si no hay empresa o no hay match → round-robin por `deals_count` mínimo

### CRM-04 (Asignar Leads)
Asigna vendedor al lead y crea el deal en pipeline.

**Campos críticos del deal:**
```json
{
  "user_id": "...",
  "title": "...",
  "contact_id": "...",
  "stage_id": "contactar",
  "amount": 0,
  "probability": 20,
  "owner_name": "...",
  "assigned_to": "$('Asignar Round-Robin').first().json.vendor_member_user_id"
}
```
**`assigned_to` es obligatorio** — sin él los vendedores no ven el deal en su pipeline.

**Nodo `Incrementar Deals Vendedor`:** PATCH con `Prefer: return=minimal` → devuelve 204 (vacío). Esto es **comportamiento esperado**, no un error. Los nodos siguientes usan `$('Asignar Round-Robin').first().json...` para acceder a datos.

---

## Variables de entorno (Netlify)

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL=https://crm.fgmedios.com.ar   ← crítico para OAuth redirect_uri
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
```

**`NEXT_PUBLIC_APP_URL` es crítico:** usado en `connect/route.ts` y `callback/route.ts` para construir el `redirect_uri` de Google OAuth. Debe coincidir exactamente con lo registrado en Google Cloud Console.

---

## Google OAuth

- **Redirect URI registrado:** `https://crm.fgmedios.com.ar/api/integrations/google/callback`
- **Scopes gmail:** userinfo.email, gmail.readonly, gmail.send
- **Scopes calendar:** userinfo.email, calendar.readonly, calendar.events
- **State param:** `${user.id}:${provider}` (ej: `abc123:google_calendar`)
- Si el token expira → el slot/book API cae back a slots de horario laboral sin Calendar

---

## API Routes para n8n (sin auth)

El middleware excluye `/api/` de la verificación de sesión. Las siguientes rutas son llamadas por n8n sin cookies de sesión:

- `POST /api/leads/inbound` — recibe lead desde WhatsApp
- `GET /api/integrations/calendar/slots` — horarios disponibles para agendar
- `POST /api/integrations/calendar/book` — confirma un turno

---

## DNS / Dominio

- **Hosting web:** Bluehost (fgmedios.com.ar) — Apache shared hosting, no puede correr Next.js
- **CRM:** Netlify via CNAME `crm` → `crm-fg-mejorado.netlify.app`
- **Registro DNS en Bluehost:** CNAME, Alias=`crm`, Points to=`crm-fg-mejorado.netlify.app`

---

## Convenciones del proyecto

- Pages server components cargan datos → pasan como `initial*` props a Client components
- Client components manejan estado local + realtime/polling
- Queries siempre filtran por `user_id = workspaceId` (nunca por `user.id` del vendor)
- `formatAmount()` desde `useCurrency` hook (lee `crm-currency` de localStorage)
- IDs de stages hardcodeados en lógica: `ganado`, `perdido`, `contactar`, `enviado`, `interesado`, `oportunidad`
- Confirmaciones destructivas: `confirm()` nativo del browser
- Sin Tailwind — todos los estilos son clases CSS custom o inline styles con variables CSS

---

## Migraciones SQL (orden de aplicación)

1. `schema.sql` — tablas base
2. `migration_crm02.sql` — campos de leads
3. `migration_crm05.sql` — tabla `integrations`, OAuth
4. `migration_crm06.sql` — `team_members.member_user_id`, `is_workspace_member()`, workspace policies
5. `migration_crm07.sql` — tabla `historial_leads`
6. `migration_crm08.sql` — `assigned_to` en contacts/deals, políticas owner/vendor
7. `migration_crm09_stages.sql` — agrega etapas `contactar` y `contactado`
8. `migration_crm10_fix_vendor_rls.sql` — **fix crítico:** `member_can_read_own` en team_members + consolida políticas deals/contacts

---

## Problemas conocidos resueltos

| Problema | Causa | Fix |
|----------|-------|-----|
| Vendor ve pipeline vacío | RLS `team_members` bloqueaba `getWorkspaceOwnerId` | `member_can_read_own` policy (migration_crm10) |
| Deals sin `assigned_to` | CRM-04 no incluía el campo | Agregado al nodo `Crear Deal Pipeline` |
| Theme se pierde al refrescar | localStorage domain-scoped | AppShell sincroniza desde Supabase user_metadata |
| OAuth `redirect_uri_mismatch` | URL de Netlify preview vs custom domain | `NEXT_PUBLIC_APP_URL` env var |
| n8n no accede a /api/ | Middleware redirigía a /login | `isApiRoute` excluido del guard |
| Calendar sin slots | Token expirado devolvía 401 | Fallback a business hours slots |
| Deals activos > leads en dashboard | buildStat contaba por contact_id (múltiples deals por contacto) | Filtrar por `deals.assigned_to = memberId` |
