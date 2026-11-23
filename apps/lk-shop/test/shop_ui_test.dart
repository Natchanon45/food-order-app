import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lk_shop/src/lk_api.dart';
import 'package:lk_shop/src/lk_shop_ui.dart';

Widget appWithFooter({required Widget home}) => MaterialApp(
  builder: (context, child) => Column(
    children: [
      Expanded(child: child ?? const SizedBox.shrink()),
      const LKVersionFooter(version: '1.0.3', buildNumber: '4'),
    ],
  ),
  home: home,
);

void main() {
  test('message categories correspond to actual event topics', () {
    expect(lkMessageTitle('คำสั่งซื้อใหม่ #B261123-00001'), 'คำสั่งซื้อใหม่');
    expect(lkMessageTitle('แจ้งชำระเงินแล้ว 689.00 บาท'), 'รายการชำระเงิน');
    expect(lkMessageTitle('ขอเติมเครดิตจัดส่ง 1000 บาท'), 'เครดิตจัดส่ง');
    expect(lkMessageTitle('ชำระค่าบริการแพลตฟอร์ม'), 'ค่าบริการแพลตฟอร์ม');
    expect(lkMessageTitle('สรุปส่วนแบ่งรายวัน'), 'สรุปส่วนแบ่งรายวัน');
    expect(
      lkMessageTitle('คำสั่งซื้อใหม่ Lalamove ชำระปลายทาง'),
      'คำสั่งซื้อใหม่',
    );
  });

  test('server UTC is displayed in Bangkok time with Thai date format', () {
    // Record generated at 05:35 Thailand time is 22:35 UTC the previous day.
    expect(lkMessageClock(DateTime.utc(2026, 11, 22, 22, 35)), '05:35');
    expect(
      lkMessageDateTime(DateTime.utc(2026, 11, 22, 22, 35)),
      '23/11/2569 • 05:35 น. (เวลาไทย)',
    );
    expect(
      lkMessageDateTime(DateTime.utc(2026, 12, 31, 19, 10)),
      '01/01/2570 • 02:10 น. (เวลาไทย)',
    );
  });

  testWidgets('app version and build are visible in pairing landing', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });
    bool scanned = false;
    bool manualPair = false;
    await tester.pumpWidget(
      appWithFooter(
        home: Scaffold(
          body: LKShopLanding(
            deviceName: 'Android ร้านค้า',
            busy: false,
            onNameChanged: (_) {},
            onScan: () => scanned = true,
            onManualPair: () => manualPair = true,
          ),
        ),
      ),
    );
    expect(find.text('LK Shop'), findsOneWidget);
    expect(find.textContaining('Version 1.0.3'), findsOneWidget);
    expect(find.byType(LKShopLogo), findsOneWidget);
    final subtitle = find.text(
      'รับแจ้งเตือนคำสั่งซื้อ การชำระเงินและรายการสำคัญ',
    );
    expect(subtitle, findsOneWidget);
    expect(tester.widget<Text>(subtitle).maxLines, 1);
    await tester.ensureVisible(find.text('ชื่ออุปกรณ์').first);
    await tester.tap(find.text('ชื่ออุปกรณ์').first);
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('lk-device-name-legend')), findsOneWidget);
    expect(
      tester.widget<Text>(find.byKey(const Key('lk-device-name-legend'))).data,
      'ชื่ออุปกรณ์',
    );
    await tester.ensureVisible(find.text('สแกน QR'));
    await tester.tap(find.text('สแกน QR'));
    expect(scanned, true);
    await tester.ensureVisible(
      find.byKey(const Key('lk-shop-manual-pair-button')),
    );
    await tester.tap(find.byKey(const Key('lk-shop-manual-pair-button')));
    expect(manualPair, true);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'notification list opens a selected message without changing it',
    (tester) async {
      final message = LKMessage(
        id: 5,
        body: 'คำสั่งซื้อใหม่\nเลขที่บิล B261123-00001',
        target: 'https://penguin-food.web.app/kitchen?orderId=123',
        createdUTC: DateTime.utc(2026, 11, 23, 2, 10),
      );
      LKMessage? selected;
      await tester.pumpWidget(
        appWithFooter(
          home: Scaffold(
            body: LKNotificationFeed(
              messages: [message],
              onSelect: (value) => selected = value,
              search: false,
              searchQuery: '',
              onSearchChanged: (_) {},
              refreshing: false,
              onRefresh: () async {},
            ),
          ),
        ),
      );
      expect(find.text('คำสั่งซื้อใหม่'), findsOneWidget);
      expect(find.textContaining('Version 1.0.3'), findsOneWidget);
      await tester.tap(find.text('คำสั่งซื้อใหม่'));
      expect(selected?.id, 5);
      expect(selected?.body, message.body);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('detail view opens only on pressing the web action', (
    tester,
  ) async {
    const url = 'https://penguin-food.web.app/admin';
    final message = LKMessage(
      id: 8,
      body: 'คำขอเติมเครดิตจัดส่ง\nLalamove 1,000.00 บาท',
      target: url,
      createdUTC: DateTime.utc(2026, 11, 23, 2, 10),
    );
    String? opened;
    await tester.pumpWidget(
      appWithFooter(
        home: LKMessageDetailPage(
          message: message,
          onOpen: (value) => opened = value,
        ),
      ),
    );
    expect(find.text(message.body), findsOneWidget);
    expect(opened, isNull);
    await tester.tap(find.text('เปิดในระบบ'));
    expect(opened, url);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'iPhone settings and notification feedback never refer to Android',
    (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });
      var tested = false;
      var settingsOpened = false;
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(platform: TargetPlatform.iOS),
          home: LKConnectionPage(
            roomName: 'แจ้งเตือนส่วนกลาง',
            pushReady: false,
            onUnpair: () async => false,
            onTestNotification: () async {
              tested = true;
              return true;
            },
            onOpenNotificationSettings: () async {
              settingsOpened = true;
              return true;
            },
          ),
        ),
      );
      expect(
        find.text('ตั้งค่าเสียง / การแจ้งเตือนของ iPhone'),
        findsOneWidget,
      );
      expect(
        find.text('ทดสอบเสียง / ป้ายแจ้งเตือน / แบนเนอร์'),
        findsOneWidget,
      );
      expect(find.textContaining('Android'), findsNothing);
      await tester.tap(find.text('ทดสอบเสียง / ป้ายแจ้งเตือน / แบนเนอร์'));
      await tester.pump();
      expect(tested, isTrue);
      expect(
        find.textContaining('ตรวจสอบเสียงและการแจ้งเตือนบน iPhone'),
        findsOneWidget,
      );
      expect(find.textContaining('Android'), findsNothing);
      await tester.tap(find.text('ตั้งค่าเสียง / การแจ้งเตือนของ iPhone'));
      await tester.pump();
      expect(settingsOpened, isTrue);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('Android settings retain Android-specific options', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData(platform: TargetPlatform.android),
        home: LKConnectionPage(
          roomName: 'แคชเชียร์',
          pushReady: true,
          pushServerConfigured: true,
          onUnpair: () async => false,
          onTestNotification: () async => true,
          onOpenNotificationSettings: () async => true,
        ),
      ),
    );
    expect(
      find.text('ตั้งค่าอนุญาตเสียง / จุดแจ้งเตือนของ Android'),
      findsOneWidget,
    );
    expect(find.text('ทดสอบเสียง / Badge / การแจ้งเตือน'), findsOneWidget);
    expect(find.textContaining('iPhone'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('connection status shows role and installed version', (
    tester,
  ) async {
    await tester.pumpWidget(
      appWithFooter(
        home: LKConnectionPage(
          roomName: 'แคชเชียร์',
          pushReady: false,
          onUnpair: () async => false,
        ),
      ),
    );
    expect(find.text('ประเภท: แคชเชียร์'), findsOneWidget);
    expect(find.textContaining('Version 1.0.3'), findsOneWidget);
    expect(find.textContaining('ยังไม่ได้ลงทะเบียน FCM'), findsOneWidget);
  });
}
