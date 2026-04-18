/**
 * Type-to-confirm sheet for the PANIC button.
 *
 * User must type the literal word "PANIC" before the confirm button arms. Once
 * fired, onConfirm is awaited and the sheet closes. The Portfolio tab is
 * responsible for disabling the PANIC trigger for 10s to prevent double-tap.
 */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  positionCount: number;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

const CONFIRM_WORD = 'PANIC';

export default function PanicConfirmSheet({ visible, positionCount, onClose, onConfirm }: Props) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) {
      setTyped('');
      setBusy(false);
    }
  }, [visible]);

  const armed = typed.trim().toUpperCase() === CONFIRM_WORD;

  const handleConfirm = async () => {
    if (!armed || busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      onClose();
    }
  };

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={busy ? undefined : onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.iconWrap}>
          <Ionicons name="warning" size={28} color="#EF4444" />
        </View>
        <Text style={styles.title}>Flatten everything?</Text>
        <Text style={styles.subtitle}>
          This will fire POST /api/panic and close all {positionCount} open position
          {positionCount === 1 ? '' : 's'} immediately at market.
        </Text>

        <Text style={styles.prompt}>Type {CONFIRM_WORD} to confirm</Text>
        <TextInput
          style={[styles.input, armed && styles.inputArmed]}
          value={typed}
          onChangeText={setTyped}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder={CONFIRM_WORD}
          placeholderTextColor="#475569"
          testID="panic-confirm-input"
        />

        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, styles.btnCancel]}
            onPress={onClose}
            disabled={busy}
            testID="panic-cancel-btn"
          >
            <Text style={styles.btnCancelLabel}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, styles.btnConfirm, (!armed || busy) && styles.btnDisabled]}
            onPress={handleConfirm}
            disabled={!armed || busy}
            testID="panic-fire-btn"
          >
            {busy ? (
              <ActivityIndicator color="#F8FAFC" />
            ) : (
              <Text style={styles.btnConfirmLabel}>Fire PANIC</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#12171E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 32,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#374151',
    marginBottom: 18,
  },
  iconWrap: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(239,68,68,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: { color: '#F8FAFC', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  subtitle: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 20,
  },
  prompt: { color: '#CBD5E1', fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 },
  input: {
    backgroundColor: '#0B0F14',
    color: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#1E2530',
    letterSpacing: 2,
  },
  inputArmed: { borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,0.06)' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 18 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnCancel: { backgroundColor: '#1E2530' },
  btnConfirm: { backgroundColor: '#EF4444' },
  btnDisabled: { opacity: 0.5 },
  btnCancelLabel: { color: '#F8FAFC', fontSize: 15, fontWeight: '600' },
  btnConfirmLabel: { color: '#F8FAFC', fontSize: 15, fontWeight: '700' },
});
