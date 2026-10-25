package com.residencyatlas;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

public class MainActivity extends Activity {
    private static final int CREATE_JSON_FILE = 2482;
    private WebView webView;
    private String pendingFilename;
    private String pendingContent;
    private static final Set<String> SAFE_HOSTS = new HashSet<>(Arrays.asList(
        "google.com", "www.google.com", "scholar.google.com",
        "pubmed.ncbi.nlm.nih.gov", "www.who.int", "who.int",
        "nice.org.uk", "www.nice.org.uk", "cdc.gov", "www.cdc.gov"
    ));

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(16, 42, 67));
        getWindow().setNavigationBarColor(Color.rgb(16, 42, 67));
        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setLoadsImagesAutomatically(true);
        settings.setDatabaseEnabled(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);

        webView.addJavascriptInterface(new AppBridge(), "Android");
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url != null && url.startsWith("file:///android_asset/")) return false;
                openExternal(url);
                return true;
            }
        });
        webView.loadUrl("file:///android_asset/index.html");
    }

    private void openExternal(String candidate) {
        try {
            Uri uri = Uri.parse(candidate);
            String scheme = uri.getScheme();
            String host = uri.getHost();
            if (!"https".equalsIgnoreCase(scheme) || host == null || !SAFE_HOSTS.contains(host.toLowerCase())) {
                Toast.makeText(this, "Blocked unsupported external link", Toast.LENGTH_SHORT).show();
                return;
            }
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException | IllegalArgumentException e) {
            Toast.makeText(this, "No browser available to open this reference", Toast.LENGTH_LONG).show();
        }
    }

    private final class AppBridge {
        @JavascriptInterface
        public void openUrl(String candidate) {
            runOnUiThread(() -> openExternal(candidate));
        }

        @JavascriptInterface
        public void saveTextFile(String filename, String content) {
            runOnUiThread(() -> {
                pendingFilename = filename == null ? "residency-atlas-export.json" :
                    filename.replaceAll("[^A-Za-z0-9._-]", "_");
                pendingContent = content == null ? "" : content;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.putExtra(Intent.EXTRA_TITLE, pendingFilename);
                try {
                    startActivityForResult(intent, CREATE_JSON_FILE);
                } catch (ActivityNotFoundException e) {
                    Toast.makeText(MainActivity.this, "File saving is not available on this device", Toast.LENGTH_LONG).show();
                }
            });
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != CREATE_JSON_FILE || resultCode != RESULT_OK || data == null || data.getData() == null) return;
        try (OutputStream output = getContentResolver().openOutputStream(data.getData())) {
            if (output == null) throw new IllegalStateException("Unable to open destination");
            output.write((pendingContent == null ? "" : pendingContent).getBytes(StandardCharsets.UTF_8));
            Toast.makeText(this, "Export saved", Toast.LENGTH_LONG).show();
        } catch (Exception e) {
            Toast.makeText(this, "Could not save export: " + e.getMessage(), Toast.LENGTH_LONG).show();
        } finally {
            pendingFilename = null;
            pendingContent = null;
        }
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        if (webView == null) {
            super.onBackPressed();
            return;
        }
        webView.evaluateJavascript("window.handleAndroidBack ? window.handleAndroidBack() : false", value -> {
            if (!"true".equals(value)) MainActivity.super.onBackPressed();
        });
    }
}
