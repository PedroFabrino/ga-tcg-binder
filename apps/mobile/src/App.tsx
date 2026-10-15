import { useEffect } from "react";
import { DarkTheme, NavigationContainer, type Theme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import * as ScreenOrientation from "expo-screen-orientation";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BottomTabBar, type TabName } from "./components/layout/BottomTabBar";
import { BinderPreview } from "./components/suite/BinderPreview";
import { DecksPreview, FriendsPreview, MetaPreview } from "./components/suite/SuiteScreens";
import { ScannerScreen } from "./screens/ScannerScreen";
import { colors } from "./theme";

const Tab = createBottomTabNavigator<Record<TabName, undefined>>();

const theme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.emerald,
    background: colors.background,
    card: colors.background,
    border: colors.border,
    text: colors.text,
  },
};

export default function App() {
  useEffect(() => {
    // Lock strictly to standard Portrait (disables upside-down reverse portrait & landscape)
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={theme}>
        <StatusBar style="light" />
        <Tab.Navigator screenOptions={{ headerShown: false, lazy: true }} tabBar={(props) => <BottomTabBar {...props} />}>
          <Tab.Screen name="Scanner" component={ScannerScreen} />
          <Tab.Screen name="Binder" component={BinderPreview} />
          <Tab.Screen name="Decks" component={DecksPreview} />
          <Tab.Screen name="Meta" component={MetaPreview} />
          <Tab.Screen name="Friends" component={FriendsPreview} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
