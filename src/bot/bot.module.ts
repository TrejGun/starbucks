import { Module, Logger } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { BotUpdate } from "./bot.update";
import { BotService } from "./bot.service";
import { TonModule } from "../ton/ton.module";

@Module({
  imports: [ConfigModule, TonModule],
  providers: [Logger, BotUpdate, BotService],
  exports: [BotService],
})
export class BotModule {}
