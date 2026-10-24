import { useEffect, useState, useCallback } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { productsApi } from '@reelbazaar/api';
import { CATEGORIES, type BrandProduct, type Category } from '@reelbazaar/config';
import { useTheme } from '@/context/ThemeContext';
import { Avatar } from '@/components/Avatar';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { radius, spacing, typography } from '@/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelectProduct: (product: BrandProduct) => void;
}

export function BrandCatalogModal({
  visible,
  onClose,
  onSelectProduct,
}: Props) {
  const insets = useSafeAreaInsets();
  const { palette, theme } = useTheme();

  const [products, setProducts] = useState<BrandProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');

  const isDark = theme !== 'light';

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await productsApi.getCatalog({
        category: selectedCategory === 'All' ? undefined : selectedCategory,
        q: searchQuery.trim() || undefined,
        limit: 50,
      });
      setProducts(res.products || []);
    } catch (err) {
      console.error('Failed to load brand products:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCategory]);

  useEffect(() => {
    if (visible) {
      void loadProducts();
    }
  }, [visible, loadProducts]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: palette.background,
            paddingTop: insets.top + spacing.xs,
            paddingBottom: insets.bottom + spacing.md,
          },
        ]}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: palette.border }]}>
          <View style={styles.headerLeft}>
            <Ionicons name="pricetag" size={20} color={palette.accent} />
            <Text style={[styles.headerTitle, { color: palette.text }]}>Tag Brand Product</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={palette.text} />
          </Pressable>
        </View>

        {/* Search input */}
        <View style={styles.searchBarWrap}>
          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                borderColor: palette.borderInteractive,
              },
            ]}
          >
            <Ionicons name="search" size={18} color={palette.textMuted} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search products by title or brand…"
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
              style={[styles.searchInput, { color: palette.text }]}
              autoCorrect={false}
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={6}>
                <Ionicons name="close-circle" size={16} color={palette.textMuted} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Category filters */}
        <View style={styles.categoriesWrap}>
          <FlatList
            horizontal
            data={['All', ...CATEGORIES]}
            keyExtractor={(item) => item}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesList}
            renderItem={({ item }) => {
              const active = selectedCategory === item;
              return (
                <Pressable
                  onPress={() => setSelectedCategory(item as Category | 'All')}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: active
                        ? palette.accent
                        : isDark
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(0,0,0,0.04)',
                      borderColor: active ? palette.accent : palette.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      {
                        color: active ? palette.textOnAccent : palette.textSecondary,
                        fontWeight: active ? '700' : '500',
                      },
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>

        {/* Products List */}
        {loading ? (
          <View style={styles.loadingArea}>
            <LoadingSpinner size="lg" />
            <Text style={{ color: palette.textMuted, fontSize: 13, marginTop: spacing.sm }}>
              Loading products…
            </Text>
          </View>
        ) : (
          <FlatList
            data={products}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Ionicons name="shirt-outline" size={44} color={palette.textMuted} />
                <Text style={[styles.emptyTitle, { color: palette.text }]}>No products found</Text>
                <Text style={[styles.emptySub, { color: palette.textMuted }]}>
                  Try adjusting your search or category filter.
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const commission = item.commissionRate || 10;
              const commissionAmt = Math.round((item.price || 0) * (commission / 100));

              return (
                <Pressable
                  onPress={() => {
                    onSelectProduct(item);
                    onClose();
                  }}
                  style={({ pressed }) => [
                    styles.productCard,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                      borderColor: palette.border,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <View style={styles.productImgWrap}>
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
                    ) : (
                      <View style={[StyleSheet.absoluteFill, styles.placeholderImg]}>
                        <Ionicons name="bag" size={24} color={palette.textMuted} />
                      </View>
                    )}
                  </View>

                  <View style={styles.productInfo}>
                    <View style={styles.brandRow}>
                      <Avatar uri={item.brandAvatarUrl} name={item.brandName} size={16} />
                      <Text style={[styles.brandName, { color: palette.textSecondary }]} numberOfLines={1}>
                        {item.brandName || 'Brand'}
                      </Text>
                    </View>

                    <Text style={[styles.itemTitle, { color: palette.text }]} numberOfLines={2}>
                      {item.name}
                    </Text>

                    <View style={styles.pricingRow}>
                      <Text style={[styles.itemPrice, { color: palette.text }]}>
                        ₹{item.price?.toLocaleString('en-IN')}
                      </Text>

                      <View style={[styles.commBadge, { backgroundColor: 'rgba(34,197,94,0.15)' }]}>
                        <Ionicons name="sparkles" size={11} color="#22c55e" />
                        <Text style={styles.commText}>
                          Earn {commission}% (₹{commissionAmt}/sale)
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.tagBtnWrap}>
                    <View style={[styles.tagPill, { backgroundColor: palette.accentSoft }]}>
                      <Text style={[styles.tagPillText, { color: palette.accent }]}>Tag</Text>
                      <Ionicons name="arrow-forward" size={12} color={palette.accent} />
                    </View>
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerTitle: { ...typography.heading, fontSize: 17, fontWeight: '700' },
  closeBtn: { padding: 4 },
  searchBarWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, fontSize: 14, height: '100%' },
  categoriesWrap: { paddingVertical: spacing.sm },
  categoriesList: { paddingHorizontal: spacing.lg, gap: spacing.xs },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  categoryChipText: { fontSize: 12 },
  listContent: { padding: spacing.lg, gap: spacing.md },
  loadingArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: spacing.xs },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptySub: { fontSize: 13, textAlign: 'center' },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
  },
  productImgWrap: {
    width: 68,
    height: 68,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: '#1e1e28',
  },
  placeholderImg: { alignItems: 'center', justifyContent: 'center' },
  productInfo: { flex: 1, gap: 3 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  brandName: { fontSize: 11, fontWeight: '600' },
  itemTitle: { fontSize: 13, fontWeight: '700', lineHeight: 17 },
  pricingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2, flexWrap: 'wrap' },
  itemPrice: { fontSize: 15, fontWeight: '800' },
  commBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  commText: { color: '#22c55e', fontSize: 10, fontWeight: '700' },
  tagBtnWrap: { justifyContent: 'center' },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  tagPillText: { fontSize: 12, fontWeight: '700' },
});
