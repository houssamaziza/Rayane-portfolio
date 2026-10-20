-- Nom complet de l'architecte
UPDATE settings SET data = json_set(data, '$.name', 'Rayene Mohamed Cheghib', '$.aboutText', replace(json_extract(data, '$.aboutText'), 'Rayane est architecte', 'Rayene Mohamed Cheghib est architecte')) WHERE id = 1 AND json_extract(data, '$.name') = 'Rayane';
