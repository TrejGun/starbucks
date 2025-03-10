import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { session } from "telegraf";
import { TelegrafModule } from "nestjs-telegraf";

import { BotModule } from "./bot/bot.module";
import { BOT_NAME } from "./common/constants";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `.env.${process.env.NODE_ENV!}`,
    }),
    TelegrafModule.forRootAsync({
      botName: BOT_NAME,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        token: configService.get<string>("BOT_TOKEN", ""),
        middlewares: [session()],
        include: [BotModule],
      }),
    }),
    BotModule,
  ],
})
export class AppModule {}
