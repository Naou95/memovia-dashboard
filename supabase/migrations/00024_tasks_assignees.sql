-- Migration 00024: Add assignees array to tasks table
-- Allows assigning a task to multiple people while keeping assigned_to for compatibility

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS assignees TEXT[] NOT NULL DEFAULT '{}';
