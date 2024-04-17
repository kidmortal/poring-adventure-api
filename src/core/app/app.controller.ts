import { Controller, Get } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

@Controller('')
export class MainController {
  @Get('/')
  getHome() {
    const indexPath = path.join(__dirname, '..', '..', '..', 'public', 'index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf-8');
    return indexContent;
  }
  @Get('/br/privacy')
  getPrivacity() {
    const indexPath = path.join(__dirname, '..', '..', '..', 'public', 'br', 'privacy.html');
    const indexContent = fs.readFileSync(indexPath, 'utf-8');
    return indexContent;
  }

  @Get('/br/terms')
  getTerms() {
    const indexPath = path.join(__dirname, '..', '..', '..', 'public', 'br', 'terms.html');
    const indexContent = fs.readFileSync(indexPath, 'utf-8');
    return indexContent;
  }

  @Get('/version')
  getApiVersion() {
    const branchData = execSync('git rev-parse HEAD').toString();
    const revision = branchData.trim();
    return {
      api_version_hash: revision,
    };
  }
}
