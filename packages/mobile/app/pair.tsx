/**
 * First-run pair screen (US-010).
 *
 * User arrives here on a fresh install (no saved host+token in pair-storage).
 * They can either:
 *   - Type host + token manually (must paste the token that the desktop
 *     `opentradex onboard` printed),
 *   - Tap "Scan QR" → Expo Camera decodes the v1 envelope from the desktop's
 *     pair QR and fills both fields automatically,
 *   - Tap "Test connection" to hit GET /api/health with a bearer token,
 *   - Tap "Save and continue" to persist via pair-storage and navigate to tabs.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  loadPair,
  normaliseHost,
  parsePairEnvelope,
  savePair,
  testConnection,
} from '../src/services/pair-storage';
import { api } from '../src/services/api';

type Status =
  | { kind: 'idle' }
  | { kind: 'testing' }
  | { kind: 'ok' }
  | { kind: 'error'; message: string };

export default function PairScreen() {
  const router = useRouter();
  const [host, setHost] = useState('');
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  // If a pair is already saved, skip this screen entirely.
  useEffect(() => {
    (async () => {
      const existing = await loadPair();
      if (existing) {
        api.configure({ host: existing.host, token: existing.token });
        router.replace('/(tabs)');
      }
    })();
  }, [router]);

  const onTest = useCallback(async () => {
    const normalised = normaliseHost(host);
    if (!normalised || !token) {
      setStatus({ kind: 'error', message: 'Host and token are both required' });
      return;
    }
    setStatus({ kind: 'testing' });
    const result = await testConnection(normalised, token);
    if (result.ok) {
      setStatus({ kind: 'ok' });
    } else {
      setStatus({ kind: 'error', message: result.error });
    }
  }, [host, token]);

  const onSave = useCallback(async () => {
    const normalised = normaliseHost(host);
    if (!normalised || !token) {
      Alert.alert('Missing details', 'Host and token are both required.');
      return;
    }
    const result = await testConnection(normalised, token);
    if (!result.ok) {
      Alert.alert('Connection failed', result.error);
      return;
    }
    await savePair({ host: normalised, token });
    api.configure({ host: normalised, token });
    router.replace('/(tabs)');
  }, [host, token, router]);

  const onScan = useCallback(async () => {
    if (!permission?.granted) {
      const p = await requestPermission();
      if (!p.granted) {
        Alert.alert('Camera needed', 'Grant camera permission to scan QR codes.');
        return;
      }
    }
    setScanning(true);
  }, [permission, requestPermission]);

  const onBarCode = useCallback(({ data }: { data: string }) => {
    setScanning(false);
    try {
      const cfg = parsePairEnvelope(data);
      setHost(cfg.host);
      setToken(cfg.token);
      setStatus({ kind: 'idle' });
    } catch (e) {
      Alert.alert('Invalid QR', e instanceof Error ? e.message : 'Unknown error');
    }
  }, []);

  if (scanning) {
    return (
      <View style={styles.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={onBarCode}
        />
        <View style={styles.cameraOverlay}>
          <Text style={styles.cameraHint}>Point camera at the QR from `opentradex onboard`</Text>
          <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => setScanning(false)} testID="cancel-scan">
            <Text style={styles.btnGhostLabel}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Connect your harness</Text>
        <Text style={styles.subtitle}>
          Run `opentradex onboard` on your computer. Scan the QR it prints, or paste the host + token below.
        </Text>

        <Text style={styles.label}>Host</Text>
        <TextInput
          testID="host-input"
          style={styles.input}
          placeholder="http://192.168.1.5:3210"
          placeholderTextColor="#5A6473"
          value={host}
          onChangeText={setHost}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />

        <Text style={styles.label}>Auth token</Text>
        <TextInput
          testID="token-input"
          style={styles.input}
          placeholder="paste the token printed during onboard"
          placeholderTextColor="#5A6473"
          value={token}
          onChangeText={setToken}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />

        <View style={styles.statusRow}>
          {status.kind === 'testing' && (
            <>
              <ActivityIndicator color="#3B82F6" />
              <Text style={styles.statusTesting}>Testing connection…</Text>
            </>
          )}
          {status.kind === 'ok' && <Text style={styles.statusOk}>✓ Gateway reachable</Text>}
          {status.kind === 'error' && (
            <Text style={styles.statusError}>✕ {status.message}</Text>
          )}
        </View>

        <Pressable style={styles.btn} onPress={onScan} testID="scan-btn">
          <Text style={styles.btnLabel}>Scan QR</Text>
        </Pressable>

        <Pressable style={[styles.btn, styles.btnSecondary]} onPress={onTest} testID="test-btn">
          <Text style={styles.btnLabel}>Test connection</Text>
        </Pressable>

        <Pressable
          style={[styles.btn, styles.btnPrimary, (!host || !token) && styles.btnDisabled]}
          disabled={!host || !token}
          onPress={onSave}
          testID="save-btn"
        >
          <Text style={styles.btnLabel}>Save and continue</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B0F14' },
  scroll: { padding: 24, paddingTop: 72, flexGrow: 1 },
  title: { color: '#F1F5F9', fontSize: 26, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#94A3B8', fontSize: 14, marginBottom: 24, lineHeight: 20 },
  label: { color: '#CBD5E1', fontSize: 13, marginBottom: 6, marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: '#111827',
    color: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, minHeight: 24, gap: 8 },
  statusOk: { color: '#22C55E', fontSize: 14, fontWeight: '600' },
  statusError: { color: '#EF4444', fontSize: 14 },
  statusTesting: { color: '#3B82F6', fontSize: 14 },
  btn: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginTop: 14,
  },
  btnSecondary: { backgroundColor: '#334155' },
  btnPrimary: { backgroundColor: '#3B82F6' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#475569' },
  btnDisabled: { opacity: 0.4 },
  btnLabel: { color: '#F8FAFC', fontSize: 15, fontWeight: '600' },
  btnGhostLabel: { color: '#F8FAFC', fontSize: 15, fontWeight: '600' },
  cameraWrap: { flex: 1, backgroundColor: '#000' },
  cameraOverlay: {
    position: 'absolute',
    bottom: 48,
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  cameraHint: {
    color: '#F8FAFC',
    fontSize: 14,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
});
