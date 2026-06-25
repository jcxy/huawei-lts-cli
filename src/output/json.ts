import { QueryResult } from '../types';

export function formatJson(data: QueryResult): string {
  return JSON.stringify(data, null, 2);
}
