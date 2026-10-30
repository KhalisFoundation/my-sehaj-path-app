import UIKit
import Firebase
import Security

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  // RNFirebase Messaging still reads `UIApplication.shared.delegate.window` when
  // it initializes. The window is owned by SceneDelegate in the scene-based
  // lifecycle, but exposing this compatibility reference prevents Messaging
  // from sending an unrecognised `window` selector to AppDelegate.
  var window: UIWindow?

  // The Keychain survives an app uninstall, unlike UserDefaults (wiped along
  // with the rest of the app's sandbox). Run this before SceneDelegate starts
  // React Native so JavaScript cannot read a stale token on a fresh install.
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
    return true
  }
}
