import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useState, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useHarness } from '../../src/hooks/useHarness';
import PortfolioCard from '../../src/components/PortfolioCard';

interface Position {
  id: string;
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
}

// Mock positions data
const MOCK_POSITIONS: Position[] = [
  { id: '1', symbol: 'SPY', quantity: 10, avgPrice: 590.00, currentPrice: 600.54, pnl: 105.40, pnlPercent: 1.79 },
  { id: '2', symbol: 'NVDA', quantity: 5, avgPrice: 180.00, currentPrice: 199.37, pnl: 96.85, pnlPercent: 10.76 },
  { id: '3', symbol: 'BTC', quantity: 0.5, avgPrice: 70000, currentPrice: 74550.32, pnl: 2275.16, pnlPercent: 6.50 },
];

export default function PortfolioScreen() {
  const { status, portfolio, isLoading, refresh } = useHarness();
  const [positions] = useState<Position[]>(MOCK_POSITIONS);
  const [timeframe, setTimeframe] = useState<'1D' | '1W' | '1M' | 'ALL'>('1D');

  const onRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  const totalPnL = positions.reduce((sum, p) => sum + p.pnl, 0);
  const totalValue = positions.reduce((sum, p) => sum + (p.quantity * p.currentPrice), 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Portfolio</Text>
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: status.connection === 'connected' ? '#10B981' : '#EF4444' }]} />
            <Text style={styles.statusText}>{status.mode.toUpperCase()}</Text>
          </View>
        </View>

        {/* Total Value Card */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total Portfolio Value</Text>
          <Text style={styles.totalValue}>
            ${(totalValue + portfolio.cash).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </Text>
          <View style={styles.pnlRow}>
            <Ionicons
              name={totalPnL >= 0 ? 'trending-up' : 'trending-down'}
              size={16}
              color={totalPnL >= 0 ? '#10B981' : '#EF4444'}
            />
            <Text style={[styles.pnlText, totalPnL >= 0 ? styles.positive : styles.negative]}>
              {totalPnL >= 0 ? '+' : ''}${totalPnL.toLocaleString('en-US', { minimumFractionDigits: 2 })} today
            </Text>
          </View>

          {/* Timeframe Selector */}
          <View style={styles.timeframeRow}>
            {(['1D', '1W', '1M', 'ALL'] as const).map((tf) => (
              <Pressable
                key={tf}
                style={[styles.timeframeButton, timeframe === tf && styles.activeTimeframe]}
                onPress={() => setTimeframe(tf)}
              >
                <Text style={[styles.timeframeText, timeframe === tf && styles.activeTimeframeText]}>
                  {tf}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <PortfolioCard
            title="Cash"
            value={portfolio.cash}
            subtitle={`${portfolio.apy}% APY`}
            variant="cash"
          />
          <View style={styles.cardGap} />
          <PortfolioCard
            title="Invested"
            value={totalValue}
            change={(totalPnL / totalValue) * 100}
            subtitle="Today"
            variant="investments"
          />
        </View>

        {/* Positions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="layers" size={18} color="#00D9FF" />
            <Text style={styles.sectionTitle}>Positions</Text>
            <Text style={styles.sectionCount}>{positions.length}</Text>
          </View>

          {positions.map((position) => (
            <View key={position.id} style={styles.positionCard}>
              <View style={styles.positionLeft}>
                <View style={styles.positionIcon}>
                  <Text style={styles.positionIconText}>{position.symbol.slice(0, 2)}</Text>
                </View>
                <View>
                  <Text style={styles.positionSymbol}>{position.symbol}</Text>
                  <Text style={styles.positionQty}>{position.quantity} shares</Text>
                </View>
              </View>
              <View style={styles.positionRight}>
                <Text style={styles.positionValue}>
                  ${(position.quantity * position.currentPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
                <Text style={[styles.positionPnl, position.pnl >= 0 ? styles.positive : styles.negative]}>
                  {position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)} ({position.pnlPercent.toFixed(2)}%)
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Activity Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="time" size={18} color="#F59E0B" />
            <Text style={styles.sectionTitle}>Recent Activity</Text>
          </View>

          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={40} color="#1E2530" />
            <Text style={styles.emptyText}>No recent trades</Text>
            <Text style={styles.emptySubtext}>Paper trades will appear here</Text>
          </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12171E',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  totalCard: {
    marginHorizontal: 16,
    padding: 20,
    backgroundColor: '#12171E',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E2530',
    marginBottom: 16,
  },
  totalLabel: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '500',
  },
  totalValue: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '700',
    marginTop: 8,
  },
  pnlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  pnlText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  positive: {
    color: '#10B981',
  },
  negative: {
    color: '#EF4444',
  },
  timeframeRow: {
    flexDirection: 'row',
    marginTop: 16,
    backgroundColor: '#0B0F14',
    borderRadius: 12,
    padding: 4,
  },
  timeframeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTimeframe: {
    backgroundColor: '#1E2530',
  },
  timeframeText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
  },
  activeTimeframeText: {
    color: '#FFFFFF',
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  cardGap: {
    width: 12,
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
    flex: 1,
  },
  sectionCount: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '500',
    backgroundColor: '#1E2530',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  positionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#12171E',
    borderRadius: 12,
    marginBottom: 8,
  },
  positionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  positionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E2530',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  positionIconText: {
    color: '#00D9FF',
    fontSize: 14,
    fontWeight: '700',
  },
  positionSymbol: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  positionQty: {
    color: '#6B7280',
    fontSize: 13,
    marginTop: 2,
  },
  positionRight: {
    alignItems: 'flex-end',
  },
  positionValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  positionPnl: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#12171E',
    borderRadius: 12,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '500',
    marginTop: 12,
  },
  emptySubtext: {
    color: '#4B5563',
    fontSize: 13,
    marginTop: 4,
  },
  bottomPadding: {
    height: 20,
  },
});
