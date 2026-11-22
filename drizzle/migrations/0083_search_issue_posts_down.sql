-- Rollback for 0083_search_issue_posts.sql. Drops only the search function and its index; no
-- post data is touched. The app falls back to its earlier fault search automatically.
DROP FUNCTION IF EXISTS public.search_issue_posts(text, text, text, boolean, text, integer, integer);
DROP INDEX IF EXISTS public.posts_issue_fts_idx;
