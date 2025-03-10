import { Command, Ctx, On, Start, Update } from "nestjs-telegraf";
import { Context } from "telegraf";

import { BotService } from "./bot.service";

@Update()
export class BotUpdate {
  constructor(private readonly botService: BotService) {}

  @Start()
  async start(@Ctx() ctx: Context) {
    return this.botService.startCommand(ctx);
  }

  @Command("help")
  async help(@Ctx() ctx: Context) {
    return this.botService.helpCommand(ctx);
  }

  @Command("exchange")
  async exchange(@Ctx() ctx: Context) {
    return this.botService.initiateExchange(ctx);
  }

  @Command("status")
  async status(@Ctx() ctx: Context) {
    return this.botService.checkStatus(ctx);
  }

  @On("pre_checkout_query")
  async onPreCheckoutQuery(@Ctx() ctx: Context) {
    return this.botService.handlePreCheckoutQuery(ctx);
  }

  @On("successful_payment")
  async onPaymentReceived(@Ctx() ctx: Context) {
    return this.botService.handleSuccessfulPayment(ctx);
  }
}
