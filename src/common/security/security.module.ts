import { Global, Module } from '@nestjs/common';
import { DataMaskingService } from './data-masking.service';
import { FieldEncryptionService } from './field-encryption.service';

@Global()
@Module({
  providers: [DataMaskingService, FieldEncryptionService],
  exports: [DataMaskingService, FieldEncryptionService],
})
export class SecurityModule {}
