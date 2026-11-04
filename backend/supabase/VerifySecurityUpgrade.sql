-- Read-only verification after SecurityUpgrade.sql. Does not inspect secret keys.
with expected(name) as (values
 ('bot_personas'),('site_events'),('personal_puzzles'),
 ('puzzle_runs'),('puzzle_attempts'),('puzzle_awards'))
select e.name as table_name,
 case when c.oid is null then 'MISSING'
   when c.relrowsecurity
     and not has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE')
     and not has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE')
     and has_table_privilege('service_role',c.oid,'SELECT')
     and has_table_privilege('service_role',c.oid,'INSERT')
     and has_table_privilege('service_role',c.oid,'UPDATE')
     and has_table_privilege('service_role',c.oid,'DELETE')
   then 'PASS' else 'CHECK PERMISSIONS' end as result
from expected e left join pg_class c on c.oid=to_regclass('public.'||e.name)
order by e.name;

with expected(signature) as (values
 ('public.touch_site_presence(uuid)'),
 ('public.puzzle_progress_snapshot(uuid)'),
 ('public.finish_puzzle_run(uuid,uuid)'),
 ('public.start_puzzle_attempt(uuid,uuid,text,jsonb,uuid,integer)'),
 ('public.commit_puzzle_answer(uuid,uuid,integer,text,jsonb)'))
select signature,
 case when to_regprocedure(signature) is null then 'MISSING'
   when not has_function_privilege('anon',to_regprocedure(signature),'EXECUTE')
     and not has_function_privilege('authenticated',to_regprocedure(signature),'EXECUTE')
     and has_function_privilege('service_role',to_regprocedure(signature),'EXECUTE')
   then 'PASS' else 'CHECK PERMISSIONS' end as result
from expected;
