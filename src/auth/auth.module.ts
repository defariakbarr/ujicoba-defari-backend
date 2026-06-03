import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt'; // FIX: Hapus JwtService dari baris import ini
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { User, UserSchema } from '../schemas/user.schema';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    JwtModule.register({
      secret: 'BELAJAR_BRO', 
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AuthController], // Controller sudah aman terdaftar
  providers: [AuthService, JwtStrategy],
  exports: [AuthService], // FIX: Wajib di-export biar AppModule utama bisa baca servicenya!
})
export class AuthModule {}