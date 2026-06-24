import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { RedisCacheModule } from "../redis-cache/redis-cache.module";
import { ConcertsController } from "./concerts.controller";
import { ConcertsService } from "./concerts.service";
import { OrganizerConcertsController } from "./organizer-concerts.controller";
import { OrganizerConcertsService } from "./organizer-concerts.service";
import { OrganizerTicketTypesController } from "./organizer-ticket-types.controller";
import { OrganizerTicketTypesService } from "./organizer-ticket-types.service";

@Module({
  imports: [AuthModule, RedisCacheModule],
  controllers: [
    ConcertsController,
    OrganizerConcertsController,
    OrganizerTicketTypesController,
  ],
  providers: [
    ConcertsService,
    OrganizerConcertsService,
    OrganizerTicketTypesService,
  ],
})
export class ConcertsModule {}
