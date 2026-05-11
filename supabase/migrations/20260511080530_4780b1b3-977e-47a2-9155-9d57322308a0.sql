
-- Public buckets serve files via direct URLs without needing this policy.
-- Removing it prevents the broad listing of all objects in the bucket.
DROP POLICY IF EXISTS "Anyone can view artist photos" ON storage.objects;
