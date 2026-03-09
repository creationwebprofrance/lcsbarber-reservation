
INSERT INTO public.carnaval_settings (setting_key, setting_value, description)
VALUES
  ('book_event_label', 'BOOK ÉVÉNEMENTIEL', 'Label en haut de la section'),
  ('book_event_title', 'Événements, artistes & collaborations', 'Titre principal'),
  ('book_event_description', 'Découvrez mes partenaires, les artistes qui me font confiance et mes prestations événementielles.', 'Description'),
  ('book_event_button_text', 'Voir mes prestations', 'Texte du bouton'),
  ('book_event_button_link', '/evenements', 'Lien du bouton')
ON CONFLICT DO NOTHING;
