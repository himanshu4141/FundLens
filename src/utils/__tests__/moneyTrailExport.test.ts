import { Platform, Share } from 'react-native';
import {
  StorageAccessFramework,
  writeAsStringAsync,
} from 'expo-file-system/legacy';
import { buildPortfolioTransaction, type RawMoneyTrailTransaction } from '../moneyTrail';
import { exportMoneyTrailCsv } from '../moneyTrailExport';

let mockDocumentDirectory: string | null = 'file://documents/';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
  Share: { share: jest.fn() },
}));

jest.mock('expo-file-system/legacy', () => ({
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: jest.fn(),
    createFileAsync: jest.fn(),
  },
  get documentDirectory() {
    return mockDocumentDirectory;
  },
  writeAsStringAsync: jest.fn(),
}));

const mockPlatform = Platform as typeof Platform & { OS: string };
const mockShare = Share.share as jest.Mock;
const mockRequestDirectoryPermissions =
  StorageAccessFramework.requestDirectoryPermissionsAsync as jest.Mock;
const mockCreateFile = StorageAccessFramework.createFileAsync as jest.Mock;
const mockWriteAsString = writeAsStringAsync as jest.Mock;

function raw(overrides: Partial<RawMoneyTrailTransaction> = {}): RawMoneyTrailTransaction {
  return {
    id: overrides.id ?? 'tx-1',
    fund_id: overrides.fund_id ?? 'fund-1',
    fund_name: overrides.fund_name ?? 'DSP Large & Mid Cap Fund',
    transaction_date: overrides.transaction_date ?? '2026-04-24',
    transaction_type: overrides.transaction_type ?? 'purchase',
    units: overrides.units ?? 10,
    amount: overrides.amount ?? 1000,
    nav_at_transaction: overrides.nav_at_transaction ?? 100,
    folio_number: overrides.folio_number ?? '12345678/01',
    cas_import_id: overrides.cas_import_id ?? 'import-1',
    ...overrides,
  };
}

function transaction() {
  return buildPortfolioTransaction(raw());
}

function clearBrowserGlobals() {
  const mutableGlobal = globalThis as Record<string, unknown>;
  delete mutableGlobal.window;
  delete mutableGlobal.document;
}

describe('exportMoneyTrailCsv', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDocumentDirectory = 'file://documents/';
    mockPlatform.OS = 'web';
    clearBrowserGlobals();
    jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:money-trail');
    jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    clearBrowserGlobals();
  });

  it('downloads a CSV in web environments', async () => {
    const click = jest.fn();
    const remove = jest.fn();
    const link = {
      href: '',
      download: '',
      click,
      remove,
    };
    const appendChild = jest.fn();
    const mutableGlobal = globalThis as Record<string, unknown>;
    mutableGlobal.window = {};
    mutableGlobal.document = {
      createElement: jest.fn(() => link),
      body: { appendChild },
    };

    const result = await exportMoneyTrailCsv([transaction()], new Date('2026-04-29T00:00:00Z'));

    expect(link.href).toBe('blob:money-trail');
    expect(link.download).toBe('fundlens-money-trail-2026-04-29.csv');
    expect(appendChild).toHaveBeenCalledWith(link);
    expect(click).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:money-trail');
    expect(result).toEqual({
      fileName: 'fundlens-money-trail-2026-04-29.csv',
      message: 'Downloaded fundlens-money-trail-2026-04-29.csv to your browser downloads.',
    });
  });

  it('uses Android folder selection when permission is granted', async () => {
    mockPlatform.OS = 'android';
    mockRequestDirectoryPermissions.mockResolvedValue({
      granted: true,
      directoryUri: 'content://downloads',
    });
    mockCreateFile.mockResolvedValue('content://downloads/fundlens-money-trail.csv');

    const result = await exportMoneyTrailCsv([transaction()], new Date('2026-04-29T00:00:00Z'));

    expect(mockRequestDirectoryPermissions).toHaveBeenCalledTimes(1);
    expect(mockCreateFile).toHaveBeenCalledWith(
      'content://downloads',
      'fundlens-money-trail-2026-04-29.csv',
      'text/csv',
    );
    expect(mockWriteAsString).toHaveBeenCalledWith(
      'content://downloads/fundlens-money-trail.csv',
      expect.stringContaining('DSP Large & Mid Cap Fund'),
      { encoding: 'utf8' },
    );
    expect(mockShare).not.toHaveBeenCalled();
    expect(result).toEqual({
      fileName: 'fundlens-money-trail-2026-04-29.csv',
      uri: 'content://downloads/fundlens-money-trail.csv',
      message: 'Saved fundlens-money-trail-2026-04-29.csv to the folder you selected.',
    });
  });

  it('falls back to app storage and share sheet when Android folder selection is cancelled', async () => {
    mockPlatform.OS = 'android';
    mockRequestDirectoryPermissions.mockResolvedValue({ granted: false });
    mockShare.mockResolvedValue({ action: 'sharedAction' });

    const result = await exportMoneyTrailCsv([transaction()], new Date('2026-04-29T00:00:00Z'));

    expect(mockWriteAsString).toHaveBeenCalledWith(
      'file://documents/fundlens-money-trail-2026-04-29.csv',
      expect.stringContaining('DSP Large & Mid Cap Fund'),
      { encoding: 'utf8' },
    );
    expect(mockShare).toHaveBeenCalledWith({
      title: 'FundLens Money Trail CSV',
      message: 'FundLens Money Trail CSV exported as fundlens-money-trail-2026-04-29.csv.',
      url: 'file://documents/fundlens-money-trail-2026-04-29.csv',
    });
    expect(result.message).toBe('Opened the share sheet for fundlens-money-trail-2026-04-29.csv.');
  });

  it('uses app storage and share sheet on non-Android native platforms', async () => {
    mockPlatform.OS = 'ios';
    mockShare.mockResolvedValue({ action: 'sharedAction' });

    const result = await exportMoneyTrailCsv([transaction()], new Date('2026-04-29T00:00:00Z'));

    expect(mockRequestDirectoryPermissions).not.toHaveBeenCalled();
    expect(mockWriteAsString).toHaveBeenCalledWith(
      'file://documents/fundlens-money-trail-2026-04-29.csv',
      expect.any(String),
      { encoding: 'utf8' },
    );
    expect(result.uri).toBe('file://documents/fundlens-money-trail-2026-04-29.csv');
  });

  it('throws when native file storage is unavailable', async () => {
    mockPlatform.OS = 'ios';
    mockDocumentDirectory = null;

    await expect(exportMoneyTrailCsv([transaction()])).rejects.toThrow(
      'File storage is unavailable on this device.',
    );
  });
});
