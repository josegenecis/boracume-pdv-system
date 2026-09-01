export const getLatestBridgeWindowsExe = async (): Promise<{ url: string; name: string } | null> => {
  return {
    url: '/api/bridge/latest',
    name: 'PopConnect-Setup.exe',
  }
}
