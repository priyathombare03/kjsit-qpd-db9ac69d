-- Trigger-only functions must not be callable from the API
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Unused helper: not needed by the API
REVOKE ALL ON FUNCTION public.my_department() FROM PUBLIC, anon, authenticated;

-- Self-scoped helpers: no direct API access needed; RLS still evaluates them
REVOKE ALL ON FUNCTION public.my_email() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_institution() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_assigned_reviewer(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;

-- Harden has_role: signed-in callers can only ask about themselves,
-- so it can no longer be used to enumerate other users' roles.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
  END
$function$;