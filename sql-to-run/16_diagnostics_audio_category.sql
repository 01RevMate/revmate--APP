-- RevMate SQL step 16 — add "Speakers / Sound" diagnostics category
-- Copy of drizzle/migrations/0048_diagnostics_audio_category.sql. Safe to run more than once.

BEGIN;

ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_issue_system_check;
ALTER TABLE public.posts ADD CONSTRAINT posts_issue_system_check CHECK (
  issue_system IS NULL OR issue_system IN (
    'engine', 'gearbox', 'electrical', 'bodywork', 'suspension', 'brakes', 'cooling',
    'exhaust', 'fuel', 'steering', 'tyres_wheels', 'interior', 'software', 'audio', 'other')
);

COMMIT;
