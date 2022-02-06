import { IpAddress, ThrottlerCoreGuard, UserAgent } from '@common';
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UserDto } from 'src/admin/users/dto/user.dto';
import { User } from 'src/admin/users/entities/user.entity';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedDto } from './dto/authenticated.dto';
import { LoginInput } from './dto/login.input';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TokensService } from './tokens.service';

@UseGuards(ThrottlerCoreGuard)
@Controller('auth')
export class AuthController {
  constructor (
    private tokensService: TokensService,
    private authService: AuthService
  ) {}

  //@Recaptcha({ action: "register" })
  
  @Post('login')
  login(
    @Body() input: LoginInput,
    @UserAgent() agent: string,
    @IpAddress() ip: string 
  ): Promise<AuthenticatedDto> {
    return this.authService.login(input, agent, ip)
  }

  @Post('logout')
  logout(
    @Body('refresh_token') token: string
  ): Promise<void> {
    return this.tokensService.revokeRefreshToken(token)
  }

  @Post('refresh')
  refresh(
    @Body('refresh_token') token: string,
    @UserAgent() agent: string,
    @IpAddress() ip: string
  ): Promise<Omit<AuthenticatedDto, 'user'>> {
    return this.tokensService.createTokensFromRefreshToken(token, agent, ip)
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: User): UserDto {
    return new UserDto(user)
  }
}
