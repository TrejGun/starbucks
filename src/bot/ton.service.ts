import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";

@Injectable()
export class TonService {
  private readonly logger = new Logger(TonService.name);
  private readonly botToken: string;
  private readonly telegramApiUrl = "https://api.telegram.org";

  constructor(private readonly configService: ConfigService) {
    this.botToken = this.configService.get<string>("BOT_TOKEN", "");
  }

  async sendUsdtToUserWallet(
    userId: number,
    chatId: number,
    amount: number,
  ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    try {
      // Подготовка данных для отправки USDT через встроенный кошелек Telegram
      // Используем метод sendCryptoPayment из Bot API
      const response = await axios.post(`${this.telegramApiUrl}/bot${this.botToken}/sendCryptoPayment`, {
        chat_id: chatId,
        asset: "TON-USDT", // Токен USDT на сети TON
        amount: amount.toString(), // Сумма в строковом формате
        description: "Обмен звездочек на USDT",
        unsave_info: false, // Сохранить информацию о получателе для будущих платежей
      });

      if (response.data?.ok && response.data.result) {
        return {
          success: true,
          transactionId: response.data.result.cryptocurrency_transaction_id,
        };
      }

      return {
        success: false,
        error: "Failed to send USDT payment",
      };
    } catch (error) {
      this.logger.error("Error sending USDT to user wallet:", error);
      return {
        success: false,
        error: error.message || "Unknown error",
      };
    }
  }
}
