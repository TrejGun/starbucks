import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { TelegrafExecutionContext, TelegrafException } from "nestjs-telegraf";
import { Scenes } from "telegraf";

@Injectable()
export class AdminGuard implements CanActivate {
  private readonly ADMIN_IDS = [
    7251827244, // пивоваров
  ];

  canActivate(context: ExecutionContext): boolean {
    const ctx = TelegrafExecutionContext.create(context);
    const { from } = ctx.getContext<Scenes.SceneContext>();

    const isAdmin = from?.id && this.ADMIN_IDS.includes(from.id);
    if (!isAdmin) {
      throw new TelegrafException("You are not admin 😡");
    }

    return true;
  }
}
