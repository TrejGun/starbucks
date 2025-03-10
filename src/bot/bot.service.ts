import { Inject, Injectable, Logger, LoggerService } from "@nestjs/common";
import { Context } from "telegraf";
import { ConfigService } from "@nestjs/config";

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
  private readonly paymentsToken: string;

  constructor(
    @Inject(Logger)
    private readonly loggerService: LoggerService,
    private readonly configService: ConfigService,
    private readonly tonService: TonService,
  ) {
    this.conversionRate = this.configService.get<number>("CONVERSION_RATE", 100);
    this.minAmount = this.configService.get<number>("MIN_AMOUNT", 100);
    this.paymentsToken = this.configService.get<string>("PAYMENTS_TOKEN", "");
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
      this.loggerService.error("Ошибка при создании платежа:", error);
      await ctx.reply("Произошла ошибка при создании платежного поручения. Попробуйте позже.");
    }
  }

  async checkStatus(ctx: Context) {
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
        paymentStatus: PaymentStatus.COMPLETED,
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
      this.loggerService.error("Ошибка при обработке платежа:", error);
      await ctx.reply("Произошла ошибка при обработке платежа. Пожалуйста, попробуйте позже.");
    }
  }

  // Вспомогательные методы для работы с сессией
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

  /**
   * Отправляет счет на оплату (используя sendInvoice)
   */
  async sendInvoice(ctx: Context, starsAmount: number): Promise<void> {
    try {
      const chatId = ctx.chat?.id;
      if (!chatId) {
        throw new Error("Chat ID not found");
      }

      // Расчет суммы в наименьших единицах валюты (копейки, центы и т.д.)
      // Предполагаем, что мы используем условные единицы для звездочек
      const amount = starsAmount * 100; // Умножаем на 100 для конвертации в наименьшие единицы

      const title = "Покупка звездочек";
      const description = `Приобретение ${starsAmount} звездочек для обмена на USDT`;
      const payload = `stars_purchase_${Date.now()}`;

      await ctx.sendInvoice({
        title,
        currency: "USDT",
        description,
        payload,
        provider_token: this.paymentsToken,
        prices: [
          {
            label: `${starsAmount} звездочек`,
            amount,
          },
        ],
      });

      this.loggerService.log(`Invoice sent to chat ${chatId} for ${starsAmount} stars`);
    } catch (error) {
      this.loggerService.error("Error sending invoice:", error);
      throw error;
    }
  }

  /**
   * Метод для обработки успешного платежа
   */
  async handleSuccessfulPayment(ctx: Context): Promise<{
    amount: number;
    transactionId: string;
    currency: string;
  }> {
    try {
      const message = ctx.message as any;
      if (!message?.successful_payment) {
        throw new Error("No successful payment data found");
      }

      const { successful_payment } = message;

      this.loggerService.log(`Successful payment received: ${JSON.stringify(successful_payment)}`);

      // Конвертируем сумму обратно из наименьших единиц (cents -> dollars)
      const amount = successful_payment.total_amount / 100;

      return Promise.resolve({
        amount: amount,
        transactionId: successful_payment.telegram_payment_charge_id,
        currency: successful_payment.currency,
      });
    } catch (error) {
      this.loggerService.error("Error handling successful payment:", error);
      throw error;
    }
  }
}
