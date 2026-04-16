import { View, Text, StyleSheet, ScrollView, RefreshControl, TextInput, Pressable } from 'react-native';
import { useState, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useHarness } from '../../src/hooks/useHarness';
import AssetCard from '../../src/components/AssetCard';
import PortfolioCard from '../../src/components/PortfolioCard';
import NewsCard from '../../src/components/NewsCard';
import StatusBadge from '../../src/components/StatusBadge';

type Tab = 'watchlist' | 'trending' | 'news';

export default function HomeScreen() {
  const { status, watchlist, trending, news, portfolio, isLoading, refresh } = useHarness();
  const [activeTab, setActiveTab] = useState<Tab>('watchlist');
  const [searchQuery, setSearchQuery] = useState('');

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.logo}>OpenTradex</Text>
          <StatusBadge status={status.connection} mode={status.mode} />
        </View>

        {/* Search Bar */}
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
        {/* Portfolio Summary */}
        <View style={styles.portfolioSection}>
          <View style={styles.portfolioRow}>
            <PortfolioCard
              title="Cash"
              value={portfolio.cash}
              subtitle={`${portfolio.apy}% APY`}
              variant="cash"
            />
            <View style={styles.portfolioGap} />
            <PortfolioCard
              title="Investments"
              value={portfolio.investments}
              change={portfolio.dayPnLPercent}
              subtitle="Today"
              variant="investments"
            />
          </View>
        </View>

        {/* Tabs */}
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

        {/* Content based on active tab */}
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
  logo: {
    color: '#00D9FF',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
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
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
  },
  content: {
    flex: 1,
  },
  portfolioSection: {
    padding: 16,
  },
  portfolioRow: {
    flexDirection: 'row',
  },
  portfolioGap: {
    width: 12,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#12171E',
  },
  activeTab: {
    backgroundColor: '#00D9FF20',
    borderWidth: 1,
    borderColor: '#00D9FF40',
  },
  tabText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#00D9FF',
  },
  listSection: {
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  bottomPadding: {
    height: 20,
  },
});
