import { Logger } from "@nestjs/common";
import { Command, Ctx, On, Start, Update } from "nestjs-telegraf";
import { Context } from "telegraf";

import { BotService } from "./bot.service";

@Update()
export class BotUpdate {
  private readonly logger = new Logger(BotUpdate.name);

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

  // Обработчик событий оплаты звездочками
  // Используем On декоратор для события successful_payment
  @On("successful_payment")
  async onPaymentReceived(@Ctx() ctx: Context) {
    try {
      const update = ctx.update as any;
      if (update?.successful_payment) {
        const { stars_amount, payment_id } = update.successful_payment;

        if (stars_amount && payment_id) {
          await this.botService.handlePaymentReceived(ctx, stars_amount, payment_id);
        }
      }
    } catch (error) {
      this.logger.error("Error handling payment received event:", error);
    }
  }
}
