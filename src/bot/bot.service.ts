import { Injectable, Logger } from "@nestjs/common";
import { Context } from "telegraf";
import { ConfigService } from "@nestjs/config";

import { PaymentsService } from "./payments.service";
import { TonService } from "./ton.service";

interface ISessionData {
  paymentStatus: "idle" | "waiting" | "completed";
  lastPaymentId?: string;
  starsAmount?: number;
  usdtAmount?: number;
}

@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);
  private readonly conversionRate: number;
  private readonly minAmount: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly paymentsService: PaymentsService,
    private readonly tonService: TonService,
  ) {
    this.conversionRate = this.configService.get<number>("CONVERSION_RATE", 100);
    this.minAmount = this.configService.get<number>("MIN_AMOUNT", 100);
  }

  async startCommand(ctx: Context) {
    await ctx.reply("Добро пожаловать в бот обмена звездочек на USDT!\n\n" + "Для обмена отправьте команду /exchange");
  }

  async helpCommand(ctx: Context) {
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

  async initiateExchange(ctx: Context) {
    // Устанавливаем статус в сессии
    this.setSessionData(ctx, { paymentStatus: "idle" });

    const message =
      "Чтобы обменять звездочки на USDT, отправьте звездочки боту.\n\n" +
      `Курс обмена: ${this.conversionRate} звездочек = 1 USDT\n` +
      `Минимальная сумма: ${this.minAmount} звездочек`;

    try {
      // Создаем платежное поручение на звездочки
      const paymentLink = await this.paymentsService.createStarsPaymentLink({
        amount: this.minAmount,
        description: "Обмен звездочек на USDT",
        hidden_message: "Спасибо за обмен!",
        allow_anonymous: false,
        allow_foreign_from_user_id: true,
      });

      await ctx.reply(message, {
        reply_markup: {
          inline_keyboard: [[{ text: "Отправить звездочки", url: paymentLink }]],
        },
      });

      // Обновляем статус в сессии
      this.setSessionData(ctx, { paymentStatus: "waiting" });
    } catch (error) {
      this.logger.error("Ошибка при создании платежа:", error);
      await ctx.reply("Произошла ошибка при создании платежного поручения. Попробуйте позже.");
    }
  }

  async checkStatus(ctx: Context) {
    const session = this.getSessionData(ctx);

    let statusMessage = "Статус обмена: ";

    switch (session.paymentStatus) {
      case "idle":
        statusMessage += "Нет активных обменов. Используйте /exchange для начала обмена.";
        break;
      case "waiting":
        statusMessage += "Ожидание получения звездочек...";
        break;
      case "completed":
        statusMessage += `Завершен!\nОбменяно ${session.starsAmount} звездочек на ${session.usdtAmount} USDT.`;
        break;
    }

    await ctx.reply(statusMessage);
  }

  async handlePaymentReceived(ctx: Context, starsAmount: number, paymentId: string) {
    try {
      // Расчет USDT к отправке
      const usdtAmount = starsAmount / this.conversionRate;

      // Проверка минимальной суммы
      if (starsAmount < this.minAmount) {
        await ctx.reply(
          `Получено ${starsAmount} звездочек, но минимальная сумма для обмена - ${this.minAmount} звездочек.`,
        );
        return;
      }

      // Обновляем данные сессии
      this.setSessionData(ctx, {
        paymentStatus: "completed",
        starsAmount,
        usdtAmount,
        lastPaymentId: paymentId,
      });

      // Отправляем сообщение о получении платежа
      await ctx.reply(
        `✅ Получено ${starsAmount} звездочек!\n\n` +
          `💰 Отправляем вам ${usdtAmount} USDT на TON кошелек...\n` +
          `Пожалуйста, подождите.`,
      );

      // Получаем ID пользователя
      const userId = ctx.from?.id;

      if (!userId) {
        throw new Error("User ID not found");
      }

      // Получаем ID чата безопасным способом
      let chatId: number;

      if ("chat" in ctx && ctx.chat && "id" in ctx.chat) {
        chatId = ctx.chat.id;
      } else {
        chatId = userId; // Используем ID пользователя как fallback
      }

      // Отправка USDT через встроенный кошелек Telegram
      const response = await this.tonService.sendUsdtToUserWallet(userId, chatId, usdtAmount);

      if (response.success) {
        await ctx.reply(
          `✅ Транзакция успешно выполнена!\n\n` +
            `📤 Отправлено: ${usdtAmount} USDT\n` +
            `🧾 ID транзакции: ${response.transactionId}\n\n` +
            `Спасибо за использование нашего сервиса!`,
        );
      } else {
        await ctx.reply(
          "❌ Произошла ошибка при отправке USDT.\n" + "Пожалуйста, свяжитесь с администратором для решения проблемы.",
        );
      }
    } catch (error) {
      this.logger.error("Ошибка при обработке платежа:", error);
      await ctx.reply("Произошла ошибка при обработке платежа. Пожалуйста, попробуйте позже.");
    }
  }

  // Вспомогательные методы для работы с сессией
  private getSessionData(ctx: Context): ISessionData {
    return (ctx as any).session || { paymentStatus: "idle" };
  }

  private setSessionData(ctx: Context, data: Partial<ISessionData>) {
    if (!(ctx as any).session) {
      (ctx as any).session = { paymentStatus: "idle" };
    }

    (ctx as any).session = {
      ...(ctx as any).session,
      ...data,
    };
  }
}
