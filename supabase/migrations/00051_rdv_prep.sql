-- Trame de préparation d'un RDV (22/08/2026) : visible dans la fiche RDV
-- avant le rendez-vous, repliée une fois le CR écrit.
alter table rdv add column if not exists prep text;
