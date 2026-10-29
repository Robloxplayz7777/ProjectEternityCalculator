package com.michael.forgingxp;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    private WebView web;
    private SharedPreferences prefs;
    private Vibrator vibrator;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences("forgingxp", Context.MODE_PRIVATE);
        vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#121010"));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setHapticFeedbackEnabled(false);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setTextZoom(100);                 // app has its own text-size setting
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);

        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new Bridge(), "Android");
        setContentView(web);
        web.loadUrl("file:///android_asset/www/index.html");
    }

    private class Bridge {
        @JavascriptInterface
        public String load() { return prefs.getString("settings", ""); }

        @JavascriptInterface
        public void save(String data) { prefs.edit().putString("settings", data).apply(); }

        @JavascriptInterface
        public void vibrate(int ms) {
            if (vibrator == null || !vibrator.hasVibrator()) return;
            int d = Math.max(1, Math.min(ms, 80));
            try {
                if (Build.VERSION.SDK_INT >= 26) {
                    int amp = Math.min(255, 40 + d * 6);
                    vibrator.vibrate(VibrationEffect.createOneShot(d, amp));
                } else {
                    vibrator.vibrate(d);
                }
            } catch (Exception ignored) { }
        }

        @JavascriptInterface
        public void copy(String text) {
            try {
                android.content.ClipboardManager cm = (android.content.ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                if (cm != null) cm.setPrimaryClip(android.content.ClipData.newPlainText("Forging XP", text));
            } catch (Exception ignored) { }
        }

        @JavascriptInterface
        public void setBars(final String status, final String nav, final boolean light) {
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    try {
                        Window w = getWindow();
                        int sc = Color.parseColor(status), nc = Color.parseColor(nav);
                        w.setStatusBarColor(sc);
                        w.setNavigationBarColor(nc);
                        web.setBackgroundColor(sc);
                        View d = w.getDecorView();
                        int f = d.getSystemUiVisibility();
                        if (light) {
                            f |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                            if (Build.VERSION.SDK_INT >= 26) f |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                        } else {
                            f &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                            if (Build.VERSION.SDK_INT >= 26) f &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                        }
                        d.setSystemUiVisibility(f);
                    } catch (Exception ignored) { }
                }
            });
        }
    }

    @Override
    public void onBackPressed() {
        if (web == null) { super.onBackPressed(); return; }
        web.evaluateJavascript("(window.__onBack && window.__onBack()) ? 'y' : 'n'", new android.webkit.ValueCallback<String>() {
            @Override public void onReceiveValue(String value) {
                if (value == null || !value.contains("y")) finish();
            }
        });
    }

    @Override
    protected void onPause() {
        if (web != null) {
            web.evaluateJavascript("window.__onPause && window.__onPause()", null);
            web.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }

    @Override
    protected void onDestroy() {
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }
}
