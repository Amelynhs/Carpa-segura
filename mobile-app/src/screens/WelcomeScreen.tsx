import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { OAuthCancelled } from '../auth/oauth';
import { CircusTent } from '../components/CircusTent';
import { Hermenegildo, type Mood } from '../components/Hermenegildo';
import { Body, Chip, FadeIn, GlassCard, H1, PastelButton } from '../components/ui';
import { API_URL, REDIRECT_URI } from '../config';
import { colors, rounded } from '../theme/theme';

const FEATURES = [
  { t: 'OAuth 2.0 + PKCE', bg: colors.lav, fg: colors.ink },
  { t: 'Keychain / Keystore', bg: colors.mint, fg: '#2f6b55' },
  { t: 'TOTP RFC 6238', bg: colors.pink, fg: '#9a3a63' },
  { t: 'Step-Up 2FA', bg: colors.sky, fg: '#2d5f8a' },
];

export function WelcomeScreen() {
  const { signIn, signInStep, bootNotice } = useAuth();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mood: Mood = error ? 'sad' : busy ? 'wink' : 'happy';

  async function go() {
    setError(null);
    setBusy(true);
    try {
      await signIn();
    } catch (e: any) {
      if (!(e instanceof OAuthCancelled)) setError(e?.message ?? 'No se pudo iniciar sesión');
      else setError('No se completó el regreso a la app. Si cerraste el navegador, reintenta; si no, revisa los datos de conexión de abajo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32, alignItems: 'center' }} showsVerticalScrollIndicator={false}>
      <FadeIn>
        <CircusTent width={310} />
      </FadeIn>
      <FadeIn delay={150} style={{ marginTop: -62, zIndex: 2 }}>
        <Hermenegildo size={150} mood={mood} />
      </FadeIn>

      <FadeIn delay={300} style={{ width: '100%', paddingHorizontal: 22, marginTop: 6 }}>
        <GlassCard style={{ alignItems: 'center', paddingTop: 22 }}>
          <Text style={{ fontFamily: rounded, fontSize: 12, fontWeight: '800', letterSpacing: 2, color: colors.lavDeep }}>UNIVERSIDAD DE LA SABANA</Text>
          <H1 style={{ textAlign: 'center', marginTop: 6 }}>La Carpa Segura</H1>
          <Body style={{ textAlign: 'center', marginTop: 8 }}>
            Hermenegildo custodia tus llaves. Inicias sesión en el navegador del sistema: tu contraseña nunca pasa por esta app.
          </Body>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 16 }}>
            {FEATURES.map((f) => (
              <Chip key={f.t} text={f.t} bg={f.bg} fg={f.fg} />
            ))}
          </View>

          {(error || bootNotice) && (
            <View style={{ backgroundColor: error ? colors.dangerBg : colors.warnBg, padding: 12, borderRadius: 16, marginTop: 16, width: '100%' }}>
              <Text style={{ fontFamily: rounded, color: error ? colors.danger : '#8a6a12', textAlign: 'center', fontSize: 13.5 }}>{error ?? bootNotice}</Text>
            </View>
          )}

          <PastelButton title="Iniciar sesión" icon="✨" onPress={go} loading={busy} style={{ width: '100%', marginTop: 20 }} />
          {busy && signInStep && (
            <FadeIn>
              <Text style={{ fontFamily: rounded, color: colors.soft, fontSize: 12.5, marginTop: 12 }}>⟳ {signInStep}</Text>
              <Text style={{ fontFamily: rounded, color: colors.faint, fontSize: 11.5, marginTop: 6, textAlign: 'center' }}>
                Si el navegador no vuelve solo tras iniciar sesión, regresa con «atrás» o cambiando de app: la sesión se completa sola.
              </Text>
            </FadeIn>
          )}
        </GlassCard>
        <Text style={{ textAlign: 'center', marginTop: 16, color: colors.soft, fontFamily: rounded, fontSize: 12 }}>
          Cliente público · sin client_secret · code_challenge S256
        </Text>
        <Text selectable style={{ textAlign: 'center', marginTop: 8, color: colors.faint, fontSize: 10.5 }}>
          API: {API_URL}{'\n'}Redirect: {REDIRECT_URI}
        </Text>
      </FadeIn>
    </ScrollView>
  );
}
