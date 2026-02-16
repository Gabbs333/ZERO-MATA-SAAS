-- Vérification des extensions installées
SELECT * FROM pg_extension WHERE extname = 'pgcrypto';
