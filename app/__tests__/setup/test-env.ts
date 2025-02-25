import { config } from 'dotenv';
import path from 'path';

type Environment = 'development' | 'production' | 'test';

export function setTestEnvironment(env: Environment): void {
  process.env.NODE_ENV = env;
  
  const envFile = env === 'production'
    ? '.env.production'
    : env === 'test'
    ? '.env.test'
    : '.env.development';

  config({ path: path.resolve(process.cwd(), envFile) });
}