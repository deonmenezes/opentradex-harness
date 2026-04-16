import { View, Text, StyleSheet } from 'react-native';
import { memo } from 'react';

interface StatusBadgeProps {
  status: 'connected' | 'disconnected' | 'reconnecting';
  mode?: string;
}

export default memo(function StatusBadge({ status, mode }: StatusBadgeProps) {
  const statusColors = {
    connected: '#10B981',
    disconnected: '#EF4444',
    reconnecting: '#F59E0B',
  };

  const statusLabels = {
    connected: 'CONNECTED',
    disconnected: 'OFFLINE',
    reconnecting: 'RECONNECTING',
  };

  return (
    <View style={styles.container}>
      <View style={[styles.dot, { backgroundColor: statusColors[status] }]} />
      <Text style={styles.status}>{statusLabels[status]}</Text>
      {mode && (
        <>
          <View style={styles.separator} />
          <Text style={styles.mode}>{mode.toUpperCase()}</Text>
        </>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12171E',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E2530',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  status: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  separator: {
    width: 1,
    height: 10,
    backgroundColor: '#1E2530',
    marginHorizontal: 8,
  },
  mode: {
    color: '#00D9FF',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
