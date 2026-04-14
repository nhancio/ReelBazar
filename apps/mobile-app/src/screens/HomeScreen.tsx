import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Dimensions,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const REEL_HEIGHT = SCREEN_HEIGHT - 140;

const CATEGORIES = ['All', 'Men', 'Women', 'Kids'];

export function HomeScreen() {
  const { token, apiUrl } = useAuth();
  const [activeCategory, setActiveCategory] = useState('All');
  const [reels, setReels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  const loadReels = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '10' });
      if (activeCategory !== 'All') params.append('category', activeCategory);
      const res = await fetch(`${apiUrl}/reels?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setReels(data.reels);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeCategory, token, apiUrl]);

  useEffect(() => {
    loadReels();
  }, [loadReels]);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index || 0);
    }
  }).current;

  const renderReel = ({ item, index }: { item: any; index: number }) => (
    <View style={[styles.reelContainer, { height: REEL_HEIGHT }]}>
      <View style={styles.reelContent}>
        <View style={styles.reelPlaceholder}>
          <Text style={styles.reelEmoji}>🎬</Text>
          <Text style={styles.reelVideoText}>Video Reel</Text>
        </View>

        {/* Overlay */}
        <View style={styles.overlay}>
          <View style={styles.bottomInfo}>
            <Text style={styles.creatorName}>@{item.creator?.name || 'Unknown'}</Text>
            {item.brandTag && <Text style={styles.brandTag}>{item.brandTag}</Text>}
            {item.caption && <Text style={styles.caption}>{item.caption}</Text>}
          </View>

          <TouchableOpacity
            style={styles.shopButton}
            onPress={() => Linking.openURL(item.productLink)}
          >
            <Text style={styles.shopButtonText}>Shop Now</Text>
          </TouchableOpacity>
        </View>

        {/* Right actions */}
        <View style={styles.rightActions}>
          <TouchableOpacity style={styles.actionBtn}>
            <Text style={styles.actionIcon}>♥</Text>
            <Text style={styles.actionCount}>{item.likesCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Text style={styles.actionIcon}>🔖</Text>
            <Text style={styles.actionCount}>{item.savesCount}</Text>
          </TouchableOpacity>
          <View style={styles.actionBtn}>
            <Text style={styles.actionIcon}>👁</Text>
            <Text style={styles.actionCount}>{item.viewsCount}</Text>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>Rava</Text>
        <View style={styles.tabs}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => setActiveCategory(cat)}
              style={[styles.tab, activeCategory === cat && styles.tabActive]}
            >
              <Text style={[styles.tabText, activeCategory === cat && styles.tabTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#ec4899" style={{ marginTop: 100 }} />
      ) : reels.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No reels yet</Text>
        </View>
      ) : (
        <FlatList
          data={reels}
          renderItem={renderReel}
          keyExtractor={(item) => item.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={REEL_HEIGHT}
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { paddingTop: 50, paddingHorizontal: 16, backgroundColor: '#0f172a' },
  logo: { fontSize: 22, fontWeight: 'bold', color: '#ec4899' },
  tabs: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1f2937' },
  tabActive: { backgroundColor: '#ec4899' },
  tabText: { color: '#9ca3af', fontWeight: '500', fontSize: 14 },
  tabTextActive: { color: '#fff' },
  reelContainer: { backgroundColor: '#000' },
  reelContent: { flex: 1, position: 'relative' },
  reelPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' },
  reelEmoji: { fontSize: 48 },
  reelVideoText: { color: '#6b7280', marginTop: 8, fontSize: 16 },
  overlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16 },
  bottomInfo: { marginBottom: 12 },
  creatorName: { color: '#fff', fontWeight: '600', fontSize: 16 },
  brandTag: { color: '#ec4899', fontSize: 14, marginTop: 2 },
  caption: { color: '#d1d5db', fontSize: 14, marginTop: 4 },
  shopButton: {
    backgroundColor: '#ec4899',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  shopButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  rightActions: { position: 'absolute', right: 12, bottom: 100, gap: 20, alignItems: 'center' },
  actionBtn: { alignItems: 'center' },
  actionIcon: { fontSize: 24 },
  actionCount: { color: '#fff', fontSize: 12, marginTop: 2 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#6b7280', fontSize: 18 },
});
