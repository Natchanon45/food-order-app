import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:lk_shop/src/lk_api.dart';
import 'package:lk_shop/src/lk_runtime.dart';
import 'package:lk_shop/src/pairing.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const site = LKRuntime.origin;
  const qrSecret =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const credential =
      'abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd';
  const id = 'penguin-native-device-12345678';
  final qr =
      'lkshop://pair?v=1&server=https%3A%2F%2Fpenguin-food.web.app&code=$qrSecret';

  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  test('native room pairing accepts only exact PENGUIN Hosting domain', () {
    final pair = LKPairing.parse(qr);
    expect(pair?.server, site);
    expect(pair?.code, qrSecret);
    expect(LKPairing.fromManualCode(qrSecret)?.server, site);
    for (final invalid in [
      qr.replaceFirst('penguin-food.web.app', 'www.lukkaja.com'),
      qr.replaceFirst('penguin-food.web.app', 'penguin-food.web.app.evil.io'),
      qr.replaceFirst('https%3A', 'http%3A'),
      '$qr&role=superadmin_slip_manual',
      '$qr&code=$qrSecret',
      '$qr#fragment',
      qr.replaceFirst('v=1', 'v=2'),
      qr.replaceFirst(qrSecret, '0' * 63),
    ]) {
      expect(LKPairing.parse(invalid), isNull, reason: invalid);
    }
  });

  test('native REST enroll and role-private inbox, push-token update and unpair have Go-compatible shapes', () async {
    final calls = <http.Request>[];
    final client = MockClient((request) async {
      calls.add(request);
      expect(request.followRedirects, isFalse);
      expect(request.maxRedirects, 0);
      if (request.url.path == '/api/lk-shop/enroll') {
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        expect(request.method, 'POST');
        expect(body.keys.toSet(), {'code', 'name', 'platform', 'fcmToken'});
        expect(body['code'], qrSecret);
        expect(body['name'], 'Kitchen Android');
        expect(body['fcmToken'], '');
        return http.Response(
          jsonEncode({
            'deviceId': id,
            'credential': credential,
            'role': 'kitchen_delivery',
            'scope': 'tenant',
            'pushReady': false,
            'deviceName': 'Kitchen Android',
          }),
          201,
        );
      }
      final authorization = request.headers.entries
          .where((entry) => entry.key.toLowerCase() == 'authorization')
          .map((entry) => entry.value)
          .firstOrNull;
      expect(authorization, 'Bearer $credential');
      switch (request.url.path) {
        case '/api/lk-shop/device':
          return http.Response(
            jsonEncode({
              'connected': true,
              'pushServerConfigured': false,
              'device': {
                'id': id,
                'role': 'kitchen_delivery',
                'scope': 'tenant',
                'pushReady': false,
              },
            }),
            200,
          );
        case '/api/lk-shop/inbox':
          return http.Response(
            jsonEncode({
              'role': 'kitchen_delivery',
              'notifications': [
                {
                  'id': 2,
                  'body': 'ออร์เดอร์ใหม่สำหรับครัว',
                  'target': '$site/kitchen',
                  'createdUTC': '2026-11-23T05:20:00.000Z',
                },
                {
                  'id': 1,
                  'body': 'แจ้งเข้าครัวเบื้องต้น',
                  'target': '$site/kitchen',
                  'createdUTC': '2026-11-23T05:10:00.000Z',
                },
              ],
            }),
            200,
            headers: {'content-type': 'application/json; charset=utf-8'},
          );
        case '/api/lk-shop/device/push-token':
          expect(request.method, 'PUT');
          expect(
            (jsonDecode(request.body) as Map<String, dynamic>)['fcmToken'],
            'fcm-test-token-12345678901234567890:abc',
          );
          return http.Response(jsonEncode({'pushReady': true}), 200);
        case '/api/lk-shop/device/unpair':
          expect(request.method, 'POST');
          return http.Response(jsonEncode({'revoked': true}), 200);
      }
      return http.Response('{}', 404);
    });
    final storage = const FlutterSecureStorage();
    final api = LKApi(client: client, storage: storage);
    final connection = await api.enroll(site, qrSecret, '', 'Kitchen Android');
    expect(connection.server, site);
    expect(connection.credential, credential);
    expect(connection.role, 'kitchen_delivery');
    expect(connection.deviceId, id);
    expect((await storage.read(key: LKApi.key)), contains(credential));
    expect((await api.status())['device']['role'], 'kitchen_delivery');
    final inbox = await api.inbox();
    expect(inbox.length, 2);
    expect(inbox.map((e) => e.id).toList(), [2, 1]);
    expect(inbox.first.target, '$site/kitchen');
    await api.updatePushToken('fcm-test-token-12345678901234567890:abc');
    await api.unpair();
    expect(api.current, isNull);
    expect(await storage.read(key: LKApi.key), isNull);
    expect(calls.map((e) => e.url.host).toSet(), {'penguin-food.web.app'});
    expect(calls.map((e) => e.url.path).toList(), [
      '/api/lk-shop/enroll',
      '/api/lk-shop/device',
      '/api/lk-shop/inbox',
      '/api/lk-shop/device/push-token',
      '/api/lk-shop/device/unpair',
    ]);
    client.close();
  });

  test('forged role, unknown native device or invalid bearer never persist credentials', () async {
    final storage = const FlutterSecureStorage();
    for (final bad in [
      {'credential': credential, 'role': 'owner', 'scope': 'tenant'},
      {'credential': 'abc', 'role': 'kitchen_delivery', 'scope': 'tenant'},
      {
        'credential': credential,
        'role': 'kitchen_delivery',
        'scope': 'platform',
      },
    ]) {
      final client = MockClient(
        (_) async => http.Response(
          jsonEncode({'deviceId': id, 'pushReady': true, ...bad}),
          201,
        ),
      );
      final api = LKApi(client: client, storage: storage);
      await expectLater(
        api.enroll(site, qrSecret, '', 'Kitchen Android'),
        throwsA(isA<LKApiException>()),
      );
      expect(api.current, isNull);
      expect(await storage.read(key: LKApi.key), isNull);
      client.close();
    }
  });

  test('restore drops Source, malformed bearer and revoked capability, without leaking', () async {
    final storage = const FlutterSecureStorage();
    for (final payload in [
      {
        'server': 'https://www.lukkaja.com',
        'credential': credential,
        'deviceId': id,
        'role': 'kitchen_delivery',
      },
      {
        'server': site,
        'credential': credential,
        'deviceId': id,
        'role': 'super_admin',
      },
      {
        'server': site,
        'credential': 'NOT_A_BEARER',
        'deviceId': id,
        'role': 'admin_store',
      },
    ]) {
      await storage.write(key: LKApi.key, value: jsonEncode(payload));
      final api = LKApi(storage: storage);
      await api.restore();
      expect(api.current, isNull);
      expect(await storage.read(key: LKApi.key), isNull);
    }
    await storage.write(
      key: LKApi.key,
      value: jsonEncode({
        'server': site,
        'credential': credential,
        'deviceId': id,
        'role': 'kitchen_delivery',
      }),
    );
    final api = LKApi(storage: storage);
    await api.restore();
    expect(api.current?.deviceId, id);
    expect(api.current?.role, 'kitchen_delivery');
  });

  test(
    'server expiry and revoked bearer convert to safe user messages',
    () async {
      final storage = const FlutterSecureStorage();
      final expired = LKApi(
        client: MockClient(
          (_) async => http.Response(
            jsonEncode({'error': 'LK_SHOP_QR_EXPIRED_OR_USED'}),
            410,
          ),
        ),
        storage: storage,
      );
      await expectLater(
        expired.enroll(site, qrSecret, '', 'Phone'),
        throwsA(
          predicate(
            (e) => e is LKApiException && e.message.contains('QR หมดอายุ'),
          ),
        ),
      );

      final client = MockClient(
        (_) async =>
            http.Response(jsonEncode({'error': 'LK_SHOP_UNPAIRED'}), 401),
      );
      await storage.write(
        key: LKApi.key,
        value: jsonEncode({
          'server': site,
          'credential': credential,
          'deviceId': id,
          'role': 'kitchen_delivery',
        }),
      );
      final revoked = LKApi(client: client, storage: storage);
      await revoked.restore();
      await expectLater(
        revoked.status(),
        throwsA(
          predicate(
            (e) => e is LKApiException && e.message.contains('ถูกยกเลิกสิทธิ์'),
          ),
        ),
      );
    },
  );

  test(
    'HTTP redirect cannot forward the bearer to an untrusted host',
    () async {
      final calls = <Uri>[];
      final client = MockClient((request) async {
        calls.add(request.url);
        expect(request.followRedirects, isFalse);
        expect(request.maxRedirects, 0);
        return http.Response(
          '',
          307,
          headers: {'location': 'https://evil.example/collect-bearer'},
        );
      });
      final storage = const FlutterSecureStorage();
      await storage.write(
        key: LKApi.key,
        value: jsonEncode({
          'server': site,
          'credential': credential,
          'deviceId': id,
          'role': 'cashier_delivery',
        }),
      );
      final api = LKApi(client: client, storage: storage);
      await api.restore();
      await expectLater(api.status(), throwsA(isA<LKApiException>()));
      expect(calls.length, 1);
      expect(calls.single.host, 'penguin-food.web.app');
      client.close();
    },
  );

  test('native website actions are restricted to this device role and PENGUIN origin', () {
    final expected = {
      'superadmin_slip_manual': '$site/admin/tenants',
      'admin_store': '$site/admin',
      'cashier_delivery': '$site/cashier',
      'kitchen_delivery': '$site/kitchen',
    };
    for (final item in expected.entries) {
      expect(LKRuntime.allowedTarget(item.value, item.key), true);
      for (final other in expected.values.where((v) => v != item.value)) {
        expect(LKRuntime.allowedTarget(other, item.key), false);
      }
      for (final invalid in [
        item.value.replaceFirst('penguin-food.web.app', 'www.lukkaja.com'),
        item.value.replaceFirst(
          'penguin-food.web.app',
          'penguin-food.web.app.evil.example',
        ),
        item.value.replaceFirst('https', 'http'),
        '${item.value}#fragment',
        '${item.value}?redirect=https://evil.example',
        item.value.replaceFirst(
          Uri.parse(item.value).path,
          '${Uri.parse(item.value).path}/../${Uri.parse(item.value).pathSegments.last}',
        ),
      ]) {
        expect(
          LKRuntime.allowedTarget(invalid, item.key),
          false,
          reason: '${item.key} $invalid',
        );
      }
    }
    expect(LKRuntime.nativeFirebaseConfigured, isFalse);
    expect(LKRuntime.firebaseProjectId, 'chat-45754');
  });
}
