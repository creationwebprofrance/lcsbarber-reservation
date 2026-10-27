-- Additive community schema. No existing provider or business data is reassigned.
CREATE TABLE public.blade_public_profiles (
 provider_id uuid PRIMARY KEY REFERENCES public.blade_providers(id), name text NOT NULL,
 city text NOT NULL, zone text NOT NULL, home boolean NOT NULL DEFAULT false,
 near boolean NOT NULL DEFAULT false, active boolean NOT NULL DEFAULT false,
 photo_path text, latitude double precision, longitude double precision,
 booking_path text CHECK (booking_path IS NULL OR booking_path='/reservation'),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.blade_public_profiles TO anon,authenticated;
GRANT ALL ON public.blade_public_profiles TO service_role;
ALTER TABLE public.blade_public_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active public profile or owner" ON public.blade_public_profiles FOR SELECT USING(active OR public.blade_owns_provider(provider_id));

CREATE TABLE public.blade_publications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider_id uuid NOT NULL REFERENCES public.blade_providers(id),
 service_id uuid NOT NULL REFERENCES public.services(id), title text NOT NULL CHECK(length(title) BETWEEN 2 AND 150),
 description text CHECK(length(description)<=2000), category text NOT NULL CHECK(length(category) BETWEEN 1 AND 80),
 kind text NOT NULL CHECK(kind IN ('image','video')), status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','processing','published','hidden','error','deleted')),
 media_path text NOT NULL UNIQUE, thumbnail_path text, mime_type text NOT NULL,
 size_bytes bigint NOT NULL, duration_seconds numeric, ready boolean NOT NULL DEFAULT false,
 published_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.blade_publications TO authenticated;
GRANT ALL ON public.blade_publications TO service_role;
ALTER TABLE public.blade_publications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner sees own work" ON public.blade_publications FOR SELECT TO authenticated USING(public.blade_owns_provider(provider_id));
CREATE INDEX blade_publications_feed_idx ON public.blade_publications(status,published_at DESC,id);
CREATE FUNCTION public.blade_validate_publication() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.services WHERE id=NEW.service_id AND provider_id=NEW.provider_id) THEN RAISE EXCEPTION 'Service ownership mismatch'; END IF;
 IF NEW.mime_type IN ('image/jpeg','image/png','image/webp') THEN
  IF NEW.kind<>'image' OR NEW.size_bytes NOT BETWEEN 1 AND 10485760 THEN RAISE EXCEPTION 'Invalid image'; END IF;
 ELSIF NEW.mime_type IN ('video/mp4','video/webm') THEN
  IF NEW.kind<>'video' OR NEW.size_bytes NOT BETWEEN 1 AND 52428800 OR NEW.duration_seconds IS NULL OR NEW.duration_seconds NOT BETWEEN 0.001 AND 60 OR NEW.thumbnail_path IS NULL THEN RAISE EXCEPTION 'Invalid video'; END IF;
 ELSE RAISE EXCEPTION 'Unsupported media'; END IF;
 IF NEW.status='published' THEN
  IF NOT NEW.ready OR NOT EXISTS(SELECT 1 FROM public.blade_public_profiles WHERE provider_id=NEW.provider_id AND active) OR NOT EXISTS(SELECT 1 FROM public.services WHERE id=NEW.service_id AND is_active) THEN RAISE EXCEPTION 'Publication is not ready'; END IF;
  NEW.published_at:=COALESCE(NEW.published_at,now());
 END IF;
 NEW.updated_at:=now();RETURN NEW;
END; $$;
CREATE TRIGGER blade_validate_publication BEFORE INSERT OR UPDATE ON public.blade_publications FOR EACH ROW EXECUTE FUNCTION public.blade_validate_publication();

CREATE TABLE public.blade_work_likes (
 publication_id uuid NOT NULL REFERENCES public.blade_publications(id) ON DELETE CASCADE,
 actor_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(publication_id,actor_hash)
);
GRANT ALL ON public.blade_work_likes TO service_role;
ALTER TABLE public.blade_work_likes ENABLE ROW LEVEL SECURITY;
-- No browser grants or policies: only the validated server identity may mutate reactions.

CREATE TABLE public.blade_private_conversations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider_a uuid NOT NULL REFERENCES public.blade_providers(id),
 provider_b uuid NOT NULL REFERENCES public.blade_providers(id), created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(provider_a<provider_b), UNIQUE(provider_a,provider_b)
);
GRANT SELECT ON public.blade_private_conversations TO authenticated;
GRANT ALL ON public.blade_private_conversations TO service_role;
ALTER TABLE public.blade_private_conversations ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.blade_conversation_member(p_conversation uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.blade_private_conversations c JOIN public.blade_providers p ON p.id IN(c.provider_a,c.provider_b) WHERE c.id=p_conversation AND p.user_id=auth.uid() AND public.has_role(auth.uid(),'admin'));
$$;
REVOKE ALL ON FUNCTION public.blade_conversation_member(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.blade_conversation_member(uuid) TO authenticated;
CREATE POLICY "Only conversation participants" ON public.blade_private_conversations FOR SELECT TO authenticated USING(public.blade_conversation_member(id));

CREATE TABLE public.blade_private_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid NOT NULL REFERENCES public.blade_private_conversations(id),
 sender_id uuid NOT NULL REFERENCES public.blade_providers(id), body text NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 2000),
 request_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(sender_id,request_id)
);
GRANT SELECT ON public.blade_private_messages TO authenticated;
GRANT ALL ON public.blade_private_messages TO service_role;
ALTER TABLE public.blade_private_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only participants read messages" ON public.blade_private_messages FOR SELECT TO authenticated USING(public.blade_conversation_member(conversation_id));
CREATE INDEX blade_private_messages_conversation_idx ON public.blade_private_messages(conversation_id,created_at);
CREATE FUNCTION public.blade_validate_private_message() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.blade_private_conversations WHERE id=NEW.conversation_id AND NEW.sender_id IN(provider_a,provider_b)) THEN RAISE EXCEPTION 'Sender not a participant'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER blade_validate_private_message BEFORE INSERT OR UPDATE ON public.blade_private_messages FOR EACH ROW EXECUTE FUNCTION public.blade_validate_private_message();
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='blade_private_messages') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.blade_private_messages; END IF; END $$;

CREATE TABLE public.blade_message_reads (
 conversation_id uuid NOT NULL REFERENCES public.blade_private_conversations(id), provider_id uuid NOT NULL REFERENCES public.blade_providers(id),
 read_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(conversation_id,provider_id)
);
GRANT ALL ON public.blade_message_reads TO service_role;
ALTER TABLE public.blade_message_reads ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.blade_community_limits (
 actor_hash text NOT NULL, scope text NOT NULL, window_start timestamptz NOT NULL, count integer NOT NULL DEFAULT 0,
 PRIMARY KEY(actor_hash,scope,window_start)
);
GRANT ALL ON public.blade_community_limits TO service_role;
ALTER TABLE public.blade_community_limits ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.blade_community_limit(p_actor text,p_scope text,p_limit int,p_seconds int) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n int; w timestamptz;
BEGIN
 IF p_seconds<1 OR p_limit<1 THEN RETURN false; END IF;
 w:=to_timestamp(floor(extract(epoch FROM now())/p_seconds)*p_seconds);
 INSERT INTO public.blade_community_limits(actor_hash,scope,window_start,count) VALUES(p_actor,p_scope,w,1)
 ON CONFLICT(actor_hash,scope,window_start) DO UPDATE SET count=blade_community_limits.count+1 RETURNING count INTO n;
 RETURN n<=p_limit;
END; $$;
REVOKE ALL ON FUNCTION public.blade_community_limit(text,text,int,int) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.blade_community_limit(text,text,int,int) TO service_role;

CREATE TABLE public.blade_ai_access_state (
 id text PRIMARY KEY CHECK(id='assistant'), paused boolean NOT NULL DEFAULT false,
 status integer, reason text, updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.blade_ai_access_state TO service_role;
ALTER TABLE public.blade_ai_access_state ENABLE ROW LEVEL SECURITY;
-- Storage bucket creation is an authorized Storage API action after acceptance, not a SQL write.
-- Originals and thumbnails remain private. No public storage.objects policy is added.