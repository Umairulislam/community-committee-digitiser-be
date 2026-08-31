import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CommitteesModule } from './committees/committees.module';
import { MembersModule } from './members/members.module';
import { InvitationsModule } from './invitations/invitations.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    CommitteesModule,
    MembersModule,
    InvitationsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
