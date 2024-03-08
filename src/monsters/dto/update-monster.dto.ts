import { PartialType } from '@nestjs/mapped-types';
import { CreateMonsterDto } from './create-monster.dto';

export class UpdateMonsterDto extends PartialType(CreateMonsterDto) {}
