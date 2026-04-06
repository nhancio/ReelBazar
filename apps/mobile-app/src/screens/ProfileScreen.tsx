import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

export function ProfileScreen() {
  const { appUser, token, apiUrl, signOut } = useAuth();
  const [reels, setReels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appUser) return;
    const load = async () => {
      try {
        const res = await fetch(`${apiUrl}/reels/user/${appUser.id}?limit=20`, {
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
    };
    load();
  }, [appUser, token, apiUrl]);

  if (!appUser) return null;

  const totalLikes = reels.reduce((sum, r) => sum + (r.likesCount || 0), 0);
  const totalViews = reels.reduce((sum, r) => sum + (r.viewsCount || 0), 0);

  const userTypeLabel =
    appUser.userType === 'influencer' ? 'Influencer' :
    appUser.userType === 'brand' ? 'Brand' : 'Viewer';

  const badgeColor =
    appUser.userType === 'influencer' ? '#a855f7' :
    appUser.userType === 'brand' ? '#f59e0b' : '#3b82f6';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {appUser.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.name}>{appUser.name}</Text>
          {appUser.brandName && <Text style={styles.brandName}>{appUser.brandName}</Text>}
          <View style={[styles.badge, { backgroundColor: `${badgeColor}33`, borderColor: `${badgeColor}50` }]}>
            <Text style={[styles.badgeText, { color: badgeColor }]}>{userTypeLabel}</Text>
          </View>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{reels.length}</Text>
          <Text style={styles.statLabel}>Reels</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{totalLikes}</Text>
          <Text style={styles.statLabel}>Likes</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{totalViews}</Text>
          <Text style={styles.statLabel}>Views</Text>
        </View>
      </View>

      {/* Sign out */}
      <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      {/* Reels */}
      <Text style={styles.sectionTitle}>My Reels</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#ec4899" style={{ marginTop: 20 }} />
      ) : reels.length === 0 ? (
        <Text style={styles.emptyText}>No reels yet</Text>
      ) : (
        <View style={styles.reelsGrid}>
          {reels.map((reel) => (
            <View key={reel.id} style={styles.reelThumb}>
              <View style={styles.reelThumbInner}>
                <Text style={styles.reelThumbEmoji}>🎬</Text>
              </View>
              <Text style={styles.reelThumbViews}>👁 {reel.viewsCount}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 100 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ec4899',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  profileInfo: { flex: 1 },
  name: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  brandName: { color: '#9ca3af', fontSize: 14, marginTop: 2 },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 6,
  },
  badgeText: { fontSize: 12, fontWeight: '500' },
  statsRow: { flexDirection: 'row', marginTop: 24, gap: 32 },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  statLabel: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  signOutBtn: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#1f2937',
    alignSelf: 'flex-start',
  },
  signOutText: { color: '#9ca3af', fontWeight: '500' },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginTop: 32, marginBottom: 12 },
  emptyText: { color: '#6b7280', textAlign: 'center', marginTop: 20 },
  reelsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  reelThumb: {
    width: '32%' as any,
    aspectRatio: 9 / 16,
    backgroundColor: '#1f2937',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  reelThumbInner: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  reelThumbEmoji: { fontSize: 24 },
  reelThumbViews: { position: 'absolute', bottom: 4, left: 4, color: '#fff', fontSize: 10 },
});
