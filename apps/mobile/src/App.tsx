import { DarkTheme, NavigationContainer, type Theme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BottomTabBar, type TabName } from "./components/layout/BottomTabBar";
import { BinderPreview } from "./components/suite/BinderPreview";
import { DecksPreview, FriendsPreview, MetaPreview } from "./components/suite/SuiteScreens";
import { ScannerScreen } from "./screens/ScannerScreen";
import { colors } from "./theme";
import { FEATURES } from "./config/features";

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
  const showScanner = FEATURES.scanner;

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={theme}>
        <StatusBar style="light" />
        <Tab.Navigator
          initialRouteName={showScanner ? "Scanner" : "Binder"}
          screenOptions={{ headerShown: false, lazy: true }}
          tabBar={(props) => <BottomTabBar {...props} />}
        >
          {showScanner && <Tab.Screen name="Scanner" component={ScannerScreen} />}
          <Tab.Screen name="Binder" component={BinderPreview} />
          <Tab.Screen name="Decks" component={DecksPreview} />
          <Tab.Screen name="Meta" component={MetaPreview} />
          <Tab.Screen name="Friends" component={FriendsPreview} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
