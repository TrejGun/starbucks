import { Module, Logger } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { supabaseProvider } from "../database/database.provider";
import { BotUpdate } from "./bot.update";
import { BotService } from "./bot.service";
import { TonModule } from "../ton/ton.module";

@Module({
  imports: [ConfigModule, TonModule],
  providers: [supabaseProvider, Logger, BotUpdate, BotService],
  exports: [BotService],
})
export class BotModule {}
