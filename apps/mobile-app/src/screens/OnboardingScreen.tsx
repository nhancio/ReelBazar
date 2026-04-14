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

const USER_TYPES = [
  { key: 'influencer', label: 'Earn through Brand Collaborations', desc: 'Create reels, promote brands, earn money' },
  { key: 'viewer', label: 'Explore & Shop Trends', desc: 'Discover trends, shop fashion products' },
  { key: 'brand', label: 'Promote Your Products', desc: 'Showcase products, find influencers' },
];

const CATEGORIES = ['Men', 'Women', 'Kids'];

export function OnboardingScreen() {
  const { register } = useAuth();
  const [step, setStep] = useState<'type' | 'details'>('type');
  const [userType, setUserType] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [brandName, setBrandName] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const toggleCategory = (cat: string) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleRegister = async () => {
    if (!name.trim()) return Alert.alert('Error', 'Name is required');
    setLoading(true);
    try {
      await register({
        name: name.trim(),
        userType,
        phone: phone || undefined,
        gender: gender || undefined,
        age: age ? parseInt(age, 10) : undefined,
        brandName: brandName || undefined,
        productCategories: categories.length > 0 ? categories : undefined,
      });
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'type') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Welcome to Rava</Text>
        <Text style={styles.subtitle}>How would you like to use Rava?</Text>

        {USER_TYPES.map((type) => (
          <TouchableOpacity
            key={type.key}
            style={styles.typeCard}
            onPress={() => {
              setUserType(type.key);
              setStep('details');
            }}
          >
            <Text style={styles.typeLabel}>{type.label}</Text>
            <Text style={styles.typeDesc}>{type.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <TouchableOpacity onPress={() => setStep('type')}>
        <Text style={styles.back}>{'< Back'}</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Complete Your Profile</Text>

      <TextInput
        style={styles.input}
        placeholder="Name *"
        placeholderTextColor="#6b7280"
        value={name}
        onChangeText={setName}
      />

      {userType === 'influencer' && (
        <>
          <TextInput style={styles.input} placeholder="Phone" placeholderTextColor="#6b7280" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <TextInput style={styles.input} placeholder="Gender" placeholderTextColor="#6b7280" value={gender} onChangeText={setGender} />
          <TextInput style={styles.input} placeholder="Age" placeholderTextColor="#6b7280" value={age} onChangeText={setAge} keyboardType="numeric" />
        </>
      )}

      {userType === 'brand' && (
        <>
          <TextInput style={styles.input} placeholder="Brand Name *" placeholderTextColor="#6b7280" value={brandName} onChangeText={setBrandName} />
          <Text style={styles.label}>Product Categories</Text>
          <View style={styles.categoryRow}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryBtn, categories.includes(cat) && styles.categoryBtnActive]}
                onPress={() => toggleCategory(cat)}
              >
                <Text style={[styles.categoryText, categories.includes(cat) && styles.categoryTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleRegister}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? 'Creating...' : 'Get Started'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', paddingHorizontal: 24 },
  scrollContent: { paddingTop: 60, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  subtitle: { color: '#9ca3af', marginBottom: 32 },
  back: { color: '#9ca3af', marginBottom: 20, fontSize: 16 },
  typeCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  typeLabel: { color: '#fff', fontSize: 18, fontWeight: '600' },
  typeDesc: { color: '#9ca3af', fontSize: 14, marginTop: 4 },
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
  categoryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1f2937',
  },
  categoryBtnActive: { backgroundColor: '#ec4899' },
  categoryText: { color: '#9ca3af', fontWeight: '500' },
  categoryTextActive: { color: '#fff' },
  button: {
    backgroundColor: '#ec4899',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
