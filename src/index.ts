import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  const host = configService.get<string>("HOST", "localhost");
  const port = configService.get<number>("PORT", 5000);

  await app.listen(port, host, () => {
    const logger = new Logger("Bootstrap");
    logger.log(`Telegram bot is running on http://${host}:${port}`);
  });
}

void bootstrap();
