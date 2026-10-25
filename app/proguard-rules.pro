# Keep the JavaScript bridge reachable from WebView JavaScript.
-keepclassmembers class com.residencyatlas.MainActivity$AppBridge {
    @android.webkit.JavascriptInterface <methods>;
}
