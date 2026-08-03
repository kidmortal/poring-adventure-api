import { BadRequestException } from '@nestjs/common';

import { ItemsValidator } from './items.validator';

describe('ItemsValidator.meetsRequiredLevel', () => {
  it('allows gear at exactly the required level', () => {
    expect(() =>
      ItemsValidator.meetsRequiredLevel({ requiredLevel: 21, level: 21, itemName: 'Cleric Robe' }),
    ).not.toThrow();
  });

  it('allows gear below the character level', () => {
    expect(() =>
      ItemsValidator.meetsRequiredLevel({ requiredLevel: 1, level: 40, itemName: 'Bronze Sword' }),
    ).not.toThrow();
  });

  it('rejects gear the character has not levelled into', () => {
    expect(() =>
      ItemsValidator.meetsRequiredLevel({ requiredLevel: 41, level: 12, itemName: 'Royal Greatsword' }),
    ).toThrow(new BadRequestException('Royal Greatsword requires level 41'));
  });
});
