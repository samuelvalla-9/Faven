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
import { colors, radius, spacing, tierColors, tierLabels, tierTextColors, typeScale } from './src/theme';

const TOKEN_KEY = 'faven.token';

type Tab = 'feed' | 'search' | 'post' | 'leaderboard' | 'profile';

// ---------- helpers ----------

function photoUri(url?: string | null): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : `${BASE_URL}${url}`;
}

function Stars({ rating }: { rating: number }) {
  return (
    <Text style={{ color: colors.accent2Ink, fontSize: 14 }}>
      {'★'.repeat(Math.round(rating))}
      <Text style={{ color: colors.inkSoft }}>{'★'.repeat(5 - Math.round(rating))}</Text>
    </Text>
  );
}

function TierBadge({ tier, sponsored }: { tier: string; sponsored?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.xs }}>
      <View style={[s.badge, { backgroundColor: tierColors[tier] || colors.inkSoft }]}>
        <Text style={[s.badgeText, { color: tierTextColors[tier] || colors.paper2 }]}>{tierLabels[tier] || tier}</Text>
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
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const { reviews } = await api.feed();
      setReviews(reviews);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Network error');
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  if (loading) return <SkeletonCards photo />;
  if (error && reviews.length === 0)
    return (
      <ErrorState
        onRetry={() => {
          setLoading(true);
          load().finally(() => setLoading(false));
        }}
      />
    );
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
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [detail, setDetail] = useState<{ restaurant: any; reviews: any[] } | null>(null);
  const [detailError, setDetailError] = useState('');

  useEffect(() => {
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const { restaurants } = await api.restaurants(q);
        setResults(restaurants);
        setError('');
      } catch (e: any) {
        setError(e.message || 'Network error');
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!selected) return setDetail(null);
    setDetailError('');
    api.restaurant(selected.id).then(setDetail).catch((e: any) => setDetailError(e.message || 'Network error'));
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
        {detailError ? (
          <ErrorState message={detailError} onRetry={() => setSelected({ ...selected })} />
        ) : detail ? (
          detail.reviews.length ? (
            detail.reviews.map((r) => <ReviewCard key={r.id} review={r} showRestaurant={false} />)
          ) : (
            <Empty text="No reviews yet for this spot." />
          )
        ) : (
          <SkeletonCards count={2} />
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
        ListEmptyComponent={
          error ? (
            <ErrorState message={error} onRetry={() => setQ((v) => v + '')} />
          ) : searching ? (
            <Empty text="Searching…" />
          ) : (
            <Empty text="No matches — try another search." />
          )
        }
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

function RankMovement({ movement, prevRank }: { movement: number | null; prevRank: number | null }) {
  if (prevRank == null) return <Text style={{ color: colors.accent2Ink, fontWeight: '700' }}>NEW</Text>;
  if (!movement) return <Text style={{ color: colors.inkSoft }}>—</Text>;
  const up = movement > 0;
  return (
    <Text style={{ color: up ? colors.green : colors.accent, fontWeight: '700' }}>
      {up ? '▲' : '▼'} {Math.abs(movement)}
    </Text>
  );
}

function LeaderboardScreen({ user }: { user: any }) {
  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState<{ month?: string; resets_in_days?: number }>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await api.leaderboard(user?.city || 'Bangalore');
      setRows(r.leaderboard);
      setMeta({ month: r.month, resets_in_days: r.resets_in_days });
      setError('');
    } catch (e: any) {
      setError(e.message || 'Network error');
    }
  }, [user?.city]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  if (loading) return <SkeletonCards />;
  if (error && rows.length === 0)
    return (
      <ErrorState
        onRetry={() => {
          setLoading(true);
          load().finally(() => setLoading(false));
        }}
      />
    );
  return (
    <FlatList
      data={rows}
      keyExtractor={(r, i) => String(r.id ?? i)}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
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
      ListHeaderComponent={
        <View style={{ gap: spacing.xs, marginBottom: spacing.sm }}>
          <Text style={s.h1}>Top foodies · {user?.city || 'Bangalore'}</Text>
          {meta.month ? (
            <Text style={s.cardMeta}>
              {meta.month} season · resets in {meta.resets_in_days} day
              {meta.resets_in_days === 1 ? '' : 's'}
            </Text>
          ) : null}
        </View>
      }
      renderItem={({ item }) => {
        const isMe = item.id === user?.id;
        return (
          <View
            style={[
              s.card,
              isMe && { borderColor: colors.accent, borderWidth: 2, backgroundColor: colors.accentTint },
            ]}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={s.cardTitle}>
                #{item.rank} {item.name || `@${item.username || 'anon'}`}
                {isMe ? '  (you)' : ''}
              </Text>
              <RankMovement movement={item.movement} prevRank={item.prev_rank} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={s.cardMeta}>Credibility {item.credibility_score ?? 0}</Text>
              <Text style={{ color: colors.accent2Ink, fontWeight: '700' }}>
                {item.posts_this_month ?? 0} posts · {item.fully_verified ?? 0} verified
              </Text>
            </View>
          </View>
        );
      }}
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

  const load = useCallback(() => {
    setError('');
    api.rewards().then(setData).catch((e: any) => setError(e.message || 'Network error'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
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
      <Text style={{ color: colors.accentInk, fontSize: 20, fontWeight: '800' }}>{value}</Text>
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

// Card-shaped loading skeleton (static shimmer-free placeholder — respects reduced motion)
function SkeletonCards({ count = 3, photo = false }: { count?: number; photo?: boolean }) {
  return (
    <View style={{ padding: spacing.md, gap: spacing.md }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={s.card} accessibilityLabel="Loading…">
          <View style={[s.skelLine, { width: '55%' }]} />
          <View style={[s.skelLine, { width: '35%' }]} />
          {photo ? <View style={[s.cardPhoto, { backgroundColor: colors.accentTint }]} /> : null}
          <View style={[s.skelLine, { width: '85%' }]} />
        </View>
      ))}
    </View>
  );
}

function ErrorState({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <View style={{ alignItems: 'center', padding: spacing.lg, gap: spacing.sm }}>
      <Text style={{ fontSize: 32 }}>🍲</Text>
      <Text style={{ color: colors.ink, fontWeight: '700' }}>Something went cold</Text>
      <Text style={{ color: colors.inkSoft, textAlign: 'center' }}>
        {message || "We couldn't reach the kitchen. Check your connection and try again."}
      </Text>
      <Button title="Try again" variant="ghost" onPress={onRetry} />
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
      <View style={s.tabBar} accessibilityRole="tablist">
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            style={s.tabItem}
            onPress={() => setTab(t.key)}
            accessibilityRole="tab"
            accessibilityLabel={t.label}
            accessibilityState={{ selected: tab === t.key }}
          >
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
  logo: { ...typeScale.display, color: colors.accentInk, textAlign: 'center' },
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
    // accentInk (6.0:1 with white text) instead of accent (3.76:1) — WCAG AA
    backgroundColor: colors.accentInk,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  btnGhost: { backgroundColor: 'transparent' },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: typeScale.body.fontSize },
  error: { color: colors.accentInk, textAlign: 'center' },
  skelLine: {
    height: 14,
    borderRadius: radius.sm ?? 6,
    backgroundColor: colors.accentTint,
    marginVertical: 2,
  },
  h1: { ...typeScale.h1, color: colors.ink },
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
  cardTitle: { fontSize: typeScale.body.fontSize, fontWeight: '700', color: colors.ink },
  cardMeta: { ...typeScale.meta, color: colors.inkSoft },
  cardBody: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  cardPhoto: { width: '100%', height: 200, borderRadius: radius.sm, marginVertical: spacing.xs },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badgeText: { color: colors.paper2, fontSize: typeScale.badge.fontSize, fontWeight: typeScale.badge.fontWeight },
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
