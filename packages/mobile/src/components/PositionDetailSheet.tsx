/**
 * Modal bottom sheet for a single open position.
 *
 * Shows live price, P&L, and exposes two actions:
 *   - Close  → fires `close {exchange} {symbol}` via /api/command
 *   - Cancel → dismisses the sheet (no gateway call)
 *
 * Home tab renders it in response to a position-row tap. Close button disables
 * itself while the command is in flight so it can't be fired twice.
 */

import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Position } from '../services/api';

interface Props {
  position: Position | null;
  onClose: () => void;
  onConfirmClose: (position: Position) => Promise<string>;
}

export default function PositionDetailSheet({ position, onClose, onConfirmClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  if (!position) return null;

  const marketValue = position.size * position.currentPrice;
  const pnlPositive = position.pnl >= 0;

  const handleClose = async () => {
    setBusy(true);
    setResult(null);
    try {
      const response = await onConfirmClose(position);
      setResult(response || 'Close command sent.');
    } catch (e) {
      setResult(`Error: ${e instanceof Error ? e.message : 'Close failed'}`);
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = () => {
    setResult(null);
    onClose();
  };

  return (
    <Modal
      transparent
      animationType="slide"
      visible={position !== null}
      onRequestClose={handleCancel}
    >
      <Pressable style={styles.backdrop} onPress={handleCancel} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View>
            <Text style={styles.symbol}>{position.symbol}</Text>
            <Text style={styles.exchange}>
              {position.exchange.toUpperCase()} · {position.side.toUpperCase()}
            </Text>
          </View>
          <Pressable hitSlop={8} onPress={handleCancel} testID="sheet-close-btn">
            <Ionicons name="close" size={22} color="#9CA3AF" />
          </Pressable>
        </View>

        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Size</Text>
            <Text style={styles.statValue}>{position.size.toLocaleString()}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Avg Price</Text>
            <Text style={styles.statValue}>${position.avgPrice.toFixed(4)}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Mark</Text>
            <Text style={styles.statValue}>${position.currentPrice.toFixed(4)}</Text>
          </View>
        </View>

        <View style={styles.pnlCard}>
          <Text style={styles.pnlLabel}>Unrealized P&amp;L</Text>
          <Text style={[styles.pnlValue, pnlPositive ? styles.positive : styles.negative]}>
            {pnlPositive ? '+' : ''}${position.pnl.toFixed(2)} ({position.pnlPercent.toFixed(2)}%)
          </Text>
          <Text style={styles.marketValue}>
            Market value ${marketValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </View>

        {result && (
          <View style={styles.resultBox}>
            <Text style={styles.resultText}>{result}</Text>
          </View>
        )}

        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, styles.btnCancel]}
            onPress={handleCancel}
            disabled={busy}
            testID="cancel-btn"
          >
            <Text style={styles.btnCancelLabel}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, styles.btnClose, busy && styles.btnDisabled]}
            onPress={handleClose}
            disabled={busy}
            testID="close-position-btn"
          >
            {busy ? (
              <ActivityIndicator color="#F8FAFC" />
            ) : (
              <Text style={styles.btnCloseLabel}>Close position</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#12171E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderColor: '#1E2530',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#374151',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  symbol: { color: '#F8FAFC', fontSize: 22, fontWeight: '700' },
  exchange: { color: '#6B7280', fontSize: 12, letterSpacing: 0.5, marginTop: 2 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  stat: { flex: 1 },
  statLabel: { color: '#6B7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  statValue: { color: '#F8FAFC', fontSize: 15, fontWeight: '600' },
  pnlCard: {
    backgroundColor: '#0B0F14',
    borderWidth: 1,
    borderColor: '#1E2530',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  pnlLabel: { color: '#6B7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  pnlValue: { fontSize: 22, fontWeight: '700', marginTop: 4 },
  positive: { color: '#10B981' },
  negative: { color: '#EF4444' },
  marketValue: { color: '#9CA3AF', fontSize: 13, marginTop: 6 },
  resultBox: {
    backgroundColor: '#0B0F14',
    borderWidth: 1,
    borderColor: '#1E2530',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  resultText: { color: '#CBD5E1', fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 12 },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancel: { backgroundColor: '#1E2530' },
  btnClose: { backgroundColor: '#EF4444' },
  btnDisabled: { opacity: 0.6 },
  btnCancelLabel: { color: '#F8FAFC', fontSize: 15, fontWeight: '600' },
  btnCloseLabel: { color: '#F8FAFC', fontSize: 15, fontWeight: '700' },
});
