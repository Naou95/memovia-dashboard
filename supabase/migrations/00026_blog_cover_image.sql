ALTER TABLE public.blog_articles
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
