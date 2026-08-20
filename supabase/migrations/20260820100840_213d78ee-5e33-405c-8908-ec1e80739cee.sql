REVOKE ALL ON FUNCTION public.my_email() FROM authenticated;
REVOKE ALL ON FUNCTION public.my_institution() FROM authenticated;
REVOKE ALL ON FUNCTION public.is_assigned_reviewer(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;