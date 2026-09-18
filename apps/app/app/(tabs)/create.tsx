import { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { CATEGORIES, type Category, type BrandProduct, MAX_FILE_SIZE } from '@reelbazaar/config';
import { reelsApi, type UploadSource } from '@reelbazaar/api';
import { auth, db, storage } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/Button';
import { BrandCatalogModal } from '@/components/BrandCatalogModal';
import { radius, spacing, typography } from '@/theme';

interface PickedVideo {
  uri: string;
  name: string;
  type: string;
  size?: number;
  webFile?: File;
}

function VideoPreviewPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      nativeControls
      allowsPictureInPicture={false}
    />
  );
}

export default function CreateReelScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette, theme } = useTheme();
  const { user, guestMode } = useAuth();
  const { showToast } = useToast();

  const [video, setVideo] = useState<PickedVideo | null>(null);
  const [productLink, setProductLink] = useState('');
  const [taggedProduct, setTaggedProduct] = useState<BrandProduct | null>(null);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [caption, setCaption] = useState('');
  const [brandTag, setBrandTag] = useState('');
  const [category, setCategory] = useState<Category>(CATEGORIES[0]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const pickVideo = useCallback(async () => {
    setError('');
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError('Media library permission is required to select videos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: true,
        quality: 1,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      if (!asset) return;

      if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE) {
        setError('Video file size must be under 50MB.');
        return;
      }

      const name = asset.fileName || `reel_${Date.now()}.mp4`;
      const type = asset.mimeType || 'video/mp4';

      setVideo({
        uri: asset.uri,
        name,
        type,
        size: asset.fileSize,
        webFile: (asset as { file?: File }).file,
      });
    } catch (err) {
      console.error('Failed to pick video:', err);
      setError('Could not open video picker.');
    }
  }, []);

  const isValidUrl = (url: string) => /^https?:\/\/.+/i.test(url.trim());

  const handleSelectProduct = (prod: BrandProduct) => {
    setTaggedProduct(prod);
    setProductLink(prod.productLink || `https://rava.one/products/${prod.id}`);
    if (prod.brandName) setBrandTag(`@${prod.brandName.toLowerCase().replace(/\s+/g, '')}`);
    if (CATEGORIES.includes(prod.category as Category)) {
      setCategory(prod.category as Category);
    }
    showToast(`Tagged "${prod.name}" (${prod.commissionRate || 10}% Commission) 🎉`, 'success');
  };

  const handleRemoveProduct = () => {
    setTaggedProduct(null);
  };

  const handleSubmit = async () => {
    if (!video) {
      setError('Please select a video for your reel.');
      return;
    }
    if (!taggedProduct && (!productLink.trim() || !isValidUrl(productLink))) {
      setError('Please tag a brand product or enter a valid product URL.');
      return;
    }
    if (!user) {
      showToast('Please sign in to post a reel.', 'info');
      router.push('/auth');
      return;
    }

    setLoading(true);
    setError('');
    setProgress(0);

    try {
      if (guestMode) {
        await new Promise((r) => setTimeout(r, 1000));
        showToast('Reel shared (browse mode)', 'success');
        router.replace('/profile');
        return;
      }

      let videoUrl: string | null = null;
      const effectiveProductLink = productLink.trim() || taggedProduct?.productLink || '';
      const effectiveProductId = taggedProduct?.id;
      const effectiveCommissionRate = taggedProduct?.commissionRate || 10;

      // Strategy 1: Try backend upload API
      try {
        const uploadSource: UploadSource =
          Platform.OS === 'web' && video.webFile
            ? video.webFile
            : {
                uri: video.uri,
                name: video.name,
                type: video.type,
              };

        const res = await reelsApi.create(
          uploadSource,
          {
            productLink: effectiveProductLink,
            category,
            caption: caption.trim() || undefined,
            brandTag: brandTag.trim() || undefined,
            productId: effectiveProductId,
            commissionRate: effectiveCommissionRate,
          },
          (p) => setProgress(p)
        );

        if (res && (res as { reel?: { videoUrl?: string }; url?: string }).url) {
          videoUrl = (res as { url: string }).url;
        }
      } catch (apiErr) {
        console.warn('Backend upload failed, attempting direct Firebase Storage upload:', apiErr);
      }

      // Strategy 2: Direct Firebase Storage fallback
      if (!videoUrl) {
        const fileId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const storageRef = ref(storage, `reels/${fileId}_${video.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`);

        let uploadBlob: Blob;
        if (Platform.OS === 'web' && video.webFile) {
          uploadBlob = video.webFile;
        } else {
          const resp = await fetch(video.uri);
          uploadBlob = await resp.blob();
        }

        const uploadTask = uploadBytesResumable(storageRef, uploadBlob, {
          contentType: video.type || 'video/mp4',
        });

        videoUrl = await new Promise<string>((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              if (snapshot.totalBytes > 0) {
                const p = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                setProgress(p);
              }
            },
            (err) => reject(err),
            async () => {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(url);
            }
          );
        });

        // Save metadata to Firestore
        await addDoc(collection(db, 'reels'), {
          videoUrl,
          thumbnailUrl: null,
          productLink: effectiveProductLink,
          productId: effectiveProductId || null,
          commissionRate: effectiveCommissionRate,
          ordersCount: 0,
          caption: caption.trim() || null,
          brandTag: brandTag.trim() || null,
          category,
          creatorId: auth.currentUser?.uid ?? user.id,
          likesCount: 0,
          viewsCount: 0,
          savesCount: 0,
          commentsCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          serverCreatedAt: serverTimestamp(),
        });
      }

      showToast('Reel published successfully! 🎉', 'success');
      setVideo(null);
      setCaption('');
      setProductLink('');
      setBrandTag('');
      setTaggedProduct(null);
      router.replace('/');
    } catch (err: unknown) {
      console.error('Failed to post reel:', err);
      const message = err instanceof Error ? err.message : 'Failed to upload reel. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  const isDark = theme !== 'light';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.fill, { backgroundColor: palette.background }]}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + spacing.xs,
            borderBottomColor: palette.border,
            backgroundColor: palette.background,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.headerBtn}
        >
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]}>New Reel</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xxl + 30 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {guestMode ? (
          <View
            style={[
              styles.guestBanner,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                borderColor: palette.border,
              },
            ]}
          >
            <Ionicons name="information-circle-outline" size={18} color={palette.accent} />
            <Text style={[styles.guestText, { color: palette.textMuted }]}>
              Browse mode — sign in to publish live reels.
            </Text>
          </View>
        ) : null}

        {/* Video Picker / Preview Area */}
        <Pressable
          onPress={!loading ? pickVideo : undefined}
          accessibilityRole="button"
          accessibilityLabel={video ? 'Change video' : 'Add video'}
          style={[
            styles.videoContainer,
            {
              backgroundColor: isDark ? '#141416' : '#f0f2f5',
              borderColor: video ? palette.accent : palette.border,
            },
          ]}
        >
          {video ? (
            <>
              <VideoPreviewPlayer uri={video.uri} />
              {!loading && (
                <View style={styles.changeOverlay}>
                  <View style={styles.changePill}>
                    <Ionicons name="camera-reverse" size={16} color="#ffffff" />
                    <Text style={styles.changeText}>Change video</Text>
                  </View>
                </View>
              )}
            </>
          ) : (
            <View style={styles.emptyVideoState}>
              <View style={[styles.videoIconWrap, { backgroundColor: palette.accentSoft }]}>
                <Ionicons name="videocam" size={28} color={palette.accent} />
              </View>
              <Text style={[styles.uploadPrompt, { color: palette.text }]}>Select a video (9:16)</Text>
              <Text style={[styles.uploadSub, { color: palette.textMuted }]}>
                MP4, WebM or QuickTime · up to 50MB
              </Text>
            </View>
          )}

          {/* Progress bar overlay during upload */}
          {loading && (
            <View style={styles.loadingOverlay}>
              <View style={styles.progressCircle}>
                <Text style={styles.progressPercent}>{progress}%</Text>
              </View>
              <Text style={styles.uploadingText}>Posting reel…</Text>
              <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
              </View>
            </View>
          )}
        </Pressable>

        {/* Form Fields */}
        <View style={styles.fields}>
          {/* Tagged Brand Product Section */}
          <View style={styles.field}>
            <View style={styles.fieldHeaderRow}>
              <Text style={[styles.fieldLabel, { color: palette.textMuted }]}>SHOPPABLE PRODUCT *</Text>
              <Pressable
                onPress={() => setShowCatalogModal(true)}
                hitSlop={6}
                style={styles.browseCatalogLink}
              >
                <Ionicons name="search" size={12} color={palette.accent} />
                <Text style={[styles.browseCatalogText, { color: palette.accent }]}>
                  {taggedProduct ? 'Change Product' : 'Browse Brand Catalog'}
                </Text>
              </Pressable>
            </View>

            {taggedProduct ? (
              /* Selected Product Preview Card */
              <View
                style={[
                  styles.taggedCard,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                    borderColor: palette.accent,
                  },
                ]}
              >
                <View style={styles.taggedThumb}>
                  {taggedProduct.imageUrl ? (
                    <Image source={{ uri: taggedProduct.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : (
                    <Ionicons name="bag" size={20} color={palette.accent} />
                  )}
                </View>

                <View style={styles.taggedInfo}>
                  <Text style={[styles.taggedBrand, { color: palette.textSecondary }]}>
                    {taggedProduct.brandName || 'Brand'}
                  </Text>
                  <Text style={[styles.taggedName, { color: palette.text }]} numberOfLines={1}>
                    {taggedProduct.name}
                  </Text>
                  <View style={styles.taggedMeta}>
                    <Text style={[styles.taggedPrice, { color: palette.text }]}>
                      ₹{taggedProduct.price?.toLocaleString('en-IN')}
                    </Text>
                    <View style={styles.commBadge}>
                      <Text style={styles.commText}>
                        {taggedProduct.commissionRate || 10}% Commission
                      </Text>
                    </View>
                  </View>
                </View>

                <Pressable onPress={handleRemoveProduct} hitSlop={8} style={styles.removeProductBtn}>
                  <Ionicons name="close-circle" size={22} color={palette.textMuted} />
                </Pressable>
              </View>
            ) : (
              /* Custom Link or Browse CTA */
              <View style={styles.productInputWrap}>
                <TextInput
                  value={productLink}
                  onChangeText={setProductLink}
                  placeholder="https://example.com/product (or browse catalog above)"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[
                    styles.input,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                      borderColor: palette.borderInteractive,
                      color: palette.text,
                    },
                  ]}
                />
              </View>
            )}
          </View>

          {/* Caption */}
          <View style={styles.field}>
            <View style={styles.fieldHeaderRow}>
              <Text style={[styles.fieldLabel, { color: palette.textMuted }]}>CAPTION</Text>
              <Text
                style={[
                  styles.counter,
                  { color: caption.length > 450 ? palette.warning : palette.textMuted },
                ]}
              >
                {caption.length}/500
              </Text>
            </View>
            <TextInput
              value={caption}
              onChangeText={(t) => setCaption(t.slice(0, 500))}
              placeholder="Write an engaging caption for your reel…"
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
              multiline
              numberOfLines={3}
              style={[
                styles.input,
                styles.textarea,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  borderColor: palette.borderInteractive,
                  color: palette.text,
                },
              ]}
            />
          </View>

          {/* Category */}
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: palette.textMuted }]}>CATEGORY</Text>
            <View style={styles.chipsRow}>
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => setCategory(cat)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isSelected
                          ? palette.accent
                          : isDark
                            ? 'rgba(255,255,255,0.08)'
                            : 'rgba(0,0,0,0.05)',
                        borderColor: isSelected ? palette.accent : palette.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        {
                          color: isSelected
                            ? palette.textOnAccent
                            : isDark
                              ? 'rgba(255,255,255,0.8)'
                              : 'rgba(0,0,0,0.75)',
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {cat}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Brand tag */}
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: palette.textMuted }]}>BRAND TAG</Text>
            <TextInput
              value={brandTag}
              onChangeText={setBrandTag}
              placeholder="@brandname"
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  borderColor: palette.borderInteractive,
                  color: palette.text,
                },
              ]}
            />
          </View>

          {error ? (
            <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
          ) : null}

          <Button
            label={loading ? `Uploading (${progress}%)…` : 'Publish Shoppable Reel'}
            onPress={handleSubmit}
            loading={loading}
            disabled={!video || (!taggedProduct && !productLink.trim())}
            fullWidth
            style={styles.submitBtn}
          />
        </View>
      </ScrollView>

      {/* Brand Catalog Tagging Modal */}
      <BrandCatalogModal
        visible={showCatalogModal}
        onClose={() => setShowCatalogModal(false)}
        onSelectProduct={handleSelectProduct}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.heading, fontSize: 18, fontWeight: '700' },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  guestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  guestText: { ...typography.caption, fontSize: 13, flex: 1 },
  videoContainer: {
    width: '100%',
    height: 260,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyVideoState: { alignItems: 'center', gap: spacing.xs },
  videoIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  uploadPrompt: { fontSize: 15, fontWeight: '700' },
  uploadSub: { fontSize: 12 },
  changeOverlay: {
    position: 'absolute',
    bottom: spacing.md,
    alignItems: 'center',
  },
  changePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  changeText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  progressCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressPercent: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  uploadingText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  progressBarTrack: {
    width: '80%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#ff3366',
    borderRadius: 3,
  },
  fields: { gap: spacing.md },
  field: { gap: spacing.xs },
  fieldHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, paddingLeft: 2 },
  browseCatalogLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  browseCatalogText: { fontSize: 12, fontWeight: '700' },
  counter: { fontSize: 11 },
  taggedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    gap: spacing.md,
  },
  taggedThumb: {
    width: 50,
    height: 50,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: '#1f242d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taggedInfo: { flex: 1, gap: 2 },
  taggedBrand: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  taggedName: { fontSize: 13, fontWeight: '700' },
  taggedMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  taggedPrice: { fontSize: 13, fontWeight: '800' },
  commBadge: { backgroundColor: 'rgba(34,197,94,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  commText: { color: '#22c55e', fontSize: 10, fontWeight: '700' },
  removeProductBtn: { padding: 4 },
  productInputWrap: {},
  input: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    fontSize: 15,
  },
  textarea: {
    height: 88,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    textAlignVertical: 'top',
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: 2 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: { fontSize: 13 },
  errorText: { fontSize: 13, marginTop: spacing.xs },
  submitBtn: { marginTop: spacing.sm, minHeight: 52 },
});
