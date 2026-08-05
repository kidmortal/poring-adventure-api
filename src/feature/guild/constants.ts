/**
 * Every stat a guild may bless, and what one level of it is worth.
 *
 * The step is what separates a cheap stat from an expensive one: a level costs
 * the same whichever is bought, so health moving 5 and strength moving 1 is the
 * whole balance between them. Crit damage moves 5 because it is a percent of a
 * normal hit, where one point is barely felt; crit rate moves 1 because a point
 * of it is a flat chance and compounds with every other source of damage.
 */
export const UPGRADE_FACTOR = {
  health: 5,
  mana: 5,
  str: 1,
  agi: 1,
  int: 1,
  defense: 1,
  critRate: 1,
  critDamage: 5,
  /** One extra point of daily profession stamina per level. */
  stamina: 1,
};

export const ALLOWED_BLESSINGS = Object.keys(UPGRADE_FACTOR);

/** The one blessing spent on the stamina ceiling rather than on a combat stat. */
export const STAMINA_BLESSING = 'stamina';
