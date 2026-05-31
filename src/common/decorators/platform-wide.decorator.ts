import { SetMetadata } from '@nestjs/common';

export const IS_PLATFORM_WIDE_KEY = 'isPlatformWide';
export const PlatformWide = () => SetMetadata(IS_PLATFORM_WIDE_KEY, true);
