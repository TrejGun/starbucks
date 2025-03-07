import { Module } from "@nestjs/common";

import { BotUpdate } from "./bot.update";
import { BotService } from "./bot.service";
import { PaymentsService } from "./payments.service";
import { TonService } from "./ton.service";

@Module({
  providers: [BotUpdate, BotService, PaymentsService, TonService],
})
export class BotModule {}
