import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <ThemeProvider>
      <AuthProvider>
        <NavThemeProvider value={DarkTheme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="log-climb" options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="log-workout" options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="calendar" options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="stat-detail" options={{ headerShown: false, presentation: 'modal' }} />
            {/*
              Future auth providers — add screens here:
              - Google Sign-In:  <Stack.Screen name="(auth)/google-callback" ... />
              - Phone Auth:      <Stack.Screen name="(auth)/phone" ... />
                                 <Stack.Screen name="(auth)/phone-verify" ... />
              The AuthProvider in contexts/AuthContext.tsx is structured to accept
              additional signIn methods alongside existing email/password.
            */}
            <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          </Stack>
        </NavThemeProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
