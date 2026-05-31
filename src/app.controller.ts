import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  @Public()
  @Get()
  health() {
    return {
      name: 'Core Academy API',
      status: 'running',
      docs: '/docs',
    };
  }
}
