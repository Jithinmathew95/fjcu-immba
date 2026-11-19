-- Platform fee add-on for the campus marketplace.
-- Paste this whole file into the Supabase SQL Editor and run it.
-- Safe to run more than once. Do not backfill old order lines: they keep fee 0.
--
-- Adds:
--   1. marketplace_settings (one row): current fee per order line, default NT$4.
--      Only platform admins (and super_admin) can read or change it.
--   2. marketplace_order_items.platform_fee: snapshot copied when the order is placed.
--   3. place_marketplace_order writes that snapshot onto every new line.
-- Buyers still pay only unit_price × quantity. The fee is taken from the seller.

create table if not exists public.marketplace_settings (
  id text primary key default 'default' check (id = 'default'),
  platform_fee numeric not null default 4 check (platform_fee >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

insert into public.marketplace_settings (id, platform_fee)
values ('default', 4)
on conflict (id) do nothing;

alter table public.marketplace_order_items
  add column if not exists platform_fee numeric not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'marketplace_order_items_platform_fee_check'
  ) then
    alter table public.marketplace_order_items
      add constraint marketplace_order_items_platform_fee_check
      check (platform_fee >= 0);
  end if;
end
$$;

alter table public.marketplace_settings enable row level security;

drop policy if exists "Platform admins read marketplace settings" on public.marketplace_settings;
create policy "Platform admins read marketplace settings"
  on public.marketplace_settings
  for select
  to authenticated
  using (private.is_platform_admin());

drop policy if exists "Platform admins update marketplace settings" on public.marketplace_settings;
create policy "Platform admins update marketplace settings"
  on public.marketplace_settings
  for update
  to authenticated
  using (private.is_platform_admin())
  with check (private.is_platform_admin());

revoke all on table public.marketplace_settings from public, anon;
grant select, update on table public.marketplace_settings to authenticated;

create or replace function public.place_marketplace_order()
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  oid uuid;
  ocode text;
  cart_row record;
  prod public.marketplace_products%rowtype;
  total numeric(10,2) := 0;
  buyer_mail text;
  cart_count integer := 0;
  fee numeric := 4;
begin
  if auth.uid() is null or not private.is_buyer() then
    raise exception 'A buyer account is required to place an order';
  end if;

  perform 1 from public.marketplace_cart where buyer_id = auth.uid() for update;
  select count(*) into cart_count from public.marketplace_cart where buyer_id = auth.uid();
  if cart_count = 0 then
    raise exception 'Cart is empty';
  end if;

  select coalesce(platform_fee, 4) into fee
  from public.marketplace_settings
  where id = 'default';
  fee := greatest(coalesce(fee, 4), 0);

  select email into buyer_mail from public.profiles where id = auth.uid();

  for cart_row in
    select * from public.marketplace_cart where buyer_id = auth.uid() order by created_at
  loop
    select * into prod from public.marketplace_products where id = cart_row.product_id for update;
    if prod.id is null or not prod.is_active then
      raise exception 'A product in your cart is no longer available';
    end if;
    if prod.seller_id = auth.uid() then
      raise exception 'You cannot buy your own listing';
    end if;
    if cart_row.quantity < 1 then
      raise exception 'Quantity must be at least 1';
    end if;
    if prod.stock < cart_row.quantity then
      raise exception 'Insufficient stock for %', prod.title;
    end if;
    total := total + (prod.price * cart_row.quantity);
  end loop;

  loop
    ocode := 'IMMBA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.marketplace_orders where order_code = ocode);
  end loop;

  insert into public.marketplace_orders (buyer_id, buyer_email, status, total, order_code)
  values (auth.uid(), coalesce(buyer_mail, ''), 'pending_payment', total, ocode)
  returning id into oid;

  for cart_row in
    select * from public.marketplace_cart where buyer_id = auth.uid() order by created_at
  loop
    select * into prod from public.marketplace_products where id = cart_row.product_id for update;
    update public.marketplace_products
    set stock = stock - cart_row.quantity
    where id = prod.id
      and is_active
      and stock >= cart_row.quantity;
    if not found then
      raise exception 'Insufficient stock for %', prod.title;
    end if;
    insert into public.marketplace_order_items (
      order_id, product_id, seller_id, seller_label, title, quantity, unit_price, platform_fee
    ) values (
      oid, prod.id, prod.seller_id, coalesce(prod.seller_label, 'Campus seller'), prod.title, cart_row.quantity, prod.price,
      least(fee, greatest(prod.price * cart_row.quantity, 0))
    );
  end loop;

  delete from public.marketplace_cart where buyer_id = auth.uid();
  return oid;
end;
$function$;
