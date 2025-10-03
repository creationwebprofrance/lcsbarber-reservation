-- Mise à jour des prix des services existants
UPDATE services SET price = 20.00 WHERE name = 'Coupe classique';
UPDATE services SET price = 25.00 WHERE name = 'Coupe + barbe';  
UPDATE services SET price = 15.00 WHERE name = 'Coupe enfant';
UPDATE services SET price = 10.00 WHERE name = 'Barbe uniquement';

-- Ajout du service Contours
INSERT INTO services (name, description, price, duration_minutes, is_active) 
VALUES ('Contours', 'Contours et finitions', 10.00, 20, true);