-- Verification controls only the public badge; preserve all records and status flags.
begin;
do $migration$
declare original text; revised text;
begin
 original := pg_get_functiondef('shikshak_private.dispatch(text,text,jsonb)'::regprocedure);
 revised := replace(original,'where l.published and p.teacher_verified','where l.published');
 revised := replace(revised,'t.active and t.teacher_verified and tl.published','t.active and tl.published');
 revised := replace(revised,'pr.active and pr.teacher_verified','pr.active');
 revised := replace(revised,'role=''teacher'' and active and teacher_verified;','role=''teacher'' and active;');
 if revised = original then raise exception 'Expected verification gates were not found; inspect the current dispatcher before applying'; end if;
 execute revised;
end $migration$;
notify pgrst,'reload schema';
commit;
