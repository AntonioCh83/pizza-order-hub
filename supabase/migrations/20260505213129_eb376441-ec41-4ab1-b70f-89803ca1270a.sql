
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

CREATE POLICY "Users see own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Auto-assign staff role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'staff');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Department enum
CREATE TYPE public.department AS ENUM ('cucina', 'pizzeria', 'bar');

-- Tables (tavoli)
CREATE TABLE public.restaurant_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number INT NOT NULL UNIQUE,
  name TEXT,
  seats INT NOT NULL DEFAULT 4,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;

-- Categories
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  department department NOT NULL DEFAULT 'cucina',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Menu items
CREATE TABLE public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  department department NOT NULL DEFAULT 'cucina',
  available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- Orders
CREATE TYPE public.order_status AS ENUM ('open', 'closed');
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES public.restaurant_tables(id),
  status order_status NOT NULL DEFAULT 'open',
  opened_by UUID REFERENCES auth.users(id),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  notes TEXT
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Order items
CREATE TYPE public.item_status AS ENUM ('pending', 'sent', 'preparing', 'ready', 'served');
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id),
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  notes TEXT,
  department department NOT NULL,
  status item_status NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- RLS: any authenticated staff can manage everything
CREATE POLICY "staff read tables" ON public.restaurant_tables FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff write tables" ON public.restaurant_tables FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "staff read cats" ON public.categories FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff write cats" ON public.categories FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "staff read menu" ON public.menu_items FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff write menu" ON public.menu_items FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "staff read orders" ON public.orders FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff write orders" ON public.orders FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "staff read items" ON public.order_items FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff write items" ON public.order_items FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;

-- Seed data
INSERT INTO public.restaurant_tables (number, seats) VALUES
  (1,2),(2,2),(3,4),(4,4),(5,4),(6,6),(7,6),(8,8),(9,4),(10,2),(11,4),(12,6);

INSERT INTO public.categories (name, department, sort_order) VALUES
  ('Antipasti', 'cucina', 1),
  ('Primi', 'cucina', 2),
  ('Secondi', 'cucina', 3),
  ('Pizze Classiche', 'pizzeria', 4),
  ('Pizze Speciali', 'pizzeria', 5),
  ('Dolci', 'cucina', 6),
  ('Bevande', 'bar', 7),
  ('Vini', 'bar', 8);

INSERT INTO public.menu_items (category_id, name, description, price, department) 
SELECT c.id, x.name, x.descr, x.price, c.department FROM public.categories c
JOIN (VALUES
  ('Antipasti', 'Bruschetta al pomodoro', 'Pane tostato, pomodoro fresco, basilico', 6.00),
  ('Antipasti', 'Tagliere misto', 'Salumi e formaggi locali', 14.00),
  ('Antipasti', 'Caprese', 'Mozzarella di bufala e pomodoro', 9.00),
  ('Primi', 'Spaghetti alla Carbonara', 'Uovo, guanciale, pecorino', 12.00),
  ('Primi', 'Lasagna della casa', 'Ragù bolognese, besciamella', 11.00),
  ('Primi', 'Risotto ai funghi porcini', 'Crema di porcini', 14.00),
  ('Secondi', 'Tagliata di manzo', 'Rucola e grana', 22.00),
  ('Secondi', 'Branzino al forno', 'Patate e olive', 24.00),
  ('Pizze Classiche', 'Margherita', 'Pomodoro, mozzarella, basilico', 8.00),
  ('Pizze Classiche', 'Marinara', 'Pomodoro, aglio, origano', 6.50),
  ('Pizze Classiche', 'Diavola', 'Pomodoro, mozzarella, salame piccante', 10.00),
  ('Pizze Classiche', 'Capricciosa', 'Prosciutto, funghi, carciofi, olive', 11.00),
  ('Pizze Speciali', 'Tartufo e burrata', 'Crema di tartufo, burrata', 16.00),
  ('Pizze Speciali', 'Quattro Formaggi', 'Mozzarella, gorgonzola, fontina, grana', 12.00),
  ('Pizze Speciali', 'Mortadella e pistacchio', 'Burrata, mortadella, pistacchio', 14.00),
  ('Dolci', 'Tiramisù', 'Della casa', 6.00),
  ('Dolci', 'Panna cotta', 'Frutti di bosco', 5.50),
  ('Bevande', 'Acqua naturale 1L', '', 2.50),
  ('Bevande', 'Acqua frizzante 1L', '', 2.50),
  ('Bevande', 'Coca Cola', '33cl', 3.50),
  ('Bevande', 'Birra Moretti', '33cl', 4.50),
  ('Vini', 'Vino della casa rosso 1/2L', '', 8.00),
  ('Vini', 'Chianti DOCG', 'Bottiglia', 22.00)
) AS x(cat, name, descr, price) ON c.name = x.cat;
