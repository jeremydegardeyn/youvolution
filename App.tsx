import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useAuth } from './src/hooks/useAuth';
import { useProfile } from './src/hooks/useProfile';
import { Colors } from './src/constants/colors';

import AuthScreen from './src/screens/AuthScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import HomeScreen from './src/screens/HomeScreen';
import CoachScreen from './src/screens/CoachScreen';
import ProgressScreen from './src/screens/ProgressScreen';
import { UserProfile } from './src/types';

const Tab = createBottomTabNavigator();

export default function App() {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, updateProfile, refetch } = useProfile(user?.id);

  if (authLoading || (user && profileLoading)) {
    return <View style={styles.splash} />;
  }

  if (!user) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar barStyle="light-content" />
          <AuthScreen />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  if (!profile?.onboarding_complete) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar barStyle="dark-content" />
          <OnboardingScreen
            userId={user.id}
            onComplete={async (data) => {
              await updateProfile({
                ...data,
                email: user.email ?? '',
                onboarding_complete: true,
              } as Partial<UserProfile>);
              await refetch();
            }}
          />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" />
        <NavigationContainer>
          <Tab.Navigator
            screenOptions={({ route }) => ({
              tabBarIcon: ({ focused, color, size }) => {
                const icons: Record<string, string> = {
                  Home: focused ? 'home' : 'home-outline',
                  Coach: focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline',
                  Progress: focused ? 'trending-up' : 'trending-up-outline',
                };
                return <Ionicons name={icons[route.name] as any} size={size} color={color} />;
              },
              tabBarActiveTintColor: Colors.primary,
              tabBarInactiveTintColor: Colors.textMuted,
              tabBarStyle: {
                backgroundColor: Colors.surface,
                borderTopColor: Colors.border,
                paddingBottom: 4,
                height: 60,
              },
              tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
              headerStyle: { backgroundColor: Colors.surface },
              headerTitleStyle: { fontWeight: '700', color: Colors.text },
              headerShadowVisible: false,
            })}
          >
            <Tab.Screen name="Home" options={{ title: 'Today' }}>
              {() => <HomeScreen profile={profile!} onChatPress={() => {}} />}
            </Tab.Screen>
            <Tab.Screen name="Coach" options={{ title: 'Coach' }}>
              {() => <CoachScreen profile={profile!} />}
            </Tab.Screen>
            <Tab.Screen name="Progress" options={{ title: 'Progress' }}>
              {() => <ProgressScreen profile={profile!} onProfileUpdate={refetch} />}
            </Tab.Screen>
          </Tab.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: Colors.primary },
});
