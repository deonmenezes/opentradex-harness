import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useState, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useHarness } from '../../src/hooks/useHarness';
import AssetCard from '../../src/components/AssetCard';

type Exchange = 'all' | 'stocks' | 'crypto' | 'commodities';

export default function MarketsScreen() {
  const { watchlist, trending, isLoading, refresh } = useHarness();
  const [activeExchange, setActiveExchange] = useState<Exchange>('all');

  const exchanges: { id: Exchange; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'all', label: 'All', icon: 'grid' },
    { id: 'stocks', label: 'Stocks', icon: 'trending-up' },
    { id: 'crypto', label: 'Crypto', icon: 'logo-bitcoin' },
    { id: 'commodities', label: 'Commodities', icon: 'cube' },
  ];

  const filteredAssets = activeExchange === 'all'
    ? watchlist
    : watchlist.filter(a => a.exchange === activeExchange);

  const handleAssetPress = (symbol: string) => {
    router.push(`/asset/${symbol}`);
  };

  const onRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Markets</Text>
        <Text style={styles.subtitle}>Real-time market data from AI harness</Text>
      </View>

      {/* Exchange Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.exchangeScroll}
        contentContainerStyle={styles.exchangeContent}
      >
        {exchanges.map((exchange) => (
          <Pressable
            key={exchange.id}
            style={[
              styles.exchangeButton,
              activeExchange === exchange.id && styles.activeExchangeButton,
            ]}
            onPress={() => setActiveExchange(exchange.id)}
          >
            <Ionicons
              name={exchange.icon}
              size={16}
              color={activeExchange === exchange.id ? '#00D9FF' : '#6B7280'}
            />
            <Text
              style={[
                styles.exchangeLabel,
                activeExchange === exchange.id && styles.activeExchangeLabel,
              ]}
            >
              {exchange.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Market Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{filteredAssets.length}</Text>
          <Text style={styles.statLabel}>Assets</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, styles.positive]}>
            {filteredAssets.filter(a => a.changePercent > 0).length}
          </Text>
          <Text style={styles.statLabel}>Gainers</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, styles.negative]}>
            {filteredAssets.filter(a => a.changePercent < 0).length}
          </Text>
          <Text style={styles.statLabel}>Losers</Text>
        </View>
      </View>

      {/* Asset List */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={onRefresh}
            tintColor="#00D9FF"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Top Movers Section */}
        {activeExchange === 'all' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="flame" size={18} color="#F59E0B" />
              <Text style={styles.sectionTitle}>Top Movers</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {trending.slice(0, 5).map((asset) => (
                <Pressable
                  key={asset.id}
                  style={styles.moverCard}
                  onPress={() => handleAssetPress(asset.symbol)}
                >
                  <View style={styles.moverIcon}>
                    <Text style={styles.moverIconText}>{asset.symbol.slice(0, 2)}</Text>
                  </View>
                  <Text style={styles.moverSymbol}>{asset.symbol}</Text>
                  <Text style={[styles.moverChange, asset.changePercent >= 0 ? styles.positive : styles.negative]}>
                    {asset.changePercent >= 0 ? '+' : ''}{asset.changePercent.toFixed(2)}%
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* All Assets */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="list" size={18} color="#00D9FF" />
            <Text style={styles.sectionTitle}>
              {activeExchange === 'all' ? 'All Markets' : exchanges.find(e => e.id === activeExchange)?.label}
            </Text>
          </View>
          {filteredAssets.map((asset) => (
            <AssetCard
              key={asset.id}
              symbol={asset.symbol}
              name={asset.name}
              price={asset.price}
              change={asset.change}
              changePercent={asset.changePercent}
              onPress={() => handleAssetPress(asset.symbol)}
            />
          ))}
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
  subtitle: {
    color: '#6B7280',
    fontSize: 14,
    marginTop: 4,
  },
  exchangeScroll: {
    maxHeight: 50,
  },
  exchangeContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  exchangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#12171E',
    marginRight: 8,
  },
  activeExchangeButton: {
    backgroundColor: '#00D9FF15',
    borderWidth: 1,
    borderColor: '#00D9FF40',
  },
  exchangeLabel: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  activeExchangeLabel: {
    color: '#00D9FF',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#12171E',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    color: '#6B7280',
    fontSize: 11,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  positive: {
    color: '#10B981',
  },
  negative: {
    color: '#EF4444',
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  horizontalList: {
    paddingRight: 16,
  },
  moverCard: {
    backgroundColor: '#12171E',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginRight: 12,
    width: 90,
  },
  moverIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E2530',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  moverIconText: {
    color: '#00D9FF',
    fontSize: 12,
    fontWeight: '700',
  },
  moverSymbol: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  moverChange: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  bottomPadding: {
    height: 20,
  },
});
