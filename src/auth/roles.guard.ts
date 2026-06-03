import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    console.log('DATA USER DARI TOKEN:', user);

    if (!user || user.role !== 'admin') {
      throw new ForbiddenException(`Waduh! Role kamu adalah: ${user?.role || 'Kosong'}. Cuma Admin yang boleh!`);
    }

    return true;
  }
}