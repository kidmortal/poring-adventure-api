import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { MonstersService } from './monsters.service';
import { CreateMonsterDto } from './dto/create-monster.dto';
import { UpdateMonsterDto } from './dto/update-monster.dto';

@Controller('monsters')
export class MonstersController {
  constructor(private readonly monstersService: MonstersService) {}

  @Post()
  create(@Body() createMonsterDto: CreateMonsterDto) {
    return this.monstersService.create(createMonsterDto);
  }

  @Get()
  findAll() {
    return this.monstersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.monstersService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMonsterDto: UpdateMonsterDto) {
    return this.monstersService.update(+id, updateMonsterDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.monstersService.remove(+id);
  }
}
