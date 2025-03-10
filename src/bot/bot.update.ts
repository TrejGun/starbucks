import { Command, Ctx, On, Start, Update } from "nestjs-telegraf";
import { Context } from "telegraf";

import { BotService } from "./bot.service";

@Update()
export class BotUpdate {
  constructor(private readonly botService: BotService) {}

  @Start()
  public start(@Ctx() ctx: Context) {
    return this.botService.startCommand(ctx);
  }

  @Command("help")
  public help(@Ctx() ctx: Context) {
    return this.botService.helpCommand(ctx);
  }

  @Command("exchange")
  public exchange(@Ctx() ctx: Context) {
    return this.botService.exchangeCommand(ctx);
  }

  @On("pre_checkout_query")
  public onPreCheckoutQuery(@Ctx() ctx: Context) {
    return this.botService.handlePreCheckoutQuery(ctx);
  }

  @On("successful_payment")
  public onPaymentReceived(@Ctx() ctx: Context) {
    return this.botService.handleSuccessfulPayment(ctx);
  }
}
