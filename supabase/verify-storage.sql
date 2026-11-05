begin;
do $test$
declare s uuid=gen_random_uuid();t uuid=gen_random_uuid();o uuid=gen_random_uuid();r uuid;f uuid=gen_random_uuid();sf uuid=gen_random_uuid();fp text;sp text;j jsonb;h jsonb;
begin
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
(s,'pdf-student-'||s||'@example.invalid',now(),'{"name":"Student","role":"student"}'),
(t,'pdf-teacher-'||t||'@example.invalid',now(),'{"name":"Teacher","role":"teacher"}'),
(o,'pdf-outsider-'||o||'@example.invalid',now(),'{"name":"Outsider","role":"student"}');
insert into shikshak_private.rooms(student_id,teacher_id) values(s,t) returning id into r;
fp=s||'/'||t||'/'||t||'/note/'||f||'.pdf';
sp=s||'/'||t||'/'||s||'/submission/'||sf||'.pdf';
insert into storage.objects(bucket_id,name,metadata) values('classroom-pdfs',fp,'{"size":100,"mimetype":"application/pdf"}'),('classroom-pdfs',sp,'{"size":120,"mimetype":"application/pdf"}');
perform set_config('request.jwt.claim.sub',t::text,true);
assert shikshak_private.storage_access(fp,true),'Teacher upload';
assert not shikshak_private.storage_access(sp,true),'Cannot upload as student';
j=public.shikshak_api('workspaces/teacher/connections/'||s||'/files','POST',jsonb_build_object('id',f,'name','notes.pdf','sizeBytes',100,'kind','note'));
assert shikshak_private.file_visible(fp),'Uploader sees upload';
perform set_config('request.jwt.claim.sub',s::text,true);
assert not shikshak_private.file_visible(fp),'Unshared upload private';
perform set_config('request.jwt.claim.sub',t::text,true);
perform public.shikshak_api('workspaces/teacher/connections/'||s||'/classroom/notes','POST',jsonb_build_object('title','Lesson PDF','content','','pdf',j));
perform set_config('request.jwt.claim.sub',s::text,true);
assert shikshak_private.file_visible(fp),'Shared note visible to student';
j=public.shikshak_api('workspaces/student/connections/'||t||'/files/'||f);assert j->>'path'=fp,'Private download authorized';
j=public.shikshak_api('workspaces/student/connections/'||t||'/files','POST',jsonb_build_object('id',sf,'name','answer.pdf','sizeBytes',120,'kind','submission'));
perform set_config('request.jwt.claim.sub',t::text,true);
assert not shikshak_private.file_visible(sp),'Unsubmitted answers stay private';
h=public.shikshak_api('workspaces/teacher/connections/'||s||'/classroom/homework','POST',jsonb_build_object('title','Practice','instructions','Question','dueAt',now()+interval '2 days'));
perform set_config('request.jwt.claim.sub',s::text,true);
h=public.shikshak_api('workspaces/student/connections/'||t||'/classroom/homework/'||(h->>'id')||'/submit','PUT',jsonb_build_object('submission','My response','pdf',j));
perform set_config('request.jwt.claim.sub',t::text,true);
assert shikshak_private.file_visible(sp),'Teacher sees submitted answers';
perform set_config('request.jwt.claim.sub',s::text,true);
perform public.shikshak_api('workspaces/student/connections/'||t||'/classroom/homework/'||(h->>'id')||'/submit','PUT','{"submission":"Text answer","removePdf":true}');
perform set_config('request.jwt.claim.sub',t::text,true);
assert not shikshak_private.file_visible(sp),'Removed submission inaccessible to teacher';
perform set_config('request.jwt.claim.sub',o::text,true);
assert not shikshak_private.storage_access(fp,false),'Outsider denied';
assert not shikshak_private.file_visible(fp),'Outsider document denied';
perform set_config('request.jwt.claim.sub',s::text,true);
insert into shikshak_private.bootstrap values(true,encode(sha256(convert_to('rollback-only-test-setup-key','UTF8')),'hex'));
begin perform public.shikshak_api('admin/bootstrap','POST','{"setupToken":"incorrect-setup-key-which-is-long-enough"}');raise exception 'Incorrect key accepted';exception when sqlstate 'PT403' then null;end;
j=public.shikshak_api('admin/bootstrap','POST','{"setupToken":"rollback-only-test-setup-key"}');assert j->>'role'='admin','Admin activated';
assert not exists(select 1 from shikshak_private.bootstrap),'One-time key consumed';
perform set_config('request.jwt.claim.sub',o::text,true);
begin perform public.shikshak_api('admin/bootstrap','POST','{"setupToken":"rollback-only-test-setup-key"}');raise exception 'Second admin allowed';exception when sqlstate 'PT409' then null;end;
perform set_config('request.jwt.claim.sub',s::text,true);
perform set_config('shikshak.test.path',fp,true);
end $test$;
set local role authenticated;
do $test$ begin
assert (select count(*) from storage.objects where name=current_setting('shikshak.test.path'))=1,'Authenticated storage RLS allows shared PDF';
begin perform id from shikshak_private.profiles;raise exception 'Direct private table read allowed';exception when insufficient_privilege then null;end;
end $test$;
reset role;
rollback;
select 'Passed: storage participant policies, unshared upload privacy, shared PDFs, removed submissions, outsider denial, one-time admin activation and direct-table denial' as result;