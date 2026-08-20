-- helper: caller's email
CREATE OR REPLACE FUNCTION public.my_email()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT email FROM public.profiles WHERE id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.my_email() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_email() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_assigned_reviewer(_paper_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.paper_assignments
    WHERE paper_id = _paper_id AND assigned_to = auth.uid()
  )
$$;
REVOKE ALL ON FUNCTION public.is_assigned_reviewer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_assigned_reviewer(uuid) TO authenticated;

-- PAPERS
DROP POLICY IF EXISTS "Demo open access to papers" ON public.papers;
REVOKE ALL ON public.papers FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.papers TO authenticated;

CREATE POLICY "Owner reads own papers" ON public.papers FOR SELECT TO authenticated
  USING (created_by_id = auth.uid());
CREATE POLICY "HOD reads institution papers" ON public.papers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'hod') AND (institution_id IS NULL OR institution_id = public.my_institution()));
CREATE POLICY "Reviewer reads assigned papers" ON public.papers FOR SELECT TO authenticated
  USING (public.is_assigned_reviewer(id));
CREATE POLICY "Coordinator reads approved papers" ON public.papers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'coord') AND status = 'approved');

CREATE POLICY "Owner creates papers" ON public.papers FOR INSERT TO authenticated
  WITH CHECK (created_by_id = auth.uid());
CREATE POLICY "Owner updates own papers" ON public.papers FOR UPDATE TO authenticated
  USING (created_by_id = auth.uid()) WITH CHECK (created_by_id = auth.uid());
CREATE POLICY "Reviewer updates assigned papers" ON public.papers FOR UPDATE TO authenticated
  USING (public.is_assigned_reviewer(id)) WITH CHECK (public.is_assigned_reviewer(id));
CREATE POLICY "HOD updates institution papers" ON public.papers FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'hod')) WITH CHECK (public.has_role(auth.uid(),'hod'));
CREATE POLICY "Owner deletes own drafts" ON public.papers FOR DELETE TO authenticated
  USING (created_by_id = auth.uid() AND status = 'draft');

-- NOTIFICATIONS
DROP POLICY IF EXISTS "Demo open access to notifications" ON public.notifications;
REVOKE ALL ON public.notifications FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
CREATE POLICY "Read own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (recipient_email = public.my_email());
CREATE POLICY "Update own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (recipient_email = public.my_email()) WITH CHECK (recipient_email = public.my_email());
CREATE POLICY "Signed-in users create notifications" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);

-- FIRST USER PER INSTITUTION BECOMES ACTIVE HOD
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _inst uuid := NULLIF(NEW.raw_user_meta_data->>'institution_id','')::uuid;
  _first boolean := false;
BEGIN
  IF _inst IS NOT NULL THEN
    SELECT NOT EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.user_roles r ON r.user_id = p.id AND r.role = 'hod'
      WHERE p.institution_id = _inst
    ) INTO _first;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, department, institution_id, status)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name',''),
    COALESCE(NEW.raw_user_meta_data->>'department',''),
    _inst,
    CASE WHEN _first THEN 'active'::public.account_status ELSE 'pending'::public.account_status END
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN _first THEN 'hod'::public.app_role ELSE 'designer'::public.app_role END)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;