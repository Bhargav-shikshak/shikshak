begin;
do $test$
declare s uuid=gen_random_uuid(); t uuid=gen_random_uuid(); outsider uuid=gen_random_uuid(); ad uuid=gen_random_uuid();
b jsonb; j jsonb; h jsonb; n jsonb; rate numeric;
begin
insert into auth.users(id,email,raw_user_meta_data) values
(s,'backend-student-'||s||'@example.invalid','{"name":"Backend Student","role":"student","homeArea":{"lat":26.17,"lng":91.77,"city":"Guwahati","locality":"Rajgarh"}}'),
(t,'backend-teacher-'||t||'@example.invalid','{"name":"Backend Teacher","role":"teacher","homeArea":{"lat":26.18,"lng":91.78,"city":"Guwahati","locality":"Chandmari"}}'),
(outsider,'backend-outsider-'||outsider||'@example.invalid','{"name":"Outsider","role":"student"}'),
(ad,'backend-admin-'||ad||'@example.invalid','{"name":"Admin","role":"admin"}');
assert (select role='student' from shikshak_private.profiles where id=ad),'Signup cannot grant admin';
update shikshak_private.profiles set role='admin' where id=ad;
perform set_config('request.jwt.claim.sub',t::text,true);
j=public.shikshak_api('auth/me'); assert j->>'role'='teacher','Teacher session';
j=public.shikshak_api('workspaces/teacher/listing','PUT','{"headline":"Physics lessons","subjects":["Physics"],"grades":["Classes 9-10"],"availability":"Evenings","description":"Test tutor listing","published":true,"rate":650}');
assert (j->>'rate')::numeric=650,'Teacher controls hourly rate';
begin perform public.shikshak_api('workspaces/teacher/discovery'); raise exception 'Teacher discovery allowed'; exception when sqlstate 'PT403' then null; end;
-- This represents a completed identity review, not a price approval.
update shikshak_private.profiles set teacher_verified=true where id=t;
perform set_config('request.jwt.claim.sub',s::text,true);
j=public.shikshak_api('workspaces/student/discovery'); assert jsonb_array_length(j->'listings')=1,'Discovery finds teacher';
begin perform public.shikshak_api('admin'); raise exception 'Student admin allowed'; exception when sqlstate 'PT403' then null; end;
begin perform public.shikshak_api('profile','PUT','{"name":"Student","homeArea":{"lat":27,"lng":92,"city":"Another","locality":"Area"}}'); raise exception 'Cooldown bypass'; exception when sqlstate 'PT429' then null; end;
b=public.shikshak_api('workspaces/student/bookings','POST',jsonb_build_object('teacherId',t,'subject','Physics','grade','Classes 9-10','startsAt',now()+interval '2 days','durationMinutes',60,'note','Backend smoke test'));
assert b->>'status'='pending','Pending booking';
begin perform public.shikshak_api('workspaces/student/connections/'||t||'/messages'); raise exception 'Premature messages allowed'; exception when sqlstate 'PT403' then null; end;
begin perform public.shikshak_api('workspaces/student/bookings','POST',jsonb_build_object('teacherId',t,'subject','Physics','grade','Classes 9-10','startsAt',now()+interval '2 days','durationMinutes',60)); raise exception 'Duplicate booking allowed'; exception when sqlstate 'PT409' then null; end;
perform set_config('request.jwt.claim.sub',t::text,true);
b=public.shikshak_api('workspaces/teacher/bookings/'||(b->>'id'),'PUT','{"decision":"accept"}'); assert b->>'status'='accepted','Accepted booking';
j=public.shikshak_api('workspaces/teacher/classrooms'); assert jsonb_array_length(j)=1,'Teacher classroom';
assert j#>>'{0,partner,locality}'='' and j#>>'{0,partner,location,lat}'='0','Student location redacted';
assert not ((j#>'{0,partner}')?'homeArea'),'No home area leak';
j=public.shikshak_api('workspaces/teacher/connections/'||s||'/classroom'); assert jsonb_array_length(j->'sessions')=1,'First session atomic';
n=public.shikshak_api('workspaces/teacher/connections/'||s||'/classroom/notes','POST','{"title":"Lesson","content":"Physics notes"}');
h=public.shikshak_api('workspaces/teacher/connections/'||s||'/classroom/homework','POST',jsonb_build_object('title','Practice','instructions','Solve question 1','dueAt',now()+interval '3 days'));
j=public.shikshak_api('workspaces/teacher/connections/'||s||'/messages','POST','{"id":"test-message","body":"Welcome"}');
j=public.shikshak_api('workspaces/teacher/connections/'||s||'/messages','POST','{"id":"test-message","body":"Welcome duplicate"}');
j=public.shikshak_api('workspaces/teacher/connections/'||s||'/messages'); assert jsonb_array_length(j)=1,'Message retry idempotent';
perform set_config('request.jwt.claim.sub',outsider::text,true);
begin perform public.shikshak_api('workspaces/student/connections/'||t||'/classroom'); raise exception 'Outsider classroom allowed'; exception when sqlstate 'PT403' then null; end;
perform set_config('request.jwt.claim.sub',s::text,true);
begin perform public.shikshak_api('workspaces/student/connections/'||t||'/classroom/notes','POST','{"title":"Intrusion","content":"No"}'); raise exception 'Student note mutation allowed'; exception when sqlstate 'PT403' or sqlstate 'PT404' then null; end;
h=public.shikshak_api('workspaces/student/connections/'||t||'/classroom/homework/'||(h->>'id')||'/submit','PUT','{"submission":"My answer"}');
perform set_config('request.jwt.claim.sub',t::text,true);
h=public.shikshak_api('workspaces/teacher/connections/'||s||'/classroom/homework/'||(h->>'id')||'/review','PUT','{"review":"Correct"}');
perform set_config('request.jwt.claim.sub',s::text,true);
begin perform public.shikshak_api('workspaces/student/connections/'||t||'/classroom/homework/'||(h->>'id')||'/submit','PUT','{"submission":"Changed"}'); raise exception 'Reviewed homework changed'; exception when sqlstate 'PT409' then null; end;
perform set_config('request.jwt.claim.sub',t::text,true);
j=public.shikshak_api('workspaces/teacher/listing');
assert (j->>'rate')::int=650,'Teacher rate persists without admin approval';
perform set_config('request.jwt.claim.sub',ad::text,true);
perform public.shikshak_api('admin/accounts/'||s||'/status','PUT','{"action":"suspend"}');
perform set_config('request.jwt.claim.sub',s::text,true);
begin perform public.shikshak_api('auth/me'); raise exception 'Suspended session allowed'; exception when sqlstate 'PT403' then null; end;
perform set_config('request.jwt.claim.sub','',true);
begin perform public.shikshak_api('auth/me'); raise exception 'Anonymous allowed'; exception when sqlstate 'PT401' then null; end;
end $test$;
rollback;
select 'Passed: signup roles, discovery, pricing, booking transaction, duplicates, private student location, chat, homework, admin and suspension' as result;