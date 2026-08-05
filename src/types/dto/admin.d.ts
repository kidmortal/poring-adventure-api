/**
 * One event carries every battle debug action, so `action` is the verb and the
 * rest is what that verb happens to need. See `BattleDebugAction` in
 * `feature/battle/battle.ts` for the list.
 */
declare type BattleDebugActionDto = {
  action: import('src/feature/battle/battle').BattleDebugAction;
  /** Whose fight. Empty means the admin's own. */
  email?: string;
  /** The buff or debuff to apply, by name. Only read by the actions that take one. */
  name?: string;
  /** Health or mana moved, where the action moves an amount. */
  amount?: number;
};
