import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from 'styled-components/native';

import { AppProvider, useApp } from '@/context/AppContext';
import { darkTheme, lightTheme } from '@/theme/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});
if (Platform.OS === 'web') {
  import('expo-web-browser')
    .then((WebBrowser) => WebBrowser.maybeCompleteAuthSession())
    .catch(() => {});
}

function Navigator() {
  const { ready, session } = useApp();

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  const isLoggedIn = !!session;

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Protected guard={!isLoggedIn}>
        <Stack.Screen name="login" options={{ animation: 'fade' }} />
        <Stack.Screen name="signup" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="auth/confirm" options={{ animation: 'fade' }} />
        <Stack.Screen name="auth/google" options={{ animation: 'fade' }} />
      </Stack.Protected>
      <Stack.Protected guard={isLoggedIn}>
        <Stack.Screen name="index" />
        <Stack.Screen name="quiz/[documentId]" />
        <Stack.Screen name="settings" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack.Protected>
      {/* Redefinição de senha pode ser aberta mesmo já autenticado */}
      <Stack.Screen name="reset-password" options={{ animation: 'fade' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? darkTheme : lightTheme;

  return (
    <SafeAreaProvider>
      <ThemeProvider theme={theme}>
        <AppProvider>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <Navigator />
        </AppProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

