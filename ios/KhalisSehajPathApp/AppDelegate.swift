import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import Firebase
import Security

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?
  private var pendingOpenURL: URL?
  private var pendingOpenURLOptions: [UIApplication.OpenURLOptionsKey: Any] = [:]

  // The Keychain survives an app uninstall, unlike UserDefaults (wiped along with the rest of the app's sandbox) - so on a fresh install/reinstall a stale token would otherwise silently leave the user logged in from before. Runs before React Native's bridge starts below, so no JS code path (including a cold-start deep link resuming SSO) can read a stale token first - refrence react-native-encrypted-storage's README, "Note regarding Keychain persistence".
  private func clearKeychainIfNecessary() {
    let defaults = UserDefaults.standard
    guard !defaults.bool(forKey: "HAS_RUN_BEFORE") else { return }
    defaults.set(true, forKey: "HAS_RUN_BEFORE")

    let secItemClasses: [CFString] = [
      kSecClassGenericPassword,
      kSecClassInternetPassword,
      kSecClassCertificate,
      kSecClassKey,
      kSecClassIdentity,
    ]
    for secItemClass in secItemClasses {
      let spec: [String: Any] = [kSecClass as String: secItemClass]
      SecItemDelete(spec as CFDictionary)
    }
  }
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    if FirebaseApp.app() == nil {
      FirebaseApp.configure()
    }
    clearKeychainIfNecessary()
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "KhalisSehajPathApp",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }

  // Forward custom-scheme URLs (including the SSO login return
  // `khalissehajpath://login?token=…`) to React Native. Without this, iOS opens
  // the app but JavaScript never receives Linking's `url` event, so the login
  // callback is never processed.
  func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    // Returning from Safari, wait for the app to become active rather than
    // guessing bridge-resumption timing. If already active, deliver now so the
    // mounted Linking listener receives the URL immediately.
    pendingOpenURL = url
    pendingOpenURLOptions = options
    if app.applicationState == .active {
      deliverPendingOpenURL(application: app)
    }
    return true
  }

  func applicationDidBecomeActive(_ application: UIApplication) {
    deliverPendingOpenURL(application: application)
  }

  private func deliverPendingOpenURL(application: UIApplication) {
    guard let url = pendingOpenURL else { return }
    let options = pendingOpenURLOptions
    pendingOpenURL = nil
    pendingOpenURLOptions = [:]
    RCTLinkingManager.application(application, open: url, options: options)
  }

  // Keep Universal Links working through the same React Native bridge (needed
  // if/when SSO moves to verified App/Universal Links).
  func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    RCTLinkingManager.application(
      application,
      continue: userActivity,
      restorationHandler: restorationHandler
    )
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}