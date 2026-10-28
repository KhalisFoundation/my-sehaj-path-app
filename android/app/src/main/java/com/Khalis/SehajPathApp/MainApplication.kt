package com.khalis.sehajpathapp

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.react.views.view.setEdgeToEdgeFeatureFlagOn
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

    // On a DSO-not-found error, extract the missing library from the APK and retry.
    // React Native's mapping overload accepts no flags, so initialize with recovery first and
    // then register the merged-library mapping. This mirrors the generated RN entry point while
    // retaining the fallback for a library Android failed to extract.
    SoLoader.init(this, SoLoader.SOLOADER_ENABLE_BACKUP_SOSOURCE_DSONOTFOUND_ERROR_RECOVERY)
    SoLoader.init(this, OpenSourceMergedSoMapping)

    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      load()
    }

    if (BuildConfig.IS_EDGE_TO_EDGE_ENABLED) {
      setEdgeToEdgeFeatureFlagOn()
    }
  }
}
