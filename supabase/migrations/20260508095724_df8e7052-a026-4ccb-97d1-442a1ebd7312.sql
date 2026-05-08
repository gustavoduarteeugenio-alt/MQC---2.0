-- Drop the old blanket admin policy (only checks 'admin' role)
DROP POLICY IF EXISTS "Admins manage questions" ON public.questions;

-- Allow admin and admin_didatico to insert questions
CREATE POLICY "Admin and didatico can insert questions"
ON public.questions
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'admin_didatico'::app_role)
);

-- Allow admin and admin_didatico to update questions
CREATE POLICY "Admin and didatico can update questions"
ON public.questions
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'admin_didatico'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'admin_didatico'::app_role)
);

-- Allow admin and admin_didatico to delete questions
CREATE POLICY "Admin and didatico can delete questions"
ON public.questions
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'admin_didatico'::app_role)
);