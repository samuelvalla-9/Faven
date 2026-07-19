import React, { useEffect, useState } from 'react';
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity,
  FlatList, StyleSheet, StatusBar, ActivityIndicator,
} from 'react-native';
import { api, setToken } from './src/api';
import { colors, spacing, radius, tierColors, tierLabels } from './src/theme';

type Screen = 'auth' | 'feed' | 'leaderboard';

export default function App() {
  const [screen, setScreen] = useState<Screen>('auth');
  const [user, setUser] = useState<any>(null);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.espresso} />
      <View style={styles.header}>
        <Text style={styles.brand}>faven</Text>
        <Text style={styles.tagline}>proof you were there</Text>
      </View>
      {screen === 'auth' && (
        <AuthScreen
          onLogin={(u) => { setUser(u); setScreen('feed'); }}
        />
      )}
      {screen === 'feed' && <FeedScreen />}
      {screen === 'leaderboard' && <LeaderboardScreen />}
      {user && (
        <View style={styles.tabs}>
          <TabButton label="Feed" active={screen === 'feed'} onPress={() => setScreen('feed')} />
          <TabButton label="Leaderboard" active={screen === 'leaderboard'} onPress={() => setScreen('leaderboard')} />
        </View>
      )}
    </SafeAreaView>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.tab, active && styles.tabActive]} onPress={onPress}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function AuthScreen({ onLogin }: { onLogin: (user: any) => void }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'phone' | 'otp'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const requestOtp = async () => {
    setBusy(true); setError('');
    try {
      await api.requestOtp(phone);
      setStage('otp');
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  const verify = async () => {
    setBusy(true); setError('');
    try {
      const { token, user } = await api.verifyOtp(phone, code);
      setToken(token);
      onLogin(user);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <View style={styles.authBox}>
      <Text style={styles.h1}>Sign in</Text>
      {stage === 'phone' ? (
        <>
          <TextInput
            style={styles.input} placeholder="Phone number" placeholderTextColor={colors.inkSoft}
            keyboardType="phone-pad" value={phone} onChangeText={setPhone}
          />
          <TouchableOpacity style={styles.cta} onPress={requestOtp} disabled={busy}>
            <Text style={styles.ctaText}>{busy ? '…' : 'Send OTP'}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.hint}>Dev OTP: 123456</Text>
          <TextInput
            style={styles.input} placeholder="6-digit code" placeholderTextColor={colors.inkSoft}
            keyboardType="number-pad" value={code} onChangeText={setCode} maxLength={6}
          />
          <TouchableOpacity style={styles.cta} onPress={verify} disabled={busy}>
            <Text style={styles.ctaText}>{busy ? '…' : 'Verify'}</Text>
          </TouchableOpacity>
        </>
      )}
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

function Badge({ tier }: { tier: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: tierColors[tier] || colors.inkSoft }]}>
      <Text style={styles.badgeText}>{tierLabels[tier] || tier}</Text>
    </View>
  );
}

function FeedScreen() {
  const [reviews, setReviews] = useState<any[] | null>(null);
  useEffect(() => { api.feed().then((d) => setReviews(d.reviews)).catch(() => setReviews([])); }, []);
  if (!reviews) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />;
  return (
    <FlatList
      data={reviews}
      keyExtractor={(r) => String(r.id)}
      contentContainerStyle={{ padding: spacing.md }}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.restaurant}>{item.restaurant_name}</Text>
            <Badge tier={item.verification_tier} />
          </View>
          <Text style={styles.meta}>@{item.username || 'anon'} · {'★'.repeat(item.rating)}</Text>
          <Text style={styles.body}>{item.body}</Text>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.hint}>No reviews yet — start the API & seed data.</Text>}
    />
  );
}

function LeaderboardScreen() {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => { api.leaderboard().then((d) => setRows(d.leaderboard)).catch(() => setRows([])); }, []);
  if (!rows) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />;
  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => String(r.id)}
      contentContainerStyle={{ padding: spacing.md }}
      renderItem={({ item, index }) => (
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.restaurant}>#{index + 1}  @{item.username || item.name || 'anon'}</Text>
            <Text style={styles.meta}>{item.fully_verified ?? 0} verified</Text>
          </View>
          <Text style={styles.meta}>Credibility {item.credibility_score} · {item.coins} coins</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  header: { backgroundColor: colors.espresso, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  brand: { color: colors.accent, fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  tagline: { color: colors.paper, opacity: 0.7, fontSize: 12 },
  authBox: { padding: spacing.lg, gap: spacing.md },
  h1: { fontSize: 24, fontWeight: '700', color: colors.ink },
  hint: { color: colors.inkSoft, textAlign: 'center', marginTop: spacing.sm },
  input: {
    backgroundColor: colors.paper2, borderColor: colors.accentTint, borderWidth: 1,
    borderRadius: radius.md, padding: spacing.md, fontSize: 16, color: colors.ink,
  },
  cta: { backgroundColor: colors.accent, borderRadius: radius.pill, padding: spacing.md, alignItems: 'center' },
  ctaText: { color: colors.paper2, fontWeight: '700', fontSize: 16 },
  error: { color: colors.accentInk, textAlign: 'center' },
  card: {
    backgroundColor: colors.paper2, borderRadius: radius.lg, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.accentTint,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  restaurant: { fontWeight: '700', fontSize: 16, color: colors.ink, flexShrink: 1 },
  meta: { color: colors.inkSoft, fontSize: 12, marginTop: 2 },
  body: { color: colors.ink, marginTop: spacing.sm, lineHeight: 20 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: colors.paper2, fontSize: 10, fontWeight: '700' },
  tabs: { flexDirection: 'row', backgroundColor: colors.espresso },
  tab: { flex: 1, padding: spacing.md, alignItems: 'center' },
  tabActive: { borderTopWidth: 2, borderTopColor: colors.accent },
  tabText: { color: colors.paper, opacity: 0.6, fontWeight: '600' },
  tabTextActive: { opacity: 1, color: colors.accent },
});
