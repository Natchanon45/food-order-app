import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:package_info_plus/package_info_plus.dart';

import 'src/lk_api.dart';
import 'src/lk_runtime.dart';
import 'src/lk_shop_ui.dart';
import 'src/pairing.dart';
import 'src/lk_system_notices.dart';

@pragma('vm:entry-point')
Future<void> lkBackgroundMessage(RemoteMessage message) async {
  // FCM/APNs handles the notification. Unlock app to fetch private details.
}
final lkSystemNotices = LKSystemNotices();
const green = Color(0xff0d7847);
const ink = Color(0xff173f2b);

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Android sound/heads-up/badge notifications can run while the app is
  // active even when optional Firebase credentials are not yet configured.
  await lkSystemNotices.initialize();
  bool firebaseReady = false;
  try {
    if (!LKRuntime.nativeFirebaseConfigured) {
      throw StateError('PENGUIN_NATIVE_FIREBASE_CONFIGURATION_REQUIRED');
    }
    await Firebase.initializeApp(
      options: FirebaseOptions(
        apiKey: LKRuntime.apiKey,
        appId: LKRuntime.appId,
        messagingSenderId: LKRuntime.senderId,
        projectId: LKRuntime.projectId,
      ),
    );
    FirebaseMessaging.onBackgroundMessage(lkBackgroundMessage);
    firebaseReady = true;
  } catch (_) {
    // Firebase native files / APNs signing are supplied outside Git.
    // Secure QR pairing and foreground inbox alerts still work without FCM.
  }
  runApp(LKShopApp(firebaseReady: firebaseReady));
}

class LKAppVersionFooter extends StatefulWidget {
  const LKAppVersionFooter({super.key});

  @override
  State<LKAppVersionFooter> createState() => _LKAppVersionFooterState();
}

class _LKAppVersionFooterState extends State<LKAppVersionFooter> {
  late final Future<PackageInfo> info = PackageInfo.fromPlatform();

  @override
  Widget build(BuildContext context) => FutureBuilder<PackageInfo>(
    future: info,
    builder: (context, snapshot) => LKVersionFooter(
      version: snapshot.data?.version ?? '…',
      buildNumber: snapshot.data?.buildNumber ?? '…',
    ),
  );
}

class LKShopApp extends StatelessWidget {
  const LKShopApp({super.key, required this.firebaseReady});
  final bool firebaseReady;
  @override
  Widget build(BuildContext context) => MaterialApp(
    debugShowCheckedModeBanner: false,
    builder: (context, child) => Column(
      children: [
        Expanded(
          child: MediaQuery.removePadding(
            context: context,
            removeBottom: true,
            child: child ?? const SizedBox.shrink(),
          ),
        ),
        const LKAppVersionFooter(),
      ],
    ),
    title: 'PG Notify',
    theme: ThemeData(
      useMaterial3: true,
      fontFamily: 'Kanit',
      colorScheme: ColorScheme.fromSeed(seedColor: green),
      scaffoldBackgroundColor: const Color(0xfff2f7f4),
      appBarTheme: const AppBarTheme(
        backgroundColor: Color(0xff104b30),
        foregroundColor: Colors.white,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: green,
          foregroundColor: Colors.white,
          minimumSize: const Size(120, 48),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(13),
          ),
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: Color(0xffd9e8de)),
        ),
      ),
    ),
    home: LKHome(firebaseReady: firebaseReady),
  );
}

const roleNames = <String, String>{
  'superadmin_slip_manual': 'แจ้งเตือนส่วนกลาง',
  'admin_store': 'แอดมินร้าน',
  'cashier_delivery': 'แคชเชียร์',
  'kitchen_delivery': 'ครัว',
};

class LKHome extends StatefulWidget {
  const LKHome({super.key, required this.firebaseReady});
  final bool firebaseReady;
  @override
  State<LKHome> createState() => _LKHomeState();
}

class _LKHomeState extends State<LKHome> with WidgetsBindingObserver {
  final api = LKApi();
  Timer? ticker;
  StreamSubscription<String>? pushRefresh;
  StreamSubscription<RemoteMessage>? foreground, tapped;
  List<LKMessage> messages = [];
  bool loading = true, busy = false, pushReady = false;
  bool pushServerConfigured = false;
  String error = '';
  String installedVersion = '…', installedBuild = '…';
  bool searching = false;
  String searchQuery = '';
  String deviceName = Platform.isIOS ? 'iPhone ร้านค้า' : 'Android ร้านค้า';
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _readInstalledVersion();
    _restore();
  }

  Future<void> _readInstalledVersion() async {
    try {
      final info = await PackageInfo.fromPlatform();
      if (!mounted) {
        return;
      }
      setState(() {
        installedVersion = info.version;
        installedBuild = info.buildNumber;
      });
    } catch (_) {
      // Tests or unsupported platforms may not expose native package metadata.
      if (mounted) {
        setState(() {
          installedVersion = 'ไม่ทราบ';
          installedBuild = 'ไม่ทราบ';
        });
      }
    }
  }

  Future<void> _restore() async {
    await api.restore();
    if (api.current != null) {
      await lkSystemNotices.requestPermission();
      await _refresh();
      await _configurePush();
    }
    if (mounted) setState(() => loading = false);
    ticker = Timer.periodic(const Duration(seconds: 20), (_) {
      if (mounted && api.current != null) {
        _refresh(silent: true, alertNew: true);
      }
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && api.current != null) {
      _refresh(silent: true, alertNew: true);
    }
  }

  Future<String> _getFCMToken() async {
    if (!widget.firebaseReady) return '';
    try {
      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission(alert: true, badge: true, sound: true);
      await messaging.setForegroundNotificationPresentationOptions(
        alert: true,
        badge: true,
        sound: true,
      );
      if (Platform.isIOS) {
        String? apns = await messaging.getAPNSToken();
        for (int i = 0; i < 8 && apns == null; i++) {
          await Future.delayed(const Duration(milliseconds: 350));
          apns = await messaging.getAPNSToken();
        }
        if (apns == null) return '';
      }
      // HTTP v1 requires an FCM registration token, not the FID emitted by onRegistered.
      // ignore: deprecated_member_use
      return await messaging.getToken() ?? '';
    } catch (_) {
      return '';
    }
  }

  Future<void> _configurePush() async {
    if (!widget.firebaseReady || api.current == null) return;
    final token = await _getFCMToken();
    if (token.isNotEmpty) {
      try {
        await api.updatePushToken(token);
        if (mounted) setState(() => pushReady = true);
      } catch (_) {
        if (mounted) setState(() => pushReady = false);
      }
    }
    await pushRefresh?.cancel();
    // The onRegistered event supplies a Firebase Installation ID, not a send token.
    // ignore: deprecated_member_use
    pushRefresh = FirebaseMessaging.instance.onTokenRefresh.listen((token) {
      if (api.current != null) {
        api.updatePushToken(token).catchError((Object _) {});
      }
    });
    await foreground?.cancel();
    foreground = FirebaseMessaging.onMessage.listen((message) async {
      if (Platform.isAndroid) {
        await lkSystemNotices.showForegroundPush();
      }
      _refresh(silent: true);
    });
    await tapped?.cancel();
    tapped = FirebaseMessaging.onMessageOpenedApp.listen((message) {
      _openPushNotice(message);
    });
    final openedFromClosedApp = await FirebaseMessaging.instance
        .getInitialMessage();
    if (openedFromClosedApp != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _openPushNotice(openedFromClosedApp);
      });
    }
  }

  // The push payload is a private inbox sequence, never a URL supplied by
  // FCM. Re-fetch by the current device bearer before opening details.
  Future<void> _openPushNotice(RemoteMessage notification) async {
    final paired = api.current;
    if (!mounted || paired == null) return;
    final sequence = int.tryParse(notification.data['eventId'] ?? '');
    if (sequence == null || sequence < 1) {
      await _refresh(silent: true);
      return;
    }
    try {
      final inbox = await api.inbox();
      if (!mounted || api.current?.deviceId != paired.deviceId) return;
      setState(() => messages = inbox);
      final matching = inbox.where((item) => item.id == sequence);
      if (matching.isNotEmpty) _showDetails(matching.first);
    } on LKApiException {
      await _refresh(silent: true);
    }
  }

  Future<void> _refresh({bool silent = false, bool alertNew = false}) async {
    final device = api.current;
    if (device == null) return;
    try {
      final status = await api.status();
      final inbox = await api.inbox();
      if (api.current?.deviceId != device.deviceId) return;
      await lkSystemNotices.observeInbox(
        device,
        inbox,
        alertNew: alertNew && !(pushReady && pushServerConfigured),
      );
      if (mounted) {
        setState(() {
          messages = inbox;
          pushReady = status['device']?['pushReady'] == true;
          pushServerConfigured = status['pushServerConfigured'] == true;
          error = '';
        });
      }
    } on LKApiException catch (e) {
      if (!silent && mounted) setState(() => error = e.message);
      if (e.message.contains('ถูกยกเลิกสิทธิ์') && mounted) {
        final oldId = api.current?.deviceId;
        await api.forgetRevoked();
        if (oldId != null) await lkSystemNotices.forgetDevice(oldId);
        setState(() {
          messages = [];
          error = 'ถูกยกเลิกสิทธิ์แล้ว กรุณาขอ QR ใหม่';
        });
      }
    }
  }

  Future<void> _pair() async {
    final pair = await Navigator.of(context).push<LKPairing>(
      MaterialPageRoute(builder: (context) => const LKScanner()),
    );
    if (pair == null || !mounted) return;
    await _enroll(pair);
  }

  Future<void> _pairManual() async {
    final controller = TextEditingController();
    try {
      final entered = await showDialog<String>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('กรอกรหัสจับคู่ PG Notify'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'สร้าง QR จากหน้า Admin หรือ Super Admin ของ Production '
                'แล้วคัดลอกรหัส 64 ตัวอักษรมาใส่ที่นี่ '
                'รหัสจะหมดอายุภายใน 5 นาทีและใช้ได้ครั้งเดียว',
              ),
              const SizedBox(height: 16),
              TextField(
                key: const Key('lk-shop-manual-pair-code'),
                controller: controller,
                autofocus: true,
                autocorrect: false,
                enableSuggestions: false,
                obscureText: true,
                maxLength: 64,
                decoration: const InputDecoration(
                  labelText: 'รหัสจับคู่ 64 ตัวอักษร',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('ยกเลิก'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, controller.text.trim()),
              child: const Text('เชื่อมต่อ'),
            ),
          ],
        ),
      );
      if (entered == null || !mounted) return;
      final pair = LKPairing.fromManualCode(entered);
      if (pair == null) {
        setState(
          () => error = 'รหัสจับคู่ต้องเป็นตัวเลขและ a-f รวม 64 ตัวอักษร',
        );
        return;
      }
      await _enroll(pair);
    } finally {
      controller.clear();
      controller.dispose();
    }
  }

  Future<void> _enroll(LKPairing pair) async {
    if (!mounted || busy) return;
    setState(() {
      busy = true;
      error = '';
    });
    try {
      final token = await _getFCMToken();
      await api.enroll(pair.server, pair.code, token, deviceName);
      await lkSystemNotices.requestPermission();
      await _refresh();
      await _configurePush();
    } on LKApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<bool> _unpair() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('ยกเลิกการจับคู่?'),
        content: const Text(
          'อุปกรณ์นี้จะไม่ได้รับข้อความจากห้องที่เชื่อมต่ออยู่ หากต้องการรับอีกครั้งให้สแกน QR ใหม่',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('กลับ'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('ยกเลิกการจับคู่'),
          ),
        ],
      ),
    );
    if (confirm != true || !mounted) return false;
    setState(() => busy = true);
    try {
      final deviceId = api.current?.deviceId;
      await api.unpair();
      if (deviceId != null) await lkSystemNotices.forgetDevice(deviceId);
      if (mounted) {
        setState(() {
          messages = [];
          error = '';
          pushReady = false;
        });
      }
    } on LKApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => busy = false);
    }
    return api.current == null;
  }

  Future<void> _openTarget(String target) async {
    final uri = Uri.tryParse(target);
    if (!LKRuntime.allowedTarget(target, api.current?.role ?? '')) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('ไม่สามารถเปิดรายการนี้ได้')),
        );
      }
      return;
    }
    try {
      final opened = await launchUrl(
        uri!,
        mode: LaunchMode.externalApplication,
      );
      if (!opened && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('ไม่สามารถเปิดลิงก์ได้ในขณะนี้')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('ไม่สามารถเปิดลิงก์ได้ในขณะนี้')),
        );
      }
    }
  }

  @override
  void dispose() {
    ticker?.cancel();
    pushRefresh?.cancel();
    foreground?.cancel();
    tapped?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  void _showDetails(LKMessage message) {
    Navigator.push<void>(
      context,
      MaterialPageRoute(
        builder: (_) => LKMessageDetailPage(
          message: message,
          onOpen: (target) => _openTarget(target),
        ),
      ),
    );
  }

  void _showConnection() {
    if (api.current == null) return;
    Navigator.push<void>(
      context,
      MaterialPageRoute(
        builder: (_) => LKConnectionPage(
          roomName: roleNames[api.current!.role] ?? 'แจ้งเตือน',
          pushReady: pushReady,
          pushServerConfigured: pushServerConfigured,
          onUnpair: _unpair,
          onTestNotification: lkSystemNotices.sendTestNotification,
          onOpenNotificationSettings: lkSystemNotices.openNotificationSettings,
        ),
      ),
    );
  }

  void _showAbout() {
    showAboutDialog(
      context: context,
      applicationName: 'PG Notify',
      applicationVersion: 'Version $installedVersion • Build $installedBuild',
      applicationIcon: const LKShopLogo(size: 54),
      children: const [
        Text(
          'รับข้อความแจ้งเตือนคำสั่งซื้อ การชำระเงิน และรายการสำคัญตามห้องที่เชื่อมต่อ',
        ),
      ],
    );
  }

  Widget _errorBanner() => Padding(
    padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
    child: Material(
      color: const Color(0xfffff0ee),
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            const Icon(Icons.error_outline, color: Color(0xffa52d2d)),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                error,
                style: const TextStyle(fontSize: 12, color: Color(0xff8a281d)),
              ),
            ),
          ],
        ),
      ),
    ),
  );

  @override
  Widget build(BuildContext context) {
    final paired = api.current != null;
    final role = paired
        ? (roleNames[api.current!.role] ?? 'แจ้งเตือน')
        : 'แจ้งเตือนคำสั่งซื้อและรายการสำคัญ';
    return Scaffold(
      appBar: AppBar(
        flexibleSpace: const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xff05432b), Color(0xff008950)],
            ),
          ),
        ),
        titleSpacing: 12,
        title: Row(
          children: [
            const LKShopLogo(size: 40),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'PG Notify',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 19,
                      color: Colors.white,
                    ),
                  ),
                  Text(
                    role,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 10,
                      color: Color(0xffd1eee0),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          if (paired)
            IconButton(
              tooltip: searching ? 'ปิดค้นหา' : 'ค้นหาข้อความ',
              icon: Icon(
                searching ? Icons.close_rounded : Icons.search_rounded,
              ),
              onPressed: () => setState(() {
                searching = !searching;
                searchQuery = '';
              }),
            ),
          if (paired)
            IconButton(
              tooltip: 'รีเฟรช',
              onPressed: () => _refresh(),
              icon: const Icon(Icons.refresh_rounded),
            ),
          PopupMenuButton<String>(
            tooltip: 'เมนูเพิ่มเติม',
            onSelected: (value) {
              if (value == 'connection') _showConnection();
              if (value == 'about') _showAbout();
            },
            itemBuilder: (_) => [
              if (paired)
                const PopupMenuItem(
                  value: 'connection',
                  child: ListTile(
                    dense: true,
                    leading: Icon(Icons.link_rounded),
                    title: Text('การเชื่อมต่อ'),
                  ),
                ),
              const PopupMenuItem(
                value: 'about',
                child: ListTile(
                  dense: true,
                  leading: Icon(Icons.info_outline),
                  title: Text('เวอร์ชันแอป'),
                ),
              ),
            ],
          ),
        ],
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                if (error.isNotEmpty) _errorBanner(),
                Expanded(
                  child: paired
                      ? LKNotificationFeed(
                          messages: messages,
                          onSelect: _showDetails,
                          search: searching,
                          searchQuery: searchQuery,
                          onSearchChanged: (text) =>
                              setState(() => searchQuery = text),
                          refreshing: busy,
                          onRefresh: () => _refresh(),
                        )
                      : LKShopLanding(
                          deviceName: deviceName,
                          busy: busy,
                          onNameChanged: (text) => deviceName = text,
                          onScan: _pair,
                          onManualPair: _pairManual,
                        ),
                ),
              ],
            ),
    );
  }
}

class LKScanner extends StatefulWidget {
  const LKScanner({super.key});
  @override
  State<LKScanner> createState() => _LKScannerState();
}

class _LKScannerState extends State<LKScanner> {
  final controller = MobileScannerController();
  bool busy = false;
  String error = '';
  void _scan(BarcodeCapture capture) {
    if (busy) return;
    final raw = capture.barcodes.isEmpty
        ? null
        : capture.barcodes.first.rawValue;
    final pair = LKPairing.parse(raw, allowLocal: kDebugMode);
    if (pair == null) {
      setState(() => error = 'QR นี้ใช้เชื่อมต่อไม่ได้ กรุณาลองอีกครั้ง');
      return;
    }
    busy = true;
    controller.stop();
    Navigator.pop(context, pair);
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('สแกน QR จับคู่')),
    body: Stack(
      children: [
        MobileScanner(controller: controller, onDetect: _scan),
        Center(
          child: Container(
            width: 260,
            height: 260,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              border: Border.all(width: 4, color: Colors.white70),
            ),
          ),
        ),
        Align(
          alignment: Alignment.bottomCenter,
          child: Padding(
            padding: const EdgeInsets.all(22),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Text(
                  error.isEmpty
                      ? 'วาง QR ของห้องที่ต้องการเข้าร่วมไว้ในกรอบ'
                      : error,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: error.isEmpty ? ink : Colors.red,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    ),
  );
}
