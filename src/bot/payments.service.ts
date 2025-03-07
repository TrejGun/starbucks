import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly paymentsToken: string;
  private readonly telegramApiUrl = "https://api.telegram.org";

  constructor(private readonly configService: ConfigService) {
    this.paymentsToken = this.configService.get<string>("PAYMENTS_TOKEN", "");
  }

  async createStarsPaymentLink(params: {
    amount: number;
    description: string;
    hidden_message?: string;
    allow_anonymous?: boolean;
    allow_foreign_from_user_id?: boolean;
  }): Promise<string> {
    try {
      const response = await axios.post(
        `${this.telegramApiUrl}/bot${this.paymentsToken}/createStarsPaymentLink`,
        params,
      );

      if (response.data?.ok && response.data.result) {
        return response.data.result;
      }

      throw new Error("Failed to create payment link");
    } catch (error) {
      this.logger.error("Error creating stars payment link:", error);
      throw error;
    }
  }
}
