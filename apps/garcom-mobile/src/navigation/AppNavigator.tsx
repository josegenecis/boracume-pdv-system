import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '../config/theme';
import { useAuthSession } from '../contexts/AuthSessionContext';
import { LoginScreen } from '../screens/LoginScreen';
import { PaymentsScreen } from '../screens/PaymentsScreen';
import { ProductCatalogScreen } from '../screens/ProductCatalogScreen';
import { TableSessionScreen } from '../screens/TableSessionScreen';
import { TablesScreen } from '../screens/TablesScreen';

export type RootStackParamList = {
  Login: undefined;
  Tables: undefined;
  TableSession: { sessionId: string };
  ProductCatalog: { sessionId: string; accountId: string };
  Payments: { sessionId: string; accountId?: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const appTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.surface,
    card: colors.white,
    text: colors.ink,
    primary: colors.brand,
    border: colors.border,
  },
};

export function AppNavigator() {
  const { loading, session } = useAuthSession();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={appTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.white,
          },
          headerTintColor: colors.ink,
          headerShadowVisible: false,
          contentStyle: {
            backgroundColor: colors.surface,
          },
          headerTitleStyle: {
            fontWeight: '800',
          },
        }}
      >
        {session ? (
          <>
            <Stack.Screen name="Tables" component={TablesScreen} options={{ title: 'Mapa de mesas' }} />
            <Stack.Screen name="TableSession" component={TableSessionScreen} options={{ title: 'Comanda' }} />
            <Stack.Screen name="ProductCatalog" component={ProductCatalogScreen} options={{ title: 'Lançamento' }} />
            <Stack.Screen name="Payments" component={PaymentsScreen} options={{ title: 'Pagamento' }} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
