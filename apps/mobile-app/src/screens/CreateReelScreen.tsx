import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = ['Men', 'Women', 'Kids'];

export function CreateReelScreen() {
  const { token, apiUrl } = useAuth();
  const [productLink, setProductLink] = useState('');
  const [category, setCategory] = useState('Women');
  const [caption, setCaption] = useState('');
  const [brandTag, setBrandTag] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!productLink) return Alert.alert('Error', 'Product link is required');

    setLoading(true);
    try {
      // Note: In production, use react-native-image-picker for video selection
      // and FormData for upload. This is a placeholder.
      Alert.alert(
        'Video Upload',
        'In production, this would open the camera/gallery for video selection. The video would be uploaded with the product details.',
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Create Reel</Text>

      {/* Video placeholder */}
      <TouchableOpacity style={styles.videoUpload}>
        <Text style={styles.uploadIcon}>🎥</Text>
        <Text style={styles.uploadText}>Tap to select video</Text>
        <Text style={styles.uploadSubtext}>MP4, WebM (max 50MB)</Text>
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        placeholder="Product Link *"
        placeholderTextColor="#6b7280"
        value={productLink}
        onChangeText={setProductLink}
        keyboardType="url"
        autoCapitalize="none"
      />

      <Text style={styles.label}>Category</Text>
      <View style={styles.categoryRow}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.categoryBtn, category === cat && styles.categoryBtnActive]}
            onPress={() => setCategory(cat)}
          >
            <Text style={[styles.categoryText, category === cat && styles.categoryTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        style={styles.input}
        placeholder="Caption"
        placeholderTextColor="#6b7280"
        value={caption}
        onChangeText={setCaption}
        multiline
      />

      <TextInput
        style={styles.input}
        placeholder="Brand Tag"
        placeholderTextColor="#6b7280"
        value={brandTag}
        onChangeText={setBrandTag}
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? 'Uploading...' : 'Upload Reel'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 24, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 24 },
  videoUpload: {
    aspectRatio: 9 / 16,
    maxHeight: 300,
    backgroundColor: '#1f2937',
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  uploadIcon: { fontSize: 40 },
  uploadText: { color: '#9ca3af', fontWeight: '500', marginTop: 8 },
  uploadSubtext: { color: '#6b7280', fontSize: 12, marginTop: 4 },
  input: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 16,
  },
  label: { color: '#d1d5db', fontSize: 14, fontWeight: '500', marginBottom: 8 },
  categoryRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  categoryBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1f2937' },
  categoryBtnActive: { backgroundColor: '#ec4899' },
  categoryText: { color: '#9ca3af', fontWeight: '500' },
  categoryTextActive: { color: '#fff' },
  button: { backgroundColor: '#ec4899', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
