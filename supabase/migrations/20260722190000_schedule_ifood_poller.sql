create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid)
from cron.job
where jobname = 'popsystem-ifood-poller';

select cron.schedule(
  'popsystem-ifood-poller',
  '30 seconds',
  $$
    select net.http_post(
      url := 'https://gcfyrcpugmducptktjic.supabase.co/functions/v1/ifood-poller',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('scheduledAt', now()),
      timeout_milliseconds := 20000
    ) as request_id;
  $$
);
