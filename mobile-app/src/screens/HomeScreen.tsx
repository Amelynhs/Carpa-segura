import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ACCESS_TTL_SECONDS } from '../config';
import { useAuth } from '../auth/AuthContext';
import { Hermenegildo, type Mood } from '../components/Hermenegildo';
import { Body, Chip, CountdownRing, EventTimeline, FadeIn, GlassCard, H1, Label, PastelButton } from '../components/ui';
import { colors, mono, rounded } from '../theme/theme';

function useNow(ms = 500) {
  const [n, setN] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setN(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return n;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s % 60)).padStart(2, '0')}`;

export function HomeScreen() {
  const { accessExpiresAt, elevated, events, api, log, signOut, forceExpireAccessToken } = useAuth();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const [running, setRunning] = useState(false);

  const accessLeft = accessExpiresAt ? Math.max(0, Math.round((accessExpiresAt - now) / 1000)) : 0;
  const elevLeft = elevated ? Math.max(0, Math.round((elevated.expiresAt - now) / 1000)) : 0;
  const mood: Mood = accessLeft === 0 ? 'shock' : 'happy';

  /** Tres peticiones simultáneas con el token muerto → UNA sola renovación (Silent Refresh Queue). */
  async function burst() {
    setRunning(true);
    log('info', 'Disparando 3 peticiones concurrentes…');
    try {
      const r = await Promise.all([api.request('/api/perfil'), api.request('/api/perfil'), api.request('/api/perfil')]);
      log('ok', `Respuestas finales: ${r.map((x) => x.status).join(' · ')}`);
    } catch (e: any) {
      log('error', e?.message ?? 'Falló la ráfaga');
    } finally {
      setRunning(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 140, gap: 16 }} showsVerticalScrollIndicator={false}>
      <FadeIn style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Hermenegildo size={92} mood={mood} />
        <View style={{ flex: 1 }}>
          <Label>Sesión activa</Label>
          <H1>¡Bienvenido a la carpa!</H1>
          <Chip text="estudiante@unisabana.edu.co" bg={colors.lav} fg={colors.ink} style={{ marginTop: 6 }} />
        </View>
      </FadeIn>

      {/* Tokens */}
      <FadeIn delay={100}>
        <GlassCard>
          <Label>Ciclo de vida de los tokens</Label>
          <View style={{ flexDirection: 'row', gap: 14, marginTop: 14 }}>
            <View style={{ flex: 1, backgroundColor: colors.infoBg, borderRadius: 22, padding: 14, alignItems: 'center' }}>
              <CountdownRing progress={accessLeft / ACCESS_TTL_SECONDS} size={74} label={fmt(accessLeft)} warnBelow={0.2} />
              <Text style={{ fontFamily: rounded, fontWeight: '800', color: colors.ink, marginTop: 8 }}>access_token</Text>
              <Text style={{ fontFamily: rounded, fontSize: 11.5, color: colors.soft, textAlign: 'center' }}>solo en RAM · 5 min</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: colors.okBg, borderRadius: 22, padding: 14, alignItems: 'center' }}>
              <View style={{ width: 74, height: 74, borderRadius: 37, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 34 }}>🔐</Text>
              </View>
              <Text style={{ fontFamily: rounded, fontWeight: '800', color: colors.ink, marginTop: 8 }}>refresh_token</Text>
              <Text style={{ fontFamily: rounded, fontSize: 11.5, color: colors.soft, textAlign: 'center' }}>Keychain / Keystore · 30 d</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, backgroundColor: elevated ? colors.pink : '#f4effb', borderRadius: 18, padding: 12 }}>
            <Text style={{ fontFamily: rounded, fontWeight: '800', color: colors.ink }}>{elevated ? '⚡ Sesión elevada (MFA)' : '🔒 Sin elevación MFA'}</Text>
            <Text style={{ fontFamily: mono, fontWeight: '700', color: colors.ink }}>{elevated ? fmt(elevLeft) : '—'}</Text>
          </View>
        </GlassCard>
      </FadeIn>

      {/* Laboratorio de Silent Refresh */}
      <FadeIn delay={200}>
        <GlassCard>
          <Label>Laboratorio · Silent Refresh Queue</Label>
          <Body style={{ marginTop: 6 }}>
            Invalida el access_token en memoria y lanza 3 peticiones a la vez. Verás una única renovación y las 3 reintentadas, sin que cierres sesión.
          </Body>
          <View style={{ gap: 10, marginTop: 14 }}>
            <PastelButton title="1 · Vencer el access_token" icon="⏳" variant="sunset" onPress={forceExpireAccessToken} />
            <PastelButton title="2 · Disparar 3 peticiones" icon="🚀" variant="mint" onPress={burst} loading={running} />
          </View>
        </GlassCard>
      </FadeIn>

      <FadeIn delay={300}>
        <GlassCard>
          <Label>Bitácora de seguridad</Label>
          <View style={{ marginTop: 12 }}>
            <EventTimeline events={events} max={10} />
          </View>
        </GlassCard>
      </FadeIn>

      <PastelButton title="Cerrar sesión" variant="ghost" icon="👋" onPress={signOut} />
    </ScrollView>
  );
}
