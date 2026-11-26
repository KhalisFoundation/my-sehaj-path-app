import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import UIKit

class SceneDelegate: RCTDefaultReactNativeFactoryDelegate, UIWindowSceneDelegate {
  var window: UIWindow?
  var reactNativeFactory: RCTReactNativeFactory?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else {
      return
    }

    dependencyProvider = RCTAppDependencyProvider()
    reactNativeFactory = RCTReactNativeFactory(delegate: self)
    window = UIWindow(windowScene: windowScene)
    // Keep the compatibility reference used by RNFirebase Messaging in sync
    // while SceneDelegate remains the owner of the scene window.
    (UIApplication.shared.delegate as? AppDelegate)?.window = window
    
    #if DEBUG
    let devMenuConfiguration = RCTDevMenuConfiguration(
      devMenuEnabled: true,
      shakeGestureEnabled: true,
      keyboardShortcutsEnabled: true
    )
    reactNativeFactory?.devMenuConfiguration = devMenuConfiguration
    #endif
    
    reactNativeFactory?.startReactNative(
      withModuleName: "KhalisSehajPathApp",
      in: window,
      connectionOptions: connectionOptions
    )

   
  }

  /// URLs that arrived before the scene was active, held until it is.
  private var pendingURLContexts: Set<UIOpenURLContext> = []

  // A URL opened while the app is running (the system-browser login fallback,
  // an invite link). Returning from Safari, it can arrive while the scene is
  // still coming to the foreground, before JS has resumed, and the `url` event
  // was then lost. The old AppDelegate held it until
  // `applicationDidBecomeActive` for exactly this. Keep the same rule here:
  // deliver now only if already active, otherwise in `sceneDidBecomeActive`.
  //
  // A cold start does not come through here. Its URL is in `connectionOptions`,
  // which `startReactNative` passes on as the launch URL for
  // `Linking.getInitialURL()`.
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    pendingURLContexts.formUnion(URLContexts)
    if scene.activationState == .foregroundActive {
      deliverPendingURLContexts(to: scene)
    }
  }

  func sceneDidBecomeActive(_ scene: UIScene) {
    deliverPendingURLContexts(to: scene)
  }

  private func deliverPendingURLContexts(to scene: UIScene) {
    guard !pendingURLContexts.isEmpty else {
      return
    }
    let contexts = pendingURLContexts
    pendingURLContexts = []
    RCTLinkingManager.scene(scene, openURLContexts: contexts)
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    RCTLinkingManager.scene(scene, continue: userActivity)
  }

  override func bundleURL() -> URL? {
    #if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
    #else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
    #endif
  }
}
