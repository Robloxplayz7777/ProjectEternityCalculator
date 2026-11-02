package com.michael.forgingxp;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Environment;
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
    private long updateDownloadId = -1;
    private BroadcastReceiver downloadReceiver;

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

        // when the update APK finishes downloading, hand it to the system installer
        downloadReceiver = new BroadcastReceiver() {
            @Override public void onReceive(Context c, Intent intent) {
                long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                if (id != updateDownloadId || id == -1) return;
                installDownloaded(id);
            }
        };
        IntentFilter f = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(downloadReceiver, f, Context.RECEIVER_EXPORTED);
        else registerReceiver(downloadReceiver, f);
    }

    private void js(final String code) {
        runOnUiThread(new Runnable() { @Override public void run() { if (web != null) web.evaluateJavascript(code, null); } });
    }

    private void installDownloaded(long id) {
        try {
            DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            DownloadManager.Query q = new DownloadManager.Query().setFilterById(id);
            android.database.Cursor cur = dm.query(q);
            boolean ok = false;
            if (cur != null) {
                if (cur.moveToFirst()) {
                    int st = cur.getInt(cur.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                    ok = st == DownloadManager.STATUS_SUCCESSFUL;
                }
                cur.close();
            }
            if (!ok) { js("window.__onUpdateError && window.__onUpdateError('The download failed. Check your connection and try again.')"); return; }
            Uri uri = dm.getUriForDownloadedFile(id);
            if (uri == null) { js("window.__onUpdateError && window.__onUpdateError('Couldn\\'t open the downloaded file.')"); return; }
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(uri, "application/vnd.android.package-archive");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
            js("window.__onUpdateReady && window.__onUpdateReady()");
        } catch (Exception e) {
            js("window.__onUpdateError && window.__onUpdateError('Couldn\\'t start the installer.')");
        }
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
        public String version() {
            try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; }
            catch (Exception e) { return ""; }
        }

        @JavascriptInterface
        public void openUrl(String url) {
            if (url == null || !(url.startsWith("https://") || url.startsWith("http://"))) return;
            try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Exception ignored) { }
        }

        @JavascriptInterface
        public void downloadUpdate(String url, String ver) {
            if (url == null || !url.startsWith("https://")) return;
            try {
                DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                String name = "ForgingXP-" + ver.replaceAll("[^0-9A-Za-z.\\-]", "") + ".apk";
                java.io.File old = new java.io.File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), name);
                if (old.exists()) old.delete();
                DownloadManager.Request r = new DownloadManager.Request(Uri.parse(url))
                    .setTitle("Forging XP " + ver)
                    .setDescription("Downloading update")
                    .setMimeType("application/vnd.android.package-archive")
                    .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
                    .setDestinationInExternalFilesDir(MainActivity.this, Environment.DIRECTORY_DOWNLOADS, name);
                updateDownloadId = dm.enqueue(r);
            } catch (Exception e) {
                js("window.__onUpdateError && window.__onUpdateError('Couldn\\'t start the download.')");
            }
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
        try { if (downloadReceiver != null) unregisterReceiver(downloadReceiver); } catch (Exception ignored) { }
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }
}
