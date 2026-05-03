import { Platform, Share } from 'react-native';
import {
  StorageAccessFramework,
  documentDirectory,
  writeAsStringAsync,
} from 'expo-file-system/legacy';
import { buildMoneyTrailCsv, type PortfolioTransaction } from '@/src/utils/moneyTrail';

export interface MoneyTrailCsvExportResult {
  fileName: string;
  message: string;
  uri?: string;
}

function formatExportDate(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

async function writeToAppStorage(fileName: string, csv: string): Promise<string> {
  if (!documentDirectory) {
    throw new Error('File storage is unavailable on this device.');
  }

  const fileUri = `${documentDirectory}${fileName}`;
  await writeAsStringAsync(fileUri, csv, { encoding: 'utf8' });
  return fileUri;
}

export async function exportMoneyTrailCsv(
  transactions: PortfolioTransaction[],
  date = new Date(),
): Promise<MoneyTrailCsvExportResult> {
  const csv = buildMoneyTrailCsv(transactions);
  const fileName = `foliolens-money-trail-${formatExportDate(date)}.csv`;

  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return {
      fileName,
      message: `Downloaded ${fileName} to your browser downloads.`,
    };
  }

  if (Platform.OS === 'android') {
    const permission = await StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (permission.granted) {
      const fileUri = await StorageAccessFramework.createFileAsync(
        permission.directoryUri,
        fileName,
        'text/csv',
      );
      await writeAsStringAsync(fileUri, csv, { encoding: 'utf8' });
      return {
        fileName,
        uri: fileUri,
        message: `Saved ${fileName} to the folder you selected.`,
      };
    }
  }

  const fileUri = await writeToAppStorage(fileName, csv);
  await Share.share({
    title: 'FolioLens Money Trail CSV',
    message: `FolioLens Money Trail CSV exported as ${fileName}.`,
    url: fileUri,
  });

  return {
    fileName,
    uri: fileUri,
    message: `Opened the share sheet for ${fileName}.`,
  };
}
