/**
 * Modal bottom sheet for a single market quote.
 *
 * On open, fires /api/quote + /api/orderbook in parallel. Shows loading, error,
 * and data states (never a blank sheet). Tapping Buy sends a paper buy command
 * through /api/command so the user can commit a paper trade from the sheet.
 */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api, { Asset, OrderbookResponse, QuoteResponse } from '../services/api';

interface Props {
  asset: Asset | null;
  onClose: () => void;
  onBuy: (asset: Asset) => Promise<string>;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; quote: QuoteResponse; orderbook: OrderbookResponse | null }
  | { kind: 'error'; message: string };

export default function MarketQuoteSheet({ asset, onClose, onBuy }: Props) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [buyBusy, setBuyBusy] = useState(false);
  const [buyResult, setBuyResult] = useState<string | null>(null);

  useEffect(() => {
    if (!asset) return;
    let cancelled = false;
    setState({ kind: 'loading' });
    setBuyResult(null);

    (async () => {
      try {
        const [quote, orderbook] = await Promise.all([
          api.getQuote(asset.exchange, asset.symbol),
          api.getOrderbook(asset.exchange, asset.symbol).catch(() => null),
        ]);
        if (!cancelled) setState({ kind: 'ready', quote, orderbook });
      } catch (e) {
        if (!cancelled) {
          setState({
            kind: 'error',
            message: e instanceof Error ? e.message : 'Failed to fetch quote',
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [asset]);

  const handleBuy = async () => {
    if (!asset) return;
    setBuyBusy(true);
    setBuyResult(null);
    try {
      const response = await onBuy(asset);
      setBuyResult(response || 'Buy command sent.');
    } catch (e) {
      setBuyResult(`Error: ${e instanceof Error ? e.message : 'Buy failed'}`);
    } finally {
      setBuyBusy(false);
    }
  };

  return (
    <Modal
      transparent
      animationType="slide"
      visible={asset !== null}
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View>
            <Text style={styles.symbol}>{asset?.symbol ?? '—'}</Text>
            <Text style={styles.exchange}>
              {asset?.exchange.toUpperCase()}
            </Text>
          </View>
          <Pressable hitSlop={8} onPress={onClose} testID="quote-close-btn">
            <Ionicons name="close" size={22} color="#9CA3AF" />
          </Pressable>
        </View>

        {state.kind === 'loading' && (
          <View style={styles.stateBox}>
            <ActivityIndicator color="#00D9FF" />
            <Text style={styles.stateText}>Fetching quote…</Text>
          </View>
        )}

        {state.kind === 'error' && (
          <View style={[styles.stateBox, styles.stateError]}>
            <Ionicons name="warning" size={20} color="#EF4444" />
            <Text style={styles.stateText}>{state.message}</Text>
          </View>
        )}

        {state.kind === 'ready' && (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.priceCard}>
              <Text style={styles.priceLabel}>Mid</Text>
              <Text style={styles.priceValue}>
                ${state.quote.market.price.toFixed(4)}
              </Text>
              {typeof state.quote.market.volume === 'number' && (
                <Text style={styles.meta}>
                  Volume {state.quote.market.volume.toLocaleString()}
                </Text>
              )}
              <Text style={styles.meta} numberOfLines={2}>
                {state.quote.market.title}
              </Text>
            </View>

            {state.orderbook ? (
              <View style={styles.orderbookCard}>
                <View style={styles.orderbookHeader}>
                  <Text style={styles.orderbookTitle}>Order book</Text>
                  <Text style={styles.orderbookSpread}>
                    spread ${state.orderbook.spread.toFixed(4)}
                  </Text>
                </View>
                <View style={styles.orderbookColumns}>
                  <View style={styles.orderbookCol}>
                    <Text style={styles.colLabel}>Bids</Text>
                    {state.orderbook.bids.slice(0, 5).map((b, i) => (
                      <View key={`b${i}`} style={styles.obRow}>
                        <Text style={[styles.obPrice, styles.positive]}>
                          ${b.price.toFixed(4)}
                        </Text>
                        <Text style={styles.obSize}>{b.size}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.orderbookCol}>
                    <Text style={styles.colLabel}>Asks</Text>
                    {state.orderbook.asks.slice(0, 5).map((a, i) => (
                      <View key={`a${i}`} style={styles.obRow}>
                        <Text style={[styles.obPrice, styles.negative]}>
                          ${a.price.toFixed(4)}
                        </Text>
                        <Text style={styles.obSize}>{a.size}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.noBookBox}>
                <Text style={styles.noBookText}>
                  No order book for this connector.
                </Text>
              </View>
            )}

            {buyResult && (
              <View style={styles.resultBox}>
                <Text style={styles.resultText}>{buyResult}</Text>
              </View>
            )}
          </ScrollView>
        )}

        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, styles.btnCancel]}
            onPress={onClose}
            testID="quote-cancel-btn"
          >
            <Text style={styles.btnCancelLabel}>Close</Text>
          </Pressable>
          <Pressable
            style={[
              styles.btn,
              styles.btnBuy,
              (state.kind !== 'ready' || buyBusy) && styles.btnDisabled,
            ]}
            onPress={handleBuy}
            disabled={state.kind !== 'ready' || buyBusy}
            testID="quote-buy-btn"
          >
            {buyBusy ? (
              <ActivityIndicator color="#F8FAFC" />
            ) : (
              <Text style={styles.btnBuyLabel}>Buy (paper)</Text>
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
    maxHeight: '85%',
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
    marginBottom: 16,
  },
  symbol: { color: '#F8FAFC', fontSize: 22, fontWeight: '700' },
  exchange: { color: '#6B7280', fontSize: 12, letterSpacing: 0.5, marginTop: 2 },
  stateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 20,
    justifyContent: 'center',
  },
  stateError: { backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 12 },
  stateText: { color: '#9CA3AF', fontSize: 14 },
  priceCard: {
    backgroundColor: '#0B0F14',
    borderWidth: 1,
    borderColor: '#1E2530',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  priceLabel: { color: '#6B7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  priceValue: { color: '#F8FAFC', fontSize: 26, fontWeight: '700', marginTop: 4 },
  meta: { color: '#9CA3AF', fontSize: 12, marginTop: 6 },
  orderbookCard: {
    backgroundColor: '#0B0F14',
    borderWidth: 1,
    borderColor: '#1E2530',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  orderbookHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  orderbookTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: '600' },
  orderbookSpread: { color: '#6B7280', fontSize: 11 },
  orderbookColumns: { flexDirection: 'row', gap: 14 },
  orderbookCol: { flex: 1 },
  colLabel: { color: '#6B7280', fontSize: 11, textTransform: 'uppercase', marginBottom: 6 },
  obRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  obPrice: { fontSize: 13, fontWeight: '600' },
  obSize: { color: '#9CA3AF', fontSize: 12 },
  positive: { color: '#10B981' },
  negative: { color: '#EF4444' },
  noBookBox: {
    padding: 12,
    backgroundColor: 'rgba(107,114,128,0.08)',
    borderRadius: 10,
    marginBottom: 12,
  },
  noBookText: { color: '#9CA3AF', fontSize: 12, textAlign: 'center' },
  resultBox: {
    backgroundColor: '#0B0F14',
    borderWidth: 1,
    borderColor: '#1E2530',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  resultText: { color: '#CBD5E1', fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 6 },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancel: { backgroundColor: '#1E2530' },
  btnBuy: { backgroundColor: '#00D9FF' },
  btnDisabled: { opacity: 0.5 },
  btnCancelLabel: { color: '#F8FAFC', fontSize: 15, fontWeight: '600' },
  btnBuyLabel: { color: '#0B0F14', fontSize: 15, fontWeight: '700' },
});
