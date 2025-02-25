import { Client, QueryResult, QueryResultRow } from 'pg';

export function getClient(): Promise<Client>;
export function query<T extends QueryResultRow = any>(query: string, values?: any[]): Promise<QueryResult<T>>;
export function checkConnection(): Promise<boolean>;
export function getTableNames(): Promise<{ table_name: string }[]>;
export function executeTransaction<T extends QueryResultRow = any>(queries: string[]): Promise<QueryResult<T>[]>;

export const dbConfig: {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};