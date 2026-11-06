-- Upgrade for teacher-set rates, staff hierarchy and admin verification.
-- Apply to a staging Supabase project first; this is not applied by merging Git branches.
begin;
alter table shikshak_private.profiles drop constraint if exists profiles_role_check;
alter table shikshak_private.profiles add constraint profiles_role_check check(role in ('student','teacher','admin','owner'));
alter table shikshak_private.profiles add column if not exists teacher_verified boolean not null default false;
create table if not exists shikshak_private.staff_audit (
  id bigint generated always as identity primary key,
  actor_id uuid not null references shikshak_private.profiles(id),
  target_id uuid not null references shikshak_private.profiles(id),
  action text not null,
  created_at timestamptz not null default now()
);
alter table shikshak_private.staff_audit enable row level security;
revoke all on shikshak_private.staff_audit from public,anon,authenticated;
revoke all on sequence shikshak_private.staff_audit_id_seq from public,anon,authenticated;
update shikshak_private.settings set data=data-'baseRate' where id=true;
update shikshak_private.profiles
  set data=data-'requestedRate'-'approvedRate'-'rateStatus'
  where data ?| array['requestedRate','approvedRate','rateStatus'];
-- Older accounts remain unverified until an administrator reviews them.

create or replace function shikshak_private.new_user() returns trigger
language plpgsql security definer set search_path='' as $$
declare m jsonb=new.raw_user_meta_data; a jsonb; r text=m->>'role'; begin
 if r not in ('student','teacher') or r is null then r='student'; end if;
 a=case when m->'homeArea' is not null then shikshak_private.area(m->'homeArea')
 else '{"lat":26.16,"lng":91.77,"city":"Guwahati","locality":"Guwahati"}'::jsonb end;
 insert into shikshak_private.profiles(id,role,data) values(new.id,r,jsonb_build_object(
 'id',new.id,'email',new.email,'name',coalesce(nullif(shikshak_private.txt(m,'name',60),''),'New member'),
 'role',r,'localityId','ganeshguri','homeArea',a,'homeChangedAt',now(),'bio','','strongSubjects','[]'::jsonb,
 'weakSubjects','[]'::jsonb,'qualifications','','experience','','active',true,'createdAt',now()));
 return new;
end $$;
create or replace function shikshak_private.profile(p shikshak_private.profiles) returns jsonb
language sql stable set search_path='' as $$ select p.data||jsonb_build_object('id',p.id,'role',p.role,'active',p.active,'teacherVerified',case when p.role='teacher' then p.teacher_verified else false end) $$;

create or replace function shikshak_private.listing(uid uuid) returns jsonb
language sql stable set search_path='' as $$
 select l.data||jsonb_build_object('id',p.id,'role',p.role,'name',p.data->>'name','localityId',p.data->>'localityId',
 'locality',(p.data#>>'{homeArea,locality}')||', '||(p.data#>>'{homeArea,city}'),
 'location',jsonb_build_object('lat',p.data#>'{homeArea,lat}','lng',p.data#>'{homeArea,lng}'),
 'rate',(l.data->>'rate')::numeric,
 'published',l.published,'teacherVerified',p.teacher_verified,'qualifications',p.data->>'qualifications','experience',p.data->>'experience')
 from shikshak_private.listings l join shikshak_private.profiles p on p.id=l.user_id where p.id=uid and p.active
$$;

create or replace function shikshak_private.quote(teacher uuid, student_area jsonb) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('baseRate',base,'travelFee',fee,'rate',base+fee)
 from (select (l.data->>'rate')::numeric base,
 least((s.data->>'maxTravelFee')::numeric,
 ceil(greatest(0,shikshak_private.distance(p.data->'homeArea',student_area)-(s.data->>'freeRadiusKm')::numeric)/(s.data->>'distanceStepKm')::numeric)*(s.data->>'stepFee')::numeric) fee
 from shikshak_private.profiles p join shikshak_private.listings l on l.user_id=p.id cross join shikshak_private.settings s where p.id=teacher) q
$$;

create or replace function shikshak_private.dispatch(path text, method text, input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 uid uuid=auth.uid(); me shikshak_private.profiles; target shikshak_private.profiles;
 p text[]=string_to_array(trim(both '/' from path),'/'); res text; role_value text;
 rid uuid; peer uuid; b shikshak_private.bookings; room shikshak_private.rooms; item shikshak_private.items;
 j jsonb; a jsonb; l jsonb; settings jsonb; rows jsonb; f jsonb; iid uuid; n numeric; dt timestamptz;
 subjects jsonb='["Mathematics","Physics","Chemistry","Biology","English","Computer Science","Social Science","Hindi","Assamese"]';
 grades jsonb='["Classes 1–5","Classes 6–8","Classes 9–10","Classes 11–12","College"]';
begin
 if uid is null then perform shikshak_private.fail('Sign in to continue.',401); end if;
 select * into me from shikshak_private.profiles where id=uid for update;
 if me.id is null or not me.active then perform shikshak_private.fail('This account is unavailable.',403); end if;
 select data into settings from shikshak_private.settings where id;
 if method not in ('GET','POST','PUT','DELETE') or octet_length(input::text)>40000 then perform shikshak_private.fail('Invalid request.'); end if;
 if p=array['auth','me'] and method='GET' then return shikshak_private.profile(me); end if;
 if p=array['profile'] and method='PUT' then
  if shikshak_private.txt(input,'name',60)='' then perform shikshak_private.fail('Enter your name.'); end if;
  a=case when input?'homeArea' then shikshak_private.area(input->'homeArea') else me.data->'homeArea' end;
  if a is distinct from me.data->'homeArea' then
   if (me.data->>'homeChangedAt')::timestamptz>now()-interval '30 days' then perform shikshak_private.fail('You can change your home area once every 30 days.',429); end if;
   me.data=me.data||jsonb_build_object('homeChangedAt',now());
  end if;
  me.data=me.data||jsonb_build_object('name',shikshak_private.txt(input,'name',60),'homeArea',a,
   'bio',shikshak_private.txt(input,'bio',700),
   'qualifications',case when me.role='teacher' then shikshak_private.txt(input,'qualifications',180) else '' end,
   'experience',case when me.role='teacher' then shikshak_private.txt(input,'experience',180) else '' end,
   'strongSubjects',case when me.role='student' and jsonb_typeof(input->'strongSubjects')='array' then input->'strongSubjects' else '[]'::jsonb end,
   'weakSubjects',case when me.role='student' and jsonb_typeof(input->'weakSubjects')='array' then input->'weakSubjects' else '[]'::jsonb end);
  update shikshak_private.profiles set data=me.data where id=uid;
  return shikshak_private.profile(me);
 end if;
 -- Deprecated rate approvals removed. Teacher rates are updated directly in their own listings.
 if p=array['admin','bootstrap'] and method='POST' then
  perform pg_advisory_xact_lock(737124976);
  if exists(select 1 from shikshak_private.profiles where role in ('admin','owner')) then perform shikshak_private.fail('Platform leadership is already configured. Ask an owner to grant access.',409); end if;
  if length(coalesce(input->>'setupToken',''))<24 or not exists(select 1 from shikshak_private.bootstrap
    where hash=encode(sha256(convert_to(input->>'setupToken','UTF8')),'hex')) then
   perform shikshak_private.fail('The one-time admin setup key is missing or incorrect.',403); end if;
  if not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null) then
   perform shikshak_private.fail('Confirm your account email before activating administrator access.',403); end if;
  update shikshak_private.profiles set role='owner', data=data||jsonb_build_object('baseRole',role) where id=uid returning * into me;
  delete from shikshak_private.bootstrap;
  return shikshak_private.profile(me);
 end if;
 if p[1]='admin' then
  if me.role not in ('admin','owner') then perform shikshak_private.fail('Administrator access required.',403); end if;
  if array_length(p,1)=1 and method='GET' then
   return jsonb_build_object('accounts',(select coalesce(jsonb_agg(shikshak_private.profile(x)),'[]'::jsonb) from (select * from shikshak_private.profiles order by created_at desc limit 500) x),
   'settings',settings,'viewerRole',me.role,'publishedListings',(select count(*) from shikshak_private.listings l join shikshak_private.profiles p on p.id=l.user_id where l.published),
   'matchedPairs',(select count(*) from shikshak_private.rooms),'pendingVerifications',(select count(*) from shikshak_private.profiles p where p.role='teacher' and p.active and not p.teacher_verified));
  end if;
  if p=array['admin','pricing'] and method='PUT' then
   if me.role<>'owner' then perform shikshak_private.fail('Only an owner can change the travel pricing policy.',403); end if;
   if coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then perform shikshak_private.fail('Complete owner two-factor authentication before changing pricing.',403); end if;
   if not (input ?& array['freeRadiusKm','distanceStepKm','stepFee','maxTravelFee']) then perform shikshak_private.fail('Complete all travel pricing fields.'); end if;
   if (input->>'freeRadiusKm')::numeric not between 0 and 100 or
   (input->>'distanceStepKm')::numeric not between 0.1 and 100 or (input->>'stepFee')::numeric not between 0 and 5000 or
   (input->>'maxTravelFee')::numeric not between 0 and 10000 then perform shikshak_private.fail('Invalid travel pricing settings.'); end if;
   j=jsonb_build_object('freeRadiusKm',(input->>'freeRadiusKm')::numeric,
   'distanceStepKm',(input->>'distanceStepKm')::numeric,'stepFee',(input->>'stepFee')::numeric,'maxTravelFee',(input->>'maxTravelFee')::numeric);
   update shikshak_private.settings set data=j where id; return j;
  end if;
  
if p[2]='accounts' and array_length(p,1)=4 and method='PUT' then
   select * into target from shikshak_private.profiles where id=p[3]::uuid for update;
   if target.id is null then perform shikshak_private.fail('Account not found.',404); end if;
   if p[4]='role' then
     if me.role<>'owner' then perform shikshak_private.fail('Only owners can change staff roles.',403); end if;
     if coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then perform shikshak_private.fail('Complete owner two-factor authentication before changing staff roles.',403); end if;
     if target.id=uid then perform shikshak_private.fail('You cannot change your own owner role.',403); end if;
     if input->>'action'='make-owner' or input->>'action'='make-admin' then
       if not target.active then perform shikshak_private.fail('Reactivate the member before assigning staff access.',409); end if;
       if not exists(select 1 from auth.users where id=target.id and email_confirmed_at is not null) then perform shikshak_private.fail('Confirm this member email before assigning staff access.',403); end if;
       if target.role in ('student','teacher') then
         update shikshak_private.profiles set data=data||jsonb_build_object('baseRole',target.role) where id=target.id;
       end if;
       update shikshak_private.profiles set role=case when input->>'action'='make-owner' then 'owner' else 'admin' end
       where id=target.id returning * into target;
     elsif input->>'action'='revoke-staff' then
       if target.role not in ('admin','owner') then perform shikshak_private.fail('This member has no staff access.',409); end if;
       if target.role='owner' and (select count(*) from shikshak_private.profiles where role='owner' and active)<=1 then
         perform shikshak_private.fail('You cannot remove the last active owner.',409); end if;
       update shikshak_private.profiles set role=case when data->>'baseRole'='teacher' then 'teacher' else 'student' end,
         data=data-'baseRole' where id=target.id returning * into target;
     else perform shikshak_private.fail('Invalid staff role action.'); end if;
     insert into shikshak_private.staff_audit(actor_id,target_id,action)
       values(uid,target.id,input->>'action');
   elsif p[4]='verification' and target.role='teacher' and input->>'action' in ('verify','unverify') then
     update shikshak_private.profiles set teacher_verified=(input->>'action'='verify')
       where id=target.id returning * into target;
     insert into shikshak_private.staff_audit(actor_id,target_id,action)
       values(uid,target.id,input->>'action');
   elsif target.role in ('owner','admin') then
     perform shikshak_private.fail('Staff accounts cannot be moderated as ordinary members.',403);
   elsif p[4]='status' and input->>'action' in ('activate','suspend') then
     update shikshak_private.profiles set active=(input->>'action'='activate') where id=target.id returning * into target;
   elsif p[4]='listing' and input->>'action'='hide' then
     update shikshak_private.listings set published=false where user_id=target.id;
   else perform shikshak_private.fail('Unsupported admin action.',404); end if;
   return shikshak_private.profile(target);
  end if;
  perform shikshak_private.fail('Admin endpoint not found.',404);
 end if;
 if p[1]<>'workspaces' or p[2]<>me.role or me.role not in ('student','teacher') then perform shikshak_private.fail('Access to this workspace is not permitted.',403); end if;
 role_value=me.role; res=p[3];
 if res='listing' and array_length(p,1)=3 then
  if method='GET' then return shikshak_private.listing(uid); end if;
  if method='PUT' then
   if shikshak_private.txt(input,'headline',90)='' or shikshak_private.txt(input,'availability',100)='' or shikshak_private.txt(input,'description',700)='' or
   jsonb_typeof(input->'subjects') is distinct from 'array' or jsonb_typeof(input->'grades') is distinct from 'array' then perform shikshak_private.fail('Complete your listing title, subjects, class levels and description.'); end if;
   if jsonb_array_length(input->'subjects') not between 1 and 20 or jsonb_array_length(input->'grades') not between 1 and 20 then perform shikshak_private.fail('Choose subjects and class levels.'); end if;
   n=(input->>'rate')::numeric;
   if n is null or n<>trunc(n) or n<(case when me.role='teacher' then 100 else 50 end) or n>10000 then perform shikshak_private.fail('Choose a valid hourly rate or budget.'); end if;
   j=jsonb_build_object('headline',shikshak_private.txt(input,'headline',90),'availability',shikshak_private.txt(input,'availability',100),
    'description',shikshak_private.txt(input,'description',700),'subjects',input->'subjects','grades',input->'grades','rate',n,'avatar',0,'color',case when me.role='teacher' then 'peach' else 'sage' end);
   insert into shikshak_private.listings values(uid,j,coalesce((input->>'published')::boolean,false))
   on conflict(user_id) do update set data=excluded.data,published=excluded.published;
   return shikshak_private.listing(uid);
  end if;
 end if;
 if res='discovery' and method='GET' and array_length(p,1)=3 then
  if me.role<>'student' then perform shikshak_private.fail('Student discovery is not available to teachers.',403); end if;
  a=coalesce(input->'origin',me.data->'homeArea');
  if (a->>'lat')::numeric is null or (a->>'lng')::numeric is null or abs((a->>'lat')::numeric)>90 or abs((a->>'lng')::numeric)>180 then perform shikshak_private.fail('Invalid search area.'); end if;
  select coalesce(jsonb_agg(x.j order by case when input->>'sort'='rate' then (x.j->>'rate')::float else (x.j->>'distance')::float end,(x.j->>'distance')::float),'[]'::jsonb) into rows from (
   select shikshak_private.listing(t.id)||shikshak_private.quote(t.id,me.data->'homeArea')||
   jsonb_build_object('distance',shikshak_private.distance(t.data->'homeArea',a),
   'saved',exists(select 1 from shikshak_private.saves v where v.user_id=uid and v.teacher_id=t.id),
   'connection',(select bk.status from shikshak_private.bookings bk where bk.student_id=uid and bk.teacher_id=t.id order by bk.created_at desc limit 1)) j
   from shikshak_private.profiles t join shikshak_private.listings tl on tl.user_id=t.id where t.role='teacher' and t.active and tl.published
  ) x where
   (coalesce(input->>'subject','')='' or (x.j->'subjects')?(input->>'subject')) and
   (coalesce(input->>'grade','')='' or (x.j->'grades')?(input->>'grade')) and
   (coalesce(input->>'query','')='' or lower(concat_ws(' ',x.j->>'name',x.j->>'headline',x.j->>'locality',x.j->>'subjects')) like '%'||lower(left(input->>'query',140))||'%') and
   (coalesce(input->>'saved','false')<>'true' or (x.j->>'saved')::boolean) and
   (coalesce(input->>'radius','')='' or (x.j->>'distance')::numeric<=nullif(input->>'radius','')::numeric) and
   (coalesce(input->>'maxRate','')='' or (x.j->>'rate')::numeric<=nullif(input->>'maxRate','')::numeric);
  return jsonb_build_object('listings',rows,'origin',me.data->'homeArea','total',jsonb_array_length(rows));
 end if;
 if res='listings' and p[5]='save' and method='PUT' and array_length(p,1)=5 then
  if me.role<>'student' then perform shikshak_private.fail('Teachers cannot browse or save student profiles.',403); end if;
  if not exists(select 1 from shikshak_private.listings li join shikshak_private.profiles pr on pr.id=li.user_id where li.user_id=p[4]::uuid and li.published and pr.role='teacher' and pr.active) then perform shikshak_private.fail('Tutor not found.',404); end if;
  if jsonb_typeof(input->'saved') is distinct from 'boolean' then perform shikshak_private.fail('Choose whether to save this tutor.'); end if;
  if (input->>'saved')::boolean then insert into shikshak_private.saves values(uid,p[4]::uuid) on conflict do nothing;
  else delete from shikshak_private.saves where user_id=uid and teacher_id=p[4]::uuid; end if;
  return jsonb_build_object('saved',input->'saved');
 end if;
 if res='bookings' then
  if method='GET' and array_length(p,1)=3 then
   select coalesce(jsonb_agg(shikshak_private.booking(x) order by x.created_at desc),'[]'::jsonb) into rows
   from shikshak_private.bookings x where uid in(x.student_id,x.teacher_id); return rows;
  end if;
  if method='POST' and array_length(p,1)=3 then
   if me.role<>'student' then perform shikshak_private.fail('Only students can request classes.',403); end if;
   peer=(input->>'teacherId')::uuid;
   select * into target from shikshak_private.profiles where id=peer and role='teacher' and active;
   l=shikshak_private.listing(peer);
   if target.id is null or l is null or not (l->>'published')::boolean then perform shikshak_private.fail('This tutor is unavailable.',404); end if;
   dt=(input->>'startsAt')::timestamptz; n=(input->>'durationMinutes')::numeric;
   if not (l->'subjects')?(input->>'subject') or not (l->'grades')?(input->>'grade') or dt is null or dt<now()+interval '15 minutes' or n is null or n<>trunc(n) or n not between 30 and 180 then perform shikshak_private.fail('Choose a subject, class level, future time and duration (30–180 minutes).'); end if;
   j=jsonb_build_object('subject',input->>'subject','grade',input->>'grade','startsAt',dt,'durationMinutes',n,
   'note',shikshak_private.txt(input,'note',600),'quotedRate',shikshak_private.quote(peer,me.data->'homeArea')->'rate','respondedAt',null);
   insert into shikshak_private.bookings(student_id,teacher_id,data) values(uid,peer,j) returning * into b;
   return shikshak_private.booking(b);
  end if;
  if method='PUT' and array_length(p,1)=4 then
   if me.role<>'teacher' then perform shikshak_private.fail('Only teachers can respond to bookings.',403); end if;
   select * into b from shikshak_private.bookings where id=p[4]::uuid and teacher_id=uid for update;
   if b.id is null then perform shikshak_private.fail('Booking not found.',404); end if;
   if b.status<>'pending' then perform shikshak_private.fail('This booking has already been decided.',409); end if;
   if input->>'decision' not in ('accept','reject') or input->>'decision' is null then perform shikshak_private.fail('Choose accept or reject.'); end if;
   if not exists(select 1 from shikshak_private.profiles where id=b.student_id and active) then perform shikshak_private.fail('Student account unavailable.',409); end if;
   update shikshak_private.bookings set status=case when input->>'decision'='accept' then 'accepted' else 'rejected' end,
   data=data||jsonb_build_object('respondedAt',now()) where id=b.id returning * into b;
   if b.status='accepted' then
    insert into shikshak_private.rooms(student_id,teacher_id) values(b.student_id,uid) on conflict(student_id,teacher_id) do update set teacher_id=excluded.teacher_id returning * into room;
    iid=gen_random_uuid();
    insert into shikshak_private.items(id,room_id,kind,data) values(iid,room.id,'sessions',
    jsonb_build_object('id',iid,'title',(b.data->>'subject')||' · First class','startsAt',b.data->'startsAt','durationMinutes',b.data->'durationMinutes','status','scheduled','createdAt',now()));
   end if;
   return shikshak_private.booking(b);
  end if;
 end if;
 if res='classrooms' and array_length(p,1)=3 and method='GET' then
  select coalesce(jsonb_agg(jsonb_build_object('partner',case when me.role='teacher' then shikshak_private.student_partner(r.student_id) else shikshak_private.listing(r.teacher_id) end,'classroom',shikshak_private.room_json(r))),'[]'::jsonb)
  into rows from shikshak_private.rooms r join shikshak_private.profiles s on s.id=r.student_id join shikshak_private.profiles t on t.id=r.teacher_id
  where uid in(r.student_id,r.teacher_id) and s.active and t.active; return rows;
 end if;
 if res='connections' then
  peer=p[4]::uuid;
  select r.* into room from shikshak_private.rooms r join shikshak_private.profiles s on s.id=r.student_id join shikshak_private.profiles t on t.id=r.teacher_id
  where ((r.student_id=uid and r.teacher_id=peer) or (r.teacher_id=uid and r.student_id=peer)) and s.active and t.active;
  if room.id is null then perform shikshak_private.fail('Classes and messages open after the teacher accepts your booking.',403); end if;
  if p[5]='messages' and array_length(p,1)=5 then
   if method='GET' then
    select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'authorId',m.author_id,'body',m.body,'sentAt',m.sent_at) order by m.sent_at),'[]'::jsonb) into rows
    from (select * from shikshak_private.messages where room_id=room.id order by sent_at desc limit 200) m; return rows;
   end if;
   if method='POST' then
    if shikshak_private.txt(input,'body',500)='' or shikshak_private.txt(input,'id',60)='' then perform shikshak_private.fail('Enter a message.'); end if;
    insert into shikshak_private.messages(id,room_id,author_id,body) values(shikshak_private.txt(input,'id',60),room.id,uid,shikshak_private.txt(input,'body',500)) on conflict do nothing;
    return (select jsonb_build_object('id',m.id,'authorId',m.author_id,'body',m.body,'sentAt',m.sent_at) from shikshak_private.messages m where m.room_id=room.id and m.author_id=uid and m.id=shikshak_private.txt(input,'id',60));
   end if;
  end if;
  if p[5]='files' then
   if method='GET' and array_length(p,1)=6 then
    return (select jsonb_build_object('path',ff.object_path,'pdf',ff.data) from shikshak_private.files ff where ff.room_id=room.id and ff.id=p[6]::uuid and shikshak_private.file_visible(ff.object_path));
   end if;
   if method='POST' and array_length(p,1)=5 then
    iid=(input->>'id')::uuid;
    j=jsonb_build_object('id',iid,'name',shikshak_private.txt(input,'name',140),'sizeBytes',(input->>'sizeBytes')::int,'mimeType','application/pdf');
    if input->>'kind' not in ('note','assignment','submission') or input->>'kind' is null or
    (input->>'kind'='submission' and me.role<>'student') or (input->>'kind'<>'submission' and me.role<>'teacher') then perform shikshak_private.fail('This upload is not permitted.',403); end if;
    if lower(j->>'name') not like '%.pdf' or (input->>'sizeBytes')::int not between 1 and 10485760 then perform shikshak_private.fail('Choose a PDF under 10 MB.'); end if;
    res=room.student_id::text||'/'||room.teacher_id::text||'/'||uid::text||'/'||(input->>'kind')||'/'||iid::text||'.pdf';
    if not exists(select 1 from storage.objects o where o.bucket_id='classroom-pdfs' and o.name=res and (o.metadata->>'size')::bigint=(input->>'sizeBytes')::bigint) then perform shikshak_private.fail('PDF upload not found.'); end if;
    insert into shikshak_private.files(id,room_id,owner_id,kind,object_path,data) values(iid,room.id,uid,input->>'kind',res,j);
    return j;
   end if;
  end if;
  if p[5]='classroom' then
   if method='GET' and array_length(p,1)=5 then return shikshak_private.room_json(room); end if;
   if method='POST' and array_length(p,1)=6 and me.role='teacher' then
    iid=gen_random_uuid(); res=p[6];
    j=jsonb_build_object('id',iid,'title',shikshak_private.txt(input,'title',100),'createdAt',now());
    if j->>'title'='' then perform shikshak_private.fail('Enter a title.'); end if;
    if res='sessions' then
     dt=(input->>'startsAt')::timestamptz; n=(input->>'durationMinutes')::numeric;
     if dt is null or dt<now()-interval '5 minutes' or n is null or n<>trunc(n) or n not between 15 and 240 then perform shikshak_private.fail('Choose a future time and duration of 15–240 minutes.'); end if;
     j=j||jsonb_build_object('startsAt',dt,'durationMinutes',n,'status','scheduled');
    elsif res='notes' then
     f=shikshak_private.pdf(input->'pdf',room.id,'note');
     if shikshak_private.txt(input,'content',8000)='' and f is null then perform shikshak_private.fail('Write a note or attach a PDF.'); end if;
     j=j||jsonb_build_object('content',shikshak_private.txt(input,'content',8000));
     if f is not null then j=j||jsonb_build_object('pdf',f); end if;
    elsif res='homework' then
     dt=(input->>'dueAt')::timestamptz; f=shikshak_private.pdf(input->'pdf',room.id,'assignment');
     if dt is null or (shikshak_private.txt(input,'instructions',3000)='' and f is null) then perform shikshak_private.fail('Add instructions or a PDF and a deadline.'); end if;
     j=j||jsonb_build_object('instructions',shikshak_private.txt(input,'instructions',3000),'dueAt',dt,'submission','','submittedAt',null,'review','','reviewedAt',null);
     if f is not null then j=j||jsonb_build_object('assignmentPdf',f); end if;
    else perform shikshak_private.fail('Endpoint not found.',404); end if;
    insert into shikshak_private.items(id,room_id,kind,data) values(iid,room.id,res,j); return j;
   end if;
   if method='PUT' and array_length(p,1)=8 then
    select * into item from shikshak_private.items where id=p[7]::uuid and room_id=room.id and kind=p[6] for update;
    if item.id is null then perform shikshak_private.fail('Classroom item not found.',404); end if;
    j=item.data;
    if item.kind='sessions' and p[8]='status' and me.role='teacher' and input->>'status' in ('completed','cancelled') then
     j=j||jsonb_build_object('status',input->>'status');
    elsif item.kind='homework' and p[8]='submit' and me.role='student' then
     if j->>'reviewedAt' is not null then perform shikshak_private.fail('Reviewed homework cannot be changed.',409); end if;
     f=case when input?'pdf' then shikshak_private.pdf(input->'pdf',room.id,'submission') else j->'submissionPdf' end;
     if input->>'removePdf'='true' then f=null; end if;
     if shikshak_private.txt(input,'submission',8000)='' and f is null then perform shikshak_private.fail('Write a response or attach a PDF.'); end if;
     j=(j-'submissionPdf')||jsonb_build_object('submission',shikshak_private.txt(input,'submission',8000),'submittedAt',now(),'review','','reviewedAt',null);
     if f is not null then j=j||jsonb_build_object('submissionPdf',f); end if;
    elsif item.kind='homework' and p[8]='review' and me.role='teacher' and j->>'submittedAt' is not null then
     if shikshak_private.txt(input,'review',4000)='' then perform shikshak_private.fail('Write feedback first.'); end if;
     j=j||jsonb_build_object('review',shikshak_private.txt(input,'review',4000),'reviewedAt',now());
    else perform shikshak_private.fail('This classroom action is not permitted.',403); end if;
    update shikshak_private.items set data=j where id=item.id; return j;
   end if;
  end if;
 end if;
 perform shikshak_private.fail('Endpoint not found.',404);
 return null;
exception
 when unique_violation then perform shikshak_private.fail('A pending or accepted booking already exists.',409); return null;
 when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then
 perform shikshak_private.fail('One or more request fields are invalid.'); return null;
end $$;
notify pgrst,'reload schema';
commit;
