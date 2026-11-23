import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lk_shop/src/lk_api.dart';
import 'package:lk_shop/src/lk_system_notices.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'initial inbox is a baseline and newer events advance per device',
    () async {
      FlutterSecureStorage.setMockInitialValues({});
      final storage = const FlutterSecureStorage();
      final alerts = LKSystemNotices(storage: storage);
      const cashier = LKConnection(
        server: 'https://penguin-food.web.app',
        credential: 'fixture-no-real-credential',
        deviceId: 'device-fixture-1',
        role: 'cashier_delivery',
      );
      LKMessage event(int id) => LKMessage(
        id: id,
        body: 'ข้อความจำลอง',
        target: '',
        createdUTC: DateTime.utc(2026, 11, 22, 22, 35),
      );

      // Nothing is posted for historical messages when a device first connects.
      await alerts.observeInbox(cashier, [event(3), event(2)], alertNew: true);
      expect(
        await storage.read(key: 'lk_shop_alert_cursor_v1_device-fixture-1'),
        '3',
      );
      await alerts.observeInbox(cashier, [event(3), event(2)], alertNew: true);
      expect(
        await storage.read(key: 'lk_shop_alert_cursor_v1_device-fixture-1'),
        '3',
      );
      await alerts.observeInbox(cashier, [
        event(5),
        event(4),
        event(3),
      ], alertNew: true);
      expect(
        await storage.read(key: 'lk_shop_alert_cursor_v1_device-fixture-1'),
        '5',
      );
      await alerts.forgetDevice(cashier.deviceId);
      expect(
        await storage.read(key: 'lk_shop_alert_cursor_v1_device-fixture-1'),
        isNull,
      );
    },
  );

  test(
    'empty newly paired inbox still notifies when first event arrives',
    () async {
      FlutterSecureStorage.setMockInitialValues({});
      const storage = FlutterSecureStorage();
      final alerts = LKSystemNotices(storage: storage);
      const device = LKConnection(
        server: 'https://penguin-food.web.app',
        credential: 'fixture-only',
        deviceId: 'fresh-device',
        role: 'admin_store',
      );
      await alerts.observeInbox(device, [], alertNew: true);
      expect(
        await storage.read(key: 'lk_shop_alert_cursor_v1_fresh-device'),
        '0',
      );
      await alerts.observeInbox(device, [
        LKMessage(
          id: 1,
          body: 'รายการใหม่',
          target: '',
          createdUTC: DateTime.utc(2026, 11, 22, 22, 35),
        ),
      ], alertNew: true);
      expect(
        await storage.read(key: 'lk_shop_alert_cursor_v1_fresh-device'),
        '1',
      );
    },
  );

  test('notifications are isolated by device cursor', () async {
    FlutterSecureStorage.setMockInitialValues({});
    final storage = const FlutterSecureStorage();
    final alerts = LKSystemNotices(storage: storage);
    const a = LKConnection(
      server: 'https://penguin-food.web.app',
      credential: 'fixture',
      deviceId: 'cashier-fixture',
      role: 'cashier_delivery',
    );
    const b = LKConnection(
      server: 'https://penguin-food.web.app',
      credential: 'fixture',
      deviceId: 'kitchen-fixture',
      role: 'kitchen_delivery',
    );
    final item = LKMessage(
      id: 42,
      body: 'ข้อความจำลอง',
      target: '',
      createdUTC: DateTime.utc(2026, 11, 22, 22, 35),
    );
    await alerts.observeInbox(a, [item]);
    await alerts.observeInbox(b, [item]);
    expect(
      await storage.read(key: 'lk_shop_alert_cursor_v1_cashier-fixture'),
      '42',
    );
    expect(
      await storage.read(key: 'lk_shop_alert_cursor_v1_kitchen-fixture'),
      '42',
    );
    await alerts.forgetDevice(a.deviceId);
    expect(
      await storage.read(key: 'lk_shop_alert_cursor_v1_cashier-fixture'),
      isNull,
    );
    expect(
      await storage.read(key: 'lk_shop_alert_cursor_v1_kitchen-fixture'),
      '42',
    );
  });
}
