// backend/src/config/app.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('captcha', () => ({
  secretKey: process.env.RECAPTCHA_SECRET_KEY,
}));
