/**
 * Portfolio tab (US-013).
 *
 * Lists real open positions from /api/risk, shows totals/equity pulled from
 * useHarness, and exposes a fixed bottom PANIC button that opens a type-to-
 * confirm sheet. After firing, the button is disabled for 10s and a success
 * banner reports the flattened-position count to prevent double-tap.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useHarness } from '../../src/hooks/useHarness';
import PortfolioCard from '../../src/components/PortfolioCard';
import PanicConfirmSheet from '../../src/components/PanicConfirmSheet';
import PositionDetailSheet from '../../src/components/PositionDetailSheet';
import type { Position } from '../../src/services/api';

const PANIC_COOLDOWN_MS = 10_000;
const BANNER_TIMEOUT_MS = 5_000;

export default function PortfolioScreen() {
  const {
    status,
    positions,
    portfolio,
    isLoading,
    panic,
    refresh,
    closePosition,
  } = useHarness();

  const [panicSheetOpen, setPanicSheetOpen] = useState(false);
  const [panicFiredAt, setPanicFiredAt] = useState<number | null>(null);
  const [banner, setBanner] = useState<{ count: number; at: number } | null>(null);
  const [, setTick] = useState(0);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);

  // Drive the cooldown countdown UI — re-render each second while cooling.
  useEffect(() => {
    if (panicFiredAt === null) return;
    const remaining = PANIC_COOLDOWN_MS - (Date.now() - panicFiredAt);
    if (remaining <= 0) return;
    const t = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, [panicFiredAt]);

  // Auto-dismiss the success banner.
  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), BANNER_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [banner]);

  const onRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  const handlePanicConfirm = useCallback(async () => {
    const count = positions.length;
    try {
      await panic();
      setBanner({ count, at: Date.now() });
      setPanicFiredAt(Date.now());
    } catch {
      // useHarness.panic swallows errors; the sheet will still close.
    }
  }, [panic, positions.length]);

  const cooldownRemaining =
    panicFiredAt !== null
      ? Math.max(0, PANIC_COOLDOWN_MS - (Date.now() - panicFiredAt))
      : 0;
  const cooldownActive = cooldownRemaining > 0;
  const panicDisabled = status.halted || positions.length === 0 || cooldownActive;

  const totalPnL = positions.reduce((sum, p) => sum + p.pnl, 0);
  const investedValue = positions.reduce(
    (sum, p) => sum + Math.abs(p.size * p.currentPrice),
    0,
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollPad}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor="#00D9FF" />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Portfolio</Text>
          <View style={styles.statusBadge}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    status.connection === 'connected' ? '#10B981' : '#EF4444',
                },
              ]}
            />
            <Text style={styles.statusText}>{status.mode.toUpperCase()}</Text>
          </View>
        </View>

        {status.halted && (
          <View style={styles.haltedBanner} testID="halted-banner">
            <Ionicons name="pause-circle" size={18} color="#F59E0B" />
            <Text style={styles.haltedText}>
              Trading halted{status.haltReason ? ` — ${status.haltReason}` : ''}
            </Text>
          </View>
        )}

        {banner && (
          <View style={styles.successBanner} testID="panic-success-banner">
            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
            <Text style={styles.successText}>
              Flattened {banner.count} position{banner.count === 1 ? '' : 's'}
            </Text>
          </View>
        )}

        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Equity</Text>
          <Text style={styles.totalValue} testID="portfolio-equity">
            ${status.equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <View style={styles.pnlRow}>
            <Ionicons
              name={status.dayPnL >= 0 ? 'trending-up' : 'trending-down'}
              size={16}
              color={status.dayPnL >= 0 ? '#10B981' : '#EF4444'}
            />
            <Text
              style={[
                styles.pnlText,
                status.dayPnL >= 0 ? styles.positive : styles.negative,
              ]}
              testID="portfolio-day-pnl"
            >
              {status.dayPnL >= 0 ? '+' : ''}$
              {status.dayPnL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (
              {status.dayPnLPercent.toFixed(2)}%) today
            </Text>
          </View>
        </View>

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
            value={investedValue}
            change={investedValue > 0 ? (totalPnL / investedValue) * 100 : 0}
            subtitle="Unrealized"
            variant="investments"
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="layers" size={18} color="#00D9FF" />
            <Text style={styles.sectionTitle}>Positions</Text>
            <Text style={styles.sectionCount} testID="portfolio-position-count">
              {positions.length}
            </Text>
          </View>

          {positions.length === 0 ? (
            <View style={styles.emptyState} testID="portfolio-empty">
              <Ionicons name="wallet-outline" size={40} color="#1E2530" />
              <Text style={styles.emptyText}>No open positions</Text>
              <Text style={styles.emptySubtext}>
                Positions from the harness show up here in real time.
              </Text>
            </View>
          ) : (
            positions.map((p) => {
              const value = Math.abs(p.size * p.currentPrice);
              return (
                <Pressable
                  key={p.id}
                  style={styles.positionCard}
                  onPress={() => setSelectedPosition(p)}
                  testID={`portfolio-position-${p.symbol}`}
                >
                  <View style={styles.positionLeft}>
                    <View style={styles.positionIcon}>
                      <Text style={styles.positionIconText}>{p.symbol.slice(0, 2)}</Text>
                    </View>
                    <View>
                      <Text style={styles.positionSymbol}>{p.symbol}</Text>
                      <Text style={styles.positionQty}>
                        {p.side.toUpperCase()} • {p.size} @ ${p.avgPrice.toFixed(4)}
                      </Text>
                      <Text style={styles.positionExchange}>{p.exchange}</Text>
                    </View>
                  </View>
                  <View style={styles.positionRight}>
                    <Text style={styles.positionValue}>
                      ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                    <Text style={[styles.positionPnl, p.pnl >= 0 ? styles.positive : styles.negative]}>
                      {p.pnl >= 0 ? '+' : ''}${p.pnl.toFixed(2)} ({p.pnlPercent.toFixed(2)}%)
                    </Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      <View style={styles.panicDock} pointerEvents="box-none">
        <Pressable
          style={[styles.panicBtn, panicDisabled && styles.panicBtnDisabled]}
          onPress={() => !panicDisabled && setPanicSheetOpen(true)}
          disabled={panicDisabled}
          testID="panic-button"
        >
          <Ionicons name="warning" size={18} color="#F8FAFC" />
          <Text style={styles.panicBtnLabel}>
            {cooldownActive
              ? `PANIC (${Math.ceil(cooldownRemaining / 1000)}s)`
              : positions.length === 0
                ? 'PANIC — no positions'
                : `PANIC • Flatten ${positions.length}`}
          </Text>
        </Pressable>
      </View>

      <PanicConfirmSheet
        visible={panicSheetOpen}
        positionCount={positions.length}
        onClose={() => setPanicSheetOpen(false)}
        onConfirm={handlePanicConfirm}
      />

      <PositionDetailSheet
        position={selectedPosition}
        onClose={() => setSelectedPosition(null)}
        onConfirmClose={closePosition}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F14' },
  content: { flex: 1 },
  scrollPad: { paddingBottom: 120 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '700' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12171E',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusText: { color: '#6B7280', fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  haltedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderColor: '#F59E0B40',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  haltedText: { color: '#F59E0B', fontSize: 13, fontWeight: '600' },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderColor: '#10B98140',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  successText: { color: '#10B981', fontSize: 13, fontWeight: '600' },
  totalCard: {
    marginHorizontal: 16,
    padding: 20,
    backgroundColor: '#12171E',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E2530',
    marginBottom: 16,
  },
  totalLabel: { color: '#6B7280', fontSize: 13, fontWeight: '500' },
  totalValue: { color: '#FFFFFF', fontSize: 36, fontWeight: '700', marginTop: 8 },
  pnlRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  pnlText: { fontSize: 14, fontWeight: '600', marginLeft: 6 },
  positive: { color: '#10B981' },
  negative: { color: '#EF4444' },
  summaryRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 24 },
  cardGap: { width: 12 },
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
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
    overflow: 'hidden',
  },
  positionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#12171E',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1E2530',
  },
  positionLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  positionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E2530',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  positionIconText: { color: '#00D9FF', fontSize: 14, fontWeight: '700' },
  positionSymbol: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  positionQty: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  positionExchange: { color: '#6B7280', fontSize: 10, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  positionRight: { alignItems: 'flex-end' },
  positionValue: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  positionPnl: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    backgroundColor: '#12171E',
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: '#1E2530',
  },
  emptyText: { color: '#9CA3AF', fontSize: 15, fontWeight: '600', marginTop: 8 },
  emptySubtext: { color: '#6B7280', fontSize: 12, textAlign: 'center' },
  bottomPadding: { height: 40 },
  panicDock: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
  },
  panicBtn: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: '#EF4444',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  panicBtnDisabled: { backgroundColor: '#4B5563', shadowOpacity: 0 },
  panicBtnLabel: { color: '#F8FAFC', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
});
