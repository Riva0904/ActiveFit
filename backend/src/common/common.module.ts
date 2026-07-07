import { Global, Module } from '@nestjs/common';
import { AuditService } from './services/audit.service';
import { CloudinaryService } from './services/cloudinary.service';
import { FirebaseService } from './services/firebase.service';
import { PushService } from './services/push.service';

@Global()
@Module({
  providers: [AuditService, CloudinaryService, FirebaseService, PushService],
  exports: [AuditService, CloudinaryService, FirebaseService, PushService],
})
export class CommonModule {}
