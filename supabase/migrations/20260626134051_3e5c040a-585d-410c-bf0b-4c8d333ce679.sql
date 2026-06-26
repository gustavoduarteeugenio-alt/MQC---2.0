
REVOKE SELECT ON public.questions FROM authenticated, anon;

GRANT SELECT (
  id, subject_id, statement, option_a, option_b, option_c, option_d, option_e,
  image_url, comment_image_url, difficulty, banca, subtopic, year, created_at, updated_at
) ON public.questions TO authenticated;

GRANT SELECT (
  id, subject_id, statement, option_a, option_b, option_c, option_d, option_e,
  image_url, difficulty, banca, subtopic, year, created_at, updated_at
) ON public.questions TO anon;
