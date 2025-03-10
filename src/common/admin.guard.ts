import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { TelegrafExecutionContext, TelegrafException } from "nestjs-telegraf";

import { IContext } from "./context.interface";

@Injectable()
export class AdminGuard implements CanActivate {
  private readonly ADMIN_IDS = [
    7251827244, // пивоваров
  ];

  canActivate(context: ExecutionContext): boolean {
    const ctx = TelegrafExecutionContext.create(context);
    const { from } = ctx.getContext<IContext>();

    const isAdmin = from?.id && this.ADMIN_IDS.includes(from.id);
    if (!isAdmin) {
      throw new TelegrafException("You are not admin 😡");
    }

    return true;
  }
}
