import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Делает ConfigModule доступным глобально
      envFilePath: '.env', // Указываем путь к .env файлу
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        // Проверяем, что все переменные окружения определены
        const host = configService.get<string>('DB_HOST');
        const port = configService.get<string>('DB_PORT');
        const username = configService.get<string>('DB_USERNAME');
        const password = configService.get<string>('DB_PASSWORD');
        const database = configService.get<string>('DB_DATABASE');

        if (!host || !port || !username || !password || !database) {
          throw new Error('Missing required environment variables');
        }

        return {
          type: 'postgres',
          host,
          port: parseInt(port, 10),
          username,
          password,
          database,
          entities: [],
          synchronize: true, // Используй только в разработке!
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
