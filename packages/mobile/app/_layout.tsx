import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { loadPair } from '../src/services/pair-storage';
import { api } from '../src/services/api';

/**
 * Root layout with a pair-gate: if no pair is saved, redirect to /pair before
 * the tab stack mounts. This is how "first launch shows pair screen" is wired.
 */
export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    (async () => {
      const pair = await loadPair();
      if (pair) {
        api.configure({ host: pair.host, token: pair.token });
        // If the user started on /pair with a stored config (e.g. returning),
        // bounce them to the tabs — otherwise stay put.
        if (segments[0] === 'pair') router.replace('/(tabs)');
      } else if (segments[0] !== 'pair') {
        router.replace('/pair');
      }
      setChecked(true);
    })();
  }, [router, segments]);

  if (!checked) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0B0F14', alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar style="light" />
        <ActivityIndicator color="#3B82F6" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0B0F14' }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0B0F14' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="pair" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="asset/[symbol]"
          options={{
            presentation: 'card',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
    </View>
  );
}
