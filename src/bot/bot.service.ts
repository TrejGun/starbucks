import { Inject, Injectable, Logger, LoggerService } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Context } from "telegraf";
import type { Message as MessageType } from "@telegraf/types";
import { SupabaseClient } from "@supabase/supabase-js";

import { TonService } from "../ton/ton.service";
import { SUPABASE_PROVIDER } from "../database/database.provider";

@Injectable()
export class BotService {
  private readonly conversionRate: number;
  private readonly minAmount: number;

  constructor(
    @Inject(Logger)
    private readonly loggerService: LoggerService,
    @Inject(SUPABASE_PROVIDER)
    private readonly supabase: SupabaseClient,
    private readonly configService: ConfigService,
    private readonly tonService: TonService,
  ) {
    this.conversionRate = this.configService.get<number>("CONVERSION_RATE", 100);
    this.minAmount = this.configService.get<number>("MIN_AMOUNT", 100);
  }

  public async startCommand(ctx: Context) {
    await ctx.reply("Добро пожаловать в бот обмена звездочек на USDT!\n\n" + "Для обмена отправьте команду /exchange");
  }

  public async helpCommand(ctx: Context) {
    const helpMessage =
      "📚 Справка по использованию бота:\n\n" +
      "• /start - Начать работу с ботом\n" +
      "• /exchange - Начать обмен звездочек на USDT\n" +
      "• /status - Проверить статус текущего обмена\n" +
      "• /help - Показать это сообщение\n\n" +
      `💱 Курс обмена: ${this.conversionRate} звездочек = 1 USDT\n` +
      `📊 Минимальная сумма обмена: ${this.minAmount} звездочек`;

    await ctx.reply(helpMessage);
  }

  public async exchangeCommand(ctx: Context) {
    const message =
      "Чтобы обменять звездочки на USDT, отправьте звездочки боту.\n\n" +
      `Курс обмена: ${this.conversionRate} звездочек = 1 USDT\n` +
      `Минимальная сумма: ${this.minAmount} звездочек`;

    await ctx.reply(message);

    // TODO allow user to select 1, 10, 100 USDT

    await this.sendInvoice(ctx, this.minAmount);
  }

  private async sendInvoice(ctx: Context, amount: number) {
    const chatId = ctx.chat?.id;
    if (!chatId) {
      throw new Error("Chat ID not found");
    }

    await ctx.sendInvoice({
      title: "Withdraw",
      description: `Send stars to receive USDT`,
      currency: "XTR",
      payload: new Date().toISOString(),
      provider_token: "",
      prices: [
        {
          label: "1 star",
          amount: 1,
        },
      ],
    });

    this.loggerService.log(`Invoice sent to chat ${chatId} for ${amount} stars`);
  }

  public async handlePreCheckoutQuery(ctx: Context) {
    // TODO check available USDT balance
    await ctx.answerPreCheckoutQuery(true);
  }

  public async handleSuccessfulPayment(ctx: Context) {
    const chatId = ctx.chat?.id;
    if (!chatId) {
      throw new Error("Chat ID not found");
    }

    const fromId = ctx.from?.id;
    if (!fromId) {
      throw new Error("User ID not found");
    }

    const { successful_payment } = ctx.message as MessageType.SuccessfulPaymentMessage;

    if (successful_payment.currency !== "XTR") {
      throw new Error("Unsupported currency");
    }

    this.loggerService.log(`Successful payment received: ${JSON.stringify(successful_payment)}`);

    await this.supabase
      .from("transactions")
      .insert({
        telegram_user_id: fromId,
        amount: 100, // TODO fixme: amount in USDT
        receipt: successful_payment.telegram_payment_charge_id,
        stars: successful_payment.total_amount,
      })
      .throwOnError();

    await this.tonService.sendUsdtToUserWallet(chatId, fromId, successful_payment.total_amount);

    await ctx.reply("Payment successful!");
  }
}
