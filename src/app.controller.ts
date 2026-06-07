import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';
import { VectorStoreAdapter } from './rag/domain/rag.ports';

@Controller()
export class AppController {
  constructor(private readonly vectorStore: VectorStoreAdapter) {}

  @Public()
  @Get()
  health() {
    return {
      name: 'MeetPoint API',
      status: 'running',
      docs: '/docs',
    };
  }

  @Public()
  @Get('healthz')
  healthz() {
    return { status: 'ok' };
  }

  @Public()
  @Get('readyz')
  async readyz() {
    const vectorStore = await this.vectorStore.healthCheck();
    return {
      status: 'ready',
      dependencies: {
        vectorStore,
      },
    };
  }
}
