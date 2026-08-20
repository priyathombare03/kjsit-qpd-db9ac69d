GRANT EXECUTE ON FUNCTION public.my_email() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_institution() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_assigned_reviewer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;