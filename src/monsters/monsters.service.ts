import { Injectable } from '@nestjs/common';
import { CreateMonsterDto } from './dto/create-monster.dto';
import { UpdateMonsterDto } from './dto/update-monster.dto';
import { prisma } from 'src/prisma/prisma';

@Injectable()
export class MonstersService {
  create(createMonsterDto: CreateMonsterDto) {
    return 'This action adds a new monster';
  }

  findAll() {
    return prisma.monster.findMany({
      include: {
        drops: {
          include: {
            item: true,
          },
        },
      },
    });
  }

  findOne(id: number) {
    return `This action returns a #${id} monster`;
  }

  update(id: number, updateMonsterDto: UpdateMonsterDto) {
    return `This action updates a #${id} monster`;
  }

  remove(id: number) {
    return `This action removes a #${id} monster`;
  }
}
