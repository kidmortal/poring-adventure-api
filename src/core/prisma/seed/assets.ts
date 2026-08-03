/**
 * The art that actually exists on the CDN.
 *
 * Every image the seed points at goes through `materialImage` or
 * `consumableImage`, which fail loudly on a name that is not in these lists.
 * That guard is here because it was needed: an earlier pass invented a dozen
 * plausible file names — `herb_stew.webp`, `demon_ore.webp` — that had never
 * been uploaded, and the seed happily created items whose artwork was a broken
 * image. A seed that cannot resolve its art should not run at all.
 *
 * The lists come from the Sirv folder listings. When new art is uploaded, add
 * its file name here and it becomes available to the seed.
 */

/** Sirv escapes spaces in a path the same way any URL does. */
function assetUrl(folder: string, name: string) {
  return `https://kidmortal.sirv.com/${folder}/${encodeURIComponent(name)}.webp`;
}

export function materialImage(name: MaterialAsset) {
  if (!(MATERIAL_ASSETS as readonly string[]).includes(name)) {
    throw new Error(`no material art named "${name}" — check the Sirv folder listing`);
  }
  return assetUrl('materials', name);
}

export function consumableImage(name: ConsumableAsset) {
  if (!(CONSUMABLE_ASSETS as readonly string[]).includes(name)) {
    throw new Error(`no consumable art named "${name}" — check the Sirv folder listing`);
  }
  return assetUrl('consumables', name);
}

export type MaterialAsset = (typeof MATERIAL_ASSETS)[number];
export type ConsumableAsset = (typeof CONSUMABLE_ASSETS)[number];

// prettier-ignore
const MATERIAL_ASSETS = [
  'amethyst_herb', 'amethyst_shard', 'azure_feather', 'azure_herb', 'banana', 'bat_wing', 'beast_claw',
  'beast_horn', 'beetle', 'black feather', 'black_feather', 'blackcurrants', 'blue shell', 'blue_herb',
  'blueberries', 'bone_fragment', 'bread roll', 'broccoli', 'brussels_sprouts', 'butter_block', 'carrot',
  'celery', 'cheese', 'cheese_wedge', 'cheese_wheel', 'cherries', 'chicken_leg', 'chili_pepper', 'cloud_wisp',
  'clover_herb', 'cocoon', 'copper_ore', 'corn', 'crab_legs', 'cracked egg', 'crimson_root', 'crystal cluster',
  'crystal_heart', 'crystal_herb_amethyst', 'crystal_herb_crimson', 'crystal_herb_frost', 'crystal_herb_ruby',
  'crystal_herb_sapphire', 'crystal_herb_topaz', 'crystal_herb_verdant', 'dark ore', 'dark_herb_bunch',
  'dark_wing', 'dough', 'dragon_egg', 'dragon_herb', 'dried_fish', 'dried_root', 'egg', 'eggplant',
  'ember_crystal_burst', 'emerald_herb', 'fairy_essence', 'fig', 'fire crystal', 'flour_bag',
  'four_leaf_clover', 'frost_crystal_burst', 'frost_feather', 'ginger_root', 'ginseng_root', 'gold dust',
  'gold horn', 'gold_dust', 'gold_flakes', 'golden_feather', 'grapes', 'green dust', 'green leaf',
  'green_apple', 'green_bell_pepper', 'green_herb', 'green_herb_pouch', 'grilled meat', 'ham_slice',
  'health potion', 'herb_leaf', 'herb_seed_pouch', 'herb_sprig', 'holy water', 'honey_pot', 'ice shard',
  'ice_crystal', 'ice_crystal_shard', 'iron_ore', 'ivory horn', 'jade ore', 'large health potion',
  'large mana potion', 'leafy_greens', 'leek', 'lemon_b', 'lettuce', 'lightning_shard', 'lime', 'magma orb',
  'mana potion', 'mandarin_orange', 'mandragora', 'mandrake_root', 'meat_cut', 'meat_slices', 'melon',
  'moon_blossom', 'moonstone_pale', 'moonstone_shard', 'mushroom', 'mushroom_b', 'old letters', 'onion',
  'orange', 'orange shell', 'orange shell 2', 'pale_claw', 'pale_crystal_burst', 'peach', 'pear', 'peas',
  'persimmon', 'phoenix feather', 'pink gem', 'pink shell', 'pink_mushroom', 'plum', 'poison pouch',
  'pomegranate', 'potato', 'potatoes', 'prism_gem', 'pumpkin', 'purple_cabbage', 'raspberries', 'raw_fish',
  'raw_meat', 'raw_seafood', 'raw_shrimp', 'red cloth', 'red mushroom', 'red rose', 'red_apple', 'red_flower',
  'red_rose', 'rice_barrel', 'salmon_fillet', 'salt_shaker', 'sauce_bottle_red', 'scallop_shell',
  'sealed letter', 'seaweed', 'seed_pouch', 'serpent_tail', 'shadow_ink', 'shadow_orb', 'shiitake_mushroom',
  'shrimp', 'silver dust', 'silver ore', 'skull', 'slime_jelly_blue', 'slime_jelly_green',
  'slime_jelly_purple', 'slime_jelly_red', 'slime_jelly_white', 'slime_jelly_yellow', 'small health potion',
  'small mana potion', 'small_bone', 'snowflake', 'speckled_egg', 'spice_ball', 'spice_pouch_red',
  'spinach_leaf', 'spiny_green_herb', 'spiny_herb', 'spiny_taproot', 'spirit_wisp', 'stamina potion',
  'stone chunk', 'strawberries', 'striped_meat', 'tomato', 'tuna_fish', 'turnip', 'water_orb',
  'watermelon_slice', 'webbed_root', 'wheat_bundle', 'white coral', 'white feather', 'white feather scroll',
  'white_blossom', 'white_cabbage', 'white_egg', 'white_fang', 'white_feather', 'white_flower',
  'white_mushroom', 'white_onion', 'white_powder_pouch', 'wild_garlic', 'wild_green_herb', 'wine gourd',
  'worm', 'yellow gem', 'yellow_mushroom', 'yellow_pepper', 'yellow_squash', 'zucchini',
] as const;

// prettier-ignore
const CONSUMABLE_ASSETS = [
  'baguette', 'beer_mug', 'bread_bun', 'bread_loaf', 'bulb_potion_antidote', 'bulb_potion_clarity',
  'bulb_potion_focus', 'bulb_potion_health', 'bulb_potion_intelligence', 'bulb_potion_mana',
  'bulb_potion_stamina', 'bulb_potion_strength', 'burger', 'burrito', 'caramel_pudding', 'charm_potion_ember',
  'charm_potion_feather', 'charm_potion_herb', 'chocolate_cake', 'chocolate_chip_cookie', 'club_sandwich',
  'cocktail', 'coffee_cup', 'cream_cake_slice', 'crimson_potion', 'croissant', 'curry_bowl', 'custard_pudding',
  'dango_skewer', 'dark_elixir_decanter', 'dumpling', 'elixir_bottle_antidote', 'elixir_bottle_cyan',
  'elixir_bottle_health', 'elixir_bottle_mana', 'elixir_bottle_stamina', 'empty_bottle', 'flask_silver_empty',
  'flatbread_pizza', 'fresh_salad', 'fried_platter', 'fried_potatoes', 'frost_flask', 'fruit_cup',
  'fruit_platter', 'gilded_potion', 'glazed_ham', 'glowing_jar_flame', 'glowing_jar_frost',
  'glowing_jar_light', 'glowing_jar_nature', 'golden_potion', 'grand_flask_agility', 'grand_flask_antidote',
  'grand_flask_focus', 'grand_flask_health', 'grand_flask_intelligence', 'grand_flask_mana',
  'grand_flask_stamina', 'grand_flask_strength', 'green_soup', 'grilled_fish', 'grilled_platter',
  'grilled_skewer', 'healing_salve_jar', 'honey_jug', 'hotdog', 'ice_cream_cone', 'kebab_skewer',
  'meat_platter', 'milk_bottle', 'miso_soup_bowl', 'monster_stew', 'mushroom_dish', 'nigiri_sushi',
  'oil_flask', 'onigiri', 'ornate_gold_elixir', 'pale_potion', 'pancakes', 'pasta_dish', 'pastry_bun',
  'peach_mochi', 'pie_slice', 'poison_jar_skull', 'poison_skull_flask', 'potion_antidote_small',
  'potion_charm_small', 'potion_grenade', 'potion_health_small', 'potion_intelligence_small',
  'potion_mana_small', 'potion_stamina_small', 'rice_bowl', 'roast_chicken', 'roast_meat', 'round_cookie',
  'salad_bowl', 'sashimi_plate', 'seafood_bowl', 'seafood_pasta', 'smoke_potion', 'soup_bowl', 'spring_roll',
  'steamed_bun', 'stew_bowl', 'stew_pot', 'stir_fry', 'strawberry_cake', 'strawberry_parfait', 'sushi_platter',
  'sushi_roll', 'testtube_antidote', 'testtube_clarity', 'testtube_health', 'testtube_mana', 'tofu_dish',
  'verdant_potion', 'vial_empty', 'vial_health', 'vial_mana', 'vial_stamina', 'vial_stoppered_clarity',
  'vial_stoppered_health', 'waffle', 'white_rice_bowl', 'white_tea_cup', 'wine_bottle', 'wrap_sandwich',
] as const;
