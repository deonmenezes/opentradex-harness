import { View, Text, StyleSheet, ScrollView, RefreshControl, TextInput, Pressable } from 'react-native';
import { useState, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useHarness } from '../../src/hooks/useHarness';
import type { Position } from '../../src/services/api';
import AssetCard from '../../src/components/AssetCard';
import NewsCard from '../../src/components/NewsCard';
import StatusBadge from '../../src/components/StatusBadge';
import PositionDetailSheet from '../../src/components/PositionDetailSheet';

type Tab = 'watchlist' | 'trending' | 'news';

export default function HomeScreen() {
  const { status, positions, watchlist, trending, news, isLoading, refresh, closePosition } = useHarness();
  const [activeTab, setActiveTab] = useState<Tab>('watchlist');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);

  const onRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  const filteredAssets = searchQuery
    ? watchlist.filter(a =>
        a.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : watchlist;

  const handleAssetPress = (symbol: string) => {
    router.push(`/asset/${symbol}`);
  };

  const pnlPositive = status.dayPnL >= 0;
  const modeLabel = status.mode === 'live-allowed' ? 'LIVE' : 'PAPER';
  const modeTone = status.mode === 'live-allowed' ? styles.modeLive : styles.modePaper;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.logo}>OpenTradex</Text>
          <StatusBadge status={status.connection} mode={modeLabel} />
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#6B7280" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search markets..."
            placeholderTextColor="#6B7280"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#6B7280" />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={onRefresh}
            tintColor="#00D9FF"
            colors={['#00D9FF']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summarySection}>
          <View style={styles.equityCard}>
            <View style={styles.equityHeader}>
              <Text style={styles.equityLabel}>Equity</Text>
              <View style={[styles.modeChip, modeTone]}>
                <Text style={styles.modeChipText}>{modeLabel}</Text>
              </View>
            </View>
            <Text style={styles.equityValue} testID="equity-value">
              ${status.equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            <View style={styles.pnlRow}>
              <Ionicons
                name={pnlPositive ? 'trending-up' : 'trending-down'}
                size={16}
                color={pnlPositive ? '#10B981' : '#EF4444'}
              />
              <Text
                style={[styles.pnlText, pnlPositive ? styles.positive : styles.negative]}
                testID="day-pnl"
              >
                {pnlPositive ? '+' : ''}${status.dayPnL.toFixed(2)} ({status.dayPnLPercent.toFixed(2)}%) today
              </Text>
            </View>
            {status.halted && (
              <View style={styles.haltedBanner}>
                <Ionicons name="warning" size={14} color="#F59E0B" />
                <Text style={styles.haltedText}>
                  Trading halted{status.haltReason ? ` · ${status.haltReason}` : ''}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.miniStatsRow}>
            <View style={styles.miniStat}>
              <Text style={styles.miniStatLabel}>Open positions</Text>
              <Text style={styles.miniStatValue} testID="open-positions-count">
                {status.openPositions}
              </Text>
            </View>
            <View style={styles.miniStat}>
              <Text style={styles.miniStatLabel}>Day P&amp;L</Text>
              <Text style={[styles.miniStatValue, pnlPositive ? styles.positive : styles.negative]}>
                {pnlPositive ? '+' : ''}${status.dayPnL.toFixed(2)}
              </Text>
            </View>
            <View style={styles.miniStat}>
              <Text style={styles.miniStatLabel}>Status</Text>
              <Text style={[styles.miniStatValue, status.halted ? styles.negative : styles.positive]}>
                {status.halted ? 'HALT' : 'OK'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.positionsSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="layers" size={16} color="#00D9FF" />
            <Text style={styles.sectionTitle}>Open positions</Text>
            <Text style={styles.sectionCount}>{positions.length}</Text>
          </View>

          {positions.length === 0 ? (
            <View style={styles.positionsEmpty}>
              <Text style={styles.positionsEmptyText}>No open positions</Text>
              <Text style={styles.positionsEmptySub}>
                Tap a symbol or use the Command tab to open a paper trade.
              </Text>
            </View>
          ) : (
            positions.map((p) => (
              <Pressable
                key={p.id}
                style={styles.positionRow}
                onPress={() => setSelectedPosition(p)}
                testID={`position-row-${p.symbol}`}
              >
                <View style={styles.positionLeft}>
                  <View style={styles.positionIcon}>
                    <Text style={styles.positionIconText}>{p.symbol.slice(0, 2)}</Text>
                  </View>
                  <View>
                    <Text style={styles.positionSymbol}>{p.symbol}</Text>
                    <Text style={styles.positionMeta}>
                      {p.side.toUpperCase()} · {p.size} @ ${p.avgPrice.toFixed(4)}
                    </Text>
                  </View>
                </View>
                <View style={styles.positionRight}>
                  <Text style={styles.positionValue}>
                    ${(p.size * p.currentPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                  <Text style={[styles.positionPnl, p.pnl >= 0 ? styles.positive : styles.negative]}>
                    {p.pnl >= 0 ? '+' : ''}${p.pnl.toFixed(2)} ({p.pnlPercent.toFixed(2)}%)
                  </Text>
                </View>
              </Pressable>
            ))
          )}
        </View>

        <View style={styles.tabs}>
          {(['watchlist', 'trending', 'news'] as Tab[]).map((tab) => (
            <Pressable
              key={tab}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.listSection}>
          {activeTab === 'watchlist' && (
            <>
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
            </>
          )}

          {activeTab === 'trending' && (
            <>
              <View style={styles.sectionHeader}>
                <Ionicons name="flame" size={16} color="#F59E0B" />
                <Text style={styles.sectionTitle}>Top Movers</Text>
              </View>
              {trending.map((asset) => (
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
            </>
          )}

          {activeTab === 'news' && (
            <>
              {news.map((item) => (
                <NewsCard
                  key={item.id}
                  title={item.title}
                  summary={item.summary}
                  source={item.source}
                  timestamp={item.timestamp}
                  icon={item.icon}
                />
              ))}
            </>
          )}
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      <PositionDetailSheet
        position={selectedPosition}
        onClose={() => setSelectedPosition(null)}
        onConfirmClose={async (pos) => {
          const response = await closePosition(pos);
          return response;
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F14' },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2530',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  logo: { color: '#00D9FF', fontSize: 20, fontWeight: '700', letterSpacing: 0.5 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12171E',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#1E2530',
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: '#FFFFFF', fontSize: 15 },
  content: { flex: 1 },
  summarySection: { padding: 16 },
  equityCard: {
    backgroundColor: '#12171E',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1E2530',
  },
  equityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  equityLabel: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modeChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  modePaper: { backgroundColor: '#1E293B' },
  modeLive: { backgroundColor: '#7F1D1D' },
  modeChipText: { color: '#F8FAFC', fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  equityValue: { color: '#FFFFFF', fontSize: 32, fontWeight: '700', marginTop: 2 },
  pnlRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  pnlText: { fontSize: 14, fontWeight: '600', marginLeft: 6 },
  positive: { color: '#10B981' },
  negative: { color: '#EF4444' },
  haltedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  haltedText: { color: '#F59E0B', fontSize: 12, fontWeight: '600' },
  miniStatsRow: { flexDirection: 'row', marginTop: 12, gap: 12 },
  miniStat: {
    flex: 1,
    backgroundColor: '#12171E',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E2530',
  },
  miniStatLabel: { color: '#6B7280', fontSize: 11, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.4 },
  miniStatValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginTop: 4 },
  positionsSection: { paddingHorizontal: 16, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '600', marginLeft: 8, flex: 1 },
  sectionCount: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '500',
    backgroundColor: '#1E2530',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  positionsEmpty: {
    backgroundColor: '#12171E',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1E2530',
    alignItems: 'center',
  },
  positionsEmptyText: { color: '#9CA3AF', fontSize: 14, fontWeight: '600' },
  positionsEmptySub: { color: '#6B7280', fontSize: 12, marginTop: 4, textAlign: 'center' },
  positionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#12171E',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1E2530',
  },
  positionLeft: { flexDirection: 'row', alignItems: 'center' },
  positionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1E2530',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  positionIconText: { color: '#00D9FF', fontSize: 13, fontWeight: '700' },
  positionSymbol: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  positionMeta: { color: '#6B7280', fontSize: 12, marginTop: 2 },
  positionRight: { alignItems: 'flex-end' },
  positionValue: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  positionPnl: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 16 },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#12171E',
  },
  activeTab: { backgroundColor: '#00D9FF20', borderWidth: 1, borderColor: '#00D9FF40' },
  tabText: { color: '#6B7280', fontSize: 13, fontWeight: '600' },
  activeTabText: { color: '#00D9FF' },
  listSection: { paddingHorizontal: 16 },
  bottomPadding: { height: 20 },
});
