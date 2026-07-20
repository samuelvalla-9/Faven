// Faven — Sprint 1 app: Auth → Feed / Search / Post / Leaderboard / Profile.
// Single-file state-based navigation (no react-navigation dep yet).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api, BASE_URL, setToken } from './src/api';
import { colors, radius, spacing, tierColors, tierLabels } from './src/theme';

const TOKEN_KEY = 'faven.token';

type Tab = 'feed' | 'search' | 'post' | 'leaderboard' | 'profile';

// ---------- helpers ----------

function photoUri(url?: string | null): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : `${BASE_URL}${url}`;
}

function Stars({ rating }: { rating: number }) {
  return (
    <Text style={{ color: colors.accent2, fontSize: 14 }}>
      {'★'.repeat(Math.round(rating))}
      <Text style={{ color: colors.inkSoft }}>{'★'.repeat(5 - Math.round(rating))}</Text>
    </Text>
  );
}

function TierBadge({ tier, sponsored }: { tier: string; sponsored?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.xs }}>
      <View style={[s.badge, { backgroundColor: tierColors[tier] || colors.inkSoft }]}>
        <Text style={s.badgeText}>{tierLabels[tier] || tier}</Text>
      </View>
      {sponsored ? (
        <View style={[s.badge, { backgroundColor: colors.accentInk }]}>
          <Text style={s.badgeText}>Sponsored</Text>
        </View>
      ) : null}
    </View>
  );
}

function ReviewCard({ review, showRestaurant = true }: { review: any; showRestaurant?: boolean }) {
  const uri = photoUri(review.photo_url);
  return (
    <View style={s.card}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={s.cardTitle}>
          {showRestaurant ? review.restaurant_name : `@${review.username || 'anon'}`}
        </Text>
        <Stars rating={Number(review.rating)} />
      </View>
      {showRestaurant ? (
        <Text style={s.cardMeta}>
          @{review.username || 'anon'} · {review.city || ''}
        </Text>
      ) : null}
      {uri ? <Image source={{ uri }} style={s.cardPhoto} resizeMode="cover" /> : null}
      {review.body ? <Text style={s.cardBody}>{review.body}</Text> : null}
      <TierBadge tier={review.verification_tier} sponsored={!!review.is_sponsored} />
    </View>
  );
}

function Button({
  title,
  onPress,
  disabled,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'ghost';
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.btn,
        variant === 'ghost' && s.btnGhost,
        (pressed || disabled) && { opacity: 0.6 },
      ]}
    >
      <Text style={[s.btnText, variant === 'ghost' && { color: colors.accentInk }]}>{title}</Text>
    </Pressable>
  );
}

// ---------- Auth ----------

function AuthScreen({ onLogin }: { onLogin: (token: string, user: any) => void }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'phone' | 'otp'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const requestOtp = async () => {
    setBusy(true);
    setError('');
    try {
      await api.requestOtp(phone);
      setStage('otp');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError('');
    try {
      const { token, user } = await api.verifyOtp(phone, code);
      onLogin(token, user);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.authWrap}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={s.logo}>Faven</Text>
      <Text style={s.tagline}>Every post is proof you were there.</Text>
      {stage === 'phone' ? (
        <>
          <TextInput
            style={s.input}
            placeholder="10-digit phone"
            placeholderTextColor={colors.inkSoft}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            maxLength={10}
          />
          <Button title={busy ? 'Sending…' : 'Send OTP'} onPress={requestOtp} disabled={busy || phone.length < 10} />
        </>
      ) : (
        <>
          <TextInput
            style={s.input}
            placeholder="OTP (dev: 123456)"
            placeholderTextColor={colors.inkSoft}
            keyboardType="number-pad"
            value={code}
            onChangeText={setCode}
            maxLength={6}
          />
          <Button title={busy ? 'Verifying…' : 'Verify & sign in'} onPress={verify} disabled={busy || code.length < 6} />
          <Button title="Change phone" variant="ghost" onPress={() => setStage('phone')} />
        </>
      )}
      {error ? <Text style={s.error}>{error}</Text> : null}
    </KeyboardAvoidingView>
  );
}

// ---------- Feed ----------

function FeedScreen() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { reviews } = await api.feed();
      setReviews(reviews);
    } catch {}
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  if (loading) return <Loading />;
  return (
    <FlatList
      data={reviews}
      keyExtractor={(r) => String(r.id)}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
      renderItem={({ item }) => <ReviewCard review={item} />}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
      ListEmptyComponent={<Empty text="No reviews yet — be the first to post!" />}
    />
  );
}

// ---------- Search + Restaurant detail ----------

function SearchScreen() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [detail, setDetail] = useState<{ restaurant: any; reviews: any[] } | null>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const { restaurants } = await api.restaurants(q);
        setResults(restaurants);
      } catch {}
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!selected) return setDetail(null);
    api.restaurant(selected.id).then(setDetail).catch(() => {});
  }, [selected]);

  if (selected) {
    return (
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
        <Button title="← Back to search" variant="ghost" onPress={() => setSelected(null)} />
        <Text style={s.h1}>{selected.name}</Text>
        <Text style={s.cardMeta}>
          {selected.cuisine} · {selected.area ? `${selected.area}, ` : ''}
          {selected.city}
        </Text>
        {detail ? (
          detail.reviews.length ? (
            detail.reviews.map((r) => <ReviewCard key={r.id} review={r} showRestaurant={false} />)
          ) : (
            <Empty text="No reviews yet for this spot." />
          )
        ) : (
          <Loading />
        )}
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1, padding: spacing.md, gap: spacing.md }}>
      <TextInput
        style={s.input}
        placeholder="Search restaurants or cuisines…"
        placeholderTextColor={colors.inkSoft}
        value={q}
        onChangeText={setQ}
      />
      <FlatList
        data={results}
        keyExtractor={(r) => String(r.id)}
        contentContainerStyle={{ gap: spacing.sm }}
        renderItem={({ item }) => (
          <Pressable style={s.card} onPress={() => setSelected(item)}>
            <Text style={s.cardTitle}>{item.name}</Text>
            <Text style={s.cardMeta}>
              {item.cuisine} · {item.area ? `${item.area}, ` : ''}
              {item.city}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={<Empty text="No matches — try another search." />}
      />
    </View>
  );
}

// ---------- Post review ----------

function PostScreen({ onPosted }: { onPosted: () => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [restaurant, setRestaurant] = useState<any | null>(null);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [sponsored, setSponsored] = useState(false);
  const [utr, setUtr] = useState('');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rewards, setRewards] = useState<any[] | null>(null);
  const [verification, setVerification] = useState<any | null>(null);

  useEffect(() => {
    if (restaurant) return;
    const t = setTimeout(async () => {
      try {
        const { restaurants } = await api.restaurants(q);
        setResults(restaurants);
      } catch {}
    }, 250);
    return () => clearTimeout(t);
  }, [q, restaurant]);

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      exif: true, // EXIF GPS needed for Sprint 2 verification
    });
    if (!res.canceled && res.assets.length) setPhoto(res.assets[0]);
  };

  const submit = async () => {
    if (!restaurant || !rating) return;
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('restaurant_id', String(restaurant.id));
      form.append('rating', String(rating));
      form.append('body', body);
      if (sponsored) form.append('is_sponsored', '1');
      if (utr.trim()) form.append('utr', utr.trim());
      if (photo) {
        if (Platform.OS === 'web') {
          const blob = await (await fetch(photo.uri)).blob();
          form.append('photo', blob, photo.fileName || 'photo.jpg');
        } else {
          form.append('photo', {
            uri: photo.uri,
            name: photo.fileName || 'photo.jpg',
            type: photo.mimeType || 'image/jpeg',
          } as any);
        }
      }
      const res = await api.submitReview(form);
      setRewards(res.rewards);
      setVerification(res.verification || null);
      // reset form
      setRestaurant(null);
      setQ('');
      setRating(0);
      setBody('');
      setSponsored(false);
      setUtr('');
      setPhoto(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
      <Text style={s.h1}>New review</Text>

      {!restaurant ? (
        <>
          <TextInput
            style={s.input}
            placeholder="Where did you eat?"
            placeholderTextColor={colors.inkSoft}
            value={q}
            onChangeText={setQ}
          />
          {results.map((r) => (
            <Pressable key={r.id} style={s.card} onPress={() => setRestaurant(r)}>
              <Text style={s.cardTitle}>{r.name}</Text>
              <Text style={s.cardMeta}>
                {r.cuisine} · {r.city}
              </Text>
            </Pressable>
          ))}
        </>
      ) : (
        <>
          <View style={[s.card, { borderColor: colors.accent, borderWidth: 1 }]}>
            <Text style={s.cardTitle}>{restaurant.name}</Text>
            <Text style={s.cardMeta}>
              {restaurant.cuisine} · {restaurant.city}
            </Text>
            <Button title="Change restaurant" variant="ghost" onPress={() => setRestaurant(null)} />
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)}>
                <Text style={{ fontSize: 32, color: n <= rating ? colors.accent2 : colors.inkSoft }}>★</Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            style={[s.input, { minHeight: 90, textAlignVertical: 'top' }]}
            placeholder="How was it? (optional)"
            placeholderTextColor={colors.inkSoft}
            multiline
            value={body}
            onChangeText={setBody}
          />

          {photo ? <Image source={{ uri: photo.uri }} style={s.cardPhoto} resizeMode="cover" /> : null}
          <Button title={photo ? 'Change photo' : 'Add photo'} variant="ghost" onPress={pickPhoto} />

          <TextInput
            style={s.input}
            placeholder="UPI transaction ID (UTR, optional — boosts verification)"
            placeholderTextColor={colors.inkSoft}
            keyboardType="number-pad"
            maxLength={12}
            value={utr}
            onChangeText={setUtr}
          />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Switch
              value={sponsored}
              onValueChange={setSponsored}
              trackColor={{ true: colors.accent, false: colors.inkSoft }}
            />
            <Text style={{ color: colors.ink }}>This visit was sponsored</Text>
          </View>

          <Button
            title={busy ? 'Posting…' : 'Post review'}
            onPress={submit}
            disabled={busy || !rating}
          />
        </>
      )}
      {error ? <Text style={s.error}>{error}</Text> : null}

      <Modal transparent visible={!!rewards} animationType="fade" onRequestClose={() => setRewards(null)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <Text style={s.h1}>🎉 Posted!</Text>
            {verification ? (
              <View style={{ alignItems: 'center', gap: 4 }}>
                <TierBadge tier={verification.tier} />
                <Text style={{ color: colors.inkSoft, fontSize: 13 }}>
                  {Object.values(verification.signals || {}).filter(Boolean).length}/5 verification signals
                </Text>
              </View>
            ) : null}
            {(rewards || []).map((r, i) => (
              <Text key={i} style={{ color: colors.ink, fontSize: 16 }}>
                {r.type === 'cashback_first_post'
                  ? `₹${r.amount_inr} first-post cashback earned!`
                  : `+${r.coins} FAV Coins`}
              </Text>
            ))}
            <Button
              title="See it in the feed"
              onPress={() => {
                setRewards(null);
                onPosted();
              }}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ---------- Leaderboard ----------

function LeaderboardScreen({ user }: { user: any }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .leaderboard(user?.city || 'Bangalore')
      .then((r) => setRows(r.leaderboard))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.city]);

  if (loading) return <Loading />;
  return (
    <FlatList
      data={rows}
      keyExtractor={(r, i) => String(r.id ?? i)}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
      ListHeaderComponent={<Text style={s.h1}>Top foodies · {user?.city || 'Bangalore'}</Text>}
      renderItem={({ item, index }) => (
        <View style={[s.card, item.id === user?.id && { borderColor: colors.accent, borderWidth: 1 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={s.cardTitle}>
              #{index + 1} {item.name || `@${item.username || 'anon'}`}
            </Text>
            <Text style={{ color: colors.accent2, fontWeight: '700' }}>
              {item.posts_this_month ?? 0} posts
            </Text>
          </View>
          <Text style={s.cardMeta}>Credibility {item.credibility_score ?? 0}</Text>
        </View>
      )}
      ListEmptyComponent={<Empty text="No rankings yet this month." />}
    />
  );
}

// ---------- Profile ----------

function ProfileScreen({
  user,
  onUserUpdated,
  onLogout,
}: {
  user: any;
  onUserUpdated: (u: any) => void;
  onLogout: () => void;
}) {
  const [name, setName] = useState(user?.name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [city, setCity] = useState(user?.city || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [showRewards, setShowRewards] = useState(false);

  const save = async () => {
    setBusy(true);
    setMsg('');
    try {
      const { user: updated } = await api.updateMe({ name, username, city });
      onUserUpdated(updated);
      setMsg('Saved ✓');
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
      <Text style={s.h1}>Profile</Text>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <StatBox label="FAV Coins" value={user?.coins ?? 0} />
        <StatBox label="Credibility" value={user?.credibility_score ?? 0} />
        <StatBox label="Streak" value={`${user?.streak_days ?? 0}d`} />
      </View>
      <TextInput style={s.input} placeholder="Name" placeholderTextColor={colors.inkSoft} value={name} onChangeText={setName} />
      <TextInput style={s.input} placeholder="Username" placeholderTextColor={colors.inkSoft} autoCapitalize="none" value={username} onChangeText={setUsername} />
      <TextInput style={s.input} placeholder="City" placeholderTextColor={colors.inkSoft} value={city} onChangeText={setCity} />
      <Button title={busy ? 'Saving…' : 'Save profile'} onPress={save} disabled={busy} />
      {msg ? <Text style={{ color: colors.green, textAlign: 'center' }}>{msg}</Text> : null}
      <Button
        title={showRewards ? 'Hide rewards history' : '🪙 Rewards history'}
        variant="ghost"
        onPress={() => setShowRewards((v) => !v)}
      />
      {showRewards ? <RewardsHistory /> : null}
      <Button title="Log out" variant="ghost" onPress={onLogout} />
    </ScrollView>
  );
}

const REWARD_TYPE_LABELS: Record<string, string> = {
  cashback_first_post: '💸 First-post cashback',
  coins_post: '🪙 Post reward',
  coins_streak: '🔥 Streak bonus',
  voucher: '🎟️ Voucher',
};

function RewardsHistory() {
  const [data, setData] = useState<{ entries: any[]; totals: { inr: number; coins: number } } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.rewards().then(setData).catch((e: any) => setError(e.message));
  }, []);

  if (error) return <Empty text={error} />;
  if (!data) return <ActivityIndicator color={colors.accent} />;

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <StatBox label="Total earned" value={`₹${data.totals.inr}`} />
        <StatBox label="Coins earned" value={data.totals.coins} />
      </View>
      {data.entries.length === 0 ? (
        <Empty text="No rewards yet — post a verified review to start earning!" />
      ) : (
        data.entries.map((e) => (
          <View key={e.id} style={s.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={s.cardTitle}>{REWARD_TYPE_LABELS[e.type] || e.type}</Text>
              <Text style={{ color: colors.green, fontWeight: '800' }}>
                {Number(e.amount_inr) > 0 ? `₹${Number(e.amount_inr)}` : `+${e.coins} FAV`}
              </Text>
            </View>
            {e.note ? <Text style={s.cardMeta}>{e.note}</Text> : null}
            <Text style={s.cardMeta}>{new Date(e.created_at).toLocaleString()}</Text>
          </View>
        ))
      )}
    </View>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={[s.card, { flex: 1, alignItems: 'center' }]}>
      <Text style={{ color: colors.accent, fontSize: 20, fontWeight: '800' }}>{value}</Text>
      <Text style={s.cardMeta}>{label}</Text>
    </View>
  );
}

// ---------- shared bits ----------

function Loading() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator color={colors.accent} size="large" />
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return <Text style={{ color: colors.inkSoft, textAlign: 'center', padding: spacing.lg }}>{text}</Text>;
}

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'feed', label: 'Feed', icon: '🍽️' },
  { key: 'search', label: 'Search', icon: '🔎' },
  { key: 'post', label: 'Post', icon: '＋' },
  { key: 'leaderboard', label: 'Ranks', icon: '🏆' },
  { key: 'profile', label: 'Profile', icon: '👤' },
];

// ---------- root ----------

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [booting, setBooting] = useState(true);
  const [tab, setTab] = useState<Tab>('feed');
  const [feedKey, setFeedKey] = useState(0); // bump to force feed reload after posting

  // Auto-login from stored token
  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem(TOKEN_KEY);
        if (token) {
          setToken(token);
          const { user } = await api.me();
          setUser(user);
        }
      } catch {
        setToken(null);
        await AsyncStorage.removeItem(TOKEN_KEY);
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  const onLogin = async (token: string, u: any) => {
    setToken(token);
    await AsyncStorage.setItem(TOKEN_KEY, token);
    setUser(u);
  };

  const onLogout = async () => {
    setToken(null);
    await AsyncStorage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  const refreshUser = useCallback(() => {
    api.me().then((r) => setUser(r.user)).catch(() => {});
  }, []);

  if (booting) {
    return (
      <SafeAreaView style={s.root}>
        <Loading />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={s.root}>
        <StatusBar style="dark" />
        <AuthScreen onLogin={onLogin} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <StatusBar style="dark" />
      <View style={s.header}>
        <Text style={s.headerLogo}>Faven</Text>
        <Text style={s.headerCoins}>🪙 {user.coins ?? 0} FAV</Text>
      </View>
      <View style={{ flex: 1 }}>
        {tab === 'feed' && <FeedScreen key={feedKey} />}
        {tab === 'search' && <SearchScreen />}
        {tab === 'post' && (
          <PostScreen
            onPosted={() => {
              refreshUser();
              setFeedKey((k) => k + 1);
              setTab('feed');
            }}
          />
        )}
        {tab === 'leaderboard' && <LeaderboardScreen user={user} />}
        {tab === 'profile' && <ProfileScreen user={user} onUserUpdated={setUser} onLogout={onLogout} />}
      </View>
      <View style={s.tabBar}>
        {TABS.map((t) => (
          <Pressable key={t.key} style={s.tabItem} onPress={() => setTab(t.key)}>
            <Text style={{ fontSize: 18 }}>{t.icon}</Text>
            <Text style={[s.tabLabel, tab === t.key && { color: colors.accent, fontWeight: '700' }]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

// ---------- styles ----------

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.paper2,
    borderBottomWidth: 1,
    borderBottomColor: colors.accentTint,
  },
  headerLogo: { fontSize: 22, fontWeight: '800', color: colors.accentInk },
  headerCoins: { fontSize: 16, color: colors.ink, fontWeight: '600' },
  authWrap: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  logo: { fontSize: 44, fontWeight: '800', color: colors.accentInk, textAlign: 'center' },
  tagline: { color: colors.inkSoft, textAlign: 'center', marginBottom: spacing.lg },
  input: {
    backgroundColor: colors.paper2,
    borderWidth: 1,
    borderColor: colors.accentTint,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.ink,
  },
  btn: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  btnGhost: { backgroundColor: 'transparent' },
  btnText: { color: colors.paper2, fontWeight: '700', fontSize: 16 },
  error: { color: colors.accentInk, textAlign: 'center' },
  h1: { fontSize: 24, fontWeight: '800', color: colors.ink },
  card: {
    backgroundColor: colors.paper2,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
    shadowColor: colors.espresso,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  cardMeta: { fontSize: 13, color: colors.inkSoft },
  cardBody: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  cardPhoto: { width: '100%', height: 200, borderRadius: radius.sm, marginVertical: spacing.xs },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badgeText: { color: colors.paper2, fontSize: 11, fontWeight: '700' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.paper2,
    borderTopWidth: 1,
    borderTopColor: colors.accentTint,
    paddingBottom: Platform.OS === 'ios' ? spacing.sm : 0,
  },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm },
  tabLabel: { fontSize: 11, color: colors.inkSoft },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(27,21,28,0.55)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.paper2,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    alignItems: 'center',
  },
});
