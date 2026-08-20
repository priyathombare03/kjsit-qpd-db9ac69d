-- ENUMS
CREATE TYPE public.app_role AS ENUM ('hod','dqc','designer','coord');
CREATE TYPE public.year_level AS ENUM ('SY','TY','LY');
CREATE TYPE public.account_status AS ENUM ('pending','active','rejected');
CREATE TYPE public.assignment_status AS ENUM ('assigned','in_review','approved','returned');

-- INSTITUTIONS
CREATE TABLE public.institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.institutions TO anon, authenticated;
GRANT ALL ON public.institutions TO service_role;
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Institutions are publicly readable" ON public.institutions FOR SELECT TO anon, authenticated USING (true);

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  institution_id uuid REFERENCES public.institutions(id),
  department text NOT NULL DEFAULT '',
  status public.account_status NOT NULL DEFAULT 'pending',
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ROLES
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.my_department()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT department FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.my_institution()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT institution_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "HOD reads department profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'hod') AND institution_id = public.my_institution());
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "HOD updates department profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'hod') AND institution_id = public.my_institution())
  WITH CHECK (public.has_role(auth.uid(),'hod') AND institution_id = public.my_institution());

CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "HOD reads all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'hod'));
CREATE POLICY "HOD manages roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'hod')) WITH CHECK (public.has_role(auth.uid(),'hod'));

-- DQC SCOPES
CREATE TABLE public.dqc_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year_level public.year_level NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, year_level)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dqc_scopes TO authenticated;
GRANT ALL ON public.dqc_scopes TO service_role;
ALTER TABLE public.dqc_scopes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own scopes" ON public.dqc_scopes FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "HOD reads scopes" ON public.dqc_scopes FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'hod'));
CREATE POLICY "HOD manages scopes" ON public.dqc_scopes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'hod')) WITH CHECK (public.has_role(auth.uid(),'hod'));

-- ACADEMIC YEARS / SEMESTERS
CREATE TABLE public.academic_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.academic_years TO anon, authenticated;
GRANT ALL ON public.academic_years TO service_role;
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Academic years readable" ON public.academic_years FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.semesters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  year_level public.year_level NOT NULL,
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (academic_year_id, label)
);
GRANT SELECT ON public.semesters TO anon, authenticated;
GRANT ALL ON public.semesters TO service_role;
ALTER TABLE public.semesters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Semesters readable" ON public.semesters FOR SELECT TO anon, authenticated USING (true);

-- PAPERS EXTRA COLUMNS
ALTER TABLE public.papers
  ADD COLUMN institution_id uuid REFERENCES public.institutions(id),
  ADD COLUMN year_level public.year_level,
  ADD COLUMN academic_year_id uuid REFERENCES public.academic_years(id),
  ADD COLUMN semester_id uuid REFERENCES public.semesters(id),
  ADD COLUMN created_by_id uuid;

-- ASSIGNMENTS
CREATE TABLE public.paper_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id uuid NOT NULL REFERENCES public.papers(id) ON DELETE CASCADE,
  assigned_by uuid,
  assigned_to uuid,
  submitted_by uuid,
  year_level public.year_level,
  academic_year_id uuid REFERENCES public.academic_years(id),
  semester_id uuid REFERENCES public.semesters(id),
  status public.assignment_status NOT NULL DEFAULT 'assigned',
  is_primary boolean NOT NULL DEFAULT true,
  due_at timestamptz,
  submitted_at timestamptz,
  decided_at timestamptz,
  note text,
  reminder_count integer NOT NULL DEFAULT 0,
  last_reminded_at timestamptz,
  last_reminded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paper_assignments TO authenticated;
GRANT ALL ON public.paper_assignments TO service_role;
ALTER TABLE public.paper_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Involved users read assignments" ON public.paper_assignments FOR SELECT TO authenticated
  USING (assigned_to = auth.uid() OR assigned_by = auth.uid() OR submitted_by = auth.uid()
         OR public.has_role(auth.uid(),'hod') OR public.has_role(auth.uid(),'coord'));
CREATE POLICY "Faculty and HOD create assignments" ON public.paper_assignments FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid() OR public.has_role(auth.uid(),'hod'));
CREATE POLICY "Reviewer or HOD updates assignment" ON public.paper_assignments FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid() OR public.has_role(auth.uid(),'hod') OR public.has_role(auth.uid(),'coord'))
  WITH CHECK (assigned_to = auth.uid() OR public.has_role(auth.uid(),'hod') OR public.has_role(auth.uid(),'coord'));
CREATE POLICY "HOD deletes assignments" ON public.paper_assignments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'hod'));

CREATE TRIGGER update_paper_assignments_updated_at BEFORE UPDATE ON public.paper_assignments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- NOTIFICATIONS type + realtime
ALTER TABLE public.notifications ADD COLUMN type text NOT NULL DEFAULT 'assignment';
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- NEW USER TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, department, institution_id, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name',''),
    COALESCE(NEW.raw_user_meta_data->>'department',''),
    NULLIF(NEW.raw_user_meta_data->>'institution_id','')::uuid,
    'pending'
  )
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'designer')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- SEED
INSERT INTO public.institutions (code, name) VALUES
  ('KJSIT','K. J. Somaiya Institute of Technology'),
  ('KJSCE','K. J. Somaiya College of Engineering'),
  ('SVU','Somaiya Vidyavihar University');

INSERT INTO public.academic_years (label, is_active) VALUES ('2026-27', true), ('2025-26', false);

INSERT INTO public.semesters (academic_year_id, year_level, label)
SELECT ay.id, v.yl::public.year_level, v.lbl
FROM public.academic_years ay
CROSS JOIN (VALUES ('SY','III'),('SY','IV'),('TY','V'),('TY','VI'),('LY','VII'),('LY','VIII')) AS v(yl,lbl);