import { Component, useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import WebView, { type WebViewNavigation } from 'react-native-webview';
import { colors } from './src/config/theme';

const WAITER_WEB_URL = process.env.EXPO_PUBLIC_WAITER_WEB_URL || 'https://popsystem.com.br/waiter-login';
const WaiterWebView = WebView as ComponentType<any>;

class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; message: string }> {
  state = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error?.message || 'Nao foi possivel carregar o app garcom.',
    };
  }

  handleRetry = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.centerScreen}>
          <Text style={styles.errorTitle}>Nao foi possivel abrir o app</Text>
          <Text style={styles.errorMessage}>{this.state.message}</Text>
          <Pressable style={styles.primaryButton} onPress={this.handleRetry}>
            <Text style={styles.primaryButtonText}>Tentar novamente</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

function WaiterWebApp() {
  const webViewRef = useRef<WebView | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void SplashScreen.hideAsync().catch(() => undefined);
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack) {
        webViewRef.current?.goBack();
        return true;
      }

      return false;
    });

    return () => subscription.remove();
  }, [canGoBack]);

  const handleNavigationChange = (event: WebViewNavigation) => {
    setCanGoBack(event.canGoBack);
  };

  const handleRetry = () => {
    setLoadError('');
    webViewRef.current?.reload();
  };

  if (loadError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" backgroundColor={colors.ink} />
        <View style={styles.centerScreen}>
          <Text style={styles.errorTitle}>Sem conexao com o PopSystem</Text>
          <Text style={styles.errorMessage}>{loadError}</Text>
          <Pressable style={styles.primaryButton} onPress={handleRetry}>
            <Text style={styles.primaryButtonText}>Recarregar app</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar style="light" backgroundColor={colors.ink} />
      <WaiterWebView
        ref={webViewRef}
        source={{ uri: WAITER_WEB_URL }}
        style={styles.webView}
        startInLoadingState
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        domStorageEnabled
        javaScriptEnabled
        cacheEnabled
        scrollEnabled
        nestedScrollEnabled
        overScrollMode="content"
        allowsBackForwardNavigationGestures
        onNavigationStateChange={handleNavigationChange}
        onLoadStart={() => setLoadError('')}
        onError={(event: any) => {
          setLoadError(event.nativeEvent.description || 'Confira a internet e tente novamente.');
        }}
        onHttpError={(event: any) => {
          const statusCode = event.nativeEvent.statusCode;
          if (statusCode >= 500) {
            setLoadError(`O servidor respondeu com erro ${statusCode}. Tente novamente em instantes.`);
          }
        }}
        renderLoading={() => (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color={colors.brand} size="large" />
            <Text style={styles.loadingText}>Abrindo app garcom...</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppErrorBoundary>
        <WaiterWebApp />
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  webView: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.ink,
  },
  loadingText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
  centerScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: colors.ink,
  },
  errorTitle: {
    color: colors.white,
    fontSize: 21,
    fontWeight: '900',
    textAlign: 'center',
  },
  errorMessage: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  primaryButton: {
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: colors.brand,
    paddingHorizontal: 22,
    paddingVertical: 13,
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '900',
  },
});
