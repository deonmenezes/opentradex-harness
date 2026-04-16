import { View, Text, StyleSheet, Pressable } from 'react-native';
import { memo } from 'react';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface AssetCardProps {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  sparkline?: number[];
  onPress?: () => void;
}

function generateSparklinePath(data: number[], width: number, height: number): string {
  if (data.length < 2) return '';

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  });

  return `M ${points.join(' L ')}`;
}

function Sparkline({ data, isPositive }: { data: number[]; isPositive: boolean }) {
  const width = 60;
  const height = 24;
  const path = generateSparklinePath(data, width, height);
  const color = isPositive ? '#10B981' : '#EF4444';

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Defs>
        <LinearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default memo(function AssetCard({
  symbol,
  name,
  price,
  change,
  changePercent,
  sparkline,
  onPress,
}: AssetCardProps) {
  const isPositive = change >= 0;
  const changeColor = isPositive ? '#10B981' : '#EF4444';

  // Generate mock sparkline if not provided
  const sparklineData = sparkline || Array.from({ length: 20 }, (_, i) =>
    100 + Math.sin(i * 0.5) * 10 + Math.random() * 5 * (isPositive ? 1 : -1)
  );

  const formatPrice = (p: number) => {
    if (p >= 1000) return `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (p >= 1) return `$${p.toFixed(2)}`;
    if (p >= 0.01) return `$${p.toFixed(4)}`;
    return `$${p.toFixed(8)}`;
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.leftSection}>
        <View style={styles.iconContainer}>
          <Text style={styles.iconText}>{symbol.slice(0, 2)}</Text>
        </View>
        <View style={styles.nameSection}>
          <Text style={styles.symbol}>{symbol}</Text>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
        </View>
      </View>

      <View style={styles.sparklineContainer}>
        <Sparkline data={sparklineData} isPositive={isPositive} />
      </View>

      <View style={styles.rightSection}>
        <Text style={styles.price}>{formatPrice(price)}</Text>
        <Text style={[styles.change, { color: changeColor }]}>
          {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
        </Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#12171E',
    borderRadius: 12,
    marginBottom: 8,
  },
  pressed: {
    backgroundColor: '#1A2029',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E2530',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconText: {
    color: '#00D9FF',
    fontSize: 14,
    fontWeight: '700',
  },
  nameSection: {
    flex: 1,
  },
  symbol: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  name: {
    color: '#6B7280',
    fontSize: 13,
    marginTop: 2,
  },
  sparklineContainer: {
    marginHorizontal: 12,
  },
  rightSection: {
    alignItems: 'flex-end',
    minWidth: 80,
  },
  price: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  change: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
});
