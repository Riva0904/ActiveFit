import { Global, Module } from '@nestjs/common';
import { AuditService } from './services/audit.service';
import { FirebaseService } from './services/firebase.service';
import { PushService } from './services/push.service';

@Global()
@Module({
  providers: [AuditService, FirebaseService, PushService],
  exports: [AuditService, FirebaseService, PushService],
})
export class CommonModule {}
