import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
  ) {}

  // --- FUNGSI REGISTER ---
  async register(username: string, password: string) {
    if (password.length < 8) {
      throw new BadRequestException('Password minimal 8 karakter!');
    }

    const userExist = await this.userModel.findOne({ username });
    if (userExist) {
      throw new BadRequestException('Username sudah dipakai, cari yang lain!');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new this.userModel({
      username,
      password: hashedPassword,
      role: 'user', 
    });

    return newUser.save();
  }

  // --- FUNGSI LOGIN ---
  async login(username: string, pass: string) {
    const user = await this.userModel.findOne({ username });
    if (!user) {
      throw new UnauthorizedException('Username salah atau belum daftar!');
    }

    const isMatch = await bcrypt.compare(pass, user.password!);
    if (!isMatch) {
      throw new UnauthorizedException('Password kamu salah, cek lagi!');
    }

    // --- BAGIAN PENTING: Masukkan role ke Payload ---
    const payload = { 
      sub: user._id, 
      username: user.username,
      role: user.role // Sekarang token membawa informasi jabatan/role
    };

    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }
}