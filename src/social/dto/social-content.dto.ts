import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ListPublicContentQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit = 24;

  @IsString()
  @MaxLength(120)
  @IsOptional()
  search?: string;

  @IsString()
  @MaxLength(80)
  @IsOptional()
  category?: string;

  @IsString()
  @MaxLength(80)
  @IsOptional()
  city?: string;
}

export class CreatePostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body: string;

  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  @IsOptional()
  mediaUrl?: string;

  @IsString()
  @MaxLength(40)
  @IsOptional()
  mediaType?: string;

  @IsString()
  @MaxLength(80)
  @IsOptional()
  city?: string;

  @IsString()
  @MaxLength(80)
  @IsOptional()
  tag?: string;

  @IsUUID()
  @IsOptional()
  sharedFromPostId?: string;
}

export class UpdatePostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  @IsOptional()
  body?: string;

  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  @IsOptional()
  mediaUrl?: string;

  @IsString()
  @MaxLength(40)
  @IsOptional()
  mediaType?: string;

  @IsString()
  @MaxLength(80)
  @IsOptional()
  city?: string;

  @IsString()
  @MaxLength(80)
  @IsOptional()
  tag?: string;
}

export class CreatePostCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body: string;
}

export class UpdatePostCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body: string;
}

export class ListPostCommentsQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit = 100;
}

export class CreatePostReactionDto {
  @IsString()
  @MaxLength(30)
  @IsOptional()
  type?: string;
}

export class SocialTargetDto {
  @IsUUID()
  targetUserId: string;
}

export class FriendRequestResponseDto {
  @IsBoolean()
  accepted: boolean;
}

export class CreateCommunityDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name: string;

  @IsString()
  @MaxLength(80)
  @IsOptional()
  topic?: string;

  @IsString()
  @MaxLength(2000)
  @IsOptional()
  description?: string;

  @IsString()
  @MaxLength(80)
  @IsOptional()
  city?: string;

  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  @IsOptional()
  imageUrl?: string;

  @IsIn(['public', 'invite', 'password'])
  @IsOptional()
  accessMode?: 'public' | 'invite' | 'password';

  @IsString()
  @MinLength(4)
  @MaxLength(80)
  @IsOptional()
  password?: string;

  @IsString()
  @MinLength(4)
  @MaxLength(80)
  @IsOptional()
  inviteCode?: string;
}

export class UpdateCommunityDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  @IsOptional()
  name?: string;

  @IsString()
  @MaxLength(80)
  @IsOptional()
  topic?: string;

  @IsString()
  @MaxLength(2000)
  @IsOptional()
  description?: string;

  @IsString()
  @MaxLength(80)
  @IsOptional()
  city?: string;

  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  @IsOptional()
  imageUrl?: string;

  @IsIn(['public', 'invite', 'password'])
  @IsOptional()
  accessMode?: 'public' | 'invite' | 'password';

  @IsString()
  @MinLength(4)
  @MaxLength(80)
  @IsOptional()
  password?: string;

  @IsString()
  @MinLength(4)
  @MaxLength(80)
  @IsOptional()
  inviteCode?: string;
}

export class JoinCommunityDto {
  @IsString()
  @MinLength(4)
  @MaxLength(80)
  @IsOptional()
  password?: string;

  @IsString()
  @MinLength(4)
  @MaxLength(80)
  @IsOptional()
  inviteCode?: string;
}

export class ListCommunityMessagesQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit = 100;
}

export class CreateCommunityMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body: string;
}

export class UpdateCommunityMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body: string;
}

export class CreateOpportunityDto {
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  title: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  company: string;

  @IsString()
  @MaxLength(80)
  @IsOptional()
  category?: string;

  @IsString()
  @MaxLength(80)
  @IsOptional()
  city?: string;

  @IsString()
  @MaxLength(80)
  @IsOptional()
  salaryLabel?: string;

  @IsString()
  @MaxLength(3000)
  @IsOptional()
  description?: string;

  @IsEmail()
  @MaxLength(160)
  @IsOptional()
  contactEmail?: string;

  @IsString()
  @MaxLength(40)
  @IsOptional()
  contactPhone?: string;
}

export class UpdateOpportunityDto {
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  @IsOptional()
  title?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @IsOptional()
  company?: string;

  @IsString()
  @MaxLength(80)
  @IsOptional()
  category?: string;

  @IsString()
  @MaxLength(80)
  @IsOptional()
  city?: string;

  @IsString()
  @MaxLength(80)
  @IsOptional()
  salaryLabel?: string;

  @IsString()
  @MaxLength(3000)
  @IsOptional()
  description?: string;

  @IsEmail()
  @MaxLength(160)
  @IsOptional()
  contactEmail?: string;

  @IsString()
  @MaxLength(40)
  @IsOptional()
  contactPhone?: string;
}

export class ApplyOpportunityDto {
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  message?: string;

  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  @IsOptional()
  resumeUrl?: string;
}

export class CreateBenefitDto {
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  title: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  partner: string;

  @IsString()
  @MaxLength(80)
  @IsOptional()
  category?: string;

  @IsString()
  @MaxLength(80)
  @IsOptional()
  city?: string;

  @IsString()
  @MaxLength(3000)
  @IsOptional()
  description?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  pointsCost?: number;
}

export class UpdateBenefitDto {
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  @IsOptional()
  title?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @IsOptional()
  partner?: string;

  @IsString()
  @MaxLength(80)
  @IsOptional()
  category?: string;

  @IsString()
  @MaxLength(80)
  @IsOptional()
  city?: string;

  @IsString()
  @MaxLength(3000)
  @IsOptional()
  description?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  pointsCost?: number;
}

export class CreateEventDto {
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  title: string;

  @IsString()
  @MaxLength(120)
  @IsOptional()
  organizer?: string;

  @IsString()
  @MaxLength(40)
  @IsOptional()
  mode?: string;

  @IsString()
  @MaxLength(160)
  @IsOptional()
  location?: string;

  @IsDateString()
  @IsOptional()
  startsAt?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  priceCents?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @IsString()
  @MaxLength(3000)
  @IsOptional()
  description?: string;
}

export class UpdateEventDto {
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  @IsOptional()
  title?: string;

  @IsString()
  @MaxLength(120)
  @IsOptional()
  organizer?: string;

  @IsString()
  @MaxLength(40)
  @IsOptional()
  mode?: string;

  @IsString()
  @MaxLength(160)
  @IsOptional()
  location?: string;

  @IsDateString()
  @IsOptional()
  startsAt?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  priceCents?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @IsString()
  @MaxLength(3000)
  @IsOptional()
  description?: string;
}
