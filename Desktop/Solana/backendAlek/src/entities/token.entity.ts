// src/entities/token.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity()
export class Token {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tokenAddress: string;

  @Column()
  name: string;

  @Column()
  symbol: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  marketCap: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  liquidity: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  tradingVolume: number;

  @Column()
  source: string; // Пример: 'Raydium', 'Orca', 'Jupiter', 'Pump.fun', 'Moonshot'

  @CreateDateColumn()
  createdAt: Date;
}
