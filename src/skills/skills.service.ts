import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class SkillsService {
  constructor(
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  async learn(args: { email: string; skillId: number }) {
    try {
      await this.prisma.learnedSkill.create({
        data: {
          user: { connect: { email: args.email } },
          skill: { connect: { id: args.skillId } },
        },
      });
      await this.users.notifyUserUpdateWithProfile({ email: args.email });
      return true;
    } catch (error) {
      this.users.notifyUserError({
        email: args.email,
        errorMessage: `Error learning skill, contact the owner`,
      });
      return false;
    }
  }
  async equip(args: { email: string; skillId: number }) {
    try {
      await this.prisma.learnedSkill.update({
        where: {
          userEmail_skillId: { userEmail: args.email, skillId: args.skillId },
        },
        data: { equipped: true },
      });
      await this.users.notifyUserUpdateWithProfile({ email: args.email });
      return true;
    } catch (error) {
      this.users.notifyUserError({
        email: args.email,
        errorMessage: `Error equipping skill, contact the owner`,
      });
      return false;
    }
  }
  async unequip(args: { email: string; skillId: number }) {
    try {
      await this.prisma.learnedSkill.update({
        where: {
          userEmail_skillId: { userEmail: args.email, skillId: args.skillId },
        },
        data: { equipped: false },
      });
      await this.users.notifyUserUpdateWithProfile({ email: args.email });
      return true;
    } catch (error) {
      this.users.notifyUserError({
        email: args.email,
        errorMessage: `Error unequipping skill, contact the owner`,
      });
      return false;
    }
  }
}
