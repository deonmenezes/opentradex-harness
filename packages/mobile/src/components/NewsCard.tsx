import { View, Text, StyleSheet, Pressable } from 'react-native';
import { memo } from 'react';

interface NewsCardProps {
  title: string;
  summary: string;
  source: string;
  timestamp: number;
  icon?: string;
  onPress?: () => void;
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default memo(function NewsCard({
  title,
  summary,
  source,
  timestamp,
  icon = '📰',
  onPress,
}: NewsCardProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        <Text style={styles.summary} numberOfLines={2}>{summary}</Text>
        <View style={styles.meta}>
          <Text style={styles.source}>{source.toUpperCase()}</Text>
          <View style={styles.dot} />
          <Text style={styles.time}>{formatTimeAgo(timestamp)}</Text>
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 14,
    backgroundColor: '#12171E',
    borderRadius: 12,
    marginBottom: 8,
  },
  pressed: {
    backgroundColor: '#1A2029',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#1E2530',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 20,
  },
  content: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  summary: {
    color: '#6B7280',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  source: {
    color: '#00D9FF',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#6B7280',
    marginHorizontal: 8,
  },
  time: {
    color: '#6B7280',
    fontSize: 11,
  },
});
