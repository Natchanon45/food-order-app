import 'dart:io';

import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'lk_api.dart';

/// System notifications for LK Shop's *foreground* inbox polling, independent
/// from optional Firebase. Background push is not enabled by this component.
class LKSystemNotices {
  LKSystemNotices({
    FlutterLocalNotificationsPlugin? plugin,
    FlutterSecureStorage? storage,
  }) : _plugin = plugin ?? FlutterLocalNotificationsPlugin(),
       _storage = storage ?? const FlutterSecureStorage();

  final FlutterLocalNotificationsPlugin _plugin;
  final FlutterSecureStorage _storage;

  static const String channelId = 'lkshop_staff_alerts_v2';
  static const _cursorPrefix = 'lk_shop_alert_cursor_v1_';
  bool _ready = false;
  final Map<String, int> _lastSeenByDevice = {};

  static const AndroidNotificationDetails androidDetails =
      AndroidNotificationDetails(
        channelId,
        'LK Shop • แจ้งเตือนสำคัญ',
        channelDescription: 'คำสั่งซื้อและรายการสำคัญของร้านค้า',
        icon: 'lk_shop_notification_small',
        importance: Importance.max,
        priority: Priority.high,
        channelShowBadge: true,
        enableVibration: true,
        playSound: true,
        visibility: NotificationVisibility.private,
        category: AndroidNotificationCategory.message,
      );

  Future<void> initialize() async {
    try {
      await _plugin.initialize(
        settings: const InitializationSettings(
          android: AndroidInitializationSettings('lk_shop_notification_small'),
          iOS: DarwinInitializationSettings(),
        ),
      );
      if (Platform.isAndroid) {
        await _plugin
            .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin
            >()
            ?.createNotificationChannel(
              const AndroidNotificationChannel(
                channelId,
                'LK Shop • แจ้งเตือนสำคัญ',
                description: 'คำสั่งซื้อและรายการสำคัญของร้านค้า',
                importance: Importance.max,
                playSound: true,
                enableVibration: true,
                showBadge: true,
              ),
            );
      }
      _ready = true;
    } catch (_) {
      _ready = false;
    }
  }

  Future<void> requestPermission() async {
    if (!_ready) return;
    try {
      if (Platform.isAndroid) {
        await _plugin
            .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin
            >()
            ?.requestNotificationsPermission();
      } else if (Platform.isIOS) {
        await _plugin
            .resolvePlatformSpecificImplementation<
              IOSFlutterLocalNotificationsPlugin
            >()
            ?.requestPermissions(alert: true, badge: true, sound: true);
      }
    } catch (_) {
      // Notification settings cannot block paired inbox access.
    }
  }

  Future<void> _showGeneric({required int id, required int count}) async {
    if (!_ready) return;
    try {
      await _plugin.show(
        id: id,
        title: 'LK Shop • มีรายการแจ้งเตือนใหม่',
        body: count > 1
            ? 'มี $count รายการใหม่ แตะเพื่อดูในแอป'
            : 'แตะเพื่อดูรายการล่าสุดในแอป',
        notificationDetails: NotificationDetails(
          iOS: DarwinNotificationDetails(
            presentAlert: true,
            presentBanner: true,
            presentList: true,
            presentBadge: true,
            presentSound: true,
            badgeNumber: count.clamp(1, 99).toInt(),
          ),
          android: AndroidNotificationDetails(
            channelId,
            'LK Shop • แจ้งเตือนสำคัญ',
            channelDescription: 'คำสั่งซื้อและรายการสำคัญของร้านค้า',
            icon: 'lk_shop_notification_small',
            importance: Importance.max,
            priority: Priority.high,
            channelShowBadge: true,
            enableVibration: true,
            playSound: true,
            visibility: NotificationVisibility.private,
            category: AndroidNotificationCategory.message,
            number: count.clamp(1, 99).toInt(),
          ),
        ),
      );
    } catch (_) {
      // The inbox itself remains authoritative if OS notifications are blocked.
    }
  }

  Future<void> showForegroundPush() async {
    await _showGeneric(
      id: DateTime.now().millisecondsSinceEpoch.remainder(100000000),
      count: 1,
    );
  }

  Future<bool> sendTestNotification() async {
    await requestPermission();
    if (!_ready) return false;
    try {
      if (Platform.isAndroid) {
        final android = _plugin
            .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin
            >();
        if (await android?.areNotificationsEnabled() == false) return false;
      }
      if (Platform.isIOS) {
        final ios = _plugin
            .resolvePlatformSpecificImplementation<
              IOSFlutterLocalNotificationsPlugin
            >();
        if (await ios?.checkPermissions() case final permissions?
            when !permissions.isEnabled) {
          return false;
        }
      }
      await _plugin.show(
        id: 998001,
        title: 'LK Shop • ทดสอบการแจ้งเตือน',
        body: 'ตรวจสอบเสียง แถบแจ้งเตือน และจุดบนไอคอนแอป',
        notificationDetails: const NotificationDetails(
          android: androidDetails,
          iOS: DarwinNotificationDetails(
            presentAlert: true,
            presentBanner: true,
            presentList: true,
            presentBadge: true,
            presentSound: true,
            badgeNumber: 1,
          ),
        ),
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> openNotificationSettings() async {
    if (!Platform.isAndroid && !Platform.isIOS) return false;
    try {
      return await _plugin.openAppNotificationSettings() ?? false;
    } catch (_) {
      return false;
    }
  }

  Future<void> observeInbox(
    LKConnection? device,
    List<LKMessage> inbox, {
    bool alertNew = false,
  }) async {
    if (device == null) return;
    final key = device.deviceId;
    final latestId = inbox.fold<int>(
      0,
      (latest, msg) => msg.id > latest ? msg.id : latest,
    );
    // An empty inbox is also a baseline (id=0). Otherwise the first
    // notification arriving after pairing would be mistaken for old history.
    int? previous = _lastSeenByDevice[key];
    if (previous == null) {
      try {
        final persisted = await _storage.read(key: '$_cursorPrefix$key');
        previous = int.tryParse(persisted ?? '');
      } catch (_) {
        // Reinitialize the baseline if keystore is unavailable.
      }
    }
    _lastSeenByDevice[key] = previous == null || latestId > previous
        ? latestId
        : previous;
    if (previous == null) {
      // Don't play a notification for an old historical inbox on first pair.
      try {
        await _storage.write(
          key: '$_cursorPrefix$key',
          value: latestId.toString(),
        );
      } catch (_) {}
      return;
    }
    if (latestId <= previous) return;

    // Advance the cursor even if permission is currently disabled so that a
    // stale device doesn't repeatedly alert on the same financial message.
    try {
      await _storage.write(
        key: '$_cursorPrefix$key',
        value: latestId.toString(),
      );
    } catch (_) {}
    if (alertNew) {
      final count = inbox.where((msg) => msg.id > previous!).length;
      await _showGeneric(id: latestId.remainder(100000000), count: count);
    }
  }

  Future<void> forgetDevice(String deviceId) async {
    _lastSeenByDevice.remove(deviceId);
    try {
      await _storage.delete(key: '$_cursorPrefix$deviceId');
      await _plugin.cancelAll();
    } catch (_) {}
  }
}
