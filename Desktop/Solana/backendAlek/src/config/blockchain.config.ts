// src/config/blockchain.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('blockchain', () => ({
  solanaRpcUrl:
    process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  raydiumApi: process.env.RAYDIUM_API || 'https://api.raydium.io/v2',
  orcaApi: process.env.ORCA_API || 'https://api.orca.so',
  jupiterApi: process.env.JUPITER_API || 'https://quote-api.jup.ag/v6',
  pumpFunApi: process.env.PUMPFUN_API || 'https://api.pump.fun',
  moonshotApi: process.env.MOONSHOT_API || 'https://api.moonshot.exchange',
}));
