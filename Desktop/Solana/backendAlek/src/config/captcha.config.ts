import { registerAs } from '@nestjs/config';

export default registerAs('captcha', () => ({
  secretKey: process.env.RECAPTCHA_SECRET_KEY || '',
  minScore: parseFloat(process.env.RECAPTCHA_MIN_SCORE ?? '0.5') || 0.5,
}));
