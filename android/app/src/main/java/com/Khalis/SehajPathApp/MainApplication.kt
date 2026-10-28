package com.khalis.sehajpathapp

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.soloader.SoLoader

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context= applicationContext,
      packageList =
            PackageList(this).packages.apply {
              // Packages that cannot be autolinked yet can be added manually here, for example:
              // add(MyReactNativePackage())
            },
        )
      }

  override fun onCreate() {
    super.onCreate()

    // If Android failed to extract a native library during install or update, let SoLoader
    // recover it from the APK and retry. loadReactNative below still supplies React Native's
    // merged-library mapping; SoLoader initialization is intentionally idempotent.
    SoLoader.init(this, SoLoader.SOLOADER_ENABLE_BACKUP_SOSOURCE_DSONOTFOUND_ERROR_RECOVERY)
    loadReactNative(this)
  }
}
