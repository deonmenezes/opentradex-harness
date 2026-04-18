/**
 * Command tab (US-014).
 *
 * Chat-style interface that posts user commands to /api/command and renders
 * the gateway's reply with a streaming-style typing effect. History (last 50
 * messages) is persisted to expo-secure-store so the conversation survives
 * app restarts. Long-press any bubble to copy it to the clipboard.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';
import { useHarness } from '../../src/hooks/useHarness';
import StatusBadge from '../../src/components/StatusBadge';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  /** Characters revealed so far when the typing effect is running. */
  revealed?: number;
}

const HISTORY_KEY = 'opentradex:command-history:v1';
const MAX_HISTORY = 50;
const TYPE_INTERVAL_MS = 14;

const WELCOME: Message = {
  id: 'welcome',
  role: 'system',
  content: 'Harness ready. Send a command, or tap a quick action below.',
  timestamp: 0,
};

const QUICK_COMMANDS: Array<{ label: string; command: string }> = [
  { label: 'Scan markets', command: 'scan markets' },
  { label: 'Risk status', command: 'risk status' },
  { label: 'Close all longs', command: 'close all longs' },
  { label: 'Status', command: 'status' },
];

async function loadHistory(): Promise<Message[]> {
  try {
    const raw = await SecureStore.getItemAsync(HISTORY_KEY);
    if (!raw) return [WELCOME];
    const parsed = JSON.parse(raw) as Message[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [WELCOME];
    return parsed;
  } catch {
    return [WELCOME];
  }
}

async function saveHistory(messages: Message[]): Promise<void> {
  try {
    const trimmed = messages.slice(-MAX_HISTORY).map((m) => ({ ...m, revealed: undefined }));
    await SecureStore.setItemAsync(HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    /* non-fatal: secure-store can reject very large payloads on some devices */
  }
}

export default function CommandScreen() {
  const { status, sendCommand } = useHarness();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [isLoading, setIsLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadHistory().then((loaded) => {
      setMessages(loaded);
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveHistory(messages);
  }, [messages, hydrated]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const typeOut = useCallback((id: string, full: string) => {
    let chars = 0;
    const total = full.length;
    const timer = setInterval(() => {
      chars += Math.max(1, Math.floor(total / 120));
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, revealed: Math.min(total, chars) } : m)),
      );
      if (chars >= total) clearInterval(timer);
    }, TYPE_INTERVAL_MS);
  }, []);

  const submitCommand = useCallback(
    async (raw: string) => {
      const command = raw.trim();
      if (!command || isLoading) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

      const userMsg: Message = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: command,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setIsLoading(true);

      try {
        const response = await sendCommand(command);
        const assistantId = `a-${Date.now()}`;
        const body = response || 'Command accepted.';
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: 'assistant',
            content: body,
            timestamp: Date.now(),
            revealed: 0,
          },
        ]);
        typeOut(assistantId, body);
      } catch (e) {
        const errorMsg: Message = {
          id: `e-${Date.now()}`,
          role: 'assistant',
          content: `Error: ${e instanceof Error ? e.message : 'Failed to send command'}`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, sendCommand, typeOut],
  );

  const handleSend = () => submitCommand(input);

  const handleQuick = (command: string) => {
    Haptics.selectionAsync().catch(() => {});
    submitCommand(command);
  };

  const handleLongPress = async (m: Message) => {
    try {
      await Clipboard.setStringAsync(m.content);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setCopiedId(m.id);
      setTimeout(() => setCopiedId((prev) => (prev === m.id ? null : prev)), 1500);
    } catch {
      /* clipboard unavailable — silent */
    }
  };

  const handleClear = async () => {
    setMessages([WELCOME]);
    try {
      await SecureStore.deleteItemAsync(HISTORY_KEY);
    } catch {
      /* ignore */
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.title}>Command</Text>
              <Text style={styles.subtitle}>AI harness control</Text>
            </View>
            <View style={styles.headerRight}>
              <StatusBadge status={status.connection} mode={status.mode} />
              <Pressable
                hitSlop={8}
                style={styles.clearBtn}
                onPress={handleClear}
                testID="command-clear-btn"
              >
                <Ionicons name="trash-outline" size={16} color="#9CA3AF" />
              </Pressable>
            </View>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.quickScroll}
          contentContainerStyle={styles.quickContent}
        >
          {QUICK_COMMANDS.map((cmd) => (
            <Pressable
              key={cmd.label}
              style={styles.quickButton}
              onPress={() => handleQuick(cmd.command)}
              disabled={isLoading}
              testID={`quick-${cmd.command.replace(/\s+/g, '-')}`}
            >
              <Text style={styles.quickLabel}>{cmd.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg) => {
            const visible =
              msg.role === 'assistant' && typeof msg.revealed === 'number'
                ? msg.content.slice(0, msg.revealed)
                : msg.content;
            const typing =
              msg.role === 'assistant' &&
              typeof msg.revealed === 'number' &&
              msg.revealed < msg.content.length;
            return (
              <View
                key={msg.id}
                style={[
                  styles.messageContainer,
                  msg.role === 'user' && styles.userMessageContainer,
                ]}
              >
                {msg.role !== 'user' && (
                  <View style={styles.avatar}>
                    <Ionicons
                      name={msg.role === 'system' ? 'information-circle' : 'cube'}
                      size={16}
                      color="#00D9FF"
                    />
                  </View>
                )}
                <Pressable
                  onLongPress={() => handleLongPress(msg)}
                  delayLongPress={350}
                  style={[
                    styles.messageBubble,
                    msg.role === 'user' && styles.userBubble,
                    msg.role === 'system' && styles.systemBubble,
                  ]}
                  testID={`message-${msg.role}-${msg.id}`}
                >
                  <Text
                    style={[
                      styles.messageText,
                      msg.role === 'user' && styles.userMessageText,
                      msg.role === 'system' && styles.systemMessageText,
                    ]}
                  >
                    {visible}
                    {typing && <Text style={styles.caret}>▍</Text>}
                  </Text>
                  {copiedId === msg.id && (
                    <Text style={styles.copiedLabel}>Copied</Text>
                  )}
                </Pressable>
              </View>
            );
          })}

          {isLoading && (
            <View style={styles.messageContainer}>
              <View style={styles.avatar}>
                <Ionicons name="cube" size={16} color="#00D9FF" />
              </View>
              <View style={styles.messageBubble}>
                <View style={styles.loadingDots}>
                  <View style={[styles.dot, styles.dot1]} />
                  <View style={[styles.dot, styles.dot2]} />
                  <View style={[styles.dot, styles.dot3]} />
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Enter command…"
            placeholderTextColor="#6B7280"
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            editable={!isLoading}
            multiline
            maxLength={1000}
            testID="command-input"
          />
          <Pressable
            style={[styles.sendButton, (!input.trim() || isLoading) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || isLoading}
            testID="command-send-btn"
          >
            <Ionicons
              name="send"
              size={20}
              color={input.trim() && !isLoading ? '#0B0F14' : '#6B7280'}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F14' },
  keyboardView: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2530',
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  clearBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#12171E',
    borderWidth: 1,
    borderColor: '#1E2530',
  },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' },
  subtitle: { color: '#6B7280', fontSize: 13, marginTop: 2 },
  quickScroll: { maxHeight: 52, borderBottomWidth: 1, borderBottomColor: '#1E2530' },
  quickContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  quickButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#12171E',
    borderWidth: 1,
    borderColor: '#1E2530',
    marginRight: 8,
  },
  quickLabel: { color: '#00D9FF', fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  messages: { flex: 1 },
  messagesContent: { padding: 16, gap: 2 },
  messageContainer: { flexDirection: 'row', marginBottom: 10 },
  userMessageContainer: { justifyContent: 'flex-end' },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#12171E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: '82%',
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#12171E',
  },
  userBubble: { backgroundColor: '#00D9FF', borderBottomRightRadius: 4 },
  systemBubble: { backgroundColor: '#1E253080', borderWidth: 1, borderColor: '#1E2530' },
  messageText: { color: '#FFFFFF', fontSize: 14, lineHeight: 20 },
  userMessageText: { color: '#0B0F14' },
  systemMessageText: { color: '#9CA3AF', fontStyle: 'italic' },
  caret: { color: '#00D9FF' },
  copiedLabel: {
    color: '#10B981',
    fontSize: 11,
    marginTop: 6,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  loadingDots: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00D9FF' },
  dot1: { opacity: 0.4 },
  dot2: { opacity: 0.6 },
  dot3: { opacity: 0.8 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E2530',
    backgroundColor: '#0B0F14',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: '#12171E',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    color: '#FFFFFF',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#1E2530',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#00D9FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: { backgroundColor: '#1E2530' },
});
