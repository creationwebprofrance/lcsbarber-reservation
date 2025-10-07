-- Permettre aux admins de supprimer des réservations
CREATE POLICY "Admins can delete bookings"
ON bookings
FOR DELETE
TO authenticated
USING (is_admin());