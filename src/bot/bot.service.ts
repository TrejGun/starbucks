import { Inject, Injectable, Logger, LoggerService } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Context } from "telegraf";
import type { Message as MessageType } from "@telegraf/types";

import { TonService } from "../ton/ton.service";

enum PaymentStatus {
  IDLE = "IDLE",
  WAITING = "WAITING",
  COMPLETED = "COMPLETED",
}

interface ISessionData {
  paymentStatus: PaymentStatus;
  lastPaymentId?: string;
  starsAmount?: number;
  usdtAmount?: number;
}

@Injectable()
export class BotService {
  private readonly conversionRate: number;
  private readonly minAmount: number;

  constructor(
    @Inject(Logger)
    private readonly loggerService: LoggerService,
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

  public async initiateExchange(ctx: Context) {
    // Устанавливаем статус в сессии
    this.setSessionData(ctx, { paymentStatus: PaymentStatus.IDLE });

    const message =
      "Чтобы обменять звездочки на USDT, отправьте звездочки боту.\n\n" +
      `Курс обмена: ${this.conversionRate} звездочек = 1 USDT\n` +
      `Минимальная сумма: ${this.minAmount} звездочек`;

    await ctx.reply(message);

    try {
      // Создаем платежное поручение на звездочки
      await this.sendInvoice(ctx, this.minAmount);

      // Обновляем статус в сессии
      this.setSessionData(ctx, { paymentStatus: PaymentStatus.WAITING });
    } catch (error) {
      this.loggerService.error(error);
      await ctx.reply("Произошла ошибка при создании платежного поручения. Попробуйте позже.");
    }
  }

  public async checkStatus(ctx: Context) {
    const session = this.getSessionData(ctx);

    let statusMessage = "Статус обмена: ";

    switch (session.paymentStatus) {
      case PaymentStatus.IDLE:
        statusMessage += "Нет активных обменов. Используйте /exchange для начала обмена.";
        break;
      case PaymentStatus.WAITING:
        statusMessage += "Ожидание получения звездочек...";
        break;
      case PaymentStatus.COMPLETED:
        statusMessage += `Завершен!\nОбменяно ${session.starsAmount} звездочек на ${session.usdtAmount} USDT.`;
        break;
    }

    await ctx.reply(statusMessage);
  }

  private getSessionData(ctx: Context): ISessionData {
    return (ctx as any).session || { paymentStatus: PaymentStatus.IDLE };
  }

  private setSessionData(ctx: Context, data: Partial<ISessionData>) {
    if (!(ctx as any).session) {
      (ctx as any).session = { paymentStatus: PaymentStatus.IDLE };
    }

    (ctx as any).session = {
      ...(ctx as any).session,
      ...data,
    };
  }

  private async sendInvoice(ctx: Context, amount: number): Promise<void> {
    const chatId = ctx.chat?.id;
    if (!chatId) {
      throw new Error("Chat ID not found");
    }

    await ctx.sendInvoice({
      title: "Покупка звездочек",
      description: `Приобретение ${amount} звездочек для обмена на USDT`,
      currency: "XTR",
      payload: `stars_purchase_${Date.now()}`,
      provider_token: "",
      prices: [
        {
          label: `${amount} звездочек`,
          amount: amount,
        },
      ],
    });

    this.loggerService.log(`Invoice sent to chat ${chatId} for ${amount} stars`);
  }

  public async handlePreCheckoutQuery(ctx: Context) {
    // TODO check USDT balance
    await ctx.answerPreCheckoutQuery(true);
  }

  public async handleSuccessfulPayment(ctx: Context): Promise<void> {
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

    // TODO save from, receipt, date and amount to DB

    await this.tonService.sendUsdtToUserWallet(chatId, fromId, successful_payment.total_amount);

    await ctx.reply("Payment successful!");
  }
}
