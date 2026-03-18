// Domain types derived from the database schema + computed fields.
// These are used throughout the app — not the raw DB types.

export type TransactionType =
  | 'purchase'
  | 'redemption'
  | 'switch_in'
  | 'switch_out'
  | 'dividend_reinvest';

export type ImportSource = 'email' | 'qr' | 'pdf';
export type ImportStatus = 'pending' | 'success' | 'failed';

export interface Fund {
  id: string;
  schemeCode: number;
  schemeName: string;
  schemeCategory: string;
  benchmarkIndex: string | null;
  benchmarkIndexSymbol: string | null;
  isActive: boolean;
}

export interface Transaction {
  id: string;
  fundId: string;
  transactionDate: string;
  transactionType: TransactionType;
  units: number;
  navAtTransaction: number;
  amount: number;
  folioNumber: string | null;
}

export interface NavDataPoint {
  date: string;
  nav: number;
}

export interface IndexDataPoint {
  date: string;
  closeValue: number;
}

export type TimeWindow = '1M' | '3M' | '6M' | '1Y' | '3Y' | 'ALL';
