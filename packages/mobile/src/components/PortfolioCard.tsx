import { View, Text, StyleSheet } from 'react-native';
import { memo } from 'react';
import { LinearGradient } from 'expo-linear-gradient';

interface PortfolioCardProps {
  title: string;
  value: number;
  subtitle?: string;
  change?: number;
  variant?: 'cash' | 'investments' | 'total';
}

export default memo(function PortfolioCard({
  title,
  value,
  subtitle,
  change,
  variant = 'cash',
}: PortfolioCardProps) {
  const gradients: Record<string, [string, string]> = {
    cash: ['#1E2530', '#12171E'],
    investments: ['#1E2530', '#12171E'],
    total: ['#00D9FF15', '#0B0F14'],
  };

  const formatValue = (v: number) => {
    return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <LinearGradient
      colors={gradients[variant]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <Text style={styles.title}>{title}</Text>
      <Text style={[styles.value, variant === 'total' && styles.totalValue]}>
        {formatValue(value)}
      </Text>
      {subtitle && (
        <View style={styles.subtitleRow}>
          <Text style={styles.subtitle}>{subtitle}</Text>
          {change !== undefined && (
            <Text style={[styles.change, change >= 0 ? styles.positive : styles.negative]}>
              {change >= 0 ? '+' : ''}{change.toFixed(2)}%
            </Text>
          )}
        </View>
      )}
    </LinearGradient>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E2530',
    minHeight: 100,
  },
  title: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 8,
  },
  totalValue: {
    color: '#00D9FF',
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  subtitle: {
    color: '#6B7280',
    fontSize: 12,
  },
  change: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
  },
  positive: {
    color: '#10B981',
  },
  negative: {
    color: '#EF4444',
  },
});
