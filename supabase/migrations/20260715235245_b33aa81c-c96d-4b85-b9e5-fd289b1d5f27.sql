
CREATE POLICY "Public read audit photos" ON storage.objects FOR SELECT USING (bucket_id = 'audit-photos');
CREATE POLICY "Public upload audit photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'audit-photos');
CREATE POLICY "Public update audit photos" ON storage.objects FOR UPDATE USING (bucket_id = 'audit-photos');
CREATE POLICY "Public delete audit photos" ON storage.objects FOR DELETE USING (bucket_id = 'audit-photos');
