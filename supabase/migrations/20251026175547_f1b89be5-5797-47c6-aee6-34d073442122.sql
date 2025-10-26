-- Enable pg_cron and pg_net extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the budget variance monitor to run every Friday at 09:00 AM
SELECT cron.schedule(
  'budget-variance-monitor-weekly',
  '0 9 * * 5', -- Every Friday at 09:00 AM (cron format: minute hour day month weekday)
  $$
  SELECT
    net.http_post(
        url:='https://zudmeuoeyskducmubruk.supabase.co/functions/v1/cfo-budget-variance-monitor',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1ZG1ldW9leXNrZHVjbXVicnVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0Njc1NTYsImV4cCI6MjA3NzA0MzU1Nn0.X7RA8LTmX_WI2U-SUuDz3J8hPX49BhT1WNrxzI42Kds"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);