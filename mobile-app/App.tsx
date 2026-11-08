import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { Hermenegildo } from './src/components/Hermenegildo';
import { PastelBackground } from './src/components/PastelBackground';
import { TabBar, type TabKey } from './src/components/ui';
import { AuthenticatorScreen } from './src/screens/AuthenticatorScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { VaultScreen } from './src/screens/VaultScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { colors, gradients, rounded } from './src/theme/theme';

function Root() {
  const { status } = useAuth();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<TabKey>('home');

  // Al cerrar sesión (manual o por refresh vencido) se vuelve a Inicio para la próxima vez.
  useEffect(() => {
    if (status === 'signedOut') setTab('home');
  }, [status]);

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <PastelBackground colors={tab === 'vault' && status === 'signedIn' ? gradients.vault : gradients.sky} />

      {status === 'booting' && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Hermenegildo size={150} mood="wink" />
          <Text style={{ fontFamily: rounded, fontWeight: '800', color: colors.soft }}>Abriendo la carpa…</Text>
        </View>
      )}

      {status === 'signedOut' && <WelcomeScreen />}

      {status === 'signedIn' && (
        <>
          {tab === 'home' && <HomeScreen key="home" />}
          {tab === 'auth' && <AuthenticatorScreen key="auth" />}
          {tab === 'vault' && <VaultScreen key="vault" />}
          <TabBar active={tab} onChange={setTab} bottomInset={insets.bottom} />
        </>
      )}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
