import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { CreateSupportSuggestionDto } from './dto/create-support-suggestion.dto';
import { SupportChatDto } from './dto/support-chat.dto';
import { SupportService } from './support.service';

@Public()
@Throttle({ default: { limit: 20, ttl: 60_000 } })
@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('suggestions')
  createSuggestion(@Body() dto: CreateSupportSuggestionDto) {
    return this.supportService.createSuggestion(dto);
  }

  @Post('chat')
  chat(@Body() dto: SupportChatDto) {
    return this.supportService.chat(dto);
  }
}
