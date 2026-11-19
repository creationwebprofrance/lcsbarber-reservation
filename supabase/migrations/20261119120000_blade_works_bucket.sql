-- Espace de stockage privé des Réalisations (photos 10 Mo, vidéos 50 Mo). Aucun accès direct du navigateur :
-- la fonction blade-community délivre des liens signés temporaires.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('blade-works','blade-works',false,52428800,ARRAY['image/jpeg','image/png','image/webp','video/mp4','video/webm'])
ON CONFLICT (id) DO NOTHING;
