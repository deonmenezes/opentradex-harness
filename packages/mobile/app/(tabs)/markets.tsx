/**
 * Markets tab (US-012).
 *
 * Shows connector filter chips derived from `/api/` exchanges + an "All" chip,
 * a debounced search field that calls `/api/search?q=…`, and a scrollable list
 * of markets hydrated from `/api/scan?exchange=…`. Loading, empty, and error
 * states all render a visible UI (never a blank screen).
 */

import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api, { Asset } from '../../src/services/api';
import { useHarness } from '../../src/hooks/useHarness';
import MarketQuoteSheet from '../../src/components/MarketQuoteSheet';

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; markets: Asset[] }
  | { kind: 'error'; message: string };

const SEARCH_DEBOUNCE_MS = 300;

// Connector chips rendered in addition to whatever /api/ reports. The `id` is
// what gets passed to `/api/scan?exchange=` / `/api/search?exchange=`, so these
// must match connector names the gateway knows.
const EXTRA_CONNECTORS = [
  'kalshi',
  'polymarket',
  'tradingview',
  'crypto',
  'alpaca',
];

export default function MarketsScreen() {
  const { status, sendCommand } = useHarness();
  const [selected, setSelected] = useState<string>('all'); // 'all' | connector
  const [query, setQuery] = useState('');
  const [state, setState] = useState<LoadState>({ kind: 'idle' });
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Union of connectors reported by the gateway and the known-defaults.
  const connectors = useMemo(() => {
    const set = new Set<string>(status.exchanges ?? []);
    for (const c of EXTRA_CONNECTORS) set.add(c);
    return ['all', ...Array.from(set).sort()];
  }, [status.exchanges]);

  const loadMarkets = useCallback(
    async (exchange: string, searchQuery: string) => {
      setState({ kind: 'loading' });
      try {
        const ex = exchange === 'all' ? undefined : exchange;
        const markets = searchQuery.trim()
          ? await api.searchMarkets(searchQuery.trim(), ex)
          : await api.scanMarkets(ex, 25);
        setState({ kind: 'ready', markets });
      } catch (e) {
        setState({
          kind: 'error',
          message: e instanceof Error ? e.message : 'Failed to load markets',
        });
      }
    },
    [],
  );

  // Initial fetch + refetch on chip change.
  useEffect(() => {
    loadMarkets(selected, query);
    // query fires separately via the debounce effect — this one is chip-driven.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // Debounced search.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadMarkets(selected, query);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selected, loadMarkets]);

  const onRefresh = useCallback(() => {
    loadMarkets(selected, query);
  }, [loadMarkets, selected, query]);

  const onBuy = useCallback(
    async (asset: Asset) => {
      return sendCommand(`buy ${asset.exchange} ${asset.symbol}`);
    },
    [sendCommand],
  );

  const isLoading = state.kind === 'loading';
  const markets: Asset[] = state.kind === 'ready' ? state.markets : [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Markets</Text>
        <Text style={styles.subtitle}>
          {status.connection === 'connected'
            ? 'Live from your local harness'
            : 'Offline — showing cached data'}
        </Text>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color="#6B7280" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search markets…"
          placeholderTextColor="#6B7280"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          testID="market-search"
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={8} testID="market-search-clear">
            <Ionicons name="close-circle" size={18} color="#6B7280" />
          </Pressable>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chipsContent}
      >
        {connectors.map((id) => {
          const active = selected === id;
          return (
            <Pressable
              key={id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setSelected(id)}
              testID={`chip-${id}`}
            >
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                {id === 'all' ? 'All' : id.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.resultsHeader}>
        <Text style={styles.resultsCount}>
          {state.kind === 'ready'
            ? `${markets.length} result${markets.length === 1 ? '' : 's'}`
            : state.kind === 'loading'
              ? 'Loading…'
              : state.kind === 'error'
                ? 'Error'
                : ''}
        </Text>
      </View>

      <FlatList
        style={styles.list}
        data={markets}
        keyExtractor={(m) => `${m.exchange}:${m.id}:${m.symbol}`}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => setSelectedAsset(item)}
            testID={`market-row-${item.symbol}`}
          >
            <View style={styles.rowLeft}>
              <View style={styles.rowIcon}>
                <Text style={styles.rowIconText}>{item.symbol.slice(0, 2)}</Text>
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowSymbol}>{item.symbol}</Text>
                <Text style={styles.rowName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.rowExchange}>{item.exchange}</Text>
              </View>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowPrice}>
                ${item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
              </Text>
            </View>
          </Pressable>
        )}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={onRefresh}
            tintColor="#00D9FF"
          />
        }
        ListEmptyComponent={
          state.kind === 'loading' ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color="#00D9FF" />
              <Text style={styles.stateText}>Loading markets…</Text>
            </View>
          ) : state.kind === 'error' ? (
            <View style={[styles.stateBox, styles.stateError]}>
              <Ionicons name="warning" size={22} color="#EF4444" />
              <Text style={styles.stateText}>{state.message}</Text>
              <Pressable style={styles.retryBtn} onPress={onRefresh}>
                <Text style={styles.retryLabel}>Retry</Text>
              </Pressable>
            </View>
          ) : state.kind === 'ready' ? (
            <View style={styles.stateBox}>
              <Ionicons name="search-outline" size={28} color="#374151" />
              <Text style={styles.stateText}>
                {query.trim()
                  ? `No markets matching "${query.trim()}"`
                  : 'No markets on this connector yet.'}
              </Text>
            </View>
          ) : null
        }
        contentContainerStyle={markets.length === 0 ? styles.emptyContainer : undefined}
      />

      <MarketQuoteSheet
        asset={selectedAsset}
        onClose={() => setSelectedAsset(null)}
        onBuy={onBuy}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F14' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '700' },
  subtitle: { color: '#6B7280', fontSize: 13, marginTop: 4 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    backgroundColor: '#12171E',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#1E2530',
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: '#FFFFFF', fontSize: 15 },
  chipsScroll: { maxHeight: 52 },
  chipsContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  chip: {
    backgroundColor: '#12171E',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1E2530',
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: 'rgba(0,217,255,0.10)',
    borderColor: '#00D9FF60',
  },
  chipLabel: { color: '#9CA3AF', fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
  chipLabelActive: { color: '#00D9FF' },
  resultsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  resultsCount: { color: '#6B7280', fontSize: 12 },
  list: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#12171E',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E2530',
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1E2530',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowIconText: { color: '#00D9FF', fontSize: 13, fontWeight: '700' },
  rowText: { flex: 1 },
  rowSymbol: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  rowName: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  rowExchange: { color: '#6B7280', fontSize: 10, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  rowRight: { alignItems: 'flex-end' },
  rowPrice: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  stateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    gap: 10,
  },
  stateError: { backgroundColor: 'rgba(239,68,68,0.05)' },
  stateText: { color: '#9CA3AF', fontSize: 13, textAlign: 'center' },
  retryBtn: {
    backgroundColor: '#1E2530',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 8,
  },
  retryLabel: { color: '#F8FAFC', fontSize: 13, fontWeight: '600' },
});
