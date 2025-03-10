import { Logger, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { TonService } from "./ton.service";

@Module({
  imports: [ConfigModule],
  providers: [Logger, TonService],
  exports: [TonService],
})
export class TonModule {}
