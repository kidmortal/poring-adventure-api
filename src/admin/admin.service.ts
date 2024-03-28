import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';

@Injectable()
export class AdminService {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

  async clearCache() {
    await this.cache.reset();
    return true;
  }
}
