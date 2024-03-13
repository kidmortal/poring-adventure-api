import { Controller, Get } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';

@Controller('')
export class MainController {
  @Get('/')
  getHome() {
    const indexPath = path.join(__dirname, '..', 'public', 'index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf-8');
    return indexContent;
  }
}
