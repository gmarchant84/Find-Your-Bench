/*
  # Create bench-photos storage bucket

  Creates a public storage bucket for bench photos and sets up
  appropriate RLS policies so:
  - Anyone can read/view photos (public bucket)
  - Any authenticated user can upload photos
  - Users can only delete their own uploads
*/

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bench-photos',
  'bench-photos',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read photos (public bucket)
CREATE POLICY "Public bench photos are viewable by everyone"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'bench-photos');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload bench photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'bench-photos');

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete own bench photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'bench-photos' AND auth.uid() = owner);
