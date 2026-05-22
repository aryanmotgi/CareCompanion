#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <React/RCTLinkingManager.h>

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  self.moduleName = @"main";

  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};

  // HealthKit-derived data persists in AsyncStorage (RCTAsyncLocalStorage_V1)
  // under NSLibraryDirectory, which is backed up by default. Required by
  // App Store guideline 5.1.3.
  [self excludeAsyncStorageFromBackup];

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

- (void)excludeAsyncStorageFromBackup
{
  NSURL *libURL = [[[NSFileManager defaultManager]
      URLsForDirectory:NSLibraryDirectory
             inDomains:NSUserDomainMask] firstObject];
  if (!libURL) return;

  NSURL *asyncStorageDir = [libURL URLByAppendingPathComponent:@"RCTAsyncLocalStorage_V1"
                                                   isDirectory:YES];

  NSFileManager *fm = [NSFileManager defaultManager];
  if (![fm fileExistsAtPath:asyncStorageDir.path]) {
    [fm createDirectoryAtURL:asyncStorageDir
 withIntermediateDirectories:YES
                  attributes:nil
                       error:nil];
  }

  NSError *err = nil;
  BOOL ok = [asyncStorageDir setResourceValue:@YES
                                       forKey:NSURLIsExcludedFromBackupKey
                                        error:&err];
  if (!ok) {
    NSLog(@"[CareCompanion] Failed to set backup exclusion on AsyncStorage dir: %@",
          err.localizedDescription);
  }
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@".expo/.virtual-metro-entry"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

// Linking API
- (BOOL)application:(UIApplication *)application openURL:(NSURL *)url options:(NSDictionary<UIApplicationOpenURLOptionsKey,id> *)options {
  return [super application:application openURL:url options:options] || [RCTLinkingManager application:application openURL:url options:options];
}

// Universal Links
- (BOOL)application:(UIApplication *)application continueUserActivity:(nonnull NSUserActivity *)userActivity restorationHandler:(nonnull void (^)(NSArray<id<UIUserActivityRestoring>> * _Nullable))restorationHandler {
  BOOL result = [RCTLinkingManager application:application continueUserActivity:userActivity restorationHandler:restorationHandler];
  return [super application:application continueUserActivity:userActivity restorationHandler:restorationHandler] || result;
}

// Explicitly define remote notification delegates to ensure compatibility with some third-party libraries
- (void)application:(UIApplication *)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken
{
  return [super application:application didRegisterForRemoteNotificationsWithDeviceToken:deviceToken];
}

// Explicitly define remote notification delegates to ensure compatibility with some third-party libraries
- (void)application:(UIApplication *)application didFailToRegisterForRemoteNotificationsWithError:(NSError *)error
{
  return [super application:application didFailToRegisterForRemoteNotificationsWithError:error];
}

// Explicitly define remote notification delegates to ensure compatibility with some third-party libraries
- (void)application:(UIApplication *)application didReceiveRemoteNotification:(NSDictionary *)userInfo fetchCompletionHandler:(void (^)(UIBackgroundFetchResult))completionHandler
{
  return [super application:application didReceiveRemoteNotification:userInfo fetchCompletionHandler:completionHandler];
}

@end
