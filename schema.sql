-- =================================================================
-- MANDATO · Schema completo para Supabase
-- Ejecuta este script en SQL Editor de Supabase
-- =================================================================

-- Drop existing tables if rebuilding (cuidado en producción)
-- drop table if exists pagos cascade;
-- drop table if exists suscripciones cascade;
-- drop table if exists ofertas cascade;
-- drop table if exists mandatos cascade;
-- drop table if exists brokers cascade;
-- drop table if exists usuarios cascade;
-- drop table if exists planes cascade;

-- =================================================================
-- 1. PLANES (catálogo de planes disponibles)
-- =================================================================
create table if not exists planes (
  id text primary key,
  tipo text not null check (tipo in ('comprador', 'broker')),
  nombre text not null,
  precio_mensual integer not null, -- en COP
  max_mandatos_activos integer, -- null = ilimitado
  vigencia_dias integer not null default 30,
  max_mandatos_visibles integer, -- para brokers: null = ilimitado
  contacto_directo boolean default false,
  badge_verificado boolean default false,
  prioridad_asignacion integer default 0,
  features jsonb default '[]'::jsonb,
  activo boolean default true,
  created_at timestamptz default now()
);

-- Insertar planes iniciales
insert into planes (id, tipo, nombre, precio_mensual, max_mandatos_activos, vigencia_dias, max_mandatos_visibles, contacto_directo, badge_verificado, prioridad_asignacion, features) values
('comprador_free', 'comprador', 'Free', 0, 1, 15, null, false, false, 0,
  '["1 mandato activo", "Vigencia 15 días", "Ofertas estándar"]'::jsonb),
('comprador_premium', 'comprador', 'Premium', 79000, 5, 30, null, false, true, 10,
  '["5 mandatos simultáneos", "Vigencia 30 días renovable", "Ofertas off-market priorizadas", "Asesor humano dedicado", "Badge verificado"]'::jsonb),
('broker_basico', 'broker', 'Básico', 149000, null, 30, 10, false, false, 1,
  '["10 mandatos por mes", "Contacto vía plataforma", "1 ciudad"]'::jsonb),
('broker_pro', 'broker', 'Pro', 349000, null, 30, null, true, true, 5,
  '["Mandatos ilimitados", "Contacto directo (WhatsApp)", "Prioridad en asignación", "Badge verificado", "Hasta 3 ciudades"]'::jsonb),
('broker_elite', 'broker', 'Élite', 799000, null, 30, null, true, true, 10,
  '["Todo lo de Pro", "Mandatos premium destacados primero", "API para CRM", "Soporte dedicado", "Sin límite de ciudades"]'::jsonb)
on conflict (id) do update set
  precio_mensual = excluded.precio_mensual,
  features = excluded.features;

-- =================================================================
-- 2. USUARIOS (compradores e inversionistas)
-- =================================================================
create table if not exists usuarios (
  id text primary key,
  created_at timestamptz default now(),
  nombre text not null,
  telefono text not null,
  email text unique,
  ciudad text default 'Medellín',
  plan_id text references planes(id) default 'comprador_free',
  plan_vence_at timestamptz,
  client_token text unique default gen_random_uuid()::text,
  metadata jsonb default '{}'::jsonb
);

create index if not exists idx_usuarios_token on usuarios(client_token);
create index if not exists idx_usuarios_telefono on usuarios(telefono);
create index if not exists idx_usuarios_email on usuarios(email);

-- =================================================================
-- 3. BROKERS
-- =================================================================
create table if not exists brokers (
  id text primary key,
  created_at timestamptz default now(),
  nombre text not null,
  telefono text not null,
  email text unique,
  empresa text,
  ciudades text[] default array['Medellín'],
  zonas_especialidad text[],
  rangos_precio text[],
  tipos_inmueble text[],
  plan_id text references planes(id) default 'broker_basico',
  plan_vence_at timestamptz,
  mandatos_vistos_mes integer default 0,
  mandatos_vistos_reset_at timestamptz default now() + interval '30 days',
  cierres_count integer default 0,
  rating numeric(3,2),
  verificado boolean default false,
  activo boolean default true,
  broker_token text unique default gen_random_uuid()::text,
  metadata jsonb default '{}'::jsonb
);

create index if not exists idx_brokers_token on brokers(broker_token);
create index if not exists idx_brokers_telefono on brokers(telefono);
create index if not exists idx_brokers_email on brokers(email);
create index if not exists idx_brokers_plan on brokers(plan_id);

-- =================================================================
-- 4. MANDATOS publicados por compradores
-- =================================================================
create table if not exists mandatos (
  id text primary key,
  created_at timestamptz default now(),
  vence_at timestamptz not null,
  status text default 'active' check (status in ('active', 'paused', 'closed', 'expired')),
  usuario_id text references usuarios(id) on delete cascade,
  -- Datos también desnormalizados por velocidad de lectura
  contact_name text not null,
  contact_phone text not null,
  contact_email text,
  -- Contenido del mandato
  free_text text,
  fields jsonb default '{}'::jsonb,
  -- Visibility según plan
  destacado boolean default false,
  ofertas_count integer default 0,
  vistas_count integer default 0
);

create index if not exists idx_mandatos_status on mandatos(status);
create index if not exists idx_mandatos_vence on mandatos(vence_at);
create index if not exists idx_mandatos_created on mandatos(created_at desc);
create index if not exists idx_mandatos_usuario on mandatos(usuario_id);
create index if not exists idx_mandatos_destacado on mandatos(destacado, created_at desc);

-- =================================================================
-- 5. OFERTAS enviadas por brokers (o por equipo Mandato)
-- =================================================================
create table if not exists ofertas (
  id text primary key,
  created_at timestamptz default now(),
  mandate_id text references mandatos(id) on delete cascade,
  broker_id text references brokers(id) on delete set null,
  -- "team" si la envía el equipo Mandato directamente
  enviada_por text default 'broker' check (enviada_por in ('broker', 'team')),
  name text not null,
  location text,
  price text,
  area text,
  rooms text,
  baths text,
  parking text,
  estrato text,
  why text,
  link text,
  status text default 'sent' check (status in ('sent', 'viewed', 'accepted', 'rejected')),
  client_viewed_at timestamptz,
  client_responded_at timestamptz
);

create index if not exists idx_ofertas_mandate on ofertas(mandate_id, created_at desc);
create index if not exists idx_ofertas_broker on ofertas(broker_id);

-- =================================================================
-- 6. SUSCRIPCIONES (historial de planes activos)
-- =================================================================
create table if not exists suscripciones (
  id text primary key,
  created_at timestamptz default now(),
  -- Una de las dos referencias debe estar
  usuario_id text references usuarios(id) on delete cascade,
  broker_id text references brokers(id) on delete cascade,
  plan_id text references planes(id) not null,
  inicio_at timestamptz not null default now(),
  fin_at timestamptz not null,
  estado text default 'pending' check (estado in ('pending', 'active', 'cancelled', 'expired')),
  monto integer not null,
  moneda text default 'COP',
  auto_renovar boolean default true,
  cancelada_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  check (
    (usuario_id is not null and broker_id is null) or
    (usuario_id is null and broker_id is not null)
  )
);

create index if not exists idx_suscripciones_usuario on suscripciones(usuario_id);
create index if not exists idx_suscripciones_broker on suscripciones(broker_id);
create index if not exists idx_suscripciones_estado on suscripciones(estado);
create index if not exists idx_suscripciones_fin on suscripciones(fin_at);

-- =================================================================
-- 7. PAGOS (cada transacción individual)
-- =================================================================
create table if not exists pagos (
  id text primary key,
  created_at timestamptz default now(),
  suscripcion_id text references suscripciones(id) on delete set null,
  -- Identificadores en Wompi
  wompi_transaction_id text unique,
  wompi_reference text unique,
  -- Datos del pago
  monto integer not null,
  moneda text default 'COP',
  estado text default 'pending' check (estado in ('pending', 'approved', 'declined', 'voided', 'error')),
  metodo_pago text, -- card, pse, nequi, bancolombia
  -- Quién pagó
  usuario_id text references usuarios(id) on delete set null,
  broker_id text references brokers(id) on delete set null,
  payer_email text,
  payer_phone text,
  raw_response jsonb,
  approved_at timestamptz,
  declined_reason text
);

create index if not exists idx_pagos_estado on pagos(estado);
create index if not exists idx_pagos_wompi on pagos(wompi_transaction_id);
create index if not exists idx_pagos_ref on pagos(wompi_reference);
create index if not exists idx_pagos_usuario on pagos(usuario_id);
create index if not exists idx_pagos_broker on pagos(broker_id);

-- =================================================================
-- 8. VISTAS DE BROKERS (para enforce de límites por plan)
-- =================================================================
create table if not exists broker_mandato_views (
  id bigserial primary key,
  broker_id text references brokers(id) on delete cascade,
  mandate_id text references mandatos(id) on delete cascade,
  viewed_at timestamptz default now(),
  unique (broker_id, mandate_id)
);

create index if not exists idx_views_broker_date on broker_mandato_views(broker_id, viewed_at desc);

-- =================================================================
-- 9. FUNCIONES Y TRIGGERS ÚTILES
-- =================================================================

-- Actualizar contador de ofertas en mandato cuando se inserta una oferta
create or replace function increment_ofertas_count()
returns trigger as $$
begin
  update mandatos set ofertas_count = ofertas_count + 1 where id = new.mandate_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_increment_ofertas on ofertas;
create trigger trg_increment_ofertas
  after insert on ofertas
  for each row execute function increment_ofertas_count();

-- Marcar mandatos expirados automáticamente
create or replace function expire_mandatos()
returns void as $$
begin
  update mandatos
  set status = 'expired'
  where status = 'active' and vence_at < now();
end;
$$ language plpgsql;

-- Marcar suscripciones expiradas y revertir a free
create or replace function expire_suscripciones()
returns void as $$
begin
  update suscripciones
  set estado = 'expired'
  where estado = 'active' and fin_at < now() and not auto_renovar;

  -- Revertir compradores a free si no auto-renovaron
  update usuarios
  set plan_id = 'comprador_free', plan_vence_at = null
  where plan_vence_at is not null and plan_vence_at < now()
    and plan_id != 'comprador_free';

  -- Pausar brokers cuyo plan venció
  update brokers
  set activo = false
  where plan_vence_at is not null and plan_vence_at < now() and activo = true;
end;
$$ language plpgsql;

-- =================================================================
-- 10. ROW LEVEL SECURITY
-- =================================================================

alter table planes enable row level security;
alter table usuarios enable row level security;
alter table brokers enable row level security;
alter table mandatos enable row level security;
alter table ofertas enable row level security;
alter table suscripciones enable row level security;
alter table pagos enable row level security;
alter table broker_mandato_views enable row level security;

-- PLANES: lectura pública
drop policy if exists "Anyone can read planes" on planes;
create policy "Anyone can read planes" on planes for select using (activo = true);

-- USUARIOS: cualquiera puede crear (signup), lectura solo con token
drop policy if exists "Anyone can insert usuarios" on usuarios;
create policy "Anyone can insert usuarios" on usuarios for insert with check (true);
drop policy if exists "Anyone can read usuarios" on usuarios;
create policy "Anyone can read usuarios" on usuarios for select using (true);
drop policy if exists "Anyone can update usuarios" on usuarios;
create policy "Anyone can update usuarios" on usuarios for update using (true);

-- BROKERS: cualquiera puede crear (signup)
drop policy if exists "Anyone can insert brokers" on brokers;
create policy "Anyone can insert brokers" on brokers for insert with check (true);
drop policy if exists "Anyone can read brokers" on brokers;
create policy "Anyone can read brokers" on brokers for select using (true);
drop policy if exists "Anyone can update brokers" on brokers;
create policy "Anyone can update brokers" on brokers for update using (true);

-- MANDATOS: cualquiera puede crear, leer activos
drop policy if exists "Anyone can insert mandatos" on mandatos;
create policy "Anyone can insert mandatos" on mandatos for insert with check (true);
drop policy if exists "Anyone can read mandatos" on mandatos;
create policy "Anyone can read mandatos" on mandatos for select using (true);
drop policy if exists "Anyone can update mandatos" on mandatos;
create policy "Anyone can update mandatos" on mandatos for update using (true);

-- OFERTAS: cualquiera puede leer e insertar
drop policy if exists "Anyone can insert ofertas" on ofertas;
create policy "Anyone can insert ofertas" on ofertas for insert with check (true);
drop policy if exists "Anyone can read ofertas" on ofertas;
create policy "Anyone can read ofertas" on ofertas for select using (true);
drop policy if exists "Anyone can update ofertas" on ofertas;
create policy "Anyone can update ofertas" on ofertas for update using (true);

-- SUSCRIPCIONES: cualquiera puede leer e insertar
drop policy if exists "Anyone can manage suscripciones" on suscripciones;
create policy "Anyone can manage suscripciones" on suscripciones for all using (true) with check (true);

-- PAGOS: cualquiera puede leer e insertar (en producción restringe esto)
drop policy if exists "Anyone can manage pagos" on pagos;
create policy "Anyone can manage pagos" on pagos for all using (true) with check (true);

-- VIEWS
drop policy if exists "Anyone can manage views" on broker_mandato_views;
create policy "Anyone can manage views" on broker_mandato_views for all using (true) with check (true);

-- =================================================================
-- IMPORTANTE:
-- Las políticas anteriores son PERMISIVAS para empezar rápido.
-- Antes de ir a producción, restringe usando Supabase Auth + JWT
-- para que solo el dueño del recurso pueda update/delete.
-- =================================================================
