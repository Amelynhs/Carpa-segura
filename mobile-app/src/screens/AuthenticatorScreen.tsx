import React, { useEffect, useState } from 'react';
import { Alert, Dimensions, NativeScrollEvent, NativeSyntheticEvent, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useAccounts } from '../auth/useAccounts';
import { useTotp } from '../auth/useTotp';
import type { TotpAccount } from '../auth/secureStorage';
import { explainTotp } from '../crypto/native';
import type { TotpDebug } from '../crypto/primitives';
import { Hermenegildo } from '../components/Hermenegildo';
import { Body, Chip, CountdownRing, FadeIn, GlassCard, H1, Label, PastelButton } from '../components/ui';
import { colors, gradients, mono, radii, rounded } from '../theme/theme';
import { ScannerModal } from './ScannerModal';

const CARD_W = Dimensions.get('window').width - 40;
const DEMO_SEED = 'JBSWY3DPEHPK3PXP';

const group = (c: string) => `${c.slice(0, 3)} ${c.slice(3)}`;

function AccountCard({ acc, onLongPress }: { acc: TotpAccount; onLongPress: () => void }) {
  const { code, remaining, progress } = useTotp(acc.secret);
  const hot = remaining <= 5;
  return (
    <View style={{ width: CARD_W, paddingRight: 12 }}>
      <LinearGradient colors={hot ? (['#ffe1e8', '#ffd3b8'] as const) : gradients.vault} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radii.xl, padding: 22, borderWidth: 3, borderColor: '#fff' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Label>{acc.issuer}</Label>
            <Text onLongPress={onLongPress} style={{ fontFamily: rounded, fontWeight: '700', color: colors.ink, fontSize: 14, marginTop: 2 }} numberOfLines={1}>
              {acc.label}
            </Text>
          </View>
          <CountdownRing progress={progress} size={58} stroke={6} label={String(remaining)} />
        </View>
        <Text
          accessibilityLabel={`Código ${code.split('').join(' ')}`}
          style={{ fontFamily: mono, fontSize: 52, fontWeight: '700', letterSpacing: 4, color: hot ? colors.danger : colors.ink, textAlign: 'center', marginVertical: 20 }}
          adjustsFontSizeToFit
          numberOfLines={1}
        >
          {code === '------' ? '--- ---' : group(code)}
        </Text>
        {/* barra de progreso lineal */}
        <View style={{ height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.75)', overflow: 'hidden' }}>
          <LinearGradient colors={hot ? (['#ff8fb1', '#ffb199'] as const) : (['#a98be8', '#6fcaa5'] as const)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 10, width: `${progress * 100}%`, borderRadius: 5 }} />
        </View>
      </LinearGradient>
    </View>
  );
}

function XRay({ secret }: { secret: string }) {
  const { code } = useTotp(secret);
  const [d, setD] = useState<TotpDebug | null>(null);
  useEffect(() => {
    explainTotp(secret).then(setD).catch(() => setD(null));
  }, [secret, code]);
  if (!d) return null;
  const hl = d.hmacHex.split('');
  const off = d.offset * 2;
  const row = (k: string, v: string, tint?: string) => (
    <View style={{ marginTop: 10 }}>
      <Label>{k}</Label>
      <Text selectable style={{ fontFamily: mono, fontSize: 12, color: colors.ink, backgroundColor: tint ?? '#f7f1ff', padding: 8, borderRadius: 12, marginTop: 4 }}>
        {v}
      </Text>
    </View>
  );
  return (
    <GlassCard>
      <Label>Rayos X · RFC 6238 paso a paso</Label>
      {row('1 · T = floor(unix / 30)', `${d.counter}  →  0x${d.counterHex}  (8 bytes Big-Endian)`)}
      <View style={{ marginTop: 10 }}>
        <Label>2 · H = HMAC-SHA1(secreto, T) · 20 bytes</Label>
        <Text style={{ fontFamily: mono, fontSize: 12, backgroundColor: '#f7f1ff', padding: 8, borderRadius: 12, marginTop: 4, color: colors.faint }}>
          {hl.slice(0, off).join('')}
          <Text style={{ backgroundColor: colors.butter, color: colors.ink, fontWeight: '800' }}>{hl.slice(off, off + 8).join('')}</Text>
          {hl.slice(off + 8, 38).join('')}
          <Text style={{ backgroundColor: colors.pink, color: colors.ink, fontWeight: '800' }}>{hl.slice(38).join('')}</Text>
        </Text>
        <Body style={{ fontSize: 12, marginTop: 4 }}>
          <Text style={{ color: '#c9962a', fontWeight: '800' }}>amarillo</Text> = 4 bytes extraídos · <Text style={{ color: colors.pinkDeep, fontWeight: '800' }}>rosa</Text> = último byte (define el offset)
        </Body>
      </View>
      {row('3 · offset = H[19] & 0x0F', `${d.offset}`)}
      {row('4 · bin_code (31 bits)', `${d.binCode}`)}
      {row('5 · TOTP = bin_code % 1 000 000', d.code, colors.okBg)}
    </GlassCard>
  );
}

export function AuthenticatorScreen() {
  const insets = useSafeAreaInsets();
  const { accounts, ready, addFromUri, addFromSeed, remove } = useAccounts();
  const [seed, setSeed] = useState('');
  const [label, setLabel] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [page, setPage] = useState(0);

  const active = accounts[Math.min(page, accounts.length - 1)];

  async function addManual() {
    setErr(null);
    try {
      await addFromSeed(seed, 'UniSabana', label.trim() || 'Cuenta manual');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSeed('');
      setLabel('');
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErr(e?.message ?? 'Semilla inválida');
    }
  }

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / CARD_W));

  return (
    <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 150, gap: 16 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <FadeIn style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20 }}>
        <Hermenegildo size={84} mood="cool" />
        <View style={{ flex: 1 }}>
          <Label>Authenticator propio</Label>
          <H1>Códigos de un solo uso</H1>
          <Chip text="✈  Funciona en Modo Avión" bg={colors.sky} fg="#2d5f8a" style={{ marginTop: 6 }} />
        </View>
      </FadeIn>

      {ready && accounts.length > 0 && (
        <FadeIn delay={80}>
          <ScrollView horizontal pagingEnabled={false} snapToInterval={CARD_W} decelerationRate="fast" showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20, paddingRight: 8 }} onMomentumScrollEnd={onScroll}>
            {accounts.map((a) => (
              <AccountCard
                key={a.id}
                acc={a}
                onLongPress={() =>
                  Alert.alert('Eliminar cuenta', `¿Quitar ${a.label} del Authenticator?`, [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Eliminar', style: 'destructive', onPress: () => remove(a.id) },
                  ])
                }
              />
            ))}
          </ScrollView>
          {accounts.length > 1 && (
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 }}>
              {accounts.map((a, i) => (
                <View key={a.id} style={{ width: i === page ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i === page ? colors.lavDeep : colors.lav }} />
              ))}
            </View>
          )}
        </FadeIn>
      )}

      <View style={{ paddingHorizontal: 20, gap: 16 }}>
        {ready && accounts.length === 0 && (
          <FadeIn delay={80}>
            <GlassCard style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 40 }}>🎟️</Text>
              <Text style={{ fontFamily: rounded, fontWeight: '800', fontSize: 18, color: colors.ink, marginTop: 6 }}>Aún no tienes cuentas</Text>
              <Body style={{ textAlign: 'center', marginTop: 4 }}>Escanea el QR del backend o pega la semilla Base32. La semilla se guarda cifrada en el Keychain/Keystore.</Body>
            </GlassCard>
          </FadeIn>
        )}

        <FadeIn delay={160}>
          <GlassCard>
            <Label>Agregar cuenta</Label>
            <PastelButton title="Escanear QR (otpauth://)" icon="📷" onPress={() => setScanning(true)} style={{ marginTop: 12 }} />
            <Text style={{ textAlign: 'center', color: colors.faint, fontFamily: rounded, fontWeight: '800', marginVertical: 10 }}>— o pega la semilla —</Text>
            <TextInput
              value={seed}
              onChangeText={(t) => {
                setSeed(t.toUpperCase());
                setErr(null);
              }}
              placeholder="JBSWY3DPEHPK3PXP"
              placeholderTextColor={colors.faint}
              autoCapitalize="characters"
              autoCorrect={false}
              spellCheck={false}
              style={{ fontFamily: mono, fontSize: 16, color: colors.ink, backgroundColor: colors.cream, borderRadius: radii.md, borderWidth: 2.5, borderColor: err ? colors.pinkDeep : '#eadff9', padding: 14 }}
            />
            <TextInput
              value={label}
              onChangeText={setLabel}
              placeholder="Etiqueta (opcional)"
              placeholderTextColor={colors.faint}
              style={{ fontFamily: rounded, fontSize: 15, color: colors.ink, backgroundColor: colors.cream, borderRadius: radii.md, borderWidth: 2.5, borderColor: '#eadff9', padding: 14, marginTop: 10 }}
            />
            {err && <Text style={{ color: colors.danger, fontFamily: rounded, marginTop: 8, fontSize: 13 }}>{err}</Text>}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <PastelButton title="Semilla demo" variant="ghost" style={{ flex: 1 }} onPress={() => setSeed(DEMO_SEED)} />
              <PastelButton title="Agregar" variant="mint" style={{ flex: 1 }} onPress={addManual} disabled={seed.length < 16} />
            </View>
          </GlassCard>
        </FadeIn>

        {active && (
          <FadeIn delay={240}>
            <XRay secret={active.secret} />
          </FadeIn>
        )}
      </View>

      <ScannerModal visible={scanning} onClose={() => setScanning(false)} onUri={async (u) => void (await addFromUri(u))} />
    </ScrollView>
  );
}
