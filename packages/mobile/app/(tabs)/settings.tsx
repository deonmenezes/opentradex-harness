import { View, Text, StyleSheet, ScrollView, Pressable, Switch, TextInput, Alert } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useHarness } from '../../src/hooks/useHarness';
import api from '../../src/services/api';

interface SettingItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  danger?: boolean;
}

function SettingItem({ icon, iconColor = '#00D9FF', title, subtitle, onPress, rightElement, danger }: SettingItemProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.settingItem, pressed && styles.settingItemPressed]}
      onPress={onPress}
      disabled={!onPress && !rightElement}
    >
      <View style={[styles.settingIcon, { backgroundColor: `${iconColor}15` }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, danger && styles.dangerText]}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {rightElement || (onPress && (
        <Ionicons name="chevron-forward" size={20} color="#4B5563" />
      ))}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { status } = useHarness();
  const [apiUrl, setApiUrl] = useState('http://localhost:3210/api');
  const [notifications, setNotifications] = useState(true);
  const [haptics, setHaptics] = useState(true);
  const [darkMode, setDarkMode] = useState(true);

  const handleApiUrlChange = () => {
    api.setBaseUrl(apiUrl);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('API URL Updated', `Now connecting to: ${apiUrl}`);
  };

  const handlePanic = () => {
    Alert.alert(
      'Emergency Stop',
      'This will immediately close all positions and halt trading. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'PANIC STOP',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.panic();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              Alert.alert('Panic Stop Executed', 'All positions closed, trading halted.');
            } catch {
              Alert.alert('Error', 'Failed to execute panic stop');
            }
          },
        },
      ]
    );
  };

  const toggleSwitch = (setter: (v: boolean) => void, value: boolean) => {
    if (haptics) Haptics.selectionAsync();
    setter(!value);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>

        {/* Connection Status */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: status.connection === 'connected' ? '#10B981' : '#EF4444' }]} />
            <Text style={styles.statusLabel}>Harness Status</Text>
          </View>
          <Text style={styles.statusValue}>
            {status.connection === 'connected' ? 'Connected' : 'Disconnected'}
          </Text>
          <Text style={styles.statusMode}>Mode: {status.mode}</Text>
        </View>

        {/* API Configuration */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connection</Text>
          <View style={styles.apiInputContainer}>
            <TextInput
              style={styles.apiInput}
              value={apiUrl}
              onChangeText={setApiUrl}
              placeholder="API URL"
              placeholderTextColor="#6B7280"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable style={styles.apiButton} onPress={handleApiUrlChange}>
              <Text style={styles.apiButtonText}>Apply</Text>
            </Pressable>
          </View>
        </View>

        {/* Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <SettingItem
            icon="notifications"
            title="Push Notifications"
            subtitle="Trade alerts and market updates"
            rightElement={
              <Switch
                value={notifications}
                onValueChange={() => toggleSwitch(setNotifications, notifications)}
                trackColor={{ false: '#1E2530', true: '#00D9FF40' }}
                thumbColor={notifications ? '#00D9FF' : '#6B7280'}
              />
            }
          />
          <SettingItem
            icon="phone-portrait"
            title="Haptic Feedback"
            subtitle="Vibrate on interactions"
            rightElement={
              <Switch
                value={haptics}
                onValueChange={() => toggleSwitch(setHaptics, haptics)}
                trackColor={{ false: '#1E2530', true: '#00D9FF40' }}
                thumbColor={haptics ? '#00D9FF' : '#6B7280'}
              />
            }
          />
          <SettingItem
            icon="moon"
            title="Dark Mode"
            subtitle="Always use dark theme"
            rightElement={
              <Switch
                value={darkMode}
                onValueChange={() => toggleSwitch(setDarkMode, darkMode)}
                trackColor={{ false: '#1E2530', true: '#00D9FF40' }}
                thumbColor={darkMode ? '#00D9FF' : '#6B7280'}
              />
            }
          />
        </View>

        {/* Trading */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trading</Text>
          <SettingItem
            icon="shield-checkmark"
            iconColor="#10B981"
            title="Risk Settings"
            subtitle="Position limits and stop-loss rules"
            onPress={() => Alert.alert('Risk Settings', 'Max Position: $1,000\nMax Daily Loss: $500\nMax Drawdown: 10%\n\nEdit these in the harness config file.', [{ text: 'OK' }])}
          />
          <SettingItem
            icon="wallet"
            iconColor="#F59E0B"
            title="Connected Accounts"
            subtitle="Manage broker connections"
            onPress={() => Alert.alert('Connected Accounts', 'Paper Trading: Active\nAlpaca: Not configured\nInteractive Brokers: Not configured\n\nConfigure brokers in the gateway settings.', [{ text: 'OK' }])}
          />
          <SettingItem
            icon="analytics"
            iconColor="#8B5CF6"
            title="Trading History"
            subtitle="View past trades and performance"
            onPress={() => Alert.alert('Trading History', 'No trades recorded yet.\n\nTrades will appear here once you start paper or live trading.', [{ text: 'OK' }])}
          />
        </View>

        {/* AI Harness */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI Harness</Text>
          <SettingItem
            icon="cube"
            title="Agent Configuration"
            subtitle="Customize AI trading behavior"
            onPress={() => Alert.alert('Agent Configuration', `Mode: ${status.mode}\nAuto-Loop: ${status.isAutoLoop ? 'Enabled' : 'Disabled'}\nScan Interval: 60s\n\nUse the Command tab to configure the agent.`, [{ text: 'OK' }])}
          />
          <SettingItem
            icon="terminal"
            title="Debug Console"
            subtitle="View harness logs"
            onPress={() => Alert.alert('Debug Console', 'Connect to the harness gateway to view real-time logs.\n\nLogs are available at:\nhttp://localhost:3210/api/events', [{ text: 'OK' }])}
          />
          <SettingItem
            icon="sync"
            title="Auto-Loop Settings"
            subtitle={`Cycles: ${status.cycles} | ${status.isAutoLoop ? 'Active' : 'Paused'}`}
            onPress={() => Alert.alert('Auto-Loop', `Status: ${status.isAutoLoop ? 'Running' : 'Stopped'}\nCycles Completed: ${status.cycles}\n\nToggle auto-loop from the Command tab.`, [
              { text: 'Cancel', style: 'cancel' },
              { text: status.isAutoLoop ? 'Stop Loop' : 'Start Loop', onPress: async () => {
                await api.sendCommand(status.isAutoLoop ? 'stop autoloop' : 'start autoloop');
              }}
            ])}
          />
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, styles.dangerTitle]}>Danger Zone</Text>
          <SettingItem
            icon="warning"
            iconColor="#EF4444"
            title="Emergency Stop"
            subtitle="Close all positions immediately"
            onPress={handlePanic}
            danger
          />
        </View>

        {/* App Info */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>OpenTradex Mobile v0.1.0</Text>
          <Text style={styles.footerSubtext}>AI-Powered Trading Harness</Text>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F14',
  },
  content: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  statusCard: {
    marginHorizontal: 16,
    padding: 16,
    backgroundColor: '#12171E',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E2530',
    marginBottom: 24,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusLabel: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '500',
  },
  statusValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  statusMode: {
    color: '#00D9FF',
    fontSize: 13,
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  dangerTitle: {
    color: '#EF4444',
  },
  apiInputContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  apiInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#12171E',
    borderRadius: 12,
    paddingHorizontal: 14,
    color: '#FFFFFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#1E2530',
  },
  apiButton: {
    height: 44,
    paddingHorizontal: 20,
    backgroundColor: '#00D9FF',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  apiButtonText: {
    color: '#0B0F14',
    fontSize: 14,
    fontWeight: '600',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#12171E',
    borderRadius: 12,
    marginBottom: 8,
  },
  settingItemPressed: {
    backgroundColor: '#1A2029',
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  settingSubtitle: {
    color: '#6B7280',
    fontSize: 13,
    marginTop: 2,
  },
  dangerText: {
    color: '#EF4444',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  footerText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '500',
  },
  footerSubtext: {
    color: '#4B5563',
    fontSize: 12,
    marginTop: 4,
  },
  bottomPadding: {
    height: 20,
  },
});
