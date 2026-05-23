alter table public.goodies drop column if exists image_url;
alter table public.goodies_internal drop column if exists vendor;
alter table public.goodies_internal drop column if exists notes;

create temporary table seed_goodies_catalog (
  tier_label text not null,
  name text not null,
  unit_cost_cents int not null,
  description text
) on commit drop;

insert into seed_goodies_catalog (tier_label, name, unit_cost_cents, description) values
  ('Tier 1', 'Anker MagSafe + 65W GaN Charger Bundle', 5000, 'Wireless MagSafe pad paired with a fast-charging GaN wall adapter. Replaces three cables with one tidy setup.'),
  ('Tier 1', 'Logitech MX Anywhere 3S Mouse', 5000, 'Compact precision mouse with silent clicks, scrolls through long documents in one flick. Works on any surface.'),
  ('Tier 1', 'Hario V60 Pour-Over Kit + Specialty Coffee', 5000, 'Ceramic dripper, server, filters, and a pound of single-origin coffee. The morning ritual upgrade.'),
  ('Tier 1', 'Yeti Rambler 30oz + Stojo Collapsible Cup', 4500, 'Keeps coffee hot for hours and a packable cup for the road. Built to outlast the laptop.'),
  ('Tier 1', 'Bellroy Lite Sling', 5000, 'Lightweight everyday-carry sling for phone, charger, and essentials. Water-resistant.'),
  ('Tier 1', 'TWSBI Eco Fountain Pen + Leuchtturm1917 Notebook', 5000, 'Refillable piston-fill fountain pen and a dot-grid hardcover notebook. For the analog-minded.'),
  ('Tier 2', 'Anker Soundcore Space One Headphones', 10000, 'Active noise cancellation, 40-hour battery, comfortable for full-day wear. Genuine focus mode.'),
  ('Tier 2', 'Logitech MX Keys S Keyboard', 10000, 'Low-profile wireless keyboard with backlit keys and multi-device switching. The professional standard.'),
  ('Tier 2', 'Kensington Pro Fit Vertical Mouse + Wrist Rest', 9500, 'Ergonomic vertical mouse and gel wrist rest. For anyone whose wrist starts complaining at hour three.'),
  ('Tier 2', 'Audible Annual + Spotify Premium 6-Month Bundle', 10000, 'One year of audiobooks plus six months of ad-free music. Soundtrack for long focus sessions.'),
  ('Tier 2', 'Theragun Mini (2nd Gen)', 9900, 'Pocket-sized percussive massager for shoulders, neck, and forearms. Three-hour battery.'),
  ('Tier 2', 'Hatch Restore 2 Sunrise Alarm', 10000, 'Sunrise-simulating alarm with soundscapes. Better mornings, better days.'),
  ('Tier 2', 'Trade Coffee 3-Month Subscription', 9000, 'Personalized roasts delivered from top US roasters. Three months of remembering this gig fondly.'),
  ('Tier 2', 'Uniqlo Gift Card', 10000, 'Use it on anything - basics, outerwear, the Heattech you''ve been meaning to try.'),
  ('Tier 3', 'Apple AirPods Pro 2 (USB-C)', 20000, 'Adaptive noise cancellation, spatial audio, and the most-used earbuds on earth.'),
  ('Tier 3', 'Kindle Paperwhite Signature Edition + 2-Year Kindle Unlimited', 20000, 'Glare-free screen, wireless charging, weeks of battery, and two years of unlimited reading.'),
  ('Tier 3', 'Herman Miller / Steelcase Refurbished Chair Credit', 20000, 'Voucher toward a refurbished ergonomic chair from Crandall Office or similar. Best-in-class for desk work.'),
  ('Tier 3', 'Roost Laptop Stand + MX Keys + MX Master 3S Combo', 20000, 'Complete ergonomic laptop setup. Raises the screen, frees the hands, fixes the neck.'),
  ('Tier 3', 'Tushy Classic 3.0 Bidet + Premium Towel Set', 18000, 'The bathroom upgrade people don''t realize they needed until they have one. Easy install.'),
  ('Tier 3', 'Insta360 Go 3 Action Camera', 20000, 'Tiny wearable camera with magnetic mounting. Stabilized 2.7K video, hands-free capture.'),
  ('Tier 3', 'REI Co-op Gift Card', 20000, 'Outdoor gear, technical layers, camping kit - whatever moves you outside.'),
  ('Tier 3', 'MasterClass Annual Subscription', 18000, 'Full year of access to every class. Cooking, writing, business, music - pick a new craft.'),
  ('Tier 3', 'Lululemon Gift Card', 20000, 'Toward technical wear that doubles as work-from-home wardrobe. ABC pants, Define jackets, Align leggings.');

insert into public.goodies (tier_label, name, description, available)
select catalog.tier_label, catalog.name, catalog.description, true
from seed_goodies_catalog catalog
where not exists (
  select 1
  from public.goodies goodies
  where goodies.tier_label = catalog.tier_label
    and goodies.name = catalog.name
);

update public.goodies goodies
set description = catalog.description,
    available = true
from seed_goodies_catalog catalog
where goodies.tier_label = catalog.tier_label
  and goodies.name = catalog.name;

insert into public.goodies_internal (goodie_id, unit_cost_cents)
select goodies.id, catalog.unit_cost_cents
from public.goodies goodies
join seed_goodies_catalog catalog
  on catalog.tier_label = goodies.tier_label
  and catalog.name = goodies.name
on conflict (goodie_id) do update
set unit_cost_cents = excluded.unit_cost_cents;
