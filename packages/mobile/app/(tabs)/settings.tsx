/**
 * Settings tab (US-015).
 *
 * Surfaces the live pair (host + masked token), app + gateway versions, and
 * lets the user change host, rotate token, or disconnect. Rotating token
 * re-tests the connection before persisting; disconnect wipes secure store
 * and bounces the user back to /pair.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { useHarness } from '../../src/hooks/useHarness';
import api from '../../src/services/api';
import {
  clearPair,
  loadPair,
  normaliseHost,
  savePair,
  testConnection,
} from '../../src/services/pair-storage';

const GITHUB_URL = 'https://github.com/deonmenezes/opentradex';

interface SettingRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  danger?: boolean;
  testID?: string;
}

function SettingRow({ icon, iconColor = '#00D9FF', title, subtitle, onPress, danger, testID }: SettingRowProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
      testID={testID}
    >
      <View style={[styles.rowIcon, { backgroundColor: `${iconColor}1A` }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, danger && styles.rowTitleDanger]}>{title}</Text>
        {subtitle && (
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#4B5563" />
    </Pressable>
  );
}

function maskToken(token: string | null): string {
  if (!token) return '—';
  if (token.length <= 8) return '••••';
  return `${token.slice(0, 4)}••••${token.slice(-4)}`;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { status } = useHarness();
  const [host, setHost] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [gatewayVersion, setGatewayVersion] = useState<string | null>(null);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [rotateValue, setRotateValue] = useState('');
  const [rotateBusy, setRotateBusy] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);

  const appVersion = useMemo(
    () =>
      (Constants.expoConfig?.version as string | undefined) ??
      (Constants.manifest2 as { extra?: { version?: string } } | undefined)?.extra?.version ??
      '0.1.0',
    [],
  );

  const reloadPair = useCallback(async () => {
    const pair = await loadPair();
    setHost(pair?.host ?? null);
    setToken(pair?.token ?? null);
  }, []);

  useEffect(() => {
    reloadPair();
  }, [reloadPair]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await api.getStatus();
        if (!cancelled) setGatewayVersion(s.version || null);
      } catch {
        if (!cancelled) setGatewayVersion(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status.connection]);

  const handleChangeHost = useCallback(() => {
    router.push('/pair');
  }, [router]);

  const handleOpenRotate = useCallback(() => {
    setRotateValue('');
    setRotateError(null);
    setRotateOpen(true);
  }, []);

  const handleRotateConfirm = useCallback(async () => {
    if (!host) {
      setRotateError('No host saved. Use Change host first.');
      return;
    }
    const candidate = rotateValue.trim();
    if (!candidate) {
      setRotateError('Token cannot be empty.');
      return;
    }
    setRotateBusy(true);
    setRotateError(null);
    try {
      const result = await testConnection(host, candidate);
      if (!result.ok) {
        setRotateError(result.error);
        return;
      }
      await savePair({ host, token: candidate });
      api.configure({ host, token: candidate });
      setToken(candidate);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setRotateOpen(false);
    } catch (e) {
      setRotateError(e instanceof Error ? e.message : 'Rotation failed');
    } finally {
      setRotateBusy(false);
    }
  }, [host, rotateValue]);

  const handleDisconnect = useCallback(() => {
    Alert.alert(
      'Disconnect',
      'Clear saved host and token and return to the pair screen?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await clearPair();
            api.setToken(null);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            router.replace('/pair');
          },
        },
      ],
    );
  }, [router]);

  const handleOpenGithub = useCallback(async () => {
    const can = await Linking.canOpenURL(GITHUB_URL).catch(() => false);
    if (can) {
      Linking.openURL(GITHUB_URL).catch(() => {});
    } else {
      Alert.alert('Cannot open link', GITHUB_URL);
    }
  }, []);

  const hostDisplay = host ? normaliseHost(host) : 'not configured';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    status.connection === 'connected' ? '#10B981' : '#EF4444',
                },
              ]}
            />
            <Text style={styles.statusLabel}>Gateway</Text>
          </View>
          <Text style={styles.statusValue} testID="settings-connection-label">
            {status.connection === 'connected'
              ? 'Connected'
              : status.connection === 'reconnecting'
                ? 'Reconnecting…'
                : 'Disconnected'}
          </Text>
          <Text style={styles.statusMode}>Mode: {status.mode}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connection</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Host</Text>
            <Text style={styles.infoValue} testID="settings-host" numberOfLines={1}>
              {hostDisplay}
            </Text>
            <Text style={[styles.infoLabel, styles.infoLabelSpaced]}>Token</Text>
            <Text style={styles.infoValueMono} testID="settings-token-masked">
              {maskToken(token)}
            </Text>
          </View>

          <SettingRow
            icon="swap-horizontal"
            title="Change host"
            subtitle="Pair the app with a different gateway"
            onPress={handleChangeHost}
            testID="settings-change-host"
          />
          <SettingRow
            icon="key"
            iconColor="#F59E0B"
            title="Rotate token"
            subtitle="Replace the current auth token"
            onPress={handleOpenRotate}
            testID="settings-rotate-token"
          />
          <SettingRow
            icon="log-out"
            iconColor="#EF4444"
            title="Disconnect"
            subtitle="Clear saved credentials and sign out"
            onPress={handleDisconnect}
            danger
            testID="settings-disconnect"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>App version</Text>
            <Text style={styles.infoValue}>{appVersion}</Text>
            <Text style={[styles.infoLabel, styles.infoLabelSpaced]}>Gateway version</Text>
            <Text style={styles.infoValue} testID="settings-gateway-version">
              {gatewayVersion ?? (status.connection === 'connected' ? 'unknown' : 'offline')}
            </Text>
            {status.badge && (
              <>
                <Text style={[styles.infoLabel, styles.infoLabelSpaced]}>Gateway badge</Text>
                <Text style={styles.infoValue}>{status.badge}</Text>
              </>
            )}
          </View>

          <SettingRow
            icon="logo-github"
            iconColor="#F8FAFC"
            title="GitHub"
            subtitle={GITHUB_URL.replace(/^https?:\/\//, '')}
            onPress={handleOpenGithub}
            testID="settings-github"
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>OpenTradex Mobile v{appVersion}</Text>
          <Text style={styles.footerSubtext}>Your trading harness, in your pocket.</Text>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      <Modal
        transparent
        animationType="slide"
        visible={rotateOpen}
        onRequestClose={() => !rotateBusy && setRotateOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => !rotateBusy && setRotateOpen(false)}
        />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Rotate auth token</Text>
          <Text style={styles.modalSubtitle}>
            Paste the new token the gateway printed during `opentradex onboard --rotate`. The
            connection is re-tested before saving.
          </Text>

          <TextInput
            style={styles.modalInput}
            value={rotateValue}
            onChangeText={setRotateValue}
            placeholder="paste new bearer token"
            placeholderTextColor="#5A6473"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            editable={!rotateBusy}
            testID="rotate-token-input"
          />

          {rotateError && (
            <Text style={styles.modalError} testID="rotate-token-error">
              {rotateError}
            </Text>
          )}

          <View style={styles.modalActions}>
            <Pressable
              style={[styles.modalBtn, styles.modalBtnCancel]}
              onPress={() => setRotateOpen(false)}
              disabled={rotateBusy}
              testID="rotate-token-cancel"
            >
              <Text style={styles.modalBtnCancelLabel}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.modalBtn,
                styles.modalBtnConfirm,
                (rotateBusy || !rotateValue.trim()) && styles.modalBtnDisabled,
              ]}
              onPress={handleRotateConfirm}
              disabled={rotateBusy || !rotateValue.trim()}
              testID="rotate-token-confirm"
            >
              {rotateBusy ? (
                <ActivityIndicator color="#0B0F14" />
              ) : (
                <Text style={styles.modalBtnConfirmLabel}>Test & Save</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F14' },
  content: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '700' },
  statusCard: {
    marginHorizontal: 16,
    padding: 16,
    backgroundColor: '#12171E',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E2530',
    marginBottom: 24,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusLabel: { color: '#6B7280', fontSize: 13, fontWeight: '500' },
  statusValue: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  statusMode: { color: '#00D9FF', fontSize: 13, marginTop: 4, textTransform: 'lowercase' },
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionTitle: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#12171E',
    borderWidth: 1,
    borderColor: '#1E2530',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  infoLabel: { color: '#6B7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoLabelSpaced: { marginTop: 10 },
  infoValue: { color: '#F8FAFC', fontSize: 14, fontWeight: '600', marginTop: 4 },
  infoValueMono: { color: '#F8FAFC', fontSize: 13, fontFamily: 'monospace', marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#12171E',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1E2530',
  },
  rowPressed: { backgroundColor: '#1A2029' },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowText: { flex: 1 },
  rowTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '600' },
  rowTitleDanger: { color: '#EF4444' },
  rowSubtitle: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  footer: { alignItems: 'center', paddingVertical: 24 },
  footerText: { color: '#6B7280', fontSize: 13, fontWeight: '500' },
  footerSubtext: { color: '#4B5563', fontSize: 12, marginTop: 4 },
  bottomPadding: { height: 20 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#12171E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#374151',
    marginBottom: 18,
  },
  modalTitle: { color: '#F8FAFC', fontSize: 20, fontWeight: '700' },
  modalSubtitle: { color: '#9CA3AF', fontSize: 13, marginTop: 6, lineHeight: 18, marginBottom: 16 },
  modalInput: {
    backgroundColor: '#0B0F14',
    color: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#1E2530',
  },
  modalError: { color: '#EF4444', fontSize: 13, marginTop: 10 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 18 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  modalBtnCancel: { backgroundColor: '#1E2530' },
  modalBtnConfirm: { backgroundColor: '#00D9FF' },
  modalBtnDisabled: { opacity: 0.5 },
  modalBtnCancelLabel: { color: '#F8FAFC', fontSize: 15, fontWeight: '600' },
  modalBtnConfirmLabel: { color: '#0B0F14', fontSize: 15, fontWeight: '700' },
});
