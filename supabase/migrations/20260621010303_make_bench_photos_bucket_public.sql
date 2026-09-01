/*
# Make bench-photos Storage Bucket Public

Updates the bench-photos storage bucket to be publicly accessible,
allowing anonymous users to view bench photos without authentication.
*/

UPDATE storage.buckets SET public = true WHERE name = 'bench-photos';
