import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

export function SkeletonBox({ width, height, style }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.6, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width: width ?? '100%', height: height ?? 20, opacity },
        style,
      ]}
    />
  );
}

export function TasksSkeleton() {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <SkeletonBox height={24} width="60%" style={{ marginBottom: 8 }} />
        <SkeletonBox height={14} width="90%" style={{ marginBottom: 16 }} />
        <SkeletonBox height={48} style={{ marginBottom: 16 }} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <SkeletonBox height={36} style={{ flex: 1 }} />
          <SkeletonBox height={36} style={{ flex: 1 }} />
        </View>
      </View>
      {[1, 2, 3].map((i) => (
        <View key={i} style={[styles.card, { flexDirection: 'row', alignItems: 'center' }]}>
          <SkeletonBox width={44} height={44} style={{ borderRadius: 22, marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <SkeletonBox height={16} width="80%" style={{ marginBottom: 6 }} />
            <SkeletonBox height={12} width="50%" />
          </View>
        </View>
      ))}
    </View>
  );
}

export function DashboardSkeleton() {
  return (
    <View style={styles.container}>
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
        <SkeletonBox height={100} style={{ flex: 1, borderRadius: 12 }} />
        <SkeletonBox height={100} style={{ flex: 1, borderRadius: 12 }} />
      </View>
      <SkeletonBox height={120} style={{ marginBottom: 16, borderRadius: 12 }} />
      <SkeletonBox height={18} width="40%" style={{ marginBottom: 12 }} />
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={[styles.card, { flexDirection: 'row', alignItems: 'center' }]}>
          <SkeletonBox width={40} height={40} style={{ borderRadius: 20, marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <SkeletonBox height={14} width="70%" style={{ marginBottom: 6 }} />
            <SkeletonBox height={12} width="40%" />
          </View>
        </View>
      ))}
    </View>
  );
}

export function ListSkeleton({ count = 4 }) {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.card, { flexDirection: 'row', alignItems: 'center' }]}>
          <SkeletonBox width={48} height={48} style={{ borderRadius: 12, marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <SkeletonBox height={16} width="85%" style={{ marginBottom: 6 }} />
            <SkeletonBox height={12} width="55%" />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  card: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  skeleton: {
    backgroundColor: '#e2e8f0',
    borderRadius: 6,
  },
});
