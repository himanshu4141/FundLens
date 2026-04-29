import { Platform } from 'react-native';
import { documentDirectory, writeAsStringAsync } from 'expo-file-system/legacy';
import { buildMoneyTrailCsv, type PortfolioTransaction } from '@/src/utils/moneyTrail';

function formatExportDate(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export async function exportMoneyTrailCsv(
  transactions: PortfolioTransaction[],
  date = new Date(),
): Promise<string> {
  const csv = buildMoneyTrailCsv(transactions);
  const fileName = `fundlens-money-trail-${formatExportDate(date)}.csv`;

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
    return fileName;
  }

  if (!documentDirectory) {
    throw new Error('File storage is unavailable on this device.');
  }

  const fileUri = `${documentDirectory}${fileName}`;
  await writeAsStringAsync(fileUri, csv, { encoding: 'utf8' });
  return fileUri;
}
