import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

// Compare was deprecated in favour of the Tools / Compare Funds screen.
// Route kept to avoid breaking external deep links — redirect to portfolio.
export default function CompareDeprecated() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/(tabs)');
  }, [router]);
  return <View />;
}
