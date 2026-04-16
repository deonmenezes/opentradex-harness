import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import { useState } from 'react';
import { useHarness } from '../../src/hooks/useHarness';

// Generate a more detailed chart path
function generateChartPath(isPositive: boolean): string {
  const width = 350;
  const height = 200;
  const points: string[] = [];
  let y = height / 2;

  for (let x = 0; x <= width; x += 5) {
    const trend = isPositive ? -0.1 : 0.1;
    y = Math.max(20, Math.min(height - 20, y + (Math.random() - 0.5 + trend) * 15));
    points.push(`${x},${y}`);
  }

  return `M ${points.join(' L ')}`;
}

export default function AssetDetailScreen() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const { watchlist, sendCommand } = useHarness();
  const [timeframe, setTimeframe] = useState<'1H' | '1D' | '1W' | '1M' | '1Y'>('1D');

  const asset = watchlist.find(a => a.symbol === symbol) || {
    symbol: symbol || 'N/A',
    name: symbol || 'Unknown Asset',
    price: 0,
    change: 0,
    changePercent: 0,
    exchange: 'unknown',
  };

  const isPositive = asset.change >= 0;
  const chartPath = generateChartPath(isPositive);
  const chartColor = isPositive ? '#10B981' : '#EF4444';

  const handleTrade = async (action: 'buy' | 'sell') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await sendCommand(`${action} ${asset.symbol} 1 share`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.symbol}>{asset.symbol}</Text>
          <Text style={styles.exchange}>{asset.exchange.toUpperCase()}</Text>
        </View>
        <Pressable style={styles.menuButton}>
          <Ionicons name="ellipsis-horizontal" size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Price Section */}
        <View style={styles.priceSection}>
          <Text style={styles.name}>{asset.name}</Text>
          <Text style={styles.price}>
            ${asset.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: asset.price < 1 ? 8 : 2 })}
          </Text>
          <View style={styles.changeRow}>
            <Ionicons
              name={isPositive ? 'trending-up' : 'trending-down'}
              size={18}
              color={chartColor}
            />
            <Text style={[styles.changeText, { color: chartColor }]}>
              {isPositive ? '+' : ''}${asset.change.toFixed(2)} ({isPositive ? '+' : ''}{asset.changePercent.toFixed(2)}%)
            </Text>
            <Text style={styles.changeLabel}>Today</Text>
          </View>
        </View>

        {/* Chart */}
        <View style={styles.chartContainer}>
          <Svg width="100%" height={200} viewBox="0 0 350 200" preserveAspectRatio="none">
            <Path
              d={chartPath}
              fill="none"
              stroke={chartColor}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>

          {/* Timeframe Selector */}
          <View style={styles.timeframeRow}>
            {(['1H', '1D', '1W', '1M', '1Y'] as const).map((tf) => (
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

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Open</Text>
            <Text style={styles.statValue}>${(asset.price - asset.change).toFixed(2)}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>High</Text>
            <Text style={styles.statValue}>${(asset.price * 1.02).toFixed(2)}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Low</Text>
            <Text style={styles.statValue}>${(asset.price * 0.98).toFixed(2)}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Volume</Text>
            <Text style={styles.statValue}>12.4M</Text>
          </View>
        </View>

        {/* AI Analysis */}
        <View style={styles.aiSection}>
          <View style={styles.aiHeader}>
            <Ionicons name="cube" size={18} color="#00D9FF" />
            <Text style={styles.aiTitle}>AI Analysis</Text>
          </View>
          <View style={styles.aiCard}>
            <Text style={styles.aiText}>
              Based on current market conditions and technical indicators, {asset.symbol} shows
              {isPositive ? ' bullish momentum with strong support levels. Consider entry points on minor pullbacks.' : ' bearish pressure with resistance at current levels. Monitor for potential reversal signals.'}
            </Text>
            <View style={styles.aiSignal}>
              <View style={[styles.signalDot, { backgroundColor: isPositive ? '#10B981' : '#EF4444' }]} />
              <Text style={[styles.signalText, { color: isPositive ? '#10B981' : '#EF4444' }]}>
                {isPositive ? 'BULLISH' : 'BEARISH'}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Pressable style={styles.actionButton} onPress={() => sendCommand(`analyze ${asset.symbol}`)}>
            <Ionicons name="analytics" size={20} color="#00D9FF" />
            <Text style={styles.actionText}>Deep Analysis</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => sendCommand(`alert ${asset.symbol}`)}>
            <Ionicons name="notifications" size={20} color="#F59E0B" />
            <Text style={styles.actionText}>Set Alert</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => sendCommand(`compare ${asset.symbol}`)}>
            <Ionicons name="git-compare" size={20} color="#8B5CF6" />
            <Text style={styles.actionText}>Compare</Text>
          </Pressable>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Trade Buttons */}
      <View style={styles.tradeBar}>
        <Pressable style={[styles.tradeButton, styles.sellButton]} onPress={() => handleTrade('sell')}>
          <Text style={styles.tradeButtonText}>Sell</Text>
        </Pressable>
        <Pressable style={[styles.tradeButton, styles.buyButton]} onPress={() => handleTrade('buy')}>
          <Text style={styles.tradeButtonText}>Buy</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F14',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2530',
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    alignItems: 'center',
  },
  symbol: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  exchange: {
    color: '#6B7280',
    fontSize: 11,
    marginTop: 2,
  },
  menuButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  priceSection: {
    padding: 20,
    alignItems: 'center',
  },
  name: {
    color: '#6B7280',
    fontSize: 14,
  },
  price: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '700',
    marginTop: 8,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  changeText: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 6,
  },
  changeLabel: {
    color: '#6B7280',
    fontSize: 13,
    marginLeft: 8,
  },
  chartContainer: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  timeframeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    gap: 8,
  },
  timeframeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#12171E',
  },
  activeTimeframe: {
    backgroundColor: '#00D9FF20',
  },
  timeframeText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
  },
  activeTimeframeText: {
    color: '#00D9FF',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  statItem: {
    width: '25%',
    paddingVertical: 12,
    alignItems: 'center',
  },
  statLabel: {
    color: '#6B7280',
    fontSize: 12,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  aiSection: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  aiTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  aiCard: {
    backgroundColor: '#12171E',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E2530',
  },
  aiText: {
    color: '#9CA3AF',
    fontSize: 14,
    lineHeight: 22,
  },
  aiSignal: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E2530',
  },
  signalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  signalText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#12171E',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
  bottomPadding: {
    height: 100,
  },
  tradeBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 32,
    backgroundColor: '#0B0F14',
    borderTopWidth: 1,
    borderTopColor: '#1E2530',
    gap: 12,
  },
  tradeButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  sellButton: {
    backgroundColor: '#EF444420',
    borderWidth: 1,
    borderColor: '#EF444440',
  },
  buyButton: {
    backgroundColor: '#10B981',
  },
  tradeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
