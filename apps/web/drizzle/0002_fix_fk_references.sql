-- Fix foreign key constraints that incorrectly reference auth.users instead of public.users

-- 1. audit_logs: drop FK referencing auth.users, re-add pointing to public.users
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- 2. shared_links: drop FK referencing auth.users, re-add pointing to public.users
ALTER TABLE shared_links DROP CONSTRAINT IF EXISTS shared_links_user_id_fkey;
ALTER TABLE shared_links
  ADD CONSTRAINT shared_links_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- 3. health_summaries: drop FK referencing auth.users, re-add pointing to public.users
ALTER TABLE health_summaries DROP CONSTRAINT IF EXISTS health_summaries_user_id_fkey;
ALTER TABLE health_summaries
  ADD CONSTRAINT health_summaries_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
