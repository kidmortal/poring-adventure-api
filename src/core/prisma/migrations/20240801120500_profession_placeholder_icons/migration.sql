-- Placeholder emoji icons and descriptions for the professions that already
-- exist. Real artwork replaces the emoji later; new professions can be inserted
-- at any time with their own icon/description.
UPDATE "Profession" SET "icon" = '⚔️', "description" = 'Sword and rune magic in one hand. Solid attack with the health to stay in melee.' WHERE "name" = 'Rune Knight';
UPDATE "Profession" SET "icon" = '✨', "description" = 'Support caster. Heals and blessings backed by a deep mana pool.' WHERE "name" = 'Priest';
UPDATE "Profession" SET "icon" = '🔮', "description" = 'Glass cannon caster. Highest intelligence, lowest survivability.' WHERE "name" = 'Mage';
UPDATE "Profession" SET "icon" = '🛡️', "description" = 'Frontline tank. Trades damage for the strength and health to hold aggro.' WHERE "name" = 'Knight';
UPDATE "Profession" SET "icon" = '🗡️', "description" = 'Fast striker. Highest attack and agility, thin health bar.' WHERE "name" = 'Assassin';
